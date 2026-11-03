import React, { useState, useEffect } from 'react';
import api from '../api';
import { Alert, EmptyState, Field, LoadingState } from './ui';
import { Intro, prettyDate } from './fee-setup/shared';

interface Installment {
    id: number;
    installment_no: number;
    title: string;
    start_date: string;
    end_date: string;
    last_pay_date: string;
    is_admission: boolean;
    description?: string;
    fee_type_id?: number | null;
    fee_type_name?: string;
    branch?: string;
    location?: string;
    academic_year?: string;
}

const UpdateRebateDate: React.FC = () => {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [newDates, setNewDates] = useState<Record<number, string>>({});
    const [savingId, setSavingId] = useState<number | null>(null);
    const [feeFilter, setFeeFilter] = useState('');

    const branch = localStorage.getItem('currentBranch') || 'All';
    const academicYear = localStorage.getItem('academicYear') || '';

    useEffect(() => {
        fetchInstallments();
    }, [branch, academicYear]);

    const fetchInstallments = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/installment-schedule?branch=${encodeURIComponent(branch)}`);

            // Handle both response formats safely
            const installmentsData = Array.isArray(response.data)
                ? response.data
                : (response.data.installments || []);

            // Filter by academic year (backend should already filter, but safety check)
            const filtered = academicYear
                ? installmentsData.filter((inst: Installment) =>
                    inst.academic_year === academicYear
                )
                : installmentsData;
            setInstallments(filtered);
            setError('');
        } catch (err: any) {
            console.error("Error fetching installments", err);
            setError(err.response?.data?.error || 'Failed to fetch installments');
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (id: number, value: string) => {
        setNewDates(prev => ({ ...prev, [id]: value }));
    };

    const handleSave = async (inst: Installment) => {
        const newDate = newDates[inst.id];
        if (!newDate) {
            setError('Choose the new date first.');
            setTimeout(() => setError(''), 3000);
            return;
        }

        try {
            setSavingId(inst.id);
            setSuccessMessage('');
            setError('');

            const payload = {
                installment_title: inst.title,
                academic_year: inst.academic_year || academicYear,
                branch: branch,
                new_due_date: newDate
            };

            const response = await api.put('/update-rebate-date', payload);

            setSuccessMessage(`Saved. ${inst.title}: students now pay by ${prettyDate(newDate)}.${response.data.message ? ` (${response.data.message})` : ''}`);
            setTimeout(() => setSuccessMessage(''), 5001);

            // Clear the local state for this row
            setNewDates(prev => {
                const updated = { ...prev };
                delete updated[inst.id];
                return updated;
            });

        } catch (err: any) {
            console.error("Error updating rebate date", err);
            setError(err.response?.data?.error || 'Failed to update rebate date');
            setTimeout(() => setError(''), 5001);
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <LoadingState label="Loading installments…" />;
    }

    const feeNames = Array.from(new Set(installments.map(i => i.fee_type_name || '').filter(Boolean)));
    const shown = feeFilter ? installments.filter(i => (i.fee_type_name || '') === feeFilter) : installments;
    const branchLabel = branch === 'All' || branch === 'All Branches' ? 'All branches' : branch;

    return (
        <div className="max-w-5xl mx-auto space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Last date to pay</h2>
                <Intro>
                    Move the last date to pay for an installment. It changes the date for every student who has this fee
                    in <strong>{branchLabel}</strong>{academicYear ? <> for <strong>{academicYear}</strong></> : null}.
                    The installment setup itself is not changed.
                </Intro>
            </div>

            {error && <Alert tone="error" onClose={() => setError('')}>{error}</Alert>}
            {successMessage && <Alert tone="success" onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}

            {feeNames.length > 1 && (
                <Field label="Show installments of" htmlFor="urd-filter" className="sm:max-w-xs">
                    <select id="urd-filter" value={feeFilter} onChange={e => setFeeFilter(e.target.value)} className="input">
                        <option value="">All fees</option>
                        {feeNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </Field>
            )}

            {shown.length === 0 ? (
                <div className="card">
                    <EmptyState compact title="No installments found" description="There are no installments for this branch and year." />
                </div>
            ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {shown.map(inst => (
                        <li key={inst.id} className="card">
                            <div className="card-body space-y-3">
                                <div>
                                    <p className="text-[15px] font-semibold text-slate-900 break-words">
                                        {inst.title}
                                        {inst.is_admission && <span className="ml-2 badge-success">Admission</span>}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {inst.fee_type_name || 'Fee'} · {prettyDate(inst.start_date)} – {prettyDate(inst.end_date)}
                                    </p>
                                    <p className="text-sm text-slate-700 mt-1">Set up last date: <strong>{prettyDate(inst.last_pay_date)}</strong></p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                                    <Field label="New last date to pay" htmlFor={`urd-${inst.id}`} className="flex-1">
                                        <input
                                            id={`urd-${inst.id}`}
                                            type="date"
                                            value={newDates[inst.id] || ''}
                                            onChange={(e) => handleDateChange(inst.id, e.target.value)}
                                            className="input"
                                        />
                                    </Field>
                                    <button
                                        type="button"
                                        onClick={() => handleSave(inst)}
                                        disabled={!newDates[inst.id] || savingId === inst.id}
                                        className={`btn-primary min-h-[44px] ${savingId === inst.id ? 'cursor-wait' : ''}`}
                                    >
                                        {savingId === inst.id ? 'Saving…' : 'Save date'}
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default UpdateRebateDate;
