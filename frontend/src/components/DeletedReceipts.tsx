import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { notify } from './ui/feedback';
import { ErrorState, LoadingState } from './ui';
import DeletedReceiptList from './fee-reports/DeletedReceiptList';

const DeletedReceiptsReport: React.FC = () => {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/reports/fees/deleted-receipts`);
            setReceipts(res.data.receipts || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load deleted receipts');
        } finally {
            setLoading(false);
        }
    };

    const filteredReceipts = receipts.filter(r =>
        (r.student_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.admission_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.receipt_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportToExcel = () => {
        if (filteredReceipts.length === 0) return notify('Nothing to download');
        const data = filteredReceipts.map((r, idx) => ({
            'S.No': idx + 1,
            'Student Name': r.student_name,
            'Adm No.': r.admission_no,
            'Class': `${r.class} ${r.section}`,
            'Branch': r.branch,
            'Rcpt No': r.receipt_no,
            'Fee Type': r.fee_type_str,
            'Amount': r.amount_paid,
            'Mode': r.mode,
            'Deleted By': r.deleted_by,
            'Deleted At': r.deleted_at,
            'Cancel Reason': r.cancel_reason
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Deleted_Receipts");
        XLSX.writeFile(wb, "Deleted_Receipts_Report.xlsx");
    };

    const exportToPDF = () => {
        if (filteredReceipts.length === 0) return notify('Nothing to download');
        const doc = new jsPDF("l", "mm", "a4");
        doc.setFontSize(16);
        doc.text("Deleted Receipts Report", 14, 15);

        const tableColumn = ["S.No", "Student Name", "Adm No.", "Class", "Branch", "Rcpt No", "Fee Type", "Amount", "Mode", "Deleted By", "Deleted At", "Reason"];
        const tableRows = filteredReceipts.map((r, idx) => [
            idx + 1,
            r.student_name,
            r.admission_no,
            `${r.class} ${r.section}`,
            r.branch,
            r.receipt_no,
            r.fee_type_str,
            r.amount_paid,
            r.mode,
            r.deleted_by,
            r.deleted_at,
            r.cancel_reason
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 25,
            theme: 'grid',
            styles: { fontSize: 7 }
        });
        doc.save("Deleted_Receipts_Report.pdf");
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Cancelled receipts</h2>
                <p className="text-sm text-slate-500">Receipts that were cancelled, who cancelled them, and why.</p>
            </div>

            <div className="card p-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="w-full md:w-1/2">
                    <label htmlFor="deleted-search" className="block text-sm font-medium text-slate-800 mb-1.5">Find a receipt (optional)</label>
                    <input
                        id="deleted-search"
                        type="search"
                        placeholder="Student name, admission or receipt number"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input min-h-[44px]"
                    />
                </div>
                <div className="flex gap-2 [&>*]:flex-1 md:[&>*]:flex-none">
                    <button onClick={exportToExcel} className="btn-secondary btn-sm min-h-[44px] text-emerald-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Excel
                    </button>
                    <button onClick={exportToPDF} className="btn-secondary btn-sm min-h-[44px] text-red-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        PDF
                    </button>
                    <button onClick={fetchReport} className="btn-secondary btn-sm min-h-[44px]">
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="card"><LoadingState label="Loading cancelled receipts..." /></div>
            ) : error ? (
                <div className="card"><ErrorState title="Could not load the report" message={error} onRetry={fetchReport} /></div>
            ) : (
                <>
                    <p className="text-sm text-slate-600">
                        {filteredReceipts.length} cancelled {filteredReceipts.length === 1 ? 'receipt' : 'receipts'}{searchTerm ? ` matching "${searchTerm}"` : ''}
                    </p>
                    <DeletedReceiptList receipts={filteredReceipts} />
                </>
            )}
        </div>
    );
};

export default DeletedReceiptsReport;
