import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import api from '../api';
import axios from "axios";
import { notify, confirmDialog } from './ui/feedback';
import { ActionBar, Button, DataList, Field } from './ui';
import type { Column } from './ui';
import { CopyToBranches, Intro, groupBranches } from './fee-setup/shared';

interface FeeType {
    id?: number;
    fee_type: string;
    category: string;
    fee_type_group: string;
    type: string;
    display_name: string;
    is_refundable: boolean;
    description?: string;
    branch?: string;
    academic_year?: string;
}

interface BranchOption {
    id: number | string;
    name: string;
    location_name: string;
}

const FeeTypeManagement: React.FC = () => {
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<FeeType>({
        fee_type: '',
        category: '',
        fee_type_group: '',
        type: 'Installment',
        display_name: '',
        is_refundable: false,
        description: '',
        branch: 'All',
        academic_year: localStorage.getItem('academicYear') || ''
    });
    const [editingId, setEditingId] = useState<number | null>(null);

    // Copy Feature State
    const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<string | number>('');
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);

    // Fetch fee types on component mount
    useEffect(() => {
        let globalBranch = localStorage.getItem('currentBranch') || 'All';

        setFormData(prev => ({ ...prev, branch: globalBranch }));
        fetchFeeTypes();

        // Fetch Branches for Copy Logic
        if (globalBranch && globalBranch !== 'All' && globalBranch !== 'All Branches') {
            api.get('/branches').then(res => {
                const branchList = res.data.branches || res.data || [];
                const mappedBranches = branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    location_name: b.location_name || 'Unknown Location'
                }));
                setAllBranches(mappedBranches);

                const b = branchList.find((br: any) => br.branch_name.toLowerCase() === globalBranch.toLowerCase());
                if (b) {
                    setSourceBranchId(b.id);
                }
            }).catch(err => console.error("Error fetching branches:", err));
        }

    }, []);

    // ... (keep existing functions fetchFeeTypes, handleInputChange, handleSubmit, handleEdit, handleDelete, resetForm)
    const fetchFeeTypes = async () => {
        try {
            const response = await api.get('/fee-types');
            const data = response.data;
            const allTypes = Array.isArray(data) ? data : data.fee_types || [];

            let globalBranch = localStorage.getItem('currentBranch') || 'All';

            const filtered = globalBranch === 'All' || globalBranch === 'All Branches'
                ? allTypes
                : allTypes.filter((ft: FeeType) => !ft.branch || ft.branch === 'All' || ft.branch === globalBranch);

            setFeeTypes(filtered);
        } catch (error) {
            console.error('Error fetching fee types:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setSaving(true);
        try {
            const globalBranch = localStorage.getItem("currentBranch") || "All";

            const payload = {
                ...formData,
                branch: formData.branch || globalBranch || "All",
            };

            if (editingId) {
                await api.put(`/fee-types/${editingId}`, payload);
                notify.success("Fee type saved.");
            } else {
                await api.post("/fee-types", payload);
                notify.success("Fee type added.");
            }

            resetForm();
            fetchFeeTypes();

        } catch (error: unknown) {
            console.error("Error saving fee type:", error);

            let errorMessage = "Error saving fee type. Please try again.";

            if (axios.isAxiosError(error)) {
                errorMessage =
                    error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            notify.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };
    const handleEdit = (feeType: FeeType) => {
        setFormData(feeType);
        setEditingId(feeType.id || null);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (await confirmDialog('Delete this fee type? This cannot be undone.', { tone: 'danger', confirmText: 'Delete' })) {
            try {
                await api.delete(`/fee-types/${id}`);
                fetchFeeTypes();
            } catch (error) {
                console.error('Error deleting fee type:', error);
                notify.error('Could not delete this fee type. Please try again.');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            fee_type: '',
            category: '',
            fee_type_group: '',
            type: 'Installment',
            display_name: '',
            is_refundable: false,
            description: '',
            branch: localStorage.getItem('currentBranch') || 'All',
            academic_year: localStorage.getItem('academicYear') || ''
        });
        setEditingId(null);
        setShowForm(false);
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

    const handleCopy = async () => {
        if (copyTargets.size === 0) {
            notify("Choose at least one branch to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy all fee types to ${copyTargets.size} branch${copyTargets.size === 1 ? '' : 'es'}?`)) {
            return;
        }

        setCopying(true);
        try {
            await api.post("/fees/copy-fee-types", {
                source_branch_id: sourceBranchId,
                target_branch_ids: Array.from(copyTargets),
                academic_year: localStorage.getItem('academicYear') || ''
            });
            notify.success("Fee types copied.");
            setCopyTargets(new Set());
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy fee types.");
        } finally {
            setCopying(false);
        }
    };

    const branchesByLocation = groupBranches(allBranches, sourceBranchId);

    const currentBranch = localStorage.getItem('currentBranch');
    const isSpecificBranch = currentBranch && currentBranch !== 'All' && currentBranch !== 'All Branches';

    const groupLabel = (g?: string) => (g === 'Special' ? 'Only some students' : g === 'Standard' ? 'Whole class' : '—');
    const typeLabel = (t?: string) => (t === 'One-Time' ? 'One time' : t === 'Installment' ? 'In installments' : (t || '—'));

    /* ------------------------------------------------------------ Add / edit form */
    if (showForm) {
        return (
            <form onSubmit={handleSubmit} className="w-full max-w-[1600px] mx-auto space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit fee type' : 'Add a fee type'}</h2>
                    <Intro>
                        For branch <strong>{formData.branch || 'All'}</strong>
                        {formData.academic_year ? <> · Year <strong>{formData.academic_year}</strong></> : null}
                    </Intro>
                </div>

                <div className="card">
                    <div className="card-body space-y-4">
                        <Field label="Name of the fee" htmlFor="ft-name" required hint="For example: Tuition fee, Bus fee">
                            <input
                                id="ft-name"
                                type="text"
                                name="fee_type"
                                value={formData.fee_type}
                                onChange={handleInputChange}
                                required
                                className="input"
                                placeholder="e.g. Bus fee"
                                autoFocus
                            />
                        </Field>

                        <Field label="Name on receipt (optional)" htmlFor="ft-display" hint="How this fee is written on the receipt">
                            <input
                                id="ft-display"
                                type="text"
                                name="display_name"
                                value={formData.display_name}
                                onChange={handleInputChange}
                                className="input"
                                placeholder="e.g. Transport fee"
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Who pays it?" htmlFor="ft-group">
                                <select id="ft-group" name="fee_type_group" value={formData.fee_type_group} onChange={handleInputChange} className="input">
                                    <option value="">Choose</option>
                                    <option value="Standard">Whole class (standard)</option>
                                    <option value="Special">Only some students (special)</option>
                                </select>
                            </Field>

                            <Field label="How is it paid?" htmlFor="ft-type">
                                <select id="ft-type" name="type" value={formData.type} onChange={handleInputChange} className="input">
                                    <option value="Installment">In installments (e.g. every month)</option>
                                    <option value="One-Time">One time</option>
                                </select>
                            </Field>

                            <Field label="Category (optional)" htmlFor="ft-cat">
                                <select id="ft-cat" name="category" value={formData.category} onChange={handleInputChange} className="input">
                                    <option value="">Choose a category</option>
                                    <option value="Academic">Academic</option>
                                    <option value="Tuition">Tuition</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Hostel">Hostel</option>
                                    <option value="Library">Library</option>
                                    <option value="Sports">Sports</option>
                                    <option value="Examination">Examination</option>
                                    <option value="Other">Other</option>
                                </select>
                            </Field>
                        </div>

                        <label htmlFor="is_refundable" className="flex items-center gap-3 min-h-[48px] px-3 rounded-xl border border-slate-200 cursor-pointer">
                            <input
                                type="checkbox"
                                name="is_refundable"
                                id="is_refundable"
                                checked={formData.is_refundable}
                                onChange={handleInputChange}
                                className="w-5 h-5 accent-brand-600 rounded border-slate-300"
                            />
                            <span className="text-[15px] text-slate-900">Money can be given back (refundable)</span>
                        </label>

                        <Field label="Note (optional)" htmlFor="ft-desc">
                            <textarea
                                id="ft-desc"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows={2}
                                className="input"
                            />
                        </Field>
                    </div>
                </div>

                <ActionBar note={!formData.fee_type.trim() ? 'Type the name of the fee' : undefined}>
                    <Button variant="secondary" size="lg" onClick={resetForm}>Cancel</Button>
                    <Button type="submit" size="lg" loading={saving} disabled={!formData.fee_type.trim()}>
                        Save fee type
                    </Button>
                </ActionBar>
            </form>
        );
    }

    /* ------------------------------------------------------------ List */
    const q = search.trim().toLowerCase();
    const shown = q
        ? feeTypes.filter(ft => [ft.fee_type, ft.display_name, ft.category].some(v => (v || '').toLowerCase().includes(q)))
        : feeTypes;

    const actions = (ft: FeeType) => (
        <>
            <button type="button" onClick={() => handleEdit(ft)} className="btn-soft btn-sm">
                <Pencil className="w-4 h-4" /> Edit
            </button>
            <button type="button" onClick={() => ft.id && handleDelete(ft.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Delete
            </button>
        </>
    );

    const columns: Column<FeeType>[] = [
        {
            key: 'fee_type', header: 'Fee', primary: true,
            render: ft => (
                <span>
                    {ft.fee_type}
                    {ft.display_name && ft.display_name !== ft.fee_type && (
                        <span className="block text-xs font-normal text-slate-500">On receipt: {ft.display_name}</span>
                    )}
                </span>
            ),
        },
        { key: 'fee_type_group', header: 'Who pays', secondary: true, render: ft => groupLabel(ft.fee_type_group) },
        { key: 'type', header: 'How paid', render: ft => typeLabel(ft.type) },
        { key: 'category', header: 'Category', render: ft => ft.category || '—' },
        {
            key: 'is_refundable', header: 'Refundable',
            render: ft => <span className={ft.is_refundable ? 'badge-success' : 'badge-neutral'}>{ft.is_refundable ? 'Yes' : 'No'}</span>,
        },
        {
            key: 'branch', header: 'Branch',
            render: ft => <span className={!ft.branch || ft.branch === 'All' ? 'badge-brand' : 'badge-neutral'}>{ft.branch || 'All'}</span>,
        },
        { key: 'actions', header: '', hideOnMobile: true, align: 'right', render: ft => <div className="flex justify-end gap-2">{actions(ft)}</div> },
    ];

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Fee types</h2>
                    <Intro>The names of the fees your school takes, like Tuition fee or Bus fee.</Intro>
                </div>
                <Button size="lg" icon={<Plus className="w-5 h-5" />} onClick={() => { resetForm(); setShowForm(true); }}>
                    Add fee type
                </Button>
            </div>

            {feeTypes.length > 6 && (
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search fee types"
                        aria-label="Search fee types"
                        className="input pl-9"
                    />
                </div>
            )}

            <DataList
                columns={columns}
                rows={shown}
                rowKey={(ft, i) => ft.id ?? i}
                emptyTitle={q ? 'No fee types match your search' : 'No fee types yet'}
                emptyHint={q ? undefined : 'Tap "Add fee type" to add the first one.'}
                mobileActions={actions}
            />

            {isSpecificBranch && (
                <CopyToBranches
                    what="all fee types"
                    branchesByLocation={branchesByLocation}
                    selected={copyTargets}
                    onToggle={toggleCopyTarget}
                    onCopy={handleCopy}
                    copying={copying}
                    open={isCopyDropdownOpen}
                    onOpenChange={setIsCopyDropdownOpen}
                />
            )}
        </div>
    );
};

export default FeeTypeManagement;
