import React, { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
    TodayCollection,
    DailyReport,
    MonthlyReport,
    ClassWiseReport,
    InstallmentWiseReport,
    DueReport,
    LateFeeDueReport,
    SearchStudentReport
} from './FeeReportComponents';
import FeeReceipt from './FeeReceipt';
import api from '../api';
import { notify } from './ui/feedback';
import { LoadingState } from './ui';
import { consumeIntent } from '../utils/intent';
import { FEE_REPORTS, type FeeReportId } from './fee-reports/reportCatalog';

const FeeReports: React.FC = () => {
    // Opens on the list of reports; a shortcut may open one report directly.
    const [activeTab, setActiveTab] = useState<FeeReportId | null>(() => {
        const view = consumeIntent('fee-reports');
        return FEE_REPORTS.some(r => r.id === view) ? (view as FeeReportId) : null;
    });
    const openReport = (id: FeeReportId | null) => {
        setActiveTab(id);
        window.scrollTo({ top: 0 });
    };
    const [receiptData, setReceiptData] = useState<any>(null);
    const [loadingReceipt, setLoadingReceipt] = useState(false);
    const [, setError] = useState('');

    const handleViewReceipt = async (receiptNo: string) => {
        try {
            setLoadingReceipt(true);
            setError('');

            // 1. Fetch the raw receipt data (flat list of payments)
            const res = await api.get(`/reports/fees/receipt/${receiptNo}`);
            const payments = res.data.items || [];

            if (payments.length === 0) {
                notify("This receipt has no items.");
                return;
            }

            const studentId = payments[0].student_id;

            // 2. Fetch Student Installments to get SR mapping (Critical for grouping)
            // We need this to know that "April Fee" is SR 1, "May Fee" is SR 2, etc.
            let installments = [];
            try {
                // Determine branch from local storage or cached student data if possible. 
                // For reports, we might not know the student's current branch easily if they transferred.
                // However, the payment record has branch info.
                const branch = payments[0].branch || 'All';
                const branchParam = branch === "All Branches" || branch === "All" ? "All" : branch;

                const instRes = await api.get(`/fees/student-details/${studentId}?branch=${branchParam}`);
                installments = instRes.data.installments || [];
            } catch (instErr) {
                console.error("Failed to fetch student installments for grouping:", instErr);
                // Fallback: Code will run with SR=0 and result in individual lines (safe degradation)
            }

            // 3. Enrich Payments with SR
            const enrichedPayments = payments.map((p: any) => {
                // Match by title (flexible match for "March" vs "March Fee")
                const match = installments.find((i: any) => i.title === p.installment || i.title === `${p.installment} Fee`);
                const paid = parseFloat(p.amount_paid || 0);
                const due = parseFloat(p.due_amount || 0);
                const concession = parseFloat(p.concession_amount || 0);
                const gross = parseFloat(p.previous_due || 0) || (paid + due + concession) || parseFloat(p.gross_amount || 0);
                return {
                    ...p,
                    sr: match ? match.sr : 0,
                    amount: gross,
                    gross_amount: gross,
                    amount_paid: paid,
                    paid: paid,
                    due_amount: due,
                    due: due,
                    concession_amount: concession,
                    concession: concession
                };
            });

            // 4. Group Items
            const groupedItems = groupInstallments(enrichedPayments);

            // 5. Calculate Totals based on the raw payments to ensure accuracy
            const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount_paid || 0), 0);
            const totalConcession = payments.reduce((sum: number, p: any) => sum + parseFloat(p.concession_amount || 0), 0);
            const totalDue = payments.reduce((sum: number, p: any) => sum + parseFloat(p.due_amount || 0), 0);
            const totalGross = payments.reduce(
                (sum: number, p: any) =>
                    sum +
                    (parseFloat(p.previous_due || 0) ||
                        parseFloat(p.amount_paid || 0) +
                            parseFloat(p.due_amount || 0) +
                            parseFloat(p.concession_amount || 0) ||
                        parseFloat(p.gross_amount || 0)),
                0
            );

            // 6. Construct Receipt Data object
            const formattedData = {
                studentName: res.data.studentName || payments[0]?.name, // Prefer API root property
                fatherName: res.data.fatherName || payments[0]?.fatherName,
                fatherPhone: res.data.fatherPhone || payments[0]?.fatherPhone,
                admissionNo: res.data.admissionNo || payments[0]?.admNo,
                branch: res.data.branch || payments[0]?.branch,
                className: res.data.className || payments[0]?.class,
                receiptNo: receiptNo,
                paymentDate: res.data.paymentDate || payments[0]?.payment_date,
                paymentMode: res.data.paymentMode || payments[0]?.mode,
                paymentNote: res.data.paymentNote || "",
                items: groupedItems.map((g) => ({
                    title: g.title,
                    amount: g.amount,
                    payable: g.amount,
                    amount_paid: g.amount_paid !== undefined ? g.amount_paid : g.paid || 0,
                    paid: g.amount_paid !== undefined ? g.amount_paid : g.paid || 0,
                    due_amount: g.due_amount !== undefined ? g.due_amount : g.due || 0,
                    due: g.due_amount !== undefined ? g.due_amount : g.due || 0
                })),
                amount: totalGross,
                concession: totalConcession,
                payable: totalGross - totalConcession,
                paid: totalPaid,
                due: totalDue
            };

            setReceiptData(formattedData);
        } catch (err: any) {
            console.error(err);
            notify.error(err.response?.data?.error || 'Could not open the receipt. Please try again.');
        } finally {
            setLoadingReceipt(false);
        }
    };

    const active = FEE_REPORTS.find(r => r.id === activeTab) || null;

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            {!active ? (
                <>
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Fee reports</h2>
                        <p className="text-sm text-slate-500">Choose the report you want to see.</p>
                    </div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {FEE_REPORTS.map(r => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => openReport(r.id)}
                                    className="w-full text-left card px-4 py-3.5 min-h-[64px] flex items-center gap-3 hover:border-brand-300 active:bg-slate-50 transition-colors"
                                >
                                    <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{r.icon}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-semibold text-slate-900">{r.title}</span>
                                        <span className="block text-sm text-slate-500">{r.description}</span>
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <>
                    <div className="mb-4 flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => openReport(null)}
                            className="btn-secondary btn-sm min-h-[44px] flex-shrink-0"
                            aria-label="Back to all reports"
                        >
                            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">All reports</span>
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-slate-900 leading-snug">{active.title}</h2>
                            <p className="text-sm text-slate-500">{active.description}</p>
                        </div>
                    </div>

                    {activeTab === 'today' && <TodayCollection onViewReceipt={handleViewReceipt} />}
                    {activeTab === 'daily' && <DailyReport onViewReceipt={handleViewReceipt} />}
                    {activeTab === 'monthly' && <MonthlyReport onViewReceipt={handleViewReceipt} />}
                    {activeTab === 'class' && <ClassWiseReport onViewReceipt={handleViewReceipt} />}
                    {activeTab === 'installment' && <InstallmentWiseReport onViewReceipt={handleViewReceipt} />}
                    {activeTab === 'due' && <DueReport />}
                    {activeTab === 'late-due' && <LateFeeDueReport />}
                    {activeTab === 'search' && <SearchStudentReport onViewReceipt={handleViewReceipt} />}
                </>
            )}

            {/* Receipt Modal */}
            {loadingReceipt && (
                <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-center z-50">
                    <div className="card px-8"><LoadingState label="Opening receipt…" /></div>
                </div>
            )}

            {receiptData && (
                <FeeReceipt
                    receiptData={receiptData}
                    onClose={() => setReceiptData(null)}
                />
            )}
        </div>
    );
};

