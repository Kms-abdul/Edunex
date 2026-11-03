import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { hasPermission } from '../utils/permissions';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { notify } from './ui/feedback';
import { Alert, Button, DataList, EmptyState, Field, LoadingState } from './ui';
import type { Column } from './ui';
import DueReportView from './fee-reports/DueReportView';
import { Pager, CardField, joinSummary, currentBranchLabel, FilterCard, SelectField, StatGrid, StatTile, ExportButtons, ResultsBar, niceDate } from './fee-reports/ReportKit';

// Types 
export interface Receipt {
    receipt_no: string;
    student_name: string;
    admission_no?: string;
    class?: string;
    section?: string;
    branch?: string;
    amount: number;
    amount_paid?: number;
    due_amount?: number;
    gross_amount?: number;
    concession?: number;
    net_payable?: number;
    mode?: string;
    fee_type_str?: string;
    note?: string;
    collected_by?: string;
    date?: string;
    time?: string;
    transaction_id?: string;
}

interface ReportProps {
    onViewReceipt: (receiptNo: string) => void;
    forcedStatus?: 'A' | 'I' | 'All';
    forcedConcession?: boolean;
}
// --------------------------------------------------------------------------
// Date Formatting Helper
// --------------------------------------------------------------------------
const formatDateDDMMYYYY = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '-';

    try {
        // Handle if already in DD-MM-YYYY format
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
            return dateStr;
        }

        // Handle YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            const datePart = dateStr.split('T')[0]; // Remove time part if present
            const [year, month, day] = datePart.split('-');
            return `${day}-${month}-${year}`;
        }

        // Handle other formats via Date object
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        }

        return dateStr; // Return as-is if can't parse
    } catch {
        return dateStr || '-';
    }
};
// --------------------------------------------------------------------------
// Shared Components (building blocks live in ./fee-reports/ReportKit)
// --------------------------------------------------------------------------

const Pagination = Pager;

const PAYMENT_MODE_LABEL = (m: string) => (m === 'All' ? 'All payment modes' : m);
const classOptions = (list: string[]) => list.map(c => ({ value: c, label: c === 'All' ? 'All classes' : c }));
const sectionOptions = (list: string[]) => list.map(s => ({ value: s, label: s === 'All' ? 'All sections' : s }));
const modeOptions = (list: string[]) => list.map(m => ({ value: m, label: PAYMENT_MODE_LABEL(m) }));
const feeTypeOptions = (types: any[]) => [{ value: 'All', label: 'All fees' }, ...types.map(ft => ({ value: ft.fee_type, label: ft.fee_type }))];

/** The class / section / fee / mode part of a summary line, e.g. "Class 5 A · Tuition Fee · Cash". */
const filterSummary = (f: { cls?: string; section?: string; feeType?: string; mode?: string }) =>
    joinSummary(
        f.cls && f.cls !== 'All' ? `Class ${f.cls}${f.section && f.section !== 'All' ? ` ${f.section}` : ''}` : 'All classes',
        f.feeType,
        f.mode,
        currentBranchLabel()
    );

// HOOK: Dynamic Sections based on Class
const useClassSections = (selectedClass: string) => {
    const [sections, setSections] = useState<string[]>(['All']);

    useEffect(() => {
        if (!selectedClass || selectedClass === 'All') {
            setSections(['All']);
            return;
        }

        const fetchSections = async () => {
            try {
                const res = await api.get(`/sections?class=${selectedClass}`);
                const secs = res.data.sections || [];
                setSections(['All', ...secs]);
            } catch (err) {
                console.error("Failed to fetch sections", err);
                setSections(['All']);
            }
        };
        fetchSections();
    }, [selectedClass]);

    return sections;
};

// Logic Helpers
// Logic Helpers
const filterData = (data: any[], filters: any) => {
    if (!data) return [];
    const filtered = data.filter(r => {
        if (filters.class && filters.class !== 'All' && r.class !== filters.class) return false;
        if (filters.section && filters.section !== 'All' && r.section !== filters.section) return false;
        if (filters.feeType && filters.feeType !== 'All' && !r.fee_type_str?.includes(filters.feeType)) return false;
        if (filters.mode && filters.mode !== 'All' && r.mode !== filters.mode) return false;
        if (filters.collector && filters.collector !== 'All' && r.collected_by !== filters.collector) return false;
        return true;
    });
    if (filters.feeType && filters.feeType !== 'All') {
        return filtered.map(r => {
            if (!r.line_items || !Array.isArray(r.line_items)) return r;

            const matchingItems = r.line_items.filter((item: any) => item.fee_type_str?.includes(filters.feeType));
            if (matchingItems.length === 0) return r; // Fallback

            const newAmountPaid = matchingItems.reduce((sum: number, item: any) => sum + (Number(item.amount_paid) || 0), 0);
            const newGross = matchingItems.reduce((sum: number, item: any) => sum + (Number(item.gross_amount) || 0), 0);
            const newConcession = matchingItems.reduce((sum: number, item: any) => sum + (Number(item.concession) || 0), 0);
            const newDue = matchingItems.reduce((sum: number, item: any) => sum + (Number(item.due_amount) || 0), 0);
            const newNet = matchingItems.reduce((sum: number, item: any) => sum + (Number(item.net_payable) || 0), 0);

            const uniqueFeeTypes = Array.from(new Set(matchingItems.map((item: any) => item.fee_type_str))).join(", ");

            return {
                ...r,
                amount_paid: newAmountPaid,
                amount: newAmountPaid,
                gross_amount: newGross,
                concession: newConcession,
                due_amount: newDue,
                net_payable: newNet,
                fee_type_str: uniqueFeeTypes
            };
        });
    }

    return filtered;
};


const calculateSummary = (receipts: any[]) => {
    const total = receipts.reduce((sum, r) => sum + Number(r.amount_paid || r.amount || 0), 0);
    const modeMap: Record<string, number> = {};
    const modeCount: Record<string, number> = {};
    const userMap: Record<string, { user: string, count: number, amount: number, branch: string }> = {};

    let cashTransactionsCount = 0;
    let digitalTransactionsCount = 0;

    receipts.forEach(r => {
        const amt = Number(r.amount_paid || r.amount || 0);
        const m = r.mode || 'Unknown';
        modeMap[m] = (modeMap[m] || 0) + amt;
        modeCount[m] = (modeCount[m] || 0) + 1;

        if (m.toLowerCase() === 'cash') {
            cashTransactionsCount++;
        } else if (['upi', 'card', 'bank transfer', 'online'].includes(m.toLowerCase())) {
            digitalTransactionsCount++;
        }

        const u = r.collected_by || 'Unknown';
        const b = r.branch || '-';
        const key = `${u}|${b}`;

        if (!userMap[key]) {
            userMap[key] = { user: u, count: 0, amount: 0, branch: b };
        }
        userMap[key].count += 1;
        userMap[key].amount += amt;
    });

    const collectedBySummary = Object.values(userMap);
    return { total, modeMap, modeCount, cashTransactionsCount, digitalTransactionsCount, collectedBySummary };
};

