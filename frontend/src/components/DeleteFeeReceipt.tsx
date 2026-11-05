import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import FeeReceipt from './FeeReceipt';
import { TrashIcon, PrinterIcon, RefreshIcon } from './icons';
import { notify } from './ui/feedback';
import { Alert, Badge, EmptyState, ErrorState, LoadingState } from './ui';

interface FeeItem {
    payment_id: number;
    fee_type: string;
    installment: string;
    amount_paid: string;
    concession_amount: string;
    gross_amount: string;
    due_amount: string;
    status: string;
}

interface ReceiptSummary {
    receipt_no: string;
    student_id: number;
    student_name: string;
    admission_no: string;
    enrollment_no: string;
    father_name: string;
    father_phone: string;
    branch: string;
    academic_year: string;
    class_name: string;
    section: string;
    payment_date: string;
    payment_mode: string;
    payment_note: string;
    collected_by: string;
    status: 'A' | 'I';
    cancel_reason: string;
    items: FeeItem[];
    total_paid: string;
    total_concession: string;
    total_gross: string;
    total_due: string;
}

const PREDEFINED_REASONS = [
    "Entered incorrect payment amount",
    "Wrong student / admission number selected",
    "Duplicate payment entry",
    "Cheque bounced / Transaction failed",
    "Student concession applied erroneously",
    "Parent requested refund / adjustment",
    "Other (specify below)"
];

