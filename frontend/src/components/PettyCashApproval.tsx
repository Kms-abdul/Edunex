import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { confirmDialog } from './ui/feedback';
import { Alert, EmptyState } from './ui';

const PettyCashApproval: React.FC = () => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const [transactions, setTransactions] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'expenses' | 'funds'>('expenses');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

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
        try {
            const res = await fetch(`${API_URL}/petty-cash`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (e) {
            console.error('Error fetching transactions', e);
        }
    };

    const fetchAllocations = async () => {
        try {
            const res = await fetch(`${API_URL}/petty-cash/allocations`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAllocations(data);
            }
        } catch (e) {
            console.error('Error fetching allocations', e);
        }
    };

    useEffect(() => {
        if (activeTab === 'expenses') {
            fetchTransactions();
        } else {
            fetchAllocations();
        }
    }, [activeTab]);

    const handleApproval = async (id: number, type: 'expense' | 'fund', status: 'Approved' | 'Rejected') => {
        if (!await confirmDialog(`Are you sure you want to mark this as ${status}?`)) return;
        
        setLoading(true);
        setMessage('');
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
                setMessage(`Successfully marked as ${status}`);
                if (type === 'expense') {
                    fetchTransactions();
                } else {
                    fetchAllocations();
                }
            } else {
                setMessage(data.message || 'Error updating status');
            }
        } catch (e) {
            setMessage('Network error');
        } finally {
            setLoading(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setMessage(''), 3000);
        }
    };

    const pendingTransactions = transactions.filter(t => t.approval_status === 'Pending' || !t.approval_status);
    const approvedTransactions = transactions.filter(t => t.approval_status === 'Approved');
    const rejectedTransactions = transactions.filter(t => t.approval_status === 'Rejected');

    const pendingAllocations = allocations.filter(a => a.approval_status === 'Pending' || !a.approval_status);
    const approvedAllocations = allocations.filter(a => a.approval_status === 'Approved');
    const rejectedAllocations = allocations.filter(a => a.approval_status === 'Rejected');

    const renderTransactionTable = (title: string, txns: any[], showActions: boolean) => (
        <div className="card overflow-hidden mb-6">
            <div className="card-header">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <span className="text-sm text-slate-500">{txns.length} entries</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3 border">Date</th>
                            <th className="p-3 border">Voucher</th>
                            <th className="p-3 border">Type</th>
                            <th className="p-3 border">Ledger</th>
                            <th className="p-3 border">Amount</th>
                            <th className="p-3 border text-center">Status</th>
                            {showActions && <th className="p-3 border text-center">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {txns.length === 0 && (
                            <tr>
                                <td colSpan={showActions ? 7 : 6}><EmptyState compact title="No records found." /></td>
                            </tr>
                        )}
                        {txns.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="p-3 border">{t.transaction_date}</td>
                                <td className="p-3 border">{t.voucher_name}</td>
                                <td className="p-3 border">
                                    <span className={t.voucher_type === 'Received' ? 'badge-success' : 'badge-danger'}>
                                        {t.voucher_type}
                                    </span>
                                </td>
                                <td className="p-3 border">{t.ledger_name}</td>
                                <td className="p-3 border text-right font-semibold">₹{Number(t.amount).toFixed(2)}</td>
                                <td className="p-3 border text-center">
                                    <span className={
                                        t.approval_status === 'Approved' ? 'badge-success' :
                                        t.approval_status === 'Rejected' ? 'badge-danger' :
                                        'badge-warning'
                                    }>
                                        {t.approval_status || 'Pending'}
                                    </span>
                                </td>
                                {showActions && (
                                    <td className="p-3 border text-center space-x-2">
                                        <button 
                                            onClick={() => handleApproval(t.id, 'expense', 'Approved')}
                                            disabled={loading}
                                            className="btn-success btn-sm"
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => handleApproval(t.id, 'expense', 'Rejected')}
                                            disabled={loading}
                                            className="btn-danger btn-sm"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderAllocationTable = (title: string, allcs: any[], showActions: boolean) => (
        <div className="card overflow-hidden mb-6">
            <div className="card-header">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <span className="text-sm text-slate-500">{allcs.length} entries</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3 border">Date</th>
                            <th className="p-3 border">Branch</th>
                            <th className="p-3 border">Amount</th>
                            <th className="p-3 border">Remarks</th>
                            <th className="p-3 border text-center">Status</th>
                            {showActions && <th className="p-3 border text-center">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {allcs.length === 0 && (
                            <tr>
                                <td colSpan={showActions ? 6 : 5}><EmptyState compact title="No records found." /></td>
                            </tr>
                        )}
                        {allcs.map(a => (
                            <tr key={a.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="p-3 border">{a.allocation_date}</td>
                                <td className="p-3 border">{a.branch_name}</td>
                                <td className="p-3 border text-emerald-600 font-semibold">₹{Number(a.amount).toFixed(2)}</td>
                                <td className="p-3 border">{a.remarks}</td>
                                <td className="p-3 border text-center">
                                    <span className={
                                        a.approval_status === 'Approved' ? 'badge-success' :
                                        a.approval_status === 'Rejected' ? 'badge-danger' :
                                        'badge-warning'
                                    }>
                                        {a.approval_status || 'Pending'}
                                    </span>
                                </td>
                                {showActions && (
                                    <td className="p-3 border text-center space-x-2">
                                        <button 
                                            onClick={() => handleApproval(a.id, 'fund', 'Approved')}
                                            disabled={loading}
                                            className="btn-success btn-sm"
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => handleApproval(a.id, 'fund', 'Rejected')}
                                            disabled={loading}
                                            className="btn-danger btn-sm"
                                        >
                                            Reject
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="page-title">
                    Petty Cash Approval
                </h2>
            </div>
            
            {message && (
                <Alert tone={message.startsWith('Successfully') ? 'success' : 'error'} onClose={() => setMessage('')}>
                    {message}
                </Alert>
            )}

            {/* Tabs */}
            <div className="segmented max-w-full overflow-x-auto">
                <button
                    className={`segmented-item whitespace-nowrap ${activeTab === 'expenses' ? 'segmented-item-active' : ''}`}
                    onClick={() => setActiveTab('expenses')}
                >
                    Petty Cash Expenses
                </button>
                <button
                    className={`segmented-item whitespace-nowrap ${activeTab === 'funds' ? 'segmented-item-active' : ''}`}
                    onClick={() => setActiveTab('funds')}
                >
                    Fund Allocations
                </button>
            </div>

            {/* Content */}
            {activeTab === 'expenses' && (
                <div>
                    {renderTransactionTable("Pending Expense Approvals", pendingTransactions, true)}
                    {renderTransactionTable("Approved Expenses", approvedTransactions, false)}
                    {renderTransactionTable("Rejected Expenses", rejectedTransactions, false)}
                </div>
            )}

            {activeTab === 'funds' && (
                <div>
                    {renderAllocationTable("Pending Fund Allocations", pendingAllocations, true)}
                    {renderAllocationTable("Approved Fund Allocations", approvedAllocations, false)}
                    {renderAllocationTable("Rejected Fund Allocations", rejectedAllocations, false)}
                </div>
            )}
            
        </div>
    );
};

export default PettyCashApproval;
