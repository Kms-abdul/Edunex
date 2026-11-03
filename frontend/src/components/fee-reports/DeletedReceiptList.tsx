import React from 'react';
import { DataList } from '../ui';
import type { Column } from '../ui';

/** Cancelled / deleted receipts: cards on phones, a table on wide screens. Display only. */
const columns: Column<any>[] = [
    { key: 'student', header: 'Student', primary: true, render: r => <span className="font-medium">{r.student_name}</span> },
    {
        key: 'sub', header: 'Receipt', secondary: true,
        render: r => <>Receipt {r.receipt_no}{r.class ? ` · ${r.class} ${r.section || ''}` : ''}</>,
    },
    { key: 'adm', header: 'Admission no.', render: r => <span className="text-brand-600">{r.admission_no || '-'}</span> },
    { key: 'branch', header: 'Branch', hideOnMobile: true, render: r => r.branch || '-' },
    { key: 'fee', header: 'Fee', render: r => <span className="md:block md:max-w-[160px] md:truncate" title={r.fee_type_str}>{r.fee_type_str || '-'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: r => <span className="font-medium text-slate-800">₹{(r.amount_paid || 0).toLocaleString()}</span> },
    { key: 'mode', header: 'Paid by', render: r => r.mode || '-' },
    { key: 'date', header: 'Date paid', render: r => r.date || '-' },
    { key: 'collected', header: 'Collected by', hideOnMobile: true, render: r => r.collected_by || '-' },
    { key: 'deleted_by', header: 'Cancelled by', render: r => <span className="font-medium text-red-600">{r.deleted_by || '-'}</span> },
    { key: 'deleted_at', header: 'Cancelled on', render: r => <span className="text-xs text-red-600">{r.deleted_at || '-'}</span> },
    {
        key: 'reason', header: 'Reason',
        render: r => <span className="text-xs italic text-slate-600 md:block md:max-w-[180px] md:truncate" title={r.cancel_reason}>{r.cancel_reason || '-'}</span>,
    },
];

const DeletedReceiptList: React.FC<{ receipts: any[]; emptyTitle?: string }> = ({ receipts, emptyTitle = 'No cancelled receipts found' }) => (
    <DataList columns={columns} rows={receipts} rowKey={(_, i) => i} emptyTitle={emptyTitle} />
);

export default DeletedReceiptList;