// Reusable Pagination Component consistent with Fee Reports
const Pagination: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalRecords: number;
    perPage: number;
    onPerPageChange: (perPage: number) => void;
}> = ({ currentPage, totalPages, onPageChange, totalRecords, perPage, onPerPageChange }) => {
    if (totalRecords === 0) return null;

    const visiblePages = 3;
    const startPage = Math.max(1, Math.min(currentPage, totalPages - visiblePages + 1));
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);
    const pages = Array.from({ length: Math.max(0, endPage - startPage + 1) }, (_, i) => startPage + i);
    const showLastPage = endPage < totalPages;

    const startRecord = (currentPage - 1) * perPage + 1;
    const endRecord = Math.min(currentPage * perPage, totalRecords);

    return (
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
            <div className="flex items-center gap-3">
                <span className="text-slate-500 italic text-xs sm:text-sm">
                    Showing <span className="font-semibold text-slate-700">{startRecord}</span>–<span className="font-semibold text-slate-700">{endRecord}</span> of <span className="font-semibold text-slate-700">{totalRecords}</span>
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <label htmlFor="del-per-page">Per page:</label>
                    <select
                        id="del-per-page"
                        value={perPage}
                        onChange={(e) => onPerPageChange(Number(e.target.value))}
                        className="input py-1 px-2 w-auto text-xs min-h-[36px]"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(currentPage - 1)}
                        className="px-3 py-1 min-h-[44px] sm:min-h-0 text-xs sm:text-sm font-medium text-slate-600 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-600 mr-1 rounded hover:bg-slate-200/60 transition-colors"
                    >
                        Previous
                    </button>

                    {pages.map((p) => (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`btn min-w-[44px] h-[44px] sm:min-w-[32px] sm:h-[32px] sm:text-sm ${currentPage === p ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' }`}
                        >
                            {p}
                        </button>
                    ))}

                    {showLastPage && (
                        <>
                            <span className="px-1 text-slate-400">...</span>
                            <button
                                onClick={() => onPageChange(totalPages)}
                                className={`btn min-w-[44px] h-[44px] sm:min-w-[32px] sm:h-[32px] sm:text-sm ${currentPage === totalPages ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' }`}
                            >
                                {totalPages}
                            </button>
                        </>
                    )}

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                        className="px-3 py-1 min-h-[44px] sm:min-h-0 text-xs sm:text-sm font-medium text-slate-600 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-600 ml-1 rounded hover:bg-slate-200/60 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const DeleteFeeReceipt: React.FC = () => {
    const { hasPermission } = useAuth();

    // Permissions
    const canDeleteReceipt =
        hasPermission('fees.fee.delete-fee-receipt', 'delete') ||
        hasPermission('fees.fee.delete-fee-receipt', 'write') ||
        hasPermission('fees.fee.take-fee', 'delete');

    const canReadReceipts =
        hasPermission('fees.fee.delete-fee-receipt', 'read') ||
        canDeleteReceipt ||
        hasPermission('fees.fee.fee-reports', 'read') ||
        hasPermission('fees.fee.take-fee', 'read');

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [receiptNoSearch, setReceiptNoSearch] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'A' | 'I'>('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // Classes & Sections list
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);

    // Data states
    const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Cancel modal states
    const [receiptToCancel, setReceiptToCancel] = useState<ReceiptSummary | null>(null);
    const [selectedReasonOption, setSelectedReasonOption] = useState(PREDEFINED_REASONS[0]);
    const [customReason, setCustomReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    // Print Receipt states
    const [receiptDataForPrint, setReceiptDataForPrint] = useState<any | null>(null);
    const [loadingReceiptData, setLoadingReceiptData] = useState(false);

    // Fetch classes for filtering
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await api.get('/classes');
                if (res.data && res.data.classes) {
                    const classNames = Array.from(
                        new Set(res.data.classes.map((c: any) => String(c.class_name || c.name)))
                    ).filter(Boolean) as string[];
                    setClasses(classNames);
                }
            } catch (err) {
                console.error("Error fetching classes:", err);
            }
        };
        fetchClasses();
    }, []);

    // Fetch sections dynamically when selectedClass changes
    useEffect(() => {
        const fetchSections = async () => {
            if (!selectedClass) {
                setSections([]);
                setSelectedSection('');
                return;
            }
            try {
                const branch = localStorage.getItem('currentBranch') || 'All';
                const academicYear = localStorage.getItem('academicYear') || '';
                const response = await api.get('/sections', {
                    params: {
                        class: selectedClass,
                        branch: branch === 'All Branches' || branch === 'All' ? 'All' : branch,
                        academic_year: academicYear
                    }
                });
                const fetchedSections = (response.data.sections || []).map((s: any) =>
                    typeof s === 'object' ? s.section : String(s)
                );
                setSections(fetchedSections);
            } catch (error) {
                console.error('Error fetching sections:', error);
                setSections([]);
            }
        };
        fetchSections();
    }, [selectedClass]);

    // Fetch Receipts
    const fetchReceipts = useCallback(async () => {
        if (!canReadReceipts) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchTerm.trim()) params.append('search', searchTerm.trim());
            if (receiptNoSearch.trim()) params.append('receipt_no', receiptNoSearch.trim());
            if (selectedClass) params.append('class', selectedClass);
            if (selectedSection) params.append('section', selectedSection);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const res = await api.get(`/fees/receipts/search?${params.toString()}`);
            setReceipts(res.data.receipts || []);
            setCurrentPage(1); // Reset to page 1 on new search
        } catch (err: any) {
            console.error("Error searching receipts:", err);
            setError(err.response?.data?.error || "Failed to fetch fee receipts");
        } finally {
            setLoading(false);
        }
    }, [canReadReceipts, searchTerm, receiptNoSearch, selectedClass, selectedSection, statusFilter, startDate, endDate]);

    // Initial and filter-change fetch
    useEffect(() => {
        fetchReceipts();
    }, [statusFilter, selectedClass, selectedSection]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReceipts();
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setReceiptNoSearch('');
        setSelectedClass('');
        setSelectedSection('');
        setStatusFilter('all');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
        setTimeout(() => {
            fetchReceipts();
        }, 50);
    };

    // Open Cancel Modal
    const handleOpenCancelModal = (receipt: ReceiptSummary) => {
        setReceiptToCancel(receipt);
        setSelectedReasonOption(PREDEFINED_REASONS[0]);
        setCustomReason('');
        setError(null);
        setSuccessMessage(null);
    };

    // Perform Cancellation
    const handleConfirmCancel = async () => {
        if (!receiptToCancel) return;

        const finalReason = selectedReasonOption === "Other (specify below)"
            ? customReason.trim()
            : customReason.trim()
                ? `${selectedReasonOption} - ${customReason.trim()}`
                : selectedReasonOption;

        if (!finalReason) {
            notify("Write why you are cancelling this receipt.");
            return;
        }

        setIsCancelling(true);
        try {
            const res = await api.post(`/fees/receipt/${encodeURIComponent(receiptToCancel.receipt_no)}/cancel`, {
                reason: finalReason
            });

            setSuccessMessage(res.data.message || `Receipt #${receiptToCancel.receipt_no} has been cancelled successfully.`);
            setReceiptToCancel(null);
            fetchReceipts();
        } catch (err: any) {
            console.error("Error cancelling receipt:", err);
            notify(err.response?.data?.error || "Failed to cancel receipt.");
        } finally {
            setIsCancelling(false);
        }
    };

    // Handle Print Receipt
    const handlePrintReceipt = async (receiptNo: string) => {
        setLoadingReceiptData(true);
        try {
            const res = await api.get(`/reports/fees/receipt/${encodeURIComponent(receiptNo)}`);
            const payments = res.data.payments || [];
            if (payments.length === 0) {
                notify("Could not find this receipt's details.");
                return;
            }

            const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || p.amount_paid || 0), 0);
            const totalConcession = payments.reduce((sum: number, p: any) => sum + parseFloat(p.concession || p.concession_amount || 0), 0);
            const totalGross = payments.reduce(
                (sum: number, p: any) =>
                    sum +
                    (parseFloat(p.previous_due || 0) ||
                        parseFloat(p.amount_paid || p.amount || 0) +
                            parseFloat(p.due_amount || 0) +
                            parseFloat(p.concession_amount || p.concession || 0) ||
                        parseFloat(p.gross_amount || 0)),
                0
            );
            const totalDue = payments.reduce((sum: number, p: any) => sum + parseFloat(p.due_amount || 0), 0);

            const formatted = {
                studentName: res.data.studentName || payments[0]?.name || "N/A",
                fatherName: res.data.fatherName || payments[0]?.fatherName || "N/A",
                fatherPhone: res.data.fatherPhone || payments[0]?.fatherPhone || "N/A",
                admissionNo: res.data.admissionNo || payments[0]?.admNo || "N/A",
                branch: res.data.branch || payments[0]?.branch || "N/A",
                className: res.data.className || payments[0]?.class || "N/A",
                receiptNo: receiptNo,
                paymentDate: res.data.paymentDate || payments[0]?.payment_date,
                paymentMode: res.data.paymentMode || payments[0]?.mode || "Cash",
                paymentNote: res.data.paymentNote || "",
                items: payments.map((p: any) => {
                    const paid = parseFloat(p.amount_paid || p.amount || 0);
                    const due = parseFloat(p.due_amount || 0);
                    const concession = parseFloat(p.concession_amount || p.concession || 0);
                    const amount =
                        parseFloat(p.previous_due || 0) ||
                        paid + due + concession ||
                        parseFloat(p.gross_amount || 0);
                    return {
                        title: `${p.fee_type || ''} ${p.installment || p.installment_name || ''}`.trim() || 'Fee Item',
                        amount: amount,
                        amount_paid: paid,
                        paid: paid,
                        due_amount: due,
                        due: due,
                        payable: amount
                    };
                }),
                amount: totalGross,
                concession: totalConcession,
                payable: totalGross - totalConcession,
                paid: totalPaid,
                due: totalDue
            };

            setReceiptDataForPrint(formatted);
        } catch (err: any) {
            console.error("Error loading receipt for print:", err);
            notify(err.response?.data?.error || "Failed to load receipt details.");
        } finally {
            setLoadingReceiptData(false);
        }
    };

    // Calculate Summary Stats
    const activeCount = receipts.filter(r => r.status === 'A').length;
    const cancelledCount = receipts.filter(r => r.status === 'I').length;
    const totalCollected = receipts
        .filter(r => r.status === 'A')
        .reduce((sum, r) => sum + parseFloat(r.total_paid || '0'), 0);

    // Paginated records calculation
    const totalPages = Math.ceil(receipts.length / perPage) || 1;
    const paginatedReceipts = useMemo(() => {
        const start = (currentPage - 1) * perPage;
        return receipts.slice(start, start + perPage);
    }, [receipts, currentPage, perPage]);

    const isOtherReason = selectedReasonOption === "Other (specify below)";
    const reasonMissing = isOtherReason && !customReason.trim();
    const money = (v: string | number) => `₹${(parseFloat(String(v || 0)) || 0).toLocaleString('en-IN')}`;
    const classLabel = (r: ReceiptSummary) => (r.class_name ? `${r.class_name}${r.section ? ` ${r.section}` : ''}` : '');
    const extraFilterCount = [statusFilter !== 'all', selectedClass, selectedSection, startDate, endDate].filter(Boolean).length;

    const feeLines = (r: ReceiptSummary) => (
        <ul className="space-y-0.5">
            {r.items.map((it, idx) => (
                <li key={idx} className="text-xs text-slate-700">
                    <span className="font-medium">{it.fee_type}</span>
                    {it.installment && it.installment !== 'One-Time' && <span className="text-slate-500"> ({it.installment})</span>}
                    <span className="text-slate-400"> · </span>
                    <span className="text-slate-600">₹{parseFloat(it.amount_paid).toLocaleString('en-IN')}</span>
                </li>
            ))}
        </ul>
    );

    const statusBadge = (r: ReceiptSummary) => r.status === 'I' ? <Badge tone="danger">Cancelled</Badge> : <Badge tone="success">Active</Badge>;

    if (!canReadReceipts) {
        return (
            <div className="w-full p-4 sm:p-8 max-w-[1600px] mx-auto">
                <div className="card">
                    <ErrorState title="You can't open this page" message="You do not have permission to see or cancel fee receipts. Ask an admin for access." />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900">Cancel a fee receipt</h2>
                    <p className="text-sm text-slate-500">
                        Find the receipt, check it, then cancel it with a reason. The fees on it become unpaid again for that student.
                    </p>
                </div>
                <button onClick={fetchReceipts} disabled={loading} className="btn-secondary btn-sm min-h-[44px] sm:min-h-0 flex-shrink-0" aria-label="Refresh list">
                    <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>

            {/* Notification Messages */}
            {successMessage && (
                <Alert tone="success" onClose={() => setSuccessMessage(null)}>
                    {successMessage}
                </Alert>
            )}

            {error && (
                <Alert tone="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Search & Filter Card */}
            <div className="card p-4 sm:p-5">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4">
                        <div className="md:col-span-4">
                            <label htmlFor="del-receipt-no" className="block text-sm font-medium text-slate-800 mb-1.5">Receipt number</label>
                            <input
                                id="del-receipt-no"
                                type="text"
                                value={receiptNoSearch}
                                onChange={(e) => setReceiptNoSearch(e.target.value)}
                                placeholder="e.g. 1024"
                                className="input min-h-[44px] font-medium"
                            />
                        </div>

                        <div className="md:col-span-5">
                            <label htmlFor="del-student" className="block text-sm font-medium text-slate-800 mb-1.5">Or student name / admission number</label>
                            <input
                                id="del-student"
                                type="search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Name, admission or enrolment number"
                                className="input min-h-[44px]"
                            />
                        </div>

                        <div className="sm:col-span-2 md:col-span-3 flex items-end gap-2">
                            <button type="submit" className="btn-primary flex-1 min-h-[44px]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Find receipts
                            </button>
                            <button type="button" onClick={handleResetFilters} className="btn-secondary min-h-[44px]">
                                Clear
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowMoreFilters(v => !v)}
                        className="md:hidden btn-ghost btn-sm min-h-[44px] -ml-2"
                        aria-expanded={showMoreFilters}
                    >
                        {showMoreFilters ? 'Hide more filters' : `More filters${extraFilterCount ? ` (${extraFilterCount} on)` : ''}`}
                    </button>

                    {/* More filters */}
                    <div className={`${showMoreFilters ? 'grid' : 'hidden md:grid'} grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100`}>
                        <div>
                            <label htmlFor="del-status" className="block text-sm font-medium text-slate-800 mb-1.5">Show</label>
                            <select
                                id="del-status"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="input min-h-[44px]"
                            >
                                <option value="all">All receipts</option>
                                <option value="A">Active only</option>
                                <option value="I">Cancelled only</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="del-class" className="block text-sm font-medium text-slate-800 mb-1.5">Class</label>
                            <select
                                id="del-class"
                                value={selectedClass}
                                onChange={(e) => {
                                    setSelectedClass(e.target.value);
                                    setSelectedSection('');
                                    setCurrentPage(1);
                                }}
                                className="input min-h-[44px]"
                            >
                                <option value="">All classes</option>
                                {classes.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="del-section" className="block text-sm font-medium text-slate-800 mb-1.5">Section</label>
                            <select
                                id="del-section"
                                value={selectedSection}
                                onChange={(e) => {
                                    setSelectedSection(e.target.value);
                                    setCurrentPage(1);
                                }}
                                disabled={!selectedClass || sections.length === 0}
                                className="input min-h-[44px]"
                            >
                                <option value="">All sections</option>
                                {sections.map((s, idx) => (
                                    <option key={idx} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="del-from" className="block text-sm font-medium text-slate-800 mb-1.5">From date</label>
                            <input
                                id="del-from"
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="input min-h-[44px]"
                            />
                        </div>

                        <div>
                            <label htmlFor="del-to" className="block text-sm font-medium text-slate-800 mb-1.5">To date</label>
                            <input
                                id="del-to"
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="input min-h-[44px]"
                            />
                        </div>
                    </div>
                </form>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500">Receipts found</p>
                    <p className="mt-1 text-lg sm:text-2xl font-bold text-slate-900">{receipts.length}</p>
                </div>
                <div className="card p-4 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500">Active</p>
                    <p className="mt-1 text-lg sm:text-2xl font-bold text-emerald-600">{activeCount}</p>
                </div>
                <div className="card p-4 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500">Cancelled</p>
                    <p className="mt-1 text-lg sm:text-2xl font-bold text-red-600">{cancelledCount}</p>
                </div>
                <div className="card p-4 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500">Paid on active receipts</p>
                    <p className="mt-1 text-lg sm:text-2xl font-bold text-brand-600 break-words">₹{totalCollected.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {/* Receipts list & pagination */}
            <div className="card overflow-hidden flex flex-col">
                <div className="card-header">
                    <h3 className="font-semibold text-slate-800 text-base">
                        Receipts <span className="font-normal text-slate-500">({receipts.length})</span>
                    </h3>
                    <span className="text-xs text-slate-500">
                        Page {currentPage} of {totalPages}
                    </span>
                </div>

                {loading ? (
                    <LoadingState label="Loading fee receipts..." />
                ) : paginatedReceipts.length === 0 ? (
                    <EmptyState compact title="No receipts found" description="Check the receipt number or name, or clear the filters." />
                ) : (
                    <>
                        {/* Phone: cards */}
                        <ul className="md:hidden divide-y divide-slate-100">
                            {paginatedReceipts.map((r) => {
                                const isCancelled = r.status === 'I';
                                return (
                                    <li key={r.receipt_no} className={`px-4 py-3 ${isCancelled ? 'bg-red-50/40' : ''}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[15px] font-semibold text-slate-900 break-words">{r.student_name}</p>
                                                <p className="text-sm text-slate-500 break-words">
                                                    {[classLabel(r), r.admission_no && `Adm ${r.admission_no}`].filter(Boolean).join(' · ')}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-base font-bold text-slate-900 whitespace-nowrap">{money(r.total_paid)}</p>
                                                {statusBadge(r)}
                                            </div>
                                        </div>
                                        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                            <div className="min-w-0"><dt className="text-xs text-slate-500">Receipt number</dt><dd className="text-slate-800">#{r.receipt_no}</dd></div>
                                            <div className="min-w-0"><dt className="text-xs text-slate-500">Date</dt><dd className="text-slate-800">{r.payment_date || 'N/A'}</dd></div>
                                            <div className="min-w-0"><dt className="text-xs text-slate-500">Paid by</dt><dd className="text-slate-800">{r.payment_mode || 'Cash'}</dd></div>
                                            {parseFloat(r.total_concession) > 0 && (
                                                <div className="min-w-0"><dt className="text-xs text-slate-500">Concession</dt><dd className="text-slate-800">{money(r.total_concession)}</dd></div>
                                            )}
                                            <div className="col-span-2 min-w-0"><dt className="text-xs text-slate-500">Fees on this receipt</dt><dd>{feeLines(r)}</dd></div>
                                            {isCancelled && r.cancel_reason && (
                                                <div className="col-span-2 min-w-0"><dt className="text-xs text-slate-500">Why it was cancelled</dt><dd className="text-red-700 break-words">{r.cancel_reason}</dd></div>
                                            )}
                                        </dl>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => handlePrintReceipt(r.receipt_no)}
                                                disabled={loadingReceiptData}
                                                className="btn-secondary btn-sm flex-1 min-h-[44px]"
                                            >
                                                <PrinterIcon className="w-4 h-4" /> View / print
                                            </button>
                                            {canDeleteReceipt && !isCancelled && (
                                                <button
                                                    onClick={() => handleOpenCancelModal(r)}
                                                    className="btn-secondary btn-sm flex-1 min-h-[44px] text-red-600 border-red-200"
                                                >
                                                    <TrashIcon className="w-4 h-4" /> Cancel receipt
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Wide screens: table */}
                        <div className="hidden md:block overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-slate-50 text-xs font-medium text-slate-600">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-4 py-3">Receipt no.</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Student</th>
                                        <th className="px-4 py-3">Class</th>
                                        <th className="px-4 py-3">Fees</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Concession</th>
                                        <th className="px-4 py-3">Paid by</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedReceipts.map((r) => {
                                        const isCancelled = r.status === 'I';
                                        return (
                                            <tr
                                                key={r.receipt_no}
                                                className={`hover:bg-slate-50/80 transition-colors ${isCancelled ? 'bg-red-50/40' : ''}`}
                                            >
                                                <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                                    #{r.receipt_no}
                                                    <div className="text-[11px] font-normal text-slate-500">{r.academic_year}</div>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                                                    {r.payment_date || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-slate-900">{r.student_name}</div>
                                                    <div className="text-xs text-slate-500">Adm: {r.admission_no || 'N/A'} {r.branch ? `• ${r.branch}` : ''}</div>
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                                                    {r.class_name ? `${r.class_name} ${r.section ? `(${r.section})` : ''}` : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3.5"><div className="max-w-xs">{feeLines(r)}</div></td>
                                                <td className="px-4 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                                    {money(r.total_paid)}
                                                </td>
                                                <td className="px-4 py-3.5 text-right text-slate-600 whitespace-nowrap">
                                                    {parseFloat(r.total_concession) > 0 ? money(r.total_concession) : '₹0'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                                                    <span className="badge-neutral">{r.payment_mode || 'Cash'}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    {isCancelled ? (
                                                        <div className="inline-flex flex-col items-center">
                                                            <Badge tone="danger">Cancelled</Badge>
                                                            {r.cancel_reason && (
                                                                <span className="text-[11px] text-red-600 max-w-[150px] truncate mt-0.5 italic" title={r.cancel_reason}>
                                                                    {r.cancel_reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge tone="success">Active</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handlePrintReceipt(r.receipt_no)}
                                                            disabled={loadingReceiptData}
                                                            title="View / print receipt"
                                                            aria-label={`View or print receipt ${r.receipt_no}`}
                                                            className="btn-icon text-brand-600 hover:text-brand-800 hover:bg-brand-50"
                                                        >
                                                            <PrinterIcon className="w-4 h-4" />
                                                        </button>
                                                        {canDeleteReceipt && (
                                                            <button
                                                                onClick={() => handleOpenCancelModal(r)}
                                                                disabled={isCancelled}
                                                                title={isCancelled ? "Already cancelled" : "Cancel this receipt"}
                                                                className={`btn btn-sm ${isCancelled ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:text-red-800 hover:bg-red-50'}`}
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                                <span>Cancel</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Pagination Controls */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    totalRecords={receipts.length}
                    perPage={perPage}
                    onPerPageChange={(n) => {
                        setPerPage(n);
                        setCurrentPage(1);
                    }}
                />
            </div>

            {/* Cancel confirmation: shows the receipt and asks for a reason */}
            {receiptToCancel && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50 animate-fade-in">
                    <div
                        className="card shadow-pop max-w-lg w-full max-h-[95vh] flex flex-col overflow-hidden rounded-b-none sm:rounded-b-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cancel-receipt-title"
                    >
                        {/* Header */}
                        <div className="bg-red-50 border-b border-red-100 px-4 sm:px-6 py-4 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                                <TrashIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 id="cancel-receipt-title" className="text-base font-semibold text-red-900">
                                    Cancel receipt #{receiptToCancel.receipt_no}?
                                </h3>
                                <p className="text-sm text-red-700 mt-0.5">Check the details below before you cancel.</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto">
                            {/* Receipt summary */}
                            <dl className="rounded-xl border border-slate-200 p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div className="col-span-2 min-w-0">
                                    <dt className="text-xs text-slate-500">Student</dt>
                                    <dd className="font-semibold text-slate-900 break-words">
                                        {receiptToCancel.student_name}
                                        <span className="font-normal text-slate-500"> · Adm {receiptToCancel.admission_no}{classLabel(receiptToCancel) ? ` · ${classLabel(receiptToCancel)}` : ''}</span>
                                    </dd>
                                </div>
                                <div className="min-w-0"><dt className="text-xs text-slate-500">Date paid</dt><dd className="text-slate-800">{receiptToCancel.payment_date || 'N/A'}</dd></div>
                                <div className="min-w-0"><dt className="text-xs text-slate-500">Paid by</dt><dd className="text-slate-800">{receiptToCancel.payment_mode || 'Cash'}</dd></div>
                                <div className="col-span-2 min-w-0"><dt className="text-xs text-slate-500">Fees on this receipt</dt><dd>{feeLines(receiptToCancel)}</dd></div>
                                <div className="col-span-2 flex items-center justify-between border-t border-slate-100 pt-2">
                                    <dt className="text-sm font-medium text-slate-700">Amount paid</dt>
                                    <dd className="text-lg font-bold text-slate-900">{money(receiptToCancel.total_paid)}</dd>
                                </div>
                            </dl>

                            <Alert tone="warning" title="What happens when you cancel">
                                The {money(receiptToCancel.total_paid)} on this receipt is taken back from the fee records, and these fees become unpaid again for this student.
                            </Alert>

                            <div>
                                <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-800 mb-1.5">
                                    Why are you cancelling it? <span className="text-red-600" aria-hidden="true">*</span>
                                </label>
                                <select
                                    id="cancel-reason"
                                    value={selectedReasonOption}
                                    onChange={(e) => setSelectedReasonOption(e.target.value)}
                                    className="input min-h-[44px]"
                                >
                                    {PREDEFINED_REASONS.map((reason, idx) => (
                                        <option key={idx} value={reason}>{reason}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="cancel-details" className="block text-sm font-medium text-slate-800 mb-1.5">
                                    {isOtherReason ? 'Write the reason' : 'More details (optional)'}
                                    {isOtherReason && <span className="text-red-600" aria-hidden="true"> *</span>}
                                </label>
                                <textarea
                                    id="cancel-details"
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    rows={3}
                                    placeholder="Explain why this receipt is being cancelled..."
                                    className="input"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200">
                            {reasonMissing && <p className="mb-2 text-sm text-slate-600">Write the reason to continue.</p>}
                            <div className="flex items-center justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                                <button
                                    type="button"
                                    onClick={() => setReceiptToCancel(null)}
                                    disabled={isCancelling}
                                    className="btn-secondary min-h-[44px]"
                                >
                                    Keep receipt
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCancel}
                                    disabled={isCancelling || reasonMissing}
                                    className="btn-danger min-h-[44px]"
                                >
                                    {isCancelling ? (
                                        <>
                                            <RefreshIcon className="w-4 h-4 animate-spin" />
                                            Cancelling...
                                        </>
                                    ) : (
                                        <>
                                            <TrashIcon className="w-4 h-4" />
                                            Cancel receipt
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Opening receipt */}
            {loadingReceiptData && (
                <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-center z-50">
                    <div className="card px-8"><LoadingState label="Opening receipt…" /></div>
                </div>
            )}

            {/* Printable Receipt Modal */}
            {receiptDataForPrint && (
                <FeeReceipt
                    receiptData={receiptDataForPrint}
                    onClose={() => setReceiptDataForPrint(null)}
                />
            )}
        </div>
    );
};

export default DeleteFeeReceipt;
