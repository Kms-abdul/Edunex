import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config';
import { ActionBar, Alert, Badge, DataList, Field, Steps } from './ui';
import type { Column } from './ui';
import SegmentTabs from './cash/SegmentTabs';
import { rupees, shortDate } from './cash/format';

const STEP_LABELS = ['Who gets the money?', 'Check and save'];

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

    const [view, setView] = useState<'new' | 'history'>('new');
    const [step, setStep] = useState(0);
    const [saved, setSaved] = useState<{ amount: string; branch: string; date: string } | null>(null);

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

    const branchName = branches.find(b => String(b.id) === String(formData.branch_id))?.branch_name || '';

    const handleSubmit = async () => {
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
                setSaved({ amount: formData.amount, branch: branchName, date: formData.allocation_date });
                setFormData({ ...formData, amount: '', remarks: '', approved_by: '' });
                fetchAllocations();
            } else {
                setMessage(data.message || 'Error saving allocation');
            }
        } catch (e) {
            setMessage('Network error. Check the internet and try again.');
        } finally {
            setLoading(false);
        }
    };

    const step1Note =
        !formData.branch_id ? 'Choose a branch.'
            : !formData.allocation_date ? 'Choose the date.'
                : formData.amount === '' || isNaN(parseFloat(formData.amount)) ? 'Write the amount.'
                    : '';
    const reviewLine = `Give ${rupees(formData.amount)} to ${branchName || '…'} on ${shortDate(formData.allocation_date)}`;

    const columns: Column<any>[] = [
        { key: 'branch_name', header: 'Branch', primary: true },
        { key: 'allocation_date', header: 'Date', secondary: true, render: a => shortDate(a.allocation_date) },
        { key: 'amount', header: 'Amount', align: 'right', render: a => <span className="font-semibold text-emerald-700">{rupees(a.amount)}</span> },
        { key: 'approval_status', header: 'Status', render: a => <Badge status={a.approval_status || 'Pending'} /> },
        { key: 'approved_by', header: 'Approved by', render: a => a.approved_by || '—' },
        { key: 'remarks', header: 'Note', render: a => a.remarks || '—' },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Give petty cash to a branch</h2>
                <p className="text-sm text-slate-500">Money given here is added to the branch's cash in hand for small expenses.</p>
            </div>

            <SegmentTabs
                value={view}
                onChange={setView}
                options={[
                    { value: 'new', label: 'Give money' },
                    { value: 'history', label: 'Past entries', count: allocations.length },
                ]}
            />

            {view === 'new' ? (
                <div className="card p-4 sm:p-5 max-w-2xl">
                    {saved ? (
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
                                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                                <p className="mt-3 text-xl font-semibold text-slate-900">{rupees(saved.amount)} given</p>
                                <p className="mt-1 text-sm text-slate-700">To {saved.branch} on {shortDate(saved.date)}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button type="button" className="btn-primary btn-lg" onClick={() => { setSaved(null); setStep(0); }}>Give more money</button>
                                <button type="button" className="btn-secondary btn-lg" onClick={() => { setSaved(null); setStep(0); setView('history'); }}>See past entries</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Steps steps={STEP_LABELS} current={step} onJump={setStep} className="mb-5" />
                            {message && (
                                <Alert tone="error" onClose={() => setMessage('')} className="mb-4">{message}</Alert>
                            )}

                            {step === 0 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Branch" htmlFor="fa-branch" required className="sm:col-span-2">
                                            <select id="fa-branch" name="branch_id" value={formData.branch_id} onChange={handleChange} className="input min-h-[44px]">
                                                <option value="">Choose a branch</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Amount" htmlFor="fa-amount" required>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                                <input
                                                    id="fa-amount"
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="0.01"
                                                    name="amount"
                                                    value={formData.amount}
                                                    onChange={handleChange}
                                                    className="input min-h-[44px] pl-7"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </Field>
                                        <Field label="Date" htmlFor="fa-date" required>
                                            <input id="fa-date" type="date" name="allocation_date" value={formData.allocation_date} onChange={handleChange} className="input min-h-[44px]" />
                                        </Field>
                                    </div>
                                    <ActionBar note={step1Note || undefined}>
                                        <button type="button" className="btn-primary btn-lg" disabled={!!step1Note} onClick={() => setStep(1)}>
                                            Next: check
                                        </button>
                                    </ActionBar>
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-4">
                                    <Alert tone="info" title={reviewLine} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Approved by (optional)" htmlFor="fa-approved">
                                            <input id="fa-approved" type="text" name="approved_by" value={formData.approved_by} onChange={handleChange} className="input min-h-[44px]" placeholder="Name" />
                                        </Field>
                                        <Field label="Note (optional)" htmlFor="fa-note">
                                            <textarea id="fa-note" name="remarks" value={formData.remarks} onChange={handleChange} className="input" rows={2} />
                                        </Field>
                                    </div>
                                    <ActionBar note={reviewLine}>
                                        <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(0)} disabled={loading}>Back</button>
                                        <button type="button" className="btn-primary btn-lg" onClick={handleSubmit} disabled={loading || !!step1Note}>
                                            {loading ? 'Saving…' : `Give ${rupees(formData.amount)}`}
                                        </button>
                                    </ActionBar>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <DataList
                    columns={columns}
                    rows={allocations}
                    rowKey={(a, i) => a.id ?? i}
                    emptyTitle="No money given yet"
                />
            )}
        </div>
    );
};

export default FundAllocation;