const SummaryTables = ({ modeSummary, collectedBySummary, totalCollection }: {
    modeSummary: Record<string, number>;
    collectedBySummary: any[];
    totalCollection: number;
}) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By payment mode */}
        <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
                <h4 className="text-base font-semibold text-slate-900">By payment mode</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs font-medium text-slate-500">
                        <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left">Payment mode</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {Object.entries(modeSummary || {}).map(([mode, amt]: any) => (
                            <tr key={mode}>
                                <td className="px-4 py-3 font-medium text-slate-700">{mode}</td>
                                <td className="px-4 py-3 text-right text-slate-700">₹{Number(amt).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-800">Total</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">₹{totalCollection.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* By person who collected */}
        <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
                <h4 className="text-base font-semibold text-slate-900">By person who collected</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs font-medium text-slate-500">
                        <tr className="border-b border-slate-100">
                            <th className="px-4 py-2.5 text-left">Collected by</th>
                            <th className="px-4 py-2.5 text-left">Branch</th>
                            <th className="px-4 py-2.5 text-center">Receipts</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {Array.isArray(collectedBySummary) && collectedBySummary.map((row: any, idx: number) => (
                            <tr key={idx}>
                                <td className="px-4 py-3 font-medium text-slate-700">{row.user}</td>
                                <td className="px-4 py-3 text-slate-600">{row.branch}</td>
                                <td className="px-4 py-3 text-center text-slate-600">
                                    <span className="badge-neutral">{row.count}</span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700">₹{Number(row.amount).toLocaleString()}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50">
                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-800">Total</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 text-base">₹{totalCollection.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

/** Transaction / cheque details for one receipt row. */
const paymentRef = (r: any) =>
    r.mode === 'Cheque'
        ? [r.cheque_no, r.bank_name, r.cheque_date].filter(Boolean).join(' · ') || '-'
        : (r.transaction_id || '-');

// Receipts list: cards on phones, the full table on wide screens
const FullReceiptsTable: React.FC<{
    receipts: any[];
    onViewReceipt: (id: string) => void;
    showAllColumns?: boolean;
}> = ({ receipts, onViewReceipt, showAllColumns = true }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;

    // Reset page when receipts change
    useEffect(() => {
        setCurrentPage(1);
    }, [receipts]);

    if (!receipts || receipts.length === 0) {
        return (
            <div className="card">
                <EmptyState compact title="No fee collected for this choice" description="Try changing the filters." />
            </div>
        );
    }

    const totalPages = Math.ceil(receipts.length / rowsPerPage);
    const currentReceipts = receipts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    return (
        <div className="card overflow-hidden">
            {/* Phone: cards */}
            <ul className="md:hidden divide-y divide-slate-100">
                {currentReceipts.map((r: any, idx: number) => (
                    <li key={idx} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[15px] font-semibold text-slate-900 break-words">{r.student_name}</p>
                                <p className="text-sm text-slate-500 break-words">
                                    {[`${r.class || ''} ${r.section || ''}`.trim(), r.admission_no && `Adm ${r.admission_no}`].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <p className="text-base font-bold text-slate-900 whitespace-nowrap">₹{(r.amount_paid || r.amount || 0).toLocaleString()}</p>
                        </div>
                        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            <CardField label="Receipt number">{r.receipt_no}</CardField>
                            <CardField label="Date">{r.date} {r.time}</CardField>
                            <CardField label="Paid by">{r.mode || '-'}</CardField>
                            <CardField label="Collected by">{r.collected_by || '-'}</CardField>
                            {Number(r.due_amount || 0) > 0 && <CardField label="Still due"><span className="text-red-600">₹{(r.due_amount || 0).toLocaleString()}</span></CardField>}
                            {showAllColumns && Number(r.concession || 0) > 0 && <CardField label="Concession">₹{(r.concession || 0).toLocaleString()}</CardField>}
                            {r.mode !== 'Cash' && paymentRef(r) !== '-' && <CardField label={r.mode === 'Cheque' ? 'Cheque' : 'Transaction ID'} className="col-span-2">{paymentRef(r)}</CardField>}
                            {showAllColumns && r.fee_type_str && <CardField label="Fee" className="col-span-2">{r.fee_type_str}</CardField>}
                            {showAllColumns && r.note && <CardField label="Note" className="col-span-2">{r.note}</CardField>}
                        </dl>
                        <button type="button" onClick={() => onViewReceipt(r.receipt_no)} className="btn-soft btn-sm w-full min-h-[44px] mt-3">
                            View receipt
                        </button>
                    </li>
                ))}
            </ul>

            {/* Wide screens: full table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-left">No.</th>
                            <th className="px-3 py-2 text-left">Student</th>
                            <th className="px-3 py-2 text-left">Admission no.</th>
                            <th className="px-3 py-2 text-left">Class</th>
                            <th className="px-3 py-2 text-left">Branch</th>
                            <th className="px-3 py-2 text-left">Receipt no.</th>
                            {showAllColumns && <th className="px-3 py-2 text-left">Fee</th>}
                            {showAllColumns && <th className="px-3 py-2 text-right">Total fee</th>}
                            {showAllColumns && <th className="px-3 py-2 text-right">Concession</th>}
                            {showAllColumns && <th className="px-3 py-2 text-right">To pay</th>}
                            <th className="px-3 py-2 text-right">Paid</th>
                            <th className="px-3 py-2 text-right">Still due</th>
                            <th className="px-3 py-2 text-left">Paid by</th>
                            <th className="px-3 py-2 text-left">Transaction ID</th>
                            {showAllColumns && <th className="px-3 py-2 text-left">Note</th>}
                            <th className="px-3 py-2 text-left">Date / time</th>
                            <th className="px-3 py-2 text-left">Collected by</th>
                            <th className="px-3 py-2 text-center">Receipt</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {currentReceipts.map((r: any, idx: number) => {
                            const sNo = ((currentPage - 1) * rowsPerPage) + idx + 1;
                            return (
                                <tr key={idx} className="hover:bg-slate-50 h-[45px]">
                                    <td className="px-3 py-2 text-slate-500 font-medium">{sNo}</td>
                                    <td className="px-3 py-2 font-medium">{r.student_name}</td>
                                    <td className="px-3 py-2 text-brand-600">{r.admission_no}</td>
                                    <td className="px-3 py-2">{r.class} {r.section}</td>
                                    <td className="px-3 py-2 text-slate-600">{r.branch}</td>
                                    <td className="px-3 py-2">{r.receipt_no}</td>
                                    {showAllColumns && <td className="px-3 py-2 max-w-[200px] truncate" title={r.fee_type_str}>{r.fee_type_str || '-'}</td>}
                                    {showAllColumns && <td className="px-3 py-2 text-right">₹{(r.gross_amount || 0).toLocaleString()}</td>}
                                    {showAllColumns && <td className="px-3 py-2 text-right">₹{(r.concession || 0).toLocaleString()}</td>}
                                    {showAllColumns && <td className="px-3 py-2 text-right">₹{(r.net_payable || 0).toLocaleString()}</td>}
                                    <td className="px-3 py-2 text-right font-bold text-slate-800">₹{(r.amount_paid || r.amount || 0).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right text-red-500">₹{(r.due_amount || 0).toLocaleString()}</td>
                                    <td className="px-3 py-2">{r.mode}</td>
                                    <td className="px-3 py-2 text-xs max-w-[150px]">
                                        {r.mode === 'Cheque' ? (
                                            <div className="truncate" title={`Chq: ${r.cheque_no || '-'} | ${r.bank_name || '-'} | ${r.cheque_date || '-'}`}>
                                                <div>{r.cheque_no || '-'}</div>
                                                <div className="text-slate-400">{r.bank_name || '-'}</div>
                                                <div className="text-slate-400">{r.cheque_date || '-'}</div>
                                            </div>
                                        ) : (
                                            <div className="truncate" title={r.transaction_id}>{r.transaction_id || '-'}</div>
                                        )}
                                    </td>
                                    {showAllColumns && <td className="px-3 py-2 text-xs truncate max-w-[150px]" title={r.note}>{r.note || '-'}</td>}
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                        {r.date} <br /> {r.time}
                                    </td>
                                    <td className="px-3 py-2">{r.collected_by}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            onClick={() => onViewReceipt(r.receipt_no)}
                                            className="btn-primary btn-sm"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Add empty rows to maintain height */}
                        {currentReceipts.length < rowsPerPage && Array.from({ length: rowsPerPage - currentReceipts.length }).map((_, i) => (
                            <tr key={`empty-${i}`} className="h-[45px]">
                                <td colSpan={18}>&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalRecords={receipts.length}
                perPage={rowsPerPage}
            />
        </div>
    );
};

// --------------------------------------------------------------------------
// Download Utilities
// --------------------------------------------------------------------------

const downloadExcelReport = (receipts: any[], filename: string) => {
    if (!receipts?.length) return;

    const excelData = receipts.map((r: any, idx: number) => ({
        "S.No": idx + 1,
        Student: r.student_name,
        AdmissionNo: r.admission_no,
        Class: `${r.class} ${r.section || ''}`,
        Branch: r.branch,
        ReceiptNo: r.receipt_no,
        FeeType: r.fee_type_str,
        TotalAmount: r.gross_amount || r.amount,
        Concession: r.concession || 0,
        Payable: r.net_payable || r.amount,
        Paid: r.amount_paid || r.amount,
        Due: r.due_amount || 0,
        Mode: r.mode,
        TransactionID: r.mode === 'Cheque' ? `Chq: ${r.cheque_no || '-'} | ${r.bank_name || '-'} | ${r.cheque_date || '-'}` : (r.transaction_id || '-'),
        Date: formatDateDDMMYYYY(r.date),
        Time: r.time,
        TakenBy: r.collected_by
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    saveAs(blob, `${filename}.xlsx`);
};

const downloadPDFReport = (receipts: any[], title: string, filename: string) => {
    if (!receipts?.length) return;

    const doc = new jsPDF("l", "mm", "a4");
    doc.text(title, 14, 15);

    const tableColumn = [
        "Student", "Adm No", "Class", "Branch", "Receipt",
        "Fee Type", "Paid", "Due", "Mode", "Trans ID", "Date", "Taken By"
    ];

    const tableRows = receipts.map((r: any) => ([
        r.student_name,
        r.admission_no,
        `${r.class} ${r.section || ''}`,
        r.branch,
        r.receipt_no,
        r.fee_type_str || '-',
        r.amount_paid || r.amount,
        r.due_amount || 0,
        r.mode,
        r.mode === 'Cheque'
            ? `Chq: ${r.cheque_no || '-'} | ${r.bank_name || '-'} | ${formatDateDDMMYYYY(r.cheque_date)}`
            : (r.transaction_id || '-'),
        `${formatDateDDMMYYYY(r.date)} ${r.time || ''}`,
        r.collected_by
    ]));

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        styles: { fontSize: 8 }
    });

    doc.save(`${filename}.pdf`);
};

// --------------------------------------------------------------------------
// Today's Collection (ENHANCED)
// --------------------------------------------------------------------------
export const TodayCollection: React.FC<ReportProps> = ({ onViewReceipt }) => {
    const [rawData, setRawData] = useState<any>(null); // Store API response
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [classList, setClassList] = useState<string[]>([]);
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [selectedFeeType, setSelectedFeeType] = useState('All');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedCollector] = useState('All');
    const [, setCollectors] = useState<string[]>([]);

    const sections = useClassSections(selectedClass);
    const paymentModes = ["All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    // Load initial data
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Classes
                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);

                // Fee Types
                const resTypes = await api.get('/fee-types');
                const allTypes = Array.isArray(resTypes.data) ? resTypes.data : resTypes.data.fee_types || [];
                setFeeTypes(allTypes);

                // Collectors (users)
                try {
                    const resUsers = await api.get('/users');
                    const users = resUsers.data.users || resUsers.data || [];
                    setCollectors(["All", ...users.map((u: any) => u.name || u.username)]);
                } catch {
                    setCollectors(["All"]);
                }

                // Fetch Data Immediately
                fetchReport();
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadInitialData();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            // Fetch BROAD data (All) and filter locally as requested
            const params = new URLSearchParams({
                class: 'All',
                fee_type: 'All',
                section: 'All',
                mode: 'All',
                collected_by: 'All'
            });
            const res = await api.get(`/reports/fees/today?${params.toString()}`);
            setRawData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        fetchReport();
    };

    // Derived State: Filtered Data
    const filteredReceipts = useMemo(() => {
        if (!rawData?.receipts) return [];
        return filterData(rawData.receipts, {
            class: selectedClass,
            section: selectedSection,
            feeType: selectedFeeType,
            mode: selectedMode,
            collector: selectedCollector
        });
    }, [rawData, selectedClass, selectedSection, selectedFeeType, selectedMode, selectedCollector]);

    // Derived State: Summary based on Filtered Data
    const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);

    if (loading) return <LoadingState label="Loading today's collection..." />;
    if (error) return <Alert tone="error" title="Could not load the report" onRetry={fetchReport}>{error}</Alert>;

    const summaryLine = joinSummary(
        `Fee collected today (${niceDate(new Date().toLocaleDateString('en-CA'))})`,
        filterSummary({ cls: selectedClass, section: selectedSection, feeType: selectedFeeType, mode: selectedMode })
    );

    return (
        <div className="space-y-4">
            <FilterCard summary={summaryLine} hasResults={!!rawData} onApply={handleRefresh} applyLabel="Refresh list" applyNote="The list changes as soon as you pick a filter.">
                <SelectField id="today-fee" label="Fee" value={selectedFeeType} onChange={setSelectedFeeType} options={feeTypeOptions(feeTypes)} />
                <SelectField id="today-class" label="Class" value={selectedClass} onChange={setSelectedClass} options={classOptions(classList)} />
                <SelectField id="today-section" label="Section" value={selectedSection} onChange={setSelectedSection} options={sectionOptions(sections)} />
                <SelectField id="today-mode" label="Payment mode" value={selectedMode} onChange={setSelectedMode} options={modeOptions(paymentModes)} />
            </FilterCard>

            {/* Totals */}
            <StatGrid>
                <StatTile label="Collected today" value={summary.total} money tone="good" className="col-span-2 lg:col-span-2" />
                <StatTile label="Cash payments" value={summary.cashTransactionsCount || 0} hint="Number of receipts" />
                <StatTile label="UPI / card / bank payments" value={summary.digitalTransactionsCount || 0} hint="Number of receipts" />
            </StatGrid>

            <ResultsBar title="Receipts" count={filteredReceipts.length}>
                <ExportButtons
                    disabled={!filteredReceipts.length}
                    onExcel={() => downloadExcelReport(filteredReceipts, 'Today_Collection')}
                    onPdf={() => downloadPDFReport(filteredReceipts, "Today's Collection Report", 'Today_Collection')}
                />
            </ResultsBar>
            <FullReceiptsTable receipts={filteredReceipts} onViewReceipt={onViewReceipt} />

            <SummaryTables
                modeSummary={summary.modeMap || {}}
                collectedBySummary={summary.collectedBySummary || []}
                totalCollection={summary.total}
            />
        </div>
    );
};

// --------------------------------------------------------------------------
// Daily Report (ENHANCED)
// --------------------------------------------------------------------------
export const DailyReport: React.FC<ReportProps> = ({ onViewReceipt, forcedStatus, forcedConcession }) => {
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [rawData, setRawData] = useState<any>(null); // Store API response
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [classList, setClassList] = useState<string[]>([]);
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [selectedFeeType, setSelectedFeeType] = useState('All');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedCollector] = useState('All');
    const [, setCollectors] = useState<string[]>([]);

    const sections = useClassSections(selectedClass);
    const paymentModes = ["All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    useEffect(() => {
        const loadData = async () => {
            try {
                const resTypes = await api.get('/fee-types');
                const allTypes = Array.isArray(resTypes.data) ? resTypes.data : resTypes.data.fee_types || [];
                const currentBranch = localStorage.getItem('currentBranch') || 'All';
                let filteredTypes = allTypes;
                if (currentBranch !== 'All' && currentBranch !== 'All Branches') {
                    filteredTypes = allTypes.filter((ft: any) =>
                        !ft.branch || ft.branch === 'All' || ft.branch === currentBranch
                    );
                }
                setFeeTypes(filteredTypes);

                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);

                try {
                    const resUsers = await api.get('/users');
                    const users = resUsers.data.users || resUsers.data || [];
                    setCollectors(["All", ...users.map((u: any) => u.name || u.username)]);
                } catch {
                    setCollectors(["All"]);
                }
                fetchReport(); // Load initially
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadData();
    }, []);

    const fetchReport = async () => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 365) {
            notify("Choose dates no more than one year apart.");
            return;
        }
        try {
            setLoading(true);
            setError('');
            // Fetch BROAD data and filter locally
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                class: 'All',
                section: 'All',
                fee_type: 'All',
                mode: 'All',
                collected_by: 'All'
            });
            if (forcedStatus) params.append('status', forcedStatus);
            if (forcedConcession) params.append('has_concession', 'true');
            const res = await api.get(`/reports/fees/daily?${params.toString()}`);
            setRawData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch report');
            setRawData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchReport();
    };

    // Derived State: Filtered Data
    const filteredReceipts = useMemo(() => {
        if (!rawData?.receipts) return [];
        return filterData(rawData.receipts, {
            class: selectedClass,
            section: selectedSection,
            feeType: selectedFeeType,
            mode: selectedMode,
            collector: selectedCollector
        });
    }, [rawData, selectedClass, selectedSection, selectedFeeType, selectedMode, selectedCollector]);

    // Derived State: Summary based on Filtered Data
    const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);

    const summaryLine = joinSummary(
        startDate === endDate
            ? `Fee collected on ${niceDate(startDate)}`
            : `Fee collected from ${niceDate(startDate)} to ${niceDate(endDate)}`,
        filterSummary({ cls: selectedClass, section: selectedSection, feeType: selectedFeeType, mode: selectedMode })
    );

    return (
        <div className="space-y-4">
            <FilterCard summary={summaryLine} hasResults={!!rawData} onApply={handleSearch} applying={loading} applyNote="You can choose up to one year.">
                <div>
                    <label htmlFor="daily-from" className="block text-sm font-medium text-slate-800 mb-1.5">From date</label>
                    <input id="daily-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input min-h-[44px]" />
                </div>
                <div>
                    <label htmlFor="daily-to" className="block text-sm font-medium text-slate-800 mb-1.5">To date</label>
                    <input id="daily-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input min-h-[44px]" />
                </div>
                <SelectField id="daily-fee" label="Fee" value={selectedFeeType} onChange={setSelectedFeeType} options={feeTypeOptions(feeTypes)} />
                <SelectField id="daily-class" label="Class" value={selectedClass} onChange={setSelectedClass} options={classOptions(classList)} />
                <SelectField id="daily-section" label="Section" value={selectedSection} onChange={setSelectedSection} options={sectionOptions(sections)} />
                <SelectField id="daily-mode" label="Payment mode" value={selectedMode} onChange={setSelectedMode} options={modeOptions(paymentModes)} />
            </FilterCard>

            {loading && <LoadingState label="Loading report..." />}
            {error && <Alert tone="error" title="Could not load the report">{error}</Alert>}

            {rawData && (
                <>
                    <StatGrid>
                        <StatTile label="Total collected" value={summary.total} money tone="good" className="col-span-2 lg:col-span-2" />
                        <StatTile label="Cash payments" value={summary.cashTransactionsCount || 0} hint="Number of receipts" />
                        <StatTile label="UPI / card / bank payments" value={summary.digitalTransactionsCount || 0} hint="Number of receipts" />
                    </StatGrid>

                    <ResultsBar title="Receipts" count={filteredReceipts.length}>
                        <ExportButtons
                            disabled={!filteredReceipts.length}
                            onExcel={() => downloadExcelReport(filteredReceipts, 'Daily_Fee_Report')}
                            onPdf={() => downloadPDFReport(filteredReceipts, 'Daily Fee Report', 'Daily_Fee_Report')}
                        />
                    </ResultsBar>
                    <FullReceiptsTable receipts={filteredReceipts} onViewReceipt={onViewReceipt} />
                    <SummaryTables
                        modeSummary={summary.modeMap || {}}
                        collectedBySummary={summary.collectedBySummary || []}
                        totalCollection={summary.total}
                    />
                </>
            )}
        </div>
    );
};

// --------------------------------------------------------------------------
// Monthly Report (ENHANCED)
// --------------------------------------------------------------------------
export const MonthlyReport: React.FC<ReportProps> = ({ onViewReceipt }) => {
    const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [year, setYear] = useState<string>(String(new Date().getFullYear()));
    const [rawData, setRawData] = useState<any>(null); // Store API response
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [selectedFeeType, setSelectedFeeType] = useState('All');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedCollector] = useState('All');
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [classList, setClassList] = useState<string[]>([]);
    const [, setCollectors] = useState<string[]>([]);

    const sections = useClassSections(selectedClass);
    const paymentModes = ["All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    const academicYear = localStorage.getItem("academicYear") || "";
    const [startYear, endYear] = academicYear.split("-");
    const years: string[] = startYear && endYear ? [startYear, endYear] : [String(new Date().getFullYear())];

    useEffect(() => {
        const loadData = async () => {
            try {
                const resTypes = await api.get('/fee-types');
                const allTypes = Array.isArray(resTypes.data) ? resTypes.data : resTypes.data.fee_types || [];
                setFeeTypes(allTypes);

                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);

                try {
                    const resUsers = await api.get('/users');
                    const users = resUsers.data.users || resUsers.data || [];
                    setCollectors(["All", ...users.map((u: any) => u.name || u.username)]);
                } catch {
                    setCollectors(["All"]);
                }

                // Fetch initial
                fetchReport();
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadData();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError('');
            // Fetch BROAD data and filter locally
            const params = new URLSearchParams({
                month,
                year,
                class: 'All',
                section: 'All',
                fee_type: 'All',
                mode: 'All',
                collected_by: 'All'
            });
            const res = await api.get(`/reports/fees/monthly?${params.toString()}`);
            setRawData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchReport();
    };

    const monthName = new Date(0, Number(month) - 1).toLocaleString('default', { month: 'long' });

    // Derived State: Filtered Data
    const filteredReceipts = useMemo(() => {
        if (!rawData?.receipts) return [];
        return filterData(rawData.receipts, {
            class: selectedClass,
            section: selectedSection,
            feeType: selectedFeeType,
            mode: selectedMode,
            collector: selectedCollector
        });
    }, [rawData, selectedClass, selectedSection, selectedFeeType, selectedMode, selectedCollector]);

    // Derived State: Summary based on Filtered Data
    const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);


    const summaryLine = joinSummary(
        `Fee collected in ${monthName} ${year}`,
        filterSummary({ cls: selectedClass, section: selectedSection, feeType: selectedFeeType, mode: selectedMode })
    );

    return (
        <div className="space-y-4">
            <FilterCard summary={summaryLine} hasResults={!!rawData} onApply={handleSearch} applying={loading}>
                <SelectField
                    id="monthly-month"
                    label="Month"
                    value={month}
                    onChange={setMonth}
                    options={Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: String(m), label: new Date(0, m - 1).toLocaleString('default', { month: 'long' }) }))}
                />
                <SelectField id="monthly-year" label="Year" value={year} onChange={setYear} options={years.map(y => ({ value: y, label: y }))} />
                <SelectField id="monthly-fee" label="Fee" value={selectedFeeType} onChange={setSelectedFeeType} options={feeTypeOptions(feeTypes)} />
                <SelectField id="monthly-class" label="Class" value={selectedClass} onChange={setSelectedClass} options={classOptions(classList)} />
                <SelectField id="monthly-section" label="Section" value={selectedSection} onChange={setSelectedSection} options={sectionOptions(sections)} />
                <SelectField id="monthly-mode" label="Payment mode" value={selectedMode} onChange={setSelectedMode} options={modeOptions(paymentModes)} />
            </FilterCard>

            {loading && <LoadingState label="Loading report..." />}
            {error && <Alert tone="error" title="Could not load the report">{error}</Alert>}

            {rawData && (
                <>
                    <StatGrid>
                        <StatTile label="Total collected" value={summary.total} money tone="good" className="col-span-2 lg:col-span-2" />
                        <StatTile label="Cash payments" value={summary.cashTransactionsCount || 0} hint="Number of receipts" />
                        <StatTile label="UPI / card / bank payments" value={summary.digitalTransactionsCount || 0} hint="Number of receipts" />
                    </StatGrid>

                    <ResultsBar title="Receipts" count={filteredReceipts.length}>
                        <ExportButtons
                            disabled={!filteredReceipts.length}
                            onExcel={() => downloadExcelReport(filteredReceipts, `Monthly_Report_${monthName}_${year}`)}
                            onPdf={() => downloadPDFReport(filteredReceipts, `Monthly Report - ${monthName} ${year}`, `Monthly_Report_${monthName}_${year}`)}
                        />
                    </ResultsBar>
                    <FullReceiptsTable receipts={filteredReceipts} onViewReceipt={onViewReceipt} />
                    <SummaryTables
                        modeSummary={summary.modeMap || {}}
                        collectedBySummary={summary.collectedBySummary || []}
                        totalCollection={summary.total}
                    />
                </>
            )}
        </div>
    );
};


