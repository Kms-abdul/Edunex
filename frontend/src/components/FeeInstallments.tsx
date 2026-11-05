import React, { useState, useEffect } from 'react';
import { CalendarPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { ActionBar, Button, DataList, Field, Steps } from './ui';
import type { Column } from './ui';
import { CopyToBranches, Intro, MoreOptions, SuccessPanel, SummaryRow, groupBranches, prettyDate } from './fee-setup/shared';

const BULK_STEPS = ['Choose fee', 'Choose months', 'Check and create'];

interface FeeType {
    id: number;
    fee_type: string;
    type: string;
    branch?: string;
}

interface Installment {
    id?: number;
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

import type { BranchOption } from './fee-setup/shared';

interface BulkConfig {
    fee_type_id: string;
    count: number;
    start_month_idx: number;
    year: number;
    start_installment_no: number;
    branch: string;
    location: string;
    academic_year: string;
    cutoff_day: number;
}

// ─── Bulk Preview Component ───────────────────────────────────────────────────
// Same date maths as generateBulkInstallments below; shows every installment that will be created.
const BulkPreview: React.FC<{ bulkConfig: BulkConfig; MONTHS: string[] }> = ({ bulkConfig, MONTHS }) => {
    const count = parseInt(bulkConfig.count.toString()) || 0;
    const startIdx = parseInt(bulkConfig.start_month_idx.toString()) || 0;
    const year = parseInt(bulkConfig.year.toString()) || new Date().getFullYear();
    const cutoffDay = parseInt((bulkConfig.cutoff_day ?? 5).toString());

    if (!count || count < 1) return null;

    const preview = [];
    for (let i = 0; i < Math.min(count, 12); i++) {
        const monthIdx = (startIdx + i) % 12;
        const calMonth = (monthIdx + 3) % 12;
        const yearOffset = Math.floor((startIdx + 3 + i) / 12);
        const actualYear = year + yearOffset - Math.floor((startIdx + 3) / 12);
        const lastDay = new Date(actualYear, calMonth + 1, 0).getDate();
        const safeCutoff = Math.min(cutoffDay, lastDay);

        preview.push({
            title: `${MONTHS[monthIdx]} Fee`,
            start: `01/${String(calMonth + 1).padStart(2, '0')}/${actualYear}`,
            end: `${String(lastDay).padStart(2, '0')}/${String(calMonth + 1).padStart(2, '0')}/${actualYear}`,
            cutoff: `${String(safeCutoff).padStart(2, '0')}/${String(calMonth + 1).padStart(2, '0')}/${actualYear}`
        });
    }

    return (
        <div className="card overflow-hidden">
            <div className="card-header">
                <h3 className="text-sm font-semibold text-slate-900">{count} installment{count === 1 ? '' : 's'} will be created</h3>
            </div>
            <ul className="divide-y divide-slate-100">
                {preview.map((p, i) => (
                    <li key={i} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
                        <span className="font-medium text-slate-900">{p.title}</span>
                        <span className="text-sm text-slate-600">
                            {p.start} – {p.end} · <span className="text-brand-700 font-medium">pay by {p.cutoff}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const FeeInstallments: React.FC = () => {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [academicYearOptions, setAcademicYearOptions] = useState<string[]>([]);

    const [formData, setFormData] = useState<Installment>({
        installment_no: 1,
        title: '',
        start_date: '',
        end_date: '',
        last_pay_date: '',
        is_admission: false,
        description: '',
        fee_type_id: null,
        branch: '',
        location: '',
        academic_year: ''
    });

    // Bulk Generation State
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkConfig, setBulkConfig] = useState<BulkConfig>({
        fee_type_id: '',
        count: 12,
        start_month_idx: 1,
        year: new Date().getFullYear() + 1,
        start_installment_no: 3,
        branch: '',
        location: '',
        academic_year: '',
        cutoff_day: 5
    });

    const [editingId, setEditingId] = useState<number | null>(null);


    const MONTHS = [
        'April', 'May', 'June', 'July', 'August', 'September',
        'October', 'November', 'December', 'January', 'February', 'March'
    ];

    const [selectedLocation, setSelectedLocation] = useState('All');

    // Copy Feature State
    const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<string | number>('');
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [selectedCopyFeeTypeId, setSelectedCopyFeeTypeId] = useState<number | string>('');

    // Screen state (presentation only)
    const [showSingle, setShowSingle] = useState(false);
    const [bulkStep, setBulkStep] = useState(0);
    const [bulkDone, setBulkDone] = useState<{ count: number; feeName: string } | null>(null);
    const [working, setWorking] = useState(false);
    const [feeFilter, setFeeFilter] = useState('');

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        let globalBranch = localStorage.getItem('currentBranch') || 'All';

        const storedLocation = localStorage.getItem('currentLocation');
        const initialLocation = user.location || 'Hyderabad';
        const isGlobal = globalBranch === 'All' || globalBranch === 'All Branches';
        let viewLoc = 'All';

        if (isGlobal) {
            viewLoc = (storedLocation && storedLocation !== 'All') ? storedLocation : 'All';
        } else {
            viewLoc = initialLocation;
        }

        setSelectedLocation(viewLoc);

        const currentAcademicYear = localStorage.getItem('academicYear') || '';

        setFormData(prev => ({
            ...prev,
            branch: globalBranch,
            location: viewLoc === 'All' ? 'Hyderabad' : viewLoc,
            academic_year: currentAcademicYear
        }));
        setBulkConfig(prev => ({
            ...prev,
            branch: globalBranch,
            location: viewLoc === 'All' ? 'Hyderabad' : viewLoc,
            academic_year: currentAcademicYear
        }));

        if (!isGlobal) {
            api.get('/branches').then(res => {
                const branchList = res.data.branches || [];
                const mappedBranches = branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    location_name: b.location_name || 'Unknown Location'
                }));
                setAllBranches(mappedBranches);

                const b = branchList.find(
                    (br: any) => br.branch_name.toLowerCase() === globalBranch.toLowerCase()
                );
                if (b) {
                    const locMap: { [key: string]: string } = { HYD: 'Hyderabad', MUM: 'Mumbai' };
                    const code = (b.location_code || '').toUpperCase();
                    const resolvedLoc = locMap[code] || initialLocation;
                    setSelectedLocation(resolvedLoc);
                    setFormData(prev => ({ ...prev, location: resolvedLoc }));
                    setSourceBranchId(b.id);
                }
            }).catch(err => console.error('Error fetching branch info:', err));
        } else {
            setSelectedLocation('All');
            setFormData(prev => ({ ...prev, location: 'All' }));
            setBulkConfig(prev => ({ ...prev, location: 'All' }));
        }
    }, []);

    useEffect(() => { fetchInstallments(); }, [selectedLocation]);
    useEffect(() => { fetchFeeTypes(); fetchAcademicYears(); }, []);

    // Auto-update installment number in add mode
    useEffect(() => {
        if (!editingId) {
            setFormData(prev => ({ ...prev, installment_no: installments.length + 1 }));
        }
    }, [installments, editingId]);

    // ── Fetchers ────────────────────────────────────────────────────────────────
    const fetchAcademicYears = async () => {
        try {
            const res = await api.get('/org/academic-years');
            const years = res.data.academic_years?.map((y: any) => y.name) || [];
            setAcademicYearOptions(years);
        } catch (error) {
            console.error('Error fetching academic years:', error);
            setAcademicYearOptions([]);
        }
    };

    const fetchInstallments = async () => {
        try {
            let globalBranch = localStorage.getItem('currentBranch') || 'All';
            const branchParam = globalBranch === 'All Branches' || globalBranch === 'All' ? 'All' : globalBranch;
            const response = await api.get('/installment-schedule', {
                params: { branch: branchParam, location: selectedLocation }
            });
            setInstallments(response.data.installments || []);
        } catch (error) {
            console.error('Error fetching installments:', error);
        }
    };

    const fetchFeeTypes = async () => {
        try {
            const response = await api.get('/fee-types');
            setFeeTypes(response.data.fee_types || []);
        } catch (error) {
            console.error('Error fetching fee types:', error);
        }
    };

    // ── Handlers ────────────────────────────────────────────────────────────────
    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleBulkChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numericFields = ['count', 'start_month_idx', 'year', 'start_installment_no', 'cutoff_day'];
        const coercedValue = numericFields.includes(name) ? (parseInt(value) || 0) : value;
        setBulkConfig(prev => ({ ...prev, [name]: coercedValue }));
    };

    // ── Date helper ─────────────────────────────────────────────────────────────
    const formatDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // ── Bulk Generate ───────────────────────────────────────────────────────────
    const generateBulkInstallments = async () => {
        if (!bulkConfig.fee_type_id) {
            notify.warning('Choose a fee first.');
            return;
        }

        const count = parseInt(bulkConfig.count.toString());
        const startIdx = parseInt(bulkConfig.start_month_idx.toString());
        const year = parseInt(bulkConfig.year.toString());
        const startNo = parseInt(bulkConfig.start_installment_no.toString());
        const cutoffDay = parseInt((bulkConfig.cutoff_day ?? 5).toString());
        const globalBranch = localStorage.getItem('currentBranch') || 'All';

        const newInstallments = [];

        for (let i = 0; i < count; i++) {
            // MONTHS: April=0 … March=11; map to JS calendar month (Jan=0)
            const monthIdx = (startIdx + i) % 12;
            const monthName = MONTHS[monthIdx];
            const calMonth = (monthIdx + 3) % 12; // 0-based JS month

            // Correct year rollover for any starting month
            const yearOffset = Math.floor((startIdx + 3 + i) / 12);
            const actualYear = year + yearOffset - Math.floor((startIdx + 3) / 12);

            const startDate = new Date(actualYear, calMonth, 1);
            const endDate = new Date(actualYear, calMonth + 1, 0); // last day of month

            // Clamp cutoff day to actual last day of that month (e.g. Feb 28/29)
            const safeCutoff = Math.min(cutoffDay, endDate.getDate());
            const cutoffDate = new Date(actualYear, calMonth, safeCutoff);

            newInstallments.push({
                installment_no: startNo + i,
                title: `${monthName} Fee`,
                start_date: formatDate(startDate),
                end_date: formatDate(endDate),
                last_pay_date: formatDate(cutoffDate),
                is_admission: false,
                description: `Monthly installment for ${monthName}`,
                fee_type_id: parseInt(bulkConfig.fee_type_id),
                branch: bulkConfig.branch || globalBranch || 'All',
                location: bulkConfig.location || 'Hyderabad',
                academic_year: bulkConfig.academic_year || ''
            });
        }

        setWorking(true);
        try {
            await api.post('/installment-schedule', newInstallments);
            notify.success(`${count} installments created.`);
            setBulkDone({ count, feeName: feeTypes.find(ft => String(ft.id) === String(bulkConfig.fee_type_id))?.fee_type || 'this fee' });
            fetchInstallments();
            setBulkMode(false);
        } catch (error) {
            console.error('Error generating bulk installments:', error);
            notify.error('Could not create the installments. Please try again.');
        } finally {
            setWorking(false);
        }
    };

    // ── Single Form Submit ───────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.start_date || !formData.end_date || !formData.last_pay_date) {
            notify.warning('Fill in the name and all three dates.');
            return;
        }

        const globalBranch = localStorage.getItem('currentBranch') || 'All';
        const payload = {
            ...formData,
            installment_no: parseInt(formData.installment_no.toString()),
            fee_type_id: formData.fee_type_id ? parseInt(formData.fee_type_id.toString()) : null,
            branch: formData.branch || globalBranch || 'All',
            location: formData.location || 'Hyderabad',
            academic_year: formData.academic_year || ''
        };

        setWorking(true);
        try {
            if (editingId) {
                await api.put(`/installment-schedule/${editingId}`, payload);
                notify.success('Installment saved.');
            } else {
                await api.post('/installment-schedule', payload);
                notify.success('Installment added.');
            }
            fetchInstallments();
            handleReset();
            setShowSingle(false);
        } catch (error) {
            console.error('Error saving installment:', error);
            notify.error('Could not save the installment. Please try again.');
        } finally {
            setWorking(false);
        }
    };

    const handleEdit = (installment: Installment) => {
        setFormData({
            installment_no: installment.installment_no,
            title: installment.title,
            start_date: installment.start_date,
            end_date: installment.end_date,
            last_pay_date: installment.last_pay_date,
            is_admission: installment.is_admission,
            description: installment.description || '',
            fee_type_id: installment.fee_type_id || null,
            branch: installment.branch || 'All',
            location: installment.location || 'Hyderabad',
            academic_year: installment.academic_year || ''
        });
        setEditingId(installment.id || null);
        setBulkMode(false);
        setShowSingle(true);
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog('Delete this installment? This cannot be undone.', { tone: 'danger', confirmText: 'Delete' })) return;
        try {
            await api.delete(`/installment-schedule/${id}`);
            notify.success('Installment deleted.');
            fetchInstallments();
        } catch (error) {
            console.error('Error deleting installment:', error);
            notify.error('Could not delete the installment.');
        }
    };

    const handleReset = () => {
        setFormData({
            installment_no: installments.length + 1,
            title: '',
            start_date: '',
            end_date: '',
            last_pay_date: '',
            is_admission: false,
            description: '',
            fee_type_id: null,
            branch: localStorage.getItem('currentBranch') || 'All',
            location: 'Hyderabad',
            academic_year: ''
        });
        setEditingId(null);
    };

    // ── Copy Logic ──────────────────────────────────────────────────────────────
    const toggleCopyTarget = (branchId: string) => {
        const newTargets = new Set(copyTargets);
        if (newTargets.has(branchId)) newTargets.delete(branchId);
        else newTargets.add(branchId);
        setCopyTargets(newTargets);
    };

    const handleCopy = async () => {
        if (copyTargets.size === 0) {
            notify.warning('Choose at least one branch to copy to.');
            return;
        }
        if (!selectedCopyFeeTypeId) {
            notify.warning('Choose which fee to copy.');
            return;
        }
        if (!await confirmDialog(`Copy the installments of this fee to ${copyTargets.size} branch${copyTargets.size === 1 ? '' : 'es'}?`)) return;

        setCopying(true);
        try {
            await api.post('/fees/copy-installments', {
                source_branch_id: sourceBranchId,
                target_branch_ids: Array.from(copyTargets),
                source_fee_type_id: selectedCopyFeeTypeId,
                academic_year: localStorage.getItem('academicYear') || ''
            });
            notify.success('Installments copied.');
            setCopyTargets(new Set());
            setSelectedCopyFeeTypeId('');
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error('Copy failed', error);
            notify(error.response?.data?.error || 'Failed to copy installments.');
        } finally {
            setCopying(false);
        }
    };

    // ── Derived Values ──────────────────────────────────────────────────────────
    const currentBranch = localStorage.getItem('currentBranch');
    const isSpecificBranch = currentBranch && currentBranch !== 'All' && currentBranch !== 'All Branches';

    const branchesByLocation = groupBranches(allBranches, sourceBranchId);

    const copyableFeeTypes = feeTypes.filter(ft => ft.branch === 'All' || ft.branch === currentBranch);

    const singleFeeTypes = feeTypes.filter(ft => {
        const cb = formData.branch || localStorage.getItem('currentBranch') || 'All';
        return !ft.branch || ft.branch === 'All' || ft.branch === cb;
    });
    const bulkFeeTypes = feeTypes.filter(ft => {
        const cb = bulkConfig.branch || localStorage.getItem('currentBranch') || 'All';
        return !ft.branch || ft.branch === 'All' || ft.branch === cb;
    });
    const bulkFeeName = feeTypes.find(ft => String(ft.id) === String(bulkConfig.fee_type_id))?.fee_type || '';

    // Only clear the form when leaving an edit, so a new installment keeps the defaults set on load.
    const backToList = () => { setBulkMode(false); setShowSingle(false); setBulkDone(null); if (editingId) handleReset(); };

    // ── Render: bulk created ────────────────────────────────────────────────────
    if (bulkDone) {
        return (
            <div className="w-full max-w-[1600px] mx-auto space-y-4">
                <SuccessPanel title={`${bulkDone.count} installments created`}>For {bulkDone.feeName}.</SuccessPanel>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={backToList}>See all installments</Button>
                    <Button size="lg" onClick={() => {
                        setBulkDone(null);
                        setBulkConfig(prev => ({ ...prev, fee_type_id: '' }));
                        setBulkStep(0);
                        setBulkMode(true);
                    }}>
                        Create for another fee
                    </Button>
                </ActionBar>
            </div>
        );
    }

    // ── Render: create monthly installments (steps) ─────────────────────────────
    if (bulkMode) {
        const countInvalid = bulkConfig.count > 12 || bulkConfig.count < 1;
        return (
            <div className="w-full max-w-[1600px] mx-auto space-y-4">
                <Steps steps={BULK_STEPS} current={bulkStep} onJump={setBulkStep} />

                {bulkStep === 0 && (
                    <>
                        <div className="card">
                            <div className="card-body space-y-4">
                                <p className="text-sm text-slate-600">Create one installment for each month in one go. Which fee is it for?</p>
                                <Field label="Fee" htmlFor="bulk-fee" required>
                                    <select id="bulk-fee" name="fee_type_id" value={bulkConfig.fee_type_id} onChange={handleBulkChange} className="input">
                                        <option value="">Choose a fee</option>
                                        {bulkFeeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.fee_type}</option>)}
                                    </select>
                                </Field>
                                <Field label="School year" htmlFor="bulk-year">
                                    <select id="bulk-year" name="academic_year" value={bulkConfig.academic_year} onChange={handleBulkChange} className="input">
                                        <option value="">Choose a year</option>
                                        {academicYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </div>
                        <ActionBar note={!bulkConfig.fee_type_id ? 'Choose a fee first' : undefined}>
                            <Button variant="secondary" size="lg" onClick={backToList}>Cancel</Button>
                            <Button size="lg" disabled={!bulkConfig.fee_type_id} onClick={() => setBulkStep(1)}>Next</Button>
                        </ActionBar>
                    </>
                )}

                {bulkStep === 1 && (
                    <>
                        <div className="card">
                            <div className="card-body space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="First month" htmlFor="bulk-month">
                                        <select id="bulk-month" name="start_month_idx" value={bulkConfig.start_month_idx} onChange={handleBulkChange} className="input">
                                            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Year of the first month" htmlFor="bulk-startyear">
                                        <input id="bulk-startyear" type="number" inputMode="numeric" name="year" value={bulkConfig.year} onChange={handleBulkChange} min={2020} max={2100} className="input" />
                                    </Field>
                                </div>

                                <Field label="How many months?" hint="Up to 12" error={bulkConfig.count > 12 ? 'You can create up to 12 at a time' : null}>
                                    <div className="flex gap-2">
                                        {[3, 6, 12].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setBulkConfig(prev => ({ ...prev, count: n }))}
                                                aria-pressed={bulkConfig.count === n}
                                                className={`flex-1 min-h-[44px] ${bulkConfig.count === n ? 'btn-primary' : 'btn-secondary'}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            name="count"
                                            aria-label="Other number of months"
                                            value={bulkConfig.count}
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                if (isNaN(val)) return;
                                                if (val > 12) {
                                                    notify('Number of installments cannot exceed 12');
                                                    setBulkConfig(prev => ({ ...prev, count: 12 }));
                                                    return;
                                                }
                                                if (val < 1) {
                                                    setBulkConfig(prev => ({ ...prev, count: 1 }));
                                                    return;
                                                }
                                                setBulkConfig(prev => ({ ...prev, count: val }));
                                            }}
                                            min={1}
                                            max={12}
                                            className="input w-20"
                                        />
                                    </div>
                                </Field>

                                <Field label="Last day to pay each month" htmlFor="bulk-cutoff" hint="1 to 28. For example 5 means pay by the 5th of every month.">
                                    <input id="bulk-cutoff" type="number" inputMode="numeric" name="cutoff_day" value={bulkConfig.cutoff_day} onChange={handleBulkChange} min={1} max={28} className="input" />
                                </Field>
                            </div>
                        </div>
                        <ActionBar note={countInvalid ? 'Choose between 1 and 12 months' : undefined}>
                            <Button variant="secondary" size="lg" onClick={() => setBulkStep(0)}>Back</Button>
                            <Button size="lg" disabled={countInvalid} onClick={() => setBulkStep(2)}>Next</Button>
                        </ActionBar>
                    </>
                )}

                {bulkStep === 2 && (
                    <>
                        <div className="card">
                            <div className="px-5 py-1">
                                <SummaryRow label="Fee">{bulkFeeName || '—'}</SummaryRow>
                                <SummaryRow label="School year">{bulkConfig.academic_year || '—'}</SummaryRow>
                                <SummaryRow label="Months">{bulkConfig.count}, from {MONTHS[bulkConfig.start_month_idx]} {bulkConfig.year}</SummaryRow>
                                <SummaryRow label="Pay by">Day {bulkConfig.cutoff_day} of each month</SummaryRow>
                            </div>
                        </div>
                        <BulkPreview bulkConfig={bulkConfig} MONTHS={MONTHS} />
                        <ActionBar>
                            <Button variant="secondary" size="lg" onClick={() => setBulkStep(1)}>Back</Button>
                            <Button size="lg" loading={working} onClick={generateBulkInstallments} disabled={countInvalid || !bulkConfig.fee_type_id}>
                                Create {bulkConfig.count} installments
                            </Button>
                        </ActionBar>
                    </>
                )}
            </div>
        );
    }

    // ── Render: add / edit one installment ──────────────────────────────────────
    if (showSingle) {
        const missing = !formData.title || !formData.start_date || !formData.end_date || !formData.last_pay_date;
        return (
            <form onSubmit={handleSubmit} className="w-full max-w-[1600px] mx-auto space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit installment' : 'Add one installment'}</h2>
                    <Intro>One part of a fee, with the dates it covers and the last date to pay.</Intro>
                </div>
                <div className="card">
                    <div className="card-body space-y-4">
                        <Field label="Fee" htmlFor="one-fee">
                            <select id="one-fee" name="fee_type_id" value={formData.fee_type_id || ''} onChange={handleInputChange} className="input">
                                <option value="">Choose a fee</option>
                                {singleFeeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.fee_type}</option>)}
                            </select>
                        </Field>
                        <Field label="Name" htmlFor="one-title" required hint="For example: April fee">
                            <input id="one-title" type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. April fee" className="input" required />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="From" htmlFor="one-start" required>
                                <input id="one-start" type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} className="input" required />
                            </Field>
                            <Field label="To" htmlFor="one-end" required>
                                <input id="one-end" type="date" name="end_date" value={formData.end_date} onChange={handleInputChange} className="input" required />
                            </Field>
                            <Field label="Last date to pay" htmlFor="one-cutoff" required>
                                <input id="one-cutoff" type="date" name="last_pay_date" value={formData.last_pay_date} onChange={handleInputChange} className="input" required />
                            </Field>
                            <Field label="School year" htmlFor="one-year">
                                <select id="one-year" name="academic_year" className="input" value={formData.academic_year} onChange={handleInputChange}>
                                    <option value="">Choose a year</option>
                                    {academicYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </Field>
                        </div>
                        <MoreOptions>
                            <Field label="Installment number" htmlFor="one-no" hint="Order of this installment. Filled in for you.">
                                <input id="one-no" type="number" inputMode="numeric" name="installment_no" value={formData.installment_no} onChange={handleInputChange} className="input" required />
                            </Field>
                            <Field label="Note (optional)" htmlFor="one-desc">
                                <textarea id="one-desc" name="description" value={formData.description} onChange={handleInputChange} rows={2} className="input" />
                            </Field>
                        </MoreOptions>
                    </div>
                </div>
                <ActionBar note={missing ? 'Fill in the name and all three dates' : undefined}>
                    <Button variant="secondary" size="lg" onClick={backToList}>Cancel</Button>
                    <Button type="submit" size="lg" loading={working} disabled={missing}>Save installment</Button>
                </ActionBar>
            </form>
        );
    }

    // ── Render: list ────────────────────────────────────────────────────────────
    const feeNames = Array.from(new Set(installments.map(i => i.fee_type_name || '').filter(Boolean)));
    const shown = feeFilter ? installments.filter(i => (i.fee_type_name || '') === feeFilter) : installments;

    const rowActions = (inst: Installment) => (
        <>
            <button type="button" onClick={() => handleEdit(inst)} className="btn-soft btn-sm">
                <Pencil className="w-4 h-4" /> Edit
            </button>
            <button type="button" onClick={() => handleDelete(inst.id!)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Delete
            </button>
        </>
    );

    const columns: Column<Installment>[] = [
        {
            key: 'title', header: 'Installment', primary: true,
            render: i => <span>{i.title}{i.is_admission && <span className="ml-2 badge-success">Admission</span>}</span>,
        },
        { key: 'fee_type_name', header: 'Fee', secondary: true, render: i => i.fee_type_name || '—' },
        { key: 'period', header: 'Covers', render: i => `${prettyDate(i.start_date)} – ${prettyDate(i.end_date)}` },
        { key: 'last_pay_date', header: 'Last date to pay', render: i => <span className="font-medium">{prettyDate(i.last_pay_date)}</span> },
        { key: 'branch', header: 'Branch', render: i => i.branch || 'All' },
        { key: 'actions', header: '', hideOnMobile: true, align: 'right', render: i => <div className="flex justify-end gap-2">{rowActions(i)}</div> },
    ];

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Installments</h2>
                    <Intro>A fee can be split into parts, like April fee and May fee. Each part has a last date to pay.</Intro>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button size="lg" icon={<CalendarPlus className="w-5 h-5" />} onClick={() => { setBulkStep(0); setShowSingle(false); setBulkMode(true); }}>
                        Create monthly installments
                    </Button>
                    <Button variant="secondary" size="lg" icon={<Plus className="w-5 h-5" />} onClick={() => { if (editingId) handleReset(); setShowSingle(true); }}>
                        Add one
                    </Button>
                </div>
            </div>

            {feeNames.length > 1 && (
                <Field label="Show installments of" htmlFor="fi-filter" className="sm:max-w-xs">
                    <select id="fi-filter" value={feeFilter} onChange={e => setFeeFilter(e.target.value)} className="input">
                        <option value="">All fees</option>
                        {feeNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </Field>
            )}

            <DataList
                columns={columns}
                rows={shown}
                rowKey={(i, idx) => i.id ?? idx}
                emptyTitle="No installments yet"
                emptyHint='Tap "Create monthly installments" to make them in one go.'
                mobileActions={rowActions}
            />

            {isSpecificBranch && (
                <CopyToBranches
                    what="installments"
                    note="Copy the installments of one fee to other branches."
                    branchesByLocation={branchesByLocation}
                    selected={copyTargets}
                    onToggle={toggleCopyTarget}
                    onCopy={handleCopy}
                    copying={copying}
                    open={isCopyDropdownOpen}
                    onOpenChange={setIsCopyDropdownOpen}
                    blockedReason={!selectedCopyFeeTypeId ? 'Choose which fee to copy' : undefined}
                >
                    <Field label="Which fee?" htmlFor="fi-copy-fee">
                        <select id="fi-copy-fee" className="input" value={selectedCopyFeeTypeId} onChange={e => setSelectedCopyFeeTypeId(e.target.value)}>
                            <option value="">Choose a fee</option>
                            {copyableFeeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.fee_type} ({ft.type})</option>)}
                        </select>
                    </Field>
                </CopyToBranches>
            )}
        </div>
    );
};

export default FeeInstallments;
