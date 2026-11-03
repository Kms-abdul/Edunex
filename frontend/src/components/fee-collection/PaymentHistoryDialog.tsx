import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { PrinterIcon } from '../icons';
import { Badge, DataList } from '../ui';
import type { Column } from '../ui';
import { groupInstallments } from './groupInstallments';
import { formatDay, rupees } from './FeeCard';

interface HistoryRow {
    receiptNo: string;
    academicYear: string;
    date: string;
    titles: string[];
    amount: number;
    concession: number;
    mode: string;
    isCancelled: boolean;
    cancelReason?: string;
}

/**
 * "Past payments" for one student: every receipt, with print.
 * Same grouping and totals as the old Payment History table.
 */
const PaymentHistoryDialog: React.FC<{
    studentName?: string;
    academicYear?: string | null;
    paymentHistory: any[];
    installments: { sr: number; title: string }[];
    showCancelled: boolean;
    onShowCancelledChange: (v: boolean) => void;
    onPrint: (receiptNo: string) => void;
    onClose: () => void;
}> = ({ studentName, academicYear, paymentHistory, installments, showCancelled, onShowCancelledChange, onPrint, onClose }) => {
    const rows: HistoryRow[] = useMemo(
        () =>
            Object.values(
                paymentHistory.reduce((acc: any, curr) => {
                    if (!acc[curr.receipt_no]) acc[curr.receipt_no] = [];
                    acc[curr.receipt_no].push(curr);
                    return acc;
                }, {})
            ).map((group: any) => {
                const first = group[0];
                const enrichedGroup = group.map((p: any) => {
                    const match = installments.find(
                        i => i.title === p.installment || i.title === `${p.installment} Fee`
                    );
                    return { ...p, sr: match ? match.sr : 0 };
                });
                const groupedDetails = groupInstallments(enrichedGroup);
                const totalAmount = group.reduce((sum: number, p: any) => sum + parseFloat(p.amount_paid), 0);
                const totalConcession = group.reduce(
                    (sum: number, p: any) => sum + parseFloat(p.concession_amount),
                    0
                );
                return {
                    receiptNo: first.receipt_no,
                    academicYear: first.academic_year,
                    date: first.payment_date,
                    titles: groupedDetails.map((g: any) => g.title),
                    amount: totalAmount,
                    concession: totalConcession,
                    mode: first.mode,
                    isCancelled: first.status === 'I',
                    cancelReason: first.cancel_reason
                };
            }),
        [paymentHistory, installments]
    );

    const printButton = (r: HistoryRow, withText?: boolean) => (
        <button
            type="button"
            onClick={() => onPrint(r.receiptNo)}
            title="Print receipt"
            aria-label={`Print receipt ${r.receiptNo}`}
            className={withText ? 'btn-secondary btn-sm' : 'btn-icon text-brand-600 hover:text-brand-800 hover:bg-brand-50'}
        >
            <PrinterIcon className="w-5 h-5" />
            {withText && 'Print receipt'}
        </button>
    );

    const columns: Column<HistoryRow>[] = [
        { key: 'receiptNo', header: 'Receipt number', primary: true, render: r => `Receipt ${r.receiptNo}` },
        { key: 'date', header: 'Date', secondary: true, render: r => `${formatDay(r.date)} · ${r.mode}` },
        {
            key: 'titles',
            header: 'Fees',
            render: r => (
                <div className="space-y-0.5">
                    {r.titles.map((t, i) => (
                        <div key={i} className="font-medium">{t}</div>
                    ))}
                </div>
            )
        },
        { key: 'amount', header: 'Amount', align: 'right', render: r => rupees(r.amount) },
        { key: 'concession', header: 'Concession', align: 'right', render: r => rupees(r.concession) },
        { key: 'academicYear', header: 'Year' },
        {
            key: 'status',
            header: 'Status',
            render: r =>
                r.isCancelled ? (
                    <div className="text-xs">
                        <Badge tone="danger">Cancelled</Badge>
                        {r.cancelReason && <div className="mt-1 text-slate-500 italic">{r.cancelReason}</div>}
                    </div>
                ) : (
                    <Badge tone="success">Active</Badge>
                )
        },
        { key: 'actions', header: 'Print', align: 'center', hideOnMobile: true, render: r => printButton(r) }
    ];

    return (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-stretch sm:items-center z-50">
            <div className="card rounded-none sm:rounded-xl shadow-pop w-full max-w-4xl sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900">Past payments</h2>
                        <p className="text-sm text-slate-500 break-words">
                            {studentName}
                            {academicYear ? ` · ${academicYear}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 mb-4 min-h-[44px]">
                    <input
                        type="checkbox"
                        checked={showCancelled}
                        onChange={e => onShowCancelledChange(e.target.checked)}
                        className="h-5 w-5 text-brand-600 rounded border-slate-300"
                    />
                    Show cancelled receipts too
                </label>

                <DataList
                    columns={columns}
                    rows={rows}
                    rowKey={r => r.receiptNo}
                    emptyTitle="No payments yet."
                    mobileActions={r => printButton(r, true)}
                />

                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistoryDialog;
