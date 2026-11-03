import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { confirmDialog, notify } from './ui/feedback';
import { Alert, EmptyState, LoadingState } from './ui';
import ApprovalCard from './cash/ApprovalCard';
import SegmentTabs from './cash/SegmentTabs';
import { rupees, shortDate } from './cash/format';

type StatusTab = 'Pending' | 'Approved' | 'Rejected';

const PettyCashApproval: React.FC = () => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const [transactions, setTransactions] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'expenses' | 'funds'>('expenses');
    const [statusTab, setStatusTab] = useState<StatusTab>('Pending');

    const getHeaders = () => {
        const token = localStorage.getItem('token') || '';
        const currentBranch = localStorage.getItem('currentBranch') || 'All';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Academic-Year': globalYear,
            'X-Branch': currentBranch
        };
    };

    const fetchTransactions = async () => {
        setListLoading(true);
        try {
            const res = await fetch(`${API_URL}/petty-cash`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (e) {
            console.error('Error fetching transactions', e);
        } finally {
            setListLoading(false);
        }
    };

    const fetchAllocations = async () => {
        setListLoading(true);
        try {
            const res = await fetch(`${API_URL}/petty-cash/allocations`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAllocations(data);
            }
        } catch (e) {
            console.error('Error fetching allocations', e);
        } finally {
            setListLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'expenses') {
            fetchTransactions();
        } else {
            fetchAllocations();
        }
    }, [activeTab]);

    const handleApproval = async (id: number, type: 'expense' | 'fund', status: 'Approved' | 'Rejected', what: string) => {
        const question = status === 'Approved' ? `Approve ${what}?` : `Reject ${what}?`;
        if (!await confirmDialog(question, {
            title: status === 'Approved' ? 'Approve' : 'Reject',
            confirmText: status === 'Approved' ? 'Yes, approve' : 'Yes, reject',
            cancelText: 'No, go back',
            tone: status === 'Approved' ? 'default' : 'danger',
        })) return;

        setLoading(true);
        try {
            const url = type === 'expense'
                ? `${API_URL}/petty-cash/${id}/approve`
                : `${API_URL}/petty-cash/fund-allocation/${id}/approve`;

            const res = await fetch(url, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ approval_status: status })
            });
            const data = await res.json();

            if (res.ok) {
                notify.success(status === 'Approved' ? 'Approved' : 'Rejected');
                if (type === 'expense') {
                    fetchTransactions();
                } else {
                    fetchAllocations();
                }
            } else {
                notify.error(data.message || 'Error updating status');
            }
        } catch (e) {
            notify.error('Network error. Check the internet and try again.');
        } finally {
            setLoading(false);
        }
    };

    const byStatus = (rows: any[], s: StatusTab) =>
        s === 'Pending' ? rows.filter(r => r.approval_status === 'Pending' || !r.approval_status) : rows.filter(r => r.approval_status === s);

    const rows = activeTab === 'expenses' ? transactions : allocations;
    const shown = byStatus(rows, statusTab);
    const pendingTotal = byStatus(rows, 'Pending').reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const emptyText = {
        Pending: 'Nothing is waiting for approval.',
        Approved: 'Nothing approved yet.',
        Rejected: 'Nothing rejected.',
    }[statusTab];

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Approve petty cash</h2>
                <p className="text-sm text-slate-500">Check each entry, then tap Approve or Reject.</p>
            </div>

            <SegmentTabs
                value={activeTab}
                onChange={setActiveTab}
                options={[
                    { value: 'expenses', label: 'Expenses' },
                    { value: 'funds', label: 'Money given to branches' },
                ]}
            />

            <SegmentTabs
                value={statusTab}
                onChange={setStatusTab}
                options={[
                    { value: 'Pending', label: 'Waiting', count: byStatus(rows, 'Pending').length },
                    { value: 'Approved', label: 'Approved', count: byStatus(rows, 'Approved').length },
                    { value: 'Rejected', label: 'Rejected', count: byStatus(rows, 'Rejected').length },
                ]}
            />

            {statusTab === 'Pending' && shown.length > 0 && (
                <Alert tone="warning">
                    {shown.length} waiting · {rupees(pendingTotal)} in total
                </Alert>
            )}

            {listLoading && rows.length === 0 ? (
                <LoadingState />
            ) : shown.length === 0 ? (
                <div className="card"><EmptyState compact title={emptyText} /></div>
            ) : activeTab === 'expenses' ? (
                <ul className="space-y-2.5">
                    {shown.map(t => (
                        <ApprovalCard
                            key={t.id}
                            title={t.voucher_name}
                            amount={rupees(t.amount)}
                            details={[
                                `${shortDate(t.transaction_date)} · ${t.voucher_type === 'Received' ? 'Money received' : 'Spent'}`,
                                [t.ledger_name, t.paid_to ? `Paid to ${t.paid_to}` : ''].filter(Boolean).join(' · '),
                                t.created_by ? `By ${t.created_by}` : '',
                            ]}
                            status={t.approval_status || 'Pending'}
                            busy={loading}
                            canDecide={statusTab === 'Pending'}
                            onApprove={() => handleApproval(t.id, 'expense', 'Approved', `${rupees(t.amount)} for ${t.voucher_name}`)}
                            onReject={() => handleApproval(t.id, 'expense', 'Rejected', `${rupees(t.amount)} for ${t.voucher_name}`)}
                        />
                    ))}
                </ul>
            ) : (
                <ul className="space-y-2.5">
                    {shown.map(a => (
                        <ApprovalCard
                            key={a.id}
                            title={a.branch_name || 'Branch'}
                            amount={<span className="text-emerald-700">{rupees(a.amount)}</span>}
                            details={[
                                `Given on ${shortDate(a.allocation_date)}`,
                                a.remarks ? `Note: ${a.remarks}` : '',
                            ]}
                            status={a.approval_status || 'Pending'}
                            busy={loading}
                            canDecide={statusTab === 'Pending'}
                            onApprove={() => handleApproval(a.id, 'fund', 'Approved', `${rupees(a.amount)} for ${a.branch_name}`)}
                            onReject={() => handleApproval(a.id, 'fund', 'Rejected', `${rupees(a.amount)} for ${a.branch_name}`)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PettyCashApproval;