// --------------------------------------------------------------------------
// Class Wise Report (ENHANCED)
// --------------------------------------------------------------------------
export const ClassWiseReport: React.FC<ReportProps> = ({ onViewReceipt }) => {
    const [classList, setClassList] = useState<string[]>([]);
    const [className, setClassName] = useState('');
    const [selectedSection, setSelectedSection] = useState('All');
    const [selectedFeeType, setSelectedFeeType] = useState('All');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedCollector] = useState('All');
    const [startDate] = useState<string>('');
    const [endDate] = useState<string>('');
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [, setCollectors] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any>(null); // Store API response
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const sections = useClassSections(className);
    const paymentModes = ["All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    useEffect(() => {
        const loadData = async () => {
            try {
                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                const names = classesData.map((c: any) => c.class_name);
                setClassList(names);
                if (names.length > 0) setClassName(names[0]);

                const resTypes = await api.get('/fee-types');
                const allTypes = Array.isArray(resTypes.data) ? resTypes.data : resTypes.data.fee_types || [];
                setFeeTypes(allTypes);

                try {
                    const resUsers = await api.get('/users');
                    const users = resUsers.data.users || resUsers.data || [];
                    setCollectors(["All", ...users.map((u: any) => u.name || u.username)]);
                } catch {
                    setCollectors(["All"]);
                }
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadData();
    }, []);

    const fetchReport = async () => {
        if (!className) return;
        try {
            setLoading(true);
            setError('');
            // Fetch BROAD data for the class and filter locally
            const params = new URLSearchParams({
                class: className,
                section: 'All', // Fetch all sections
                fee_type: 'All', // Fetch all types
                mode: 'All', // Fetch all modes
                collected_by: 'All', // Fetch all collectors
                ...(startDate && { start_date: startDate }),
                ...(endDate && { end_date: endDate })
            });
            const res = await api.get(`/reports/fees/class-wise?${params.toString()}`);
            setRawData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error fetching report');
            setRawData(null);
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Filtered Data
    const filteredReceipts = useMemo(() => {
        if (!rawData?.receipts) return [];
        return filterData(rawData.receipts, {
            class: className, // Ensure class matches (though API should have filtered it)
            section: selectedSection,
            feeType: selectedFeeType,
            mode: selectedMode,
            collector: selectedCollector
        });
    }, [rawData, className, selectedSection, selectedFeeType, selectedMode, selectedCollector]);

    // Derived State: Summary based on Filtered Data
    // Note: ClassWiseReport API returns specific summary fields (total_fee, collected, due).
    // If we filter locally, we should probably recalculate these summaries based on filtered receipts,
    // OR trust the helper `calculateSummary` for at least the collection part.
    // However, "Total Demand" (total_fee) and "Due" might be specific to the class student list, 
    // which might not be fully available in just 'receipts'. 
    // BUT, for a Receipt Report, we care about what was COLLECTED.
    // The original code showed `data.total_fee`, `data.collected`, `data.due`.
    // If we filter by "Cash" mode, "Total Demand" shouldn't change, but "Collected" should.
    // So we should recalculate "Collected" from filtered receipts.
    // "Total Demand" and "Due" might be misleading if we filter by Payment Mode (as due is not mode-specific).
    // I will use `calculateSummary` for the collection stats.
    // For Demand/Due, I'll keep the raw API data BUT maybe hide them if actively filtering by Mode/Type?
    // Actually, users usually want to see "Of the Cash collected, how much is it?".
    // So `summary.total` will be the filtered collection.

    const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);

    const summaryLine = joinSummary(
        className ? `Fee collected from Class ${className}${selectedSection !== 'All' ? ` ${selectedSection}` : ''}` : 'Choose a class',
        selectedFeeType,
        selectedMode,
        currentBranchLabel()
    );

    return (
        <div className="space-y-4">
            <FilterCard
                summary={summaryLine}
                hasResults={!!rawData}
                onApply={fetchReport}
                applying={loading}
                applyDisabled={!className}
                applyNote={!className ? 'Choose a class first.' : undefined}
            >
                <SelectField id="class-class" label="Class" value={className} onChange={setClassName} options={classList.map(c => ({ value: c, label: c }))} />
                <SelectField id="class-section" label="Section" value={selectedSection} onChange={setSelectedSection} options={sectionOptions(sections)} />
                <SelectField id="class-fee" label="Fee" value={selectedFeeType} onChange={setSelectedFeeType} options={feeTypeOptions(feeTypes)} />
                <SelectField id="class-mode" label="Payment mode" value={selectedMode} onChange={setSelectedMode} options={modeOptions(paymentModes)} />
            </FilterCard>

            {loading && <LoadingState />}
            {error && <Alert tone="error" title="Could not load the report">{error}</Alert>}

            {rawData && (
                <>
                    <StatGrid>
                        <StatTile label="Total fee of the class" value={rawData.total_fee} money />
                        <StatTile label="Collected (with these filters)" value={summary.total} money tone="good" />
                        <StatTile label="Still to collect" value={rawData.due} money tone="bad" />
                        <StatTile label="Collected so far" value={`${rawData.total_fee ? ((summary.total / rawData.total_fee) * 100).toFixed(1) : 0}%`} />
                    </StatGrid>

                    <ResultsBar title="Receipts" count={filteredReceipts.length}>
                        <ExportButtons
                            disabled={!filteredReceipts.length}
                            onExcel={() => downloadExcelReport(filteredReceipts, `ClassWise_Report_${className}`)}
                            onPdf={() => downloadPDFReport(filteredReceipts, `Class ${className} Fee Report`, `ClassWise_Report_${className}`)}
                        />
                    </ResultsBar>
                    <FullReceiptsTable receipts={filteredReceipts} onViewReceipt={onViewReceipt} />
                    <SummaryTables
                        modeSummary={summary.modeMap || {}}
                        collectedBySummary={summary.collectedBySummary || []}
                        totalCollection={summary.total}
                    />
                </>
            )}
        </div>
    );
};

// --------------------------------------------------------------------------
// Installment Wise Report (ENHANCED)
// --------------------------------------------------------------------------
export const InstallmentWiseReport: React.FC<ReportProps> = ({ onViewReceipt }) => {
    const [installment, setInstallment] = useState('');
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [selectedMode, setSelectedMode] = useState('All');
    const [selectedCollector] = useState('All');
    const [classList, setClassList] = useState<string[]>([]);
    const [, setCollectors] = useState<string[]>([]);
    const [rawData, setRawData] = useState<any>(null); // Store API response
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const sections = useClassSections(selectedClass);
    const paymentModes = ["All", "Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch Installments for the "Fee Head" dropdown
                // This ensures we match 'StudentFee.month' which stores installment titles (e.g. "June Fee")
                const resInst = await api.get('/installment-schedule');
                const installmentsData = resInst.data.installments || [];

                // Also fetch Fee Types for One-Time fees if needed, 
                // but primarily we need Installment Titles.
                // Let's combine unique titles from Installments.
                const uniqueTitles = Array.from(new Set(installmentsData.map((i: any) => i.title)));

                // If we also want to support "One-Time" or direct Fee Type matches that might be stored in 'month' column (rare but possible)
                // we could fetch fee types, but normally 'month' column aligns with Installment Title.

                setFeeTypes(uniqueTitles.map((t, idx) => ({ id: idx, fee_type: t }))); // Map to expected shape { fee_type: string }
                if (uniqueTitles.length > 0) setInstallment(uniqueTitles[0] as string);

                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);

                try {
                    const resUsers = await api.get('/users');
                    const users = resUsers.data.users || resUsers.data || [];
                    setCollectors(["All", ...users.map((u: any) => u.name || u.username)]);
                } catch {
                    setCollectors(["All"]);
                }
            } catch (err) {
                console.error("Failed to load initial data", err);
            }
        };
        loadData();
    }, []);

    const fetchReport = async () => {
        if (!installment) return;
        try {
            setLoading(true);
            setError('');
            // Fetch BROAD data for the installment
            const params = new URLSearchParams({
                installment,
                class: 'All',
                section: 'All',
                mode: 'All',
                collected_by: 'All'
            });
            const res = await api.get(`/reports/fees/installment-wise?${params.toString()}`);
            setRawData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error fetching report');
            setRawData(null);
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Filtered Data
    const filteredReceipts = useMemo(() => {
        if (!rawData?.receipts) return [];
        return filterData(rawData.receipts, {
            class: selectedClass,
            section: selectedSection,
            feeType: 'All', // Already filtered by installment
            mode: selectedMode,
            collector: selectedCollector
        });
    }, [rawData, selectedClass, selectedSection, selectedMode, selectedCollector]);

    const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);

    const summaryLine = joinSummary(
        installment ? `Fee collected for ${installment}` : 'Choose a fee',
        filterSummary({ cls: selectedClass, section: selectedSection, mode: selectedMode })
    );

    return (
        <div className="space-y-4">
            <FilterCard
                summary={summaryLine}
                hasResults={!!rawData}
                onApply={fetchReport}
                applying={loading}
                applyDisabled={!installment}
                applyNote={!installment ? 'Choose a fee first.' : undefined}
            >
                <SelectField
                    id="inst-fee"
                    label="Fee (month or term)"
                    value={installment}
                    onChange={setInstallment}
                    options={[{ value: '', label: 'Choose a fee' }, ...feeTypes.map(ft => ({ value: ft.fee_type, label: ft.fee_type }))]}
                />
                <SelectField id="inst-class" label="Class" value={selectedClass} onChange={setSelectedClass} options={classOptions(classList)} />
                <SelectField id="inst-section" label="Section" value={selectedSection} onChange={setSelectedSection} options={sectionOptions(sections)} />
                <SelectField id="inst-mode" label="Payment mode" value={selectedMode} onChange={setSelectedMode} options={modeOptions(paymentModes)} />
            </FilterCard>

            {loading && <LoadingState />}
            {error && <Alert tone="error" title="Could not load the report">{error}</Alert>}

            {rawData && (
                <>
                    <StatGrid>
                        <StatTile label="Total fee" value={rawData.total_demand} money />
                        <StatTile label="Collected (with these filters)" value={summary.total} money tone="good" />
                        <StatTile label="Still to collect" value={rawData.due} money tone="bad" />
                        <StatTile label="Students who paid" value={`${rawData.paid_students} / ${rawData.total_students}`} />
                        <StatTile label="Collected so far" value={`${rawData.total_demand ? ((summary.total / rawData.total_demand) * 100).toFixed(1) : 0}%`} />
                    </StatGrid>

                    <ResultsBar title="Receipts" count={filteredReceipts.length}>
                        <ExportButtons
                            disabled={!filteredReceipts.length}
                            onExcel={() => downloadExcelReport(filteredReceipts, `Installment_Report_${installment}`)}
                            onPdf={() => downloadPDFReport(filteredReceipts, `${installment} - Fee Report`, `Installment_Report_${installment}`)}
                        />
                    </ResultsBar>
                    <FullReceiptsTable receipts={filteredReceipts} onViewReceipt={onViewReceipt} />
                    <SummaryTables
                        modeSummary={summary.modeMap || {}}
                        collectedBySummary={summary.collectedBySummary || []}
                        totalCollection={summary.total}
                    />
                </>
            )}
        </div>
    );
};

