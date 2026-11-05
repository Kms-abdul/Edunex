import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { ActionBar, Alert, Button, DataList, Field } from './ui';
import type { Column } from './ui';
import { CopyToBranches, Intro, groupBranches, rupees } from './fee-setup/shared';

interface FeeType {
    id: number;
    fee_type: string;
    category: string;
}

interface ConcessionItem {
    id: number;
    fee_type_id: number;
    fee_type_name: string;
    percentage: number;
}

interface ConcessionGroup {
    title: string;
    description: string;
    academic_year: string;
    is_percentage: boolean;
    show_in_payment: boolean;
    items: ConcessionItem[];
    branch?: string;
}

import type { BranchOption } from './fee-setup/shared';

const ConcessionMaster: React.FC = () => {
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [concessions, setConcessions] = useState<ConcessionGroup[]>([]);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [academicYear, setAcademicYear] = useState(localStorage.getItem('academicYear') || '');
    const [branch, setBranch] = useState('All');
    const [showInPayment, setShowInPayment] = useState(false);
    const [globalAmount, setGlobalAmount] = useState('');
    const [concessionItems, setConcessionItems] = useState<Record<number, number | string>>({});

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);

    const [originalTitle, setOriginalTitle] = useState('');
    const [originalYear, setOriginalYear] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Copy Feature State
    const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<string | number>('');
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);


    // Fetch Data on load
    useEffect(() => {
        let initialBranch = localStorage.getItem('currentBranch') || 'All';


        setBranch(initialBranch);

        // Fetch Branches for Copy Feature
        if (initialBranch !== 'All' && initialBranch !== 'All Branches') {

            api.get('/branches').then(res => {
                const branchList = res.data.branches || [];
                const mappedBranches = branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    location_name: b.location_name || 'Unknown Location'
                }));
                setAllBranches(mappedBranches);

                const b = branchList.find((br: any) => br.branch_name.toLowerCase() === initialBranch.toLowerCase());
                if (b) {
                    setSourceBranchId(b.id);
                }
            }).catch(err => console.error("Error fetching branch info:", err));
        }

        fetchFeeTypes();
        fetchConcessions();
    }, []);

    const fetchFeeTypes = async () => {
        try {

            const response = await api.get('/fee-types');
            setFeeTypes(response.data.fee_types);
            resetItems(response.data.fee_types);
        } catch (error) {
            console.error("Error fetching fee types:", error);
        }
    };

    const fetchConcessions = async () => {
        try {

            const response = await api.get('/concessions');

            const globalBranch = localStorage.getItem('currentBranch') || 'All';
            const allConcessions = response.data.concessions;

            // Filter by branch
            // If Admin: Filter by globalBranch (selected in header)
            // If User: Show all returned (Backend filters strictly)

            let filtered = allConcessions;
            filtered = globalBranch === 'All' || globalBranch === 'All Branches' || globalBranch === 'All Locations'
                ? allConcessions
                : allConcessions.filter((c: ConcessionGroup) => c.branch === globalBranch || c.branch === 'All');

            setConcessions(filtered);
        } catch (error) {
            console.error("Error fetching concessions:", error);
        }
    };

    const resetItems = (types: FeeType[]) => {
        const initialItems: Record<number, number | string> = {};
        types.forEach(ft => {
            initialItems[ft.id] = '';
        });
        setConcessionItems(initialItems);
    };

    // Copy Logic
    const toggleCopyTarget = (branchId: string) => {
        const newTargets = new Set(copyTargets);
        if (newTargets.has(branchId)) {
            newTargets.delete(branchId);
        } else {
            newTargets.add(branchId);
        }
        setCopyTargets(newTargets);
    };

    const handleCopyConcessions = async () => {
        if (copyTargets.size === 0) {
            notify.warning("Choose at least one branch to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy all discount types to ${copyTargets.size} branch${copyTargets.size === 1 ? '' : 'es'}? Ones that already exist there are skipped.`)) {
            return;
        }

        setCopying(true);
        try {

            await api.post('/fees/copy-concessions', {
                source_branch_id: sourceBranchId,
                target_branch_ids: Array.from(copyTargets),
                academic_year: academicYear
            });
            notify.success("Discount types copied.");
            setCopyTargets(new Set());
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy concessions.");
        } finally {
            setCopying(false);
        }
    };

    const handleCopy = () => {
        if (!globalAmount) return;
        const val = parseFloat(globalAmount);
        if (isNaN(val)) return;

        const newItems = { ...concessionItems };
        feeTypes.forEach(ft => {
            newItems[ft.id] = val;
        });
        setConcessionItems(newItems);
    };

    const handleItemChange = (id: number, val: string) => {
        if (val === '') {
            setConcessionItems(prev => ({ ...prev, [id]: '' }));
            return;
        }
        setConcessionItems(prev => ({ ...prev, [id]: val }));
    };

    const handleEdit = (concession: ConcessionGroup) => {
        setTitle(concession.title);
        setDescription(concession.description || '');
        setAcademicYear(concession.academic_year);
        setBranch(concession.branch || 'All');
        setShowInPayment(concession.show_in_payment || false);

        // Populate items
        const newItems: Record<number, number | string> = {};
        // First reset to ''
        feeTypes.forEach(ft => newItems[ft.id] = '');
        // Then fill with existing data
        concession.items.forEach(item => {
            newItems[item.fee_type_id] = item.percentage;
        });
        setConcessionItems(newItems);

        // Set Edit Mode
        setIsEditing(true);
        setOriginalTitle(concession.title);
        setOriginalYear(concession.academic_year);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setMessage('');
        setShowForm(true);
    };

    const handleDelete = async (title: string, year: string) => {
        if (!await confirmDialog(`Delete the discount "${title}" for ${year}? This cannot be undone.`, { tone: 'danger', confirmText: 'Delete' })) return;

        try {

            await api.delete(`/concessions/${encodeURIComponent(title)}/${encodeURIComponent(year)}`);
            setMessage("Discount type deleted.");
            fetchConcessions();
        } catch (error: any) {
            console.error("Error deleting concession:", error);
            const status = error?.response?.status;
            const serverMsg: string = error?.response?.data?.error || '';
            // A 500 here is almost always a foreign-key violation: students still use this concession.
            if (status === 500 && /foreign key|integrity|constraint|violates/i.test(serverMsg)) {
                notify.error("This concession is assigned to students, so it can't be deleted.");
            } else {
                notify.error(serverMsg || "Failed to delete concession. Please try again.");
            }
        }
    };

    const handleSave = async () => {
        if (!title || !academicYear) {
            notify.warning("Type a name for the discount.");
            return;
        }

        setLoading(true);
        setMessage('');

        try {


            const items = Object.keys(concessionItems).map(key => ({
                fee_type_id: parseInt(key),
                percentage: parseFloat(concessionItems[parseInt(key)] as string) || 0
            }));

            const payload = {
                title,
                description,
                academic_year: academicYear,
                branch,
                is_percentage: false,
                show_in_payment: showInPayment,
                items
            };

            if (isEditing) {
                // UPDATE
                await api.put(`/concessions/${encodeURIComponent(originalTitle)}/${encodeURIComponent(originalYear)}`, payload);
                setMessage("Discount type saved.");
            } else {
                // CREATE
                await api.post('/concessions', payload);
                setMessage("Discount type added.");
            }

            // Reset form
            handleReset();
            fetchConcessions();
            setShowForm(false);

        } catch (error: any) {
            console.error("Error saving concession:", error);
            setMessage(`Error: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setTitle('');
        setDescription('');
        setGlobalAmount('');
        setAcademicYear(localStorage.getItem('academicYear') || '');

        setBranch(localStorage.getItem('currentBranch') || 'All');

        setShowInPayment(false);
        setIsEditing(false);
        setOriginalTitle('');
        setOriginalYear('');
        resetItems(feeTypes);
    };

    const isError = message.includes('Error');
    const messageAlert = message && (
        <Alert tone={isError ? 'error' : 'success'} onClose={() => setMessage('')}>
            {isError ? message.replace(/^Error:\s*/, 'Could not save: ') : message}
        </Alert>
    );

    /* ------------------------------------------------------------ Add / edit form */
    if (showForm) {
        return (
            <div className="w-full max-w-[1600px] mx-auto space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{isEditing ? 'Edit discount type' : 'Add a discount type'}</h2>
                    <Intro>For branch <strong>{branch}</strong> · Year <strong>{academicYear || '—'}</strong></Intro>
                </div>

                {messageAlert}

                <div className="card">
                    <div className="card-body space-y-4">
                        <Field label="Name of the discount" htmlFor="cm-title" required hint="For example: Sibling discount, Staff child">
                            <input id="cm-title" type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sibling discount" autoFocus />
                        </Field>
                        <Field label="Note (optional)" htmlFor="cm-desc">
                            <input id="cm-desc" type="text" className="input" value={description} onChange={e => setDescription(e.target.value)} />
                        </Field>
                        <label htmlFor="showInPayment" className="flex items-start gap-3 min-h-[48px] px-3 py-2.5 rounded-xl border border-slate-200 cursor-pointer">
                            <input
                                type="checkbox"
                                id="showInPayment"
                                className="w-5 h-5 mt-0.5 accent-brand-600 rounded flex-shrink-0"
                                checked={showInPayment}
                                onChange={e => setShowInPayment(e.target.checked)}
                            />
                            <span>
                                <span className="block text-[15px] text-slate-900">Show when collecting fees</span>
                                <span className="block text-sm text-slate-500">The cashier can pick this discount on the Collect fee screen.</span>
                            </span>
                        </label>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="text-sm font-semibold text-slate-900">Discount on each fee (₹)</h3>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="rounded-xl bg-brand-50 border border-brand-100 p-3">
                            <p className="text-sm font-medium text-slate-800 mb-2">Same amount for every fee?</p>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    aria-label="Amount for every fee"
                                    className="input flex-1"
                                    placeholder="Amount"
                                    value={globalAmount}
                                    onChange={e => setGlobalAmount(e.target.value)}
                                />
                                <button type="button" onClick={handleCopy} disabled={!globalAmount} className="btn-soft min-h-[44px]">
                                    Fill all
                                </button>
                            </div>
                        </div>

                        <p className="text-sm text-slate-500">Leave a fee empty for no discount on it.</p>
                        <ul className="divide-y divide-slate-100 -mx-1">
                            {feeTypes.map(ft => (
                                <li key={ft.id} className="flex items-center gap-3 px-1 py-2">
                                    <label htmlFor={`cm-item-${ft.id}`} className="flex-1 min-w-0 text-[15px] text-slate-900 break-words">{ft.fee_type}</label>
                                    <input
                                        id={`cm-item-${ft.id}`}
                                        type="number"
                                        inputMode="decimal"
                                        className="input w-32 text-right"
                                        placeholder="0"
                                        value={concessionItems[ft.id] !== undefined ? concessionItems[ft.id] : ''}
                                        onChange={e => handleItemChange(ft.id, e.target.value)}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <ActionBar note={!title ? 'Type a name for the discount' : undefined}>
                    <Button variant="secondary" size="lg" onClick={() => { handleReset(); setMessage(''); setShowForm(false); }}>Cancel</Button>
                    <Button size="lg" onClick={handleSave} loading={loading} disabled={!title}>
                        Save discount type
                    </Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ List */
    const rowActions = (c: ConcessionGroup) => (
        <>
            <button type="button" onClick={() => handleEdit(c)} className="btn-soft btn-sm">
                <Pencil className="w-4 h-4" /> Edit
            </button>
            <button type="button" onClick={() => handleDelete(c.title, c.academic_year)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Delete
            </button>
        </>
    );

    const columns: Column<ConcessionGroup>[] = [
        { key: 'title', header: 'Discount', primary: true },
        { key: 'description', header: 'Note', secondary: true, render: c => c.description || '' },
        {
            key: 'items', header: 'Fees with a discount',
            render: c => {
                const withAmount = (c.items || []).filter(i => Number(i.percentage) > 0);
                if (withAmount.length === 0) return '—';
                const amounts = Array.from(new Set(withAmount.map(i => Number(i.percentage))));
                return amounts.length === 1 ? `${withAmount.length} · ${rupees(amounts[0])} each` : `${withAmount.length} fees`;
            },
        },
        { key: 'academic_year', header: 'Year' },
        {
            key: 'show_in_payment', header: 'At fee collection',
            render: c => c.show_in_payment ? <span className="badge-success">Shown</span> : <span className="badge-neutral">Hidden</span>,
        },
        {
            key: 'branch', header: 'Branch',
            render: c => <span className={!c.branch || c.branch === 'All' ? 'badge-brand' : 'badge-neutral'}>{c.branch || 'All'}</span>,
        },
        { key: 'actions', header: '', hideOnMobile: true, align: 'right', render: c => <div className="flex justify-end gap-2">{rowActions(c)}</div> },
    ];

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Discount types</h2>
                    <Intro>Discounts you can give students, like Sibling discount. Give one to a student under Discounts → Give a discount.</Intro>
                </div>
                <Button size="lg" icon={<Plus className="w-5 h-5" />} onClick={() => { handleReset(); setMessage(''); setShowForm(true); }}>
                    Add discount type
                </Button>
            </div>

            {messageAlert}

            <DataList
                columns={columns}
                rows={concessions}
                rowKey={(c, i) => `${c.title}-${c.academic_year}-${i}`}
                emptyTitle="No discount types yet"
                emptyHint='Tap "Add discount type" to add the first one.'
                mobileActions={rowActions}
            />

            {allBranches.length > 0 && sourceBranchId && (
                <CopyToBranches
                    what="all discount types"
                    note="Ones that already exist in the other branch are skipped."
                    branchesByLocation={groupBranches(allBranches, sourceBranchId)}
                    selected={copyTargets}
                    onToggle={toggleCopyTarget}
                    onCopy={handleCopyConcessions}
                    copying={copying}
                    open={isCopyDropdownOpen}
                    onOpenChange={setIsCopyDropdownOpen}
                />
            )}
        </div>
    );
};

export default ConcessionMaster;
