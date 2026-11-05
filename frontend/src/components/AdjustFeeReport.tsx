import React, { useState } from 'react';
import FeeReceipt from './FeeReceipt';
import api from '../api';
import { notify } from './ui/feedback';
import { EmptyState, LoadingState } from './ui';

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

const AdjustFeeReport: React.FC = () => {
    const [receiptData, setReceiptData] = useState<any>(null);
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    const handleViewReceipt = async (receiptNo: string) => {
        try {
            setLoadingReceipt(true);
            const res = await api.get(`/reports/fees/receipt/${receiptNo}`);
            const payments = res.data.items || [];
            if (payments.length === 0) {
                notify("No items found in this receipt.");
                return;
            }

            const studentId = payments[0].student_id;
            let installments = [];
            try {
                const branch = payments[0].branch || 'All';
                const branchParam = branch === "All Branches" || branch === "All" ? "All" : branch;
                const instRes = await api.get(`/fees/student-details/${studentId}?branch=${branchParam}`);
                installments = instRes.data.installments || [];
            } catch (instErr) {
                console.error("Failed to fetch student installments for grouping:", instErr);
            }

            const enrichedPayments = payments.map((p: any) => {
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

            const groupedItems = groupInstallments(enrichedPayments);

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

            const formattedData = {
                studentName: res.data.studentName || payments[0]?.name,
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
            notify(err.response?.data?.error || 'Failed to load receipt');
        } finally {
            setLoadingReceipt(false);
        }
    };
    // Receipt drill-down is not wired into this report yet; keep the handler for when adjustment rows land.
    void handleViewReceipt;

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Fee adjustments</h2>
                <p className="text-sm text-slate-500">Changes made to students' fees after they were set.</p>
            </div>

            <div className="card">
                <EmptyState
                    title="Nothing to show yet"
                    description="Fee adjustment records will appear here once this report is connected."
                />
            </div>

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

export default AdjustFeeReport;