// --------------------------------------------------------------------------
// Due Report (ENHANCED)
// --------------------------------------------------------------------------
export const DueReport: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [classList, setClassList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [minDueAmount] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;

    const sections = useClassSections(selectedClass);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData]);

    useEffect(() => {
        const loadClasses = async () => {
            try {
                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);
            } catch (err) {
                console.error("Failed to load classes", err);
            }
        };
        loadClasses();
        // Initial fetch
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError('');
            // If backend expects 'All' literally, keep it. 
            // Original code sent selectedClass directly. 
            // I'll stick to sending 'All' if simpler, or check logic.
            // If I look at DailyReport refactor, I sent 'All'.
            // Here due report might be different. 
            // But let's assume 'All' is handled or I can filter locally if I fetch everything?
            // Due report for "All" classes is huge.
            // I will send the params. 
            // But if params are passed as 'All', does backend handle it?
            // Usually yes if I wrote it or if it was there.
            // I'll stick to matching the previous logic: `class: selectedClass`.

            const params2 = new URLSearchParams();
            if (selectedClass !== 'All') params2.append('class', selectedClass);
            if (selectedSection !== 'All') params2.append('section', selectedSection);
            if (minDueAmount) params2.append('min_due', minDueAmount);

            const res = await api.get(`/reports/fees/due?${params2.toString()}`);
            setData(res.data);
            setFilteredData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error fetching report');
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Local Filtering (Search + maybe class/section if we fetched all)
    // Derived State: Filtered Data (Robust Client-Side Filtering)
    useEffect(() => {
        if (!data) return;
        let res = data;

        // 1. Strict Class Filter (if not All)
        if (selectedClass !== 'All') {
            res = res.filter(s => s.class === selectedClass);
        }

        // 2. Strict Section Filter (if not All)
        if (selectedSection !== 'All') {
            res = res.filter(s => s.section === selectedSection);
        }

        // 3. Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            res = res.filter(s =>
                (s.name?.toLowerCase() || '').includes(term) ||
                (s.admission_no?.toLowerCase() || '').includes(term) ||
                (s.adm_no?.toLowerCase() || '').includes(term) || // Fallback
                (s.father_mobile?.includes(term))
            );
        }
        setFilteredData(res);
    }, [searchTerm, data, selectedClass, selectedSection]);

    const totalDue = filteredData.reduce((sum, s) => sum + (s.due_amount || 0), 0);
    const totalFee = filteredData.reduce((sum, s) => sum + (s.total_fee || 0), 0);

    const downloadExcel = () => {
        if (!filteredData.length) return;
        const excelData = filteredData.map((s: any) => ({
            StudentName: s.name,
            AdmissionNo: s.admission_no || s.adm_no || s.admissionNo || '-',
            Class: `${s.class} ${s.section || ''}`,
            FatherName: s.father_name || s.father || s.parent_name || '-',
            FatherMobile: s.father_mobile,
            TotalFee: s.total_fee,
            PaidAmount: s.paid_amount || (s.total_fee - s.due_amount),
            DueAmount: s.due_amount
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Due Report");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        saveAs(blob, `Due_Report.xlsx`);
    };

    const downloadPDF = () => {
        if (!filteredData.length) return;
        const doc = new jsPDF("l", "mm", "a4");
        doc.text("Due Fee Report", 14, 15);

        const tableColumn = [
            "Student", "Adm No", "Class", "Father Name", "Mobile", "Total Fee", "Paid", "Due"
        ];

        const tableRows = filteredData.map((s: any) => ([
            s.name,
            s.admission_no || s.adm_no || s.admissionNo || '-',
            `${s.class} ${s.section || ''}`,
            s.father_name || s.father || s.parent_name || '-',
            s.father_mobile,
            s.total_fee,
            s.paid_amount || (s.total_fee - s.due_amount),
            s.due_amount
        ]));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8 }
        });

        doc.save("Due_Report.pdf");
    };

    return (
        <DueReportView
            idPrefix="due"
            summaryLine={joinSummary('Students who still owe fees', filterSummary({ cls: selectedClass, section: selectedSection }), searchTerm && `matching "${searchTerm}"`)}
            listTitle="Students who owe fees"
            classList={classList}
            sections={sections}
            selectedClass={selectedClass}
            onClassChange={setSelectedClass}
            selectedSection={selectedSection}
            onSectionChange={setSelectedSection}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onApply={fetchReport}
            loading={loading}
            error={error}
            filteredData={filteredData}
            totalFee={totalFee}
            totalDue={totalDue}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            onExcel={downloadExcel}
            onPdf={downloadPDF}
        />
    );
};