// --- Helper Functions (Duplicated from TakeFee.tsx for consistency) ---

const groupInstallments = (items: any[]) => {
    const installmentFees = items.filter(i => i.installment && i.installment !== "One-Time" && i.installment !== "None");
    const otherFees = items.filter(i => !i.installment || i.installment === "One-Time" || i.installment === "None");

    const groups: any[] = [];
    const byType: Record<string, any[]> = {};

    installmentFees.forEach(i => {
        const type = i.fee_type || "Tuition Fee";
        if (!byType[type]) byType[type] = [];
        byType[type].push(i);
    });

    Object.keys(byType).forEach(type => {
        // Sort by sr
        const sorted = byType[type].sort((a, b) => (a.sr || 0) - (b.sr || 0));
        if (sorted.length === 0) return;

        let currentGroup = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const prev = currentGroup[currentGroup.length - 1];
            const curr = sorted[i];
            const prevSr = prev.sr || 0;
            const currSr = curr.sr || 0;

            if (prevSr > 0 && currSr > 0 && currSr === prevSr + 1) {
                currentGroup.push(curr);
            } else {
                groups.push(createGroupedItem(type, currentGroup));
                currentGroup = [curr];
            }
        }
        if (currentGroup.length > 0) {
            groups.push(createGroupedItem(type, currentGroup));
        }
    });

    otherFees.forEach(f => {
        const paid = parseFloat(f.amount_paid || f.paid || 0);
        const due = parseFloat(f.due_amount || f.due || 0);
        const concession = parseFloat(f.concession_amount || f.concession || 0);
        const gross = parseFloat(f.gross_amount || f.amount || 0) || (paid + due + concession);
        groups.push({
            title: f.fee_type === "General" ? "One-Time Fee" : f.fee_type,
            amount: gross,
            amount_paid: paid,
            paid: paid,
            concession: concession,
            payable: gross,
            due_amount: due,
            due: due,
            originalItems: [f]
        });
    });

    return groups;
};

const createGroupedItem = (type: string, items: any[]) => {
    const start = (items[0].installment || items[0].title || "").replace(" Fee", "");
    const end = (items[items.length - 1].installment || items[items.length - 1].title || "").replace(" Fee", "");

    let title = `${type} - ${start} Fee`;
    if (items.length > 1) {
        title = `Payment for ${start} Fee to ${end} Fee`;
    }

    const totalPaid = items.reduce((sum: number, i: any) => sum + parseFloat(i.amount_paid || i.paid || 0), 0);
    const totalConcession = items.reduce((sum: number, i: any) => sum + parseFloat(i.concession_amount || i.concession || 0), 0);
    const totalDue = items.reduce((sum: number, i: any) => sum + parseFloat(i.due_amount || i.due || 0), 0);
    const totalGross = items.reduce((sum: number, i: any) => sum + parseFloat(i.gross_amount || i.amount || 0), 0) || (totalPaid + totalDue + totalConcession);

    return {
        title,
        amount: totalGross,
        amount_paid: totalPaid,
        paid: totalPaid,
        concession: totalConcession,
        payable: totalGross,
        due_amount: totalDue,
        due: totalDue,
        originalItems: items
    };
};

export default FeeReports;
