import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { Alert, EmptyState } from './ui';

const FundAllocation: React.FC = () => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const [branches, setBranches] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        branch_id: '',
        allocation_date: new Date().toISOString().split('T')[0],
        amount: '',
        remarks: '',
        approved_by: ''
    });
    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

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

    const fetchBranches = async () => {
        try {
            const res = await fetch(`${API_URL}/branches`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                const fetchedBranches = data.branches || [];
                setBranches(fetchedBranches);

                const globalBranchName = localStorage.getItem('currentBranch') || 'All';
                if (globalBranchName !== 'All') {
                    const found = fetchedBranches.find((b: any) => b.branch_name === globalBranchName);
                    if (found) {
                        setFormData(prev => ({ ...prev, branch_id: found.id.toString() }));
                    }
                }
            }
        } catch (e) {
            console.error(e);
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
            console.error(e);
        }
    };

    useEffect(() => {
        fetchBranches();
        fetchAllocations();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch(`${API_URL}/petty-cash/allocations`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setMessage('Fund Allocation successful!');
                setFormData({ ...formData, amount: '', remarks: '', approved_by: '' });
                fetchAllocations();
            } else {
                setMessage(data.message || 'Error saving allocation');
            }
        } catch (e) {
            setMessage('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="page-title">
                Fund Allocation
            </h2>
            <div className="card p-5">
                <h3 className="text-base font-semibold text-slate-900 mb-4">New Fund Allocation</h3>
                {message && (
                    <Alert
                        tone={message === 'Fund Allocation successful!' ? 'success' : 'error'}
                        onClose={() => setMessage('')}
                        className="mb-4"
                    >
                        {message}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="label">Branch *</label>
                        <select
                            name="branch_id"
                            value={formData.branch_id}
                            onChange={handleChange}
                            className="input"
                            required
                        >
                            <option value="">Select Branch</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Date *</label>
                        <input
                            type="date"
                            name="allocation_date"
                            value={formData.allocation_date}
                            onChange={handleChange}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Amount *</label>
                        <input
                            type="number"
                            step="0.01"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Approved By</label>
                        <input
                            type="text"
                            name="approved_by"
                            value={formData.approved_by}
                            onChange={handleChange}
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="label">Remarks</label>
                        <textarea
                            name="remarks"
                            value={formData.remarks}
                            onChange={handleChange}
                            className="input"
                            rows={1}
                        ></textarea>
                    </div>
                    <div className="md:col-span-2 lg:col-span-5 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Saving...' : 'Save Allocation'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card overflow-hidden">
                <div className="card-header">
                    <h3 className="text-base font-semibold text-slate-900">Recent Allocations</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-3 border">Date</th>
                                <th className="p-3 border">Branch</th>
                                <th className="p-3 border">Amount</th>
                                <th className="p-3 border text-center">Status</th>
                                <th className="p-3 border">Approved By</th>
                                <th className="p-3 border">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allocations.length === 0 && (
                                <tr>
                                    <td colSpan={6}><EmptyState compact title="No allocations found." /></td>
                                </tr>
                            )}
                            {allocations.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50">
                                    <td className="p-3 border">{a.allocation_date}</td>
                                    <td className="p-3 border">{a.branch_name}</td>
                                    <td className="p-3 border text-emerald-600 font-semibold">₹{Number(a.amount).toFixed(2)}</td>
                                    <td className="p-3 border text-center">
                                        <span className={
                                            a.approval_status === 'Approved' ? 'badge-success' :
                                            a.approval_status === 'Rejected' ? 'badge-danger' :
                                            'badge-warning'
                                        }>
                                            {a.approval_status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="p-3 border">{a.approved_by}</td>
                                    <td className="p-3 border">{a.remarks}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FundAllocation;