export const LateFeeDueReport: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [classList, setClassList] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('All');
    const [selectedSection, setSelectedSection] = useState('All');
    const [minDueAmount] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 5;

    const sections = useClassSections(selectedClass);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData]);

    useEffect(() => {
        const loadClasses = async () => {
            try {
                const resClasses = await api.get('/classes');
                const classesData = resClasses.data.classes || [];
                setClassList(["All", ...classesData.map((c: any) => c.class_name)]);
            } catch (err) {
                console.error("Failed to load classes", err);
            }
        };
        loadClasses();
        // Initial fetch
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError('');
            // If backend expects 'All' literally, keep it. 
            // Original code sent selectedClass directly. 
            // I'll stick to sending 'All' if simpler, or check logic.
            // If I look at DailyReport refactor, I sent 'All'.
            // Here due report might be different. 
            // But let's assume 'All' is handled or I can filter locally if I fetch everything?
            // Due report for "All" classes is huge.
            // I will send the params. 
            // But if params are passed as 'All', does backend handle it?
            // Usually yes if I wrote it or if it was there.
            // I'll stick to matching the previous logic: `class: selectedClass`.

            const params2 = new URLSearchParams();
            if (selectedClass !== 'All') params2.append('class', selectedClass);
            if (selectedSection !== 'All') params2.append('section', selectedSection);
            if (minDueAmount) params2.append('min_due', minDueAmount);

            const res = await api.get(`/reports/fees/late-due?${params2.toString()}`);
            setData(res.data);
            setFilteredData(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error fetching report');
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Local Filtering (Search + maybe class/section if we fetched all)
    // Derived State: Filtered Data (Robust Client-Side Filtering)
    useEffect(() => {
        if (!data) return;
        let res = data;

        // 1. Strict Class Filter (if not All)
        if (selectedClass !== 'All') {
            res = res.filter(s => s.class === selectedClass);
        }

        // 2. Strict Section Filter (if not All)
        if (selectedSection !== 'All') {
            res = res.filter(s => s.section === selectedSection);
        }

        // 3. Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            res = res.filter(s =>
                (s.name?.toLowerCase() || '').includes(term) ||
                (s.admission_no?.toLowerCase() || '').includes(term) ||
                (s.adm_no?.toLowerCase() || '').includes(term) || // Fallback
                (s.father_mobile?.includes(term))
            );
        }
        setFilteredData(res);
    }, [searchTerm, data, selectedClass, selectedSection]);

    const totalDue = filteredData.reduce((sum, s) => sum + (s.due_amount || 0), 0);
    const totalFee = filteredData.reduce((sum, s) => sum + (s.total_fee || 0), 0);

    const downloadExcel = () => {
        if (!filteredData.length) return;
        const excelData = filteredData.map((s: any) => ({
            StudentName: s.name,
            AdmissionNo: s.admission_no || s.adm_no || s.admissionNo || '-',
            Class: `${s.class} ${s.section || ''}`,
            FatherName: s.father_name || s.father || s.parent_name || '-',
            FatherMobile: s.father_mobile,
            TotalFee: s.total_fee,
            PaidAmount: s.paid_amount || (s.total_fee - s.due_amount),
            DueAmount: s.due_amount
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Late Fee Due Report");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        saveAs(blob, `Late_Fee_Due_Report.xlsx`);
    };

    const downloadPDF = () => {
        if (!filteredData.length) return;
        const doc = new jsPDF("l", "mm", "a4");
        doc.text("Late Fee Due Report", 14, 15);

        const tableColumn = [
            "Student", "Adm No", "Class", "Father Name", "Mobile", "Total Fee", "Paid", "Due"
        ];

        const tableRows = filteredData.map((s: any) => ([
            s.name,
            s.admission_no || s.adm_no || s.admissionNo || '-',
            `${s.class} ${s.section || ''}`,
            s.father_name || s.father || s.parent_name || '-',
            s.father_mobile,
            s.total_fee,
            s.paid_amount || (s.total_fee - s.due_amount),
            s.due_amount
        ]));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8 }
        });

        doc.save("Late_Fee_Due_Report.pdf");
    };

    return (
        <DueReportView
            idPrefix="late"
            summaryLine={joinSummary('Students with unpaid late fees', filterSummary({ cls: selectedClass, section: selectedSection }), searchTerm && `matching "${searchTerm}"`)}
            listTitle="Students with late fees"
            classList={classList}
            sections={sections}
            selectedClass={selectedClass}
            onClassChange={setSelectedClass}
            selectedSection={selectedSection}
            onSectionChange={setSelectedSection}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onApply={fetchReport}
            loading={loading}
            error={error}
            filteredData={filteredData}
            totalFee={totalFee}
            totalDue={totalDue}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            onExcel={downloadExcel}
            onPdf={downloadPDF}
        />
    );
};
// --------------------------------------------------------------------------
// Search Student Report (NEW)
// --------------------------------------------------------------------------
export const SearchStudentReport: React.FC<ReportProps> = ({ onViewReceipt }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'name' | 'admission'>('admission');
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');

    // Edit Modal State
    const [editingReceipt, setEditingReceipt] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        mode: '',
        transaction_id: '',
        cheque_no: '',
        bank_name: '',
        cheque_date: '',
        date: ''
    });
    const [saving, setSaving] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = hasPermission(user, 'fees.fee.take-fee', 'delete'); // Usually, if they can delete/cancel, they can edit


    const paymentModes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

    // Search students by name or admission no
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            notify('Type an admission number or a name first.');
            return;
        }
        try {
            setSearching(true);
            setError('');
            setStudents([]);
            setSelectedStudent(null);
            setReceipts([]);

            const params = new URLSearchParams({
                q: searchTerm.trim(),
                type: searchType
            });
            const res = await api.get(`/students/search?${params.toString()}`);
            const list = res.data.students || res.data || [];
            setStudents(list);

            // Auto-select if exact match (admission no)
            if (list.length === 1) {
                handleSelectStudent(list[0]);
            } else if (list.length === 0) {
                setError('No student found. Check the spelling, or try the admission number.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to search students');
        } finally {
            setSearching(false);
        }
    };

    // Fetch receipts for selected student
    const handleSelectStudent = async (student: any) => {
        try {
            setLoading(true);
            setSelectedStudent(student);
            setError('');

            const studentId = student.id || student.student_id;
            const res = await api.get(`/reports/fees/student-receipts/${studentId}`);
            setReceipts(res.data.receipts || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch receipts');
            setReceipts([]);
        } finally {
            setLoading(false);
        }
    };

    // Open edit modal (admin only)
    const handleEditReceipt = (receipt: any) => {
        if (!isAdmin) {
            notify('Only an admin can change receipt details.');
            return;
        }
        setEditingReceipt(receipt);
        setEditForm({
            mode: receipt.mode || 'Cash',
            transaction_id: receipt.transaction_id || '',
            cheque_no: receipt.cheque_no || '',
            bank_name: receipt.bank_name || '',
            cheque_date: receipt.cheque_date || '',
            date: receipt.date || ''
        });
    };

    // Save edited receipt
    const handleSaveEdit = async () => {
        if (!editingReceipt) return;
        try {
            setSaving(true);
            const payload: any = {
                mode: editForm.mode,
                date: editForm.date
            };
            if (editForm.mode === 'Cheque') {
                payload.cheque_no = editForm.cheque_no;
                payload.bank_name = editForm.bank_name;
                payload.cheque_date = editForm.cheque_date;
                payload.transaction_id = '';
            } else if (editForm.mode === 'Cash') {
                payload.transaction_id = '';
            } else {
                payload.transaction_id = editForm.transaction_id;
            }

            await api.put(`/reports/fees/receipt/${editingReceipt.receipt_no}`, payload);

            // Refresh receipts
            if (selectedStudent) {
                await handleSelectStudent(selectedStudent);
            }
            setEditingReceipt(null);
            notify.success('Receipt details saved.');
        } catch (err: any) {
            notify.error(err.response?.data?.error || 'Could not save the receipt. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const totalCollected = receipts.reduce((sum, r) => sum + Number(r.amount_paid || r.amount || 0), 0);

    const studentColumns: Column<any>[] = [
        { key: 'name', header: 'Student', primary: true, render: s => <span className="font-medium">{s.name}</span> },
        { key: 'class', header: 'Class', secondary: true, render: s => `${s.class || ''} ${s.section || ''}`.trim() || '-' },
        { key: 'adm', header: 'Admission no.', render: s => <span className="text-brand-700">{s.admission_no || s.adm_no}</span> },
        { key: 'father', header: 'Father', render: s => s.father_name || s.father || '-' },
        { key: 'mobile', header: 'Phone', render: s => s.father_mobile || '-' },
    ];

    const receiptColumns: Column<any>[] = [
        { key: 'receipt_no', header: 'Receipt no.', primary: true, render: r => <span className="font-medium text-brand-700">{r.receipt_no}</span> },
        { key: 'date', header: 'Date', secondary: true, render: r => <>{formatDateDDMMYYYY(r.date)} <span className="text-slate-400">{r.time}</span></> },
        { key: 'fee', header: 'Fee', render: r => <span className="md:block md:max-w-[200px] md:truncate" title={r.fee_type_str}>{r.fee_type_str || '-'}</span> },
        { key: 'paid', header: 'Paid', align: 'right', render: r => <span className="font-bold">₹{(r.amount_paid || r.amount || 0).toLocaleString()}</span> },
        { key: 'due', header: 'Still due', align: 'right', render: r => <span className="text-red-500">₹{(r.due_amount || 0).toLocaleString()}</span> },
        {
            key: 'mode', header: 'Paid by', render: r => (
                <span className={r.mode === 'Cash' ? 'badge-success' : r.mode === 'Cheque' ? 'badge-warning' : 'badge-brand'}>{r.mode}</span>
            )
        },
        {
            key: 'ref', header: 'Transaction / cheque', render: r => r.mode === 'Cheque' ? (
                <div className="text-xs">
                    <div>{r.cheque_no || '-'}</div>
                    <div className="text-slate-400">{r.bank_name || '-'}</div>
                </div>
            ) : (
                <div className="text-xs md:max-w-[180px] md:truncate" title={r.transaction_id}>{r.transaction_id || '-'}</div>
            )
        },
        { key: 'by', header: 'Collected by', render: r => r.collected_by || '-' },
        {
            key: 'actions', header: '', align: 'center', hideOnMobile: true, render: r => (
                <div className="flex gap-1 justify-center">
                    <button onClick={() => onViewReceipt(r.receipt_no)} className="btn-primary btn-sm">View</button>
                    {isAdmin && <button onClick={() => handleEditReceipt(r)} className="btn-warn btn-sm">Edit</button>}
                </div>
            )
        },
    ];

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Find a student to see their receipts</h3>
                <div className="segmented w-full sm:w-auto mb-3" role="group" aria-label="Search by">
                    <button
                        type="button"
                        onClick={() => setSearchType('admission')}
                        className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${searchType === 'admission' ? 'segmented-item-active' : ''}`}
                    >
                        Admission number
                    </button>
                    <button
                        type="button"
                        onClick={() => setSearchType('name')}
                        className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${searchType === 'name' ? 'segmented-item-active' : ''}`}
                    >
                        Name
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <label htmlFor="search-student-term" className="sr-only">
                        {searchType === 'admission' ? 'Admission number' : 'Student name'}
                    </label>
                    <input
                        id="search-student-term"
                        type="search"
                        placeholder={searchType === 'admission' ? 'Type admission number, e.g. HARG0001' : "Type the student's name"}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="input min-h-[44px] flex-1"
                    />
                    <Button onClick={handleSearch} loading={searching} disabled={!searchTerm.trim()} className="min-h-[44px] sm:w-auto">
                        Find student
                    </Button>
                </div>
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            {/* Student List (when multiple results) */}
            {students.length > 1 && !selectedStudent && (
                <div className="space-y-2">
                    <h4 className="text-base font-semibold text-slate-900">Choose the student <span className="font-normal text-slate-500">({students.length} found)</span></h4>
                    <DataList
                        columns={studentColumns}
                        rows={students}
                        rowKey={(_, i) => i}
                        onRowClick={handleSelectStudent}
                    />
                </div>
            )}

            {/* Selected Student Info */}
            {selectedStudent && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 text-sm">
                            <CardField label="Student"><span className="font-semibold">{selectedStudent.name}</span></CardField>
                            <CardField label="Admission number"><span className="font-semibold text-brand-700">{selectedStudent.admission_no || selectedStudent.adm_no}</span></CardField>
                            <CardField label="Class"><span className="font-semibold">{selectedStudent.class} {selectedStudent.section}</span></CardField>
                            <CardField label="Father"><span className="font-semibold">{selectedStudent.father_name || selectedStudent.father || '-'}</span></CardField>
                        </dl>
                        <button
                            onClick={() => { setSelectedStudent(null); setReceipts([]); }}
                            className="btn-secondary btn-sm min-h-[44px] sm:min-h-0"
                        >
                            Choose another student
                        </button>
                    </div>
                </div>
            )}

            {loading && <LoadingState label="Loading receipts..." />}

            {/* Receipts */}
            {selectedStudent && !loading && (
                <>
                    <StatGrid>
                        <StatTile label="Receipts" value={receipts.length} />
                        <StatTile label="Total paid" value={totalCollected} money tone="good" />
                    </StatGrid>
                    <p className="text-sm text-slate-500">
                        {isAdmin ? 'You can change the date and payment details of these receipts.' : 'You can view these receipts. Only an admin can change them.'}
                    </p>

                    <DataList
                        columns={receiptColumns}
                        rows={receipts}
                        rowKey={(_, i) => i}
                        emptyTitle="No receipts found for this student"
                        mobileActions={r => (
                            <>
                                <button onClick={() => onViewReceipt(r.receipt_no)} className="btn-soft btn-sm flex-1 min-h-[44px]">View receipt</button>
                                {isAdmin && <button onClick={() => handleEditReceipt(r)} className="btn-secondary btn-sm flex-1 min-h-[44px]">Change details</button>}
                            </>
                        )}
                    />
                </>
            )}

            {/* Edit dialog */}
            {editingReceipt && (
                <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-end sm:items-center z-50 sm:p-4">
                    <div className="card shadow-pop max-w-md w-full max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-xl" role="dialog" aria-modal="true" aria-labelledby="edit-receipt-title">
                        <div className="card-header">
                            <h3 id="edit-receipt-title" className="text-base font-semibold text-slate-900">
                                Change receipt {editingReceipt.receipt_no}
                            </h3>
                            <button
                                onClick={() => setEditingReceipt(null)}
                                className="btn-icon"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Read-only info */}
                            <dl className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-200 grid grid-cols-2 gap-2">
                                <CardField label="Student"><span className="font-semibold">{selectedStudent?.name}</span></CardField>
                                <CardField label="Amount paid">
                                    <span className="font-semibold text-emerald-700">₹{(editingReceipt.amount_paid || editingReceipt.amount || 0).toLocaleString()}</span>
                                </CardField>
                            </dl>

                            <Field label="Date paid" htmlFor="edit-receipt-date" required>
                                <input
                                    id="edit-receipt-date"
                                    type="date"
                                    value={editForm.date ? (
                                        /^\d{2}-\d{2}-\d{4}$/.test(editForm.date)
                                            ? editForm.date.split('-').reverse().join('-')
                                            : editForm.date.split('T')[0]
                                    ) : ''}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    className="input min-h-[44px]"
                                />
                            </Field>

                            <Field label="Paid by" htmlFor="edit-receipt-mode" required>
                                <select
                                    id="edit-receipt-mode"
                                    value={editForm.mode}
                                    onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                                    className="input min-h-[44px]"
                                >
                                    {paymentModes.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </Field>

                            {editForm.mode === 'Cheque' ? (
                                <>
                                    <Field label="Cheque number" htmlFor="edit-receipt-chq">
                                        <input
                                            id="edit-receipt-chq"
                                            type="text"
                                            inputMode="numeric"
                                            value={editForm.cheque_no}
                                            onChange={(e) => setEditForm({ ...editForm, cheque_no: e.target.value })}
                                            className="input min-h-[44px]"
                                        />
                                    </Field>
                                    <Field label="Bank name" htmlFor="edit-receipt-bank">
                                        <input
                                            id="edit-receipt-bank"
                                            type="text"
                                            value={editForm.bank_name}
                                            onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                                            className="input min-h-[44px]"
                                        />
                                    </Field>
                                    <Field label="Cheque date" htmlFor="edit-receipt-chqdate">
                                        <input
                                            id="edit-receipt-chqdate"
                                            type="date"
                                            value={editForm.cheque_date ? (
                                                /^\d{2}-\d{2}-\d{4}$/.test(editForm.cheque_date)
                                                    ? editForm.cheque_date.split('-').reverse().join('-')
                                                    : editForm.cheque_date.split('T')[0]
                                            ) : ''}
                                            onChange={(e) => setEditForm({ ...editForm, cheque_date: e.target.value })}
                                            className="input min-h-[44px]"
                                        />
                                    </Field>
                                </>
                            ) : editForm.mode !== 'Cash' ? (
                                <Field label="Transaction ID" htmlFor="edit-receipt-txn">
                                    <input
                                        id="edit-receipt-txn"
                                        type="text"
                                        value={editForm.transaction_id}
                                        onChange={(e) => setEditForm({ ...editForm, transaction_id: e.target.value })}
                                        className="input min-h-[44px]"
                                    />
                                </Field>
                            ) : null}

                            <Alert tone="info">
                                Only the date, payment mode and transaction or cheque details can be changed. The amount, fee and student stay the same.
                            </Alert>
                        </div>

                        <div className="p-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50 [&>*]:flex-1 sm:[&>*]:flex-none">
                            <button
                                onClick={() => setEditingReceipt(null)}
                                disabled={saving}
                                className="btn-secondary min-h-[44px]"
                            >
                                Cancel
                            </button>
                            <Button onClick={handleSaveEdit} loading={saving} className="min-h-[44px]">
                                Save changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default {
    TodayCollection,
    DailyReport,
    MonthlyReport,
    ClassWiseReport,
    InstallmentWiseReport,
    DueReport,
    LateFeeDueReport,
    SearchStudentReport
};
