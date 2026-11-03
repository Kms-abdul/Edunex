import React, { useState, useEffect } from 'react';
import api from '../api';
import { Edit, Trash2, Plus, Save, Check, X, ArrowLeft } from 'lucide-react';
import { notify, confirmDialog } from './ui/feedback';
import { Alert, EmptyState, DataList, Field, ActionBar } from './ui';
import type { Column } from './ui';
import { SetupIntro } from './exam-setup/shared';

interface GradeScaleDetail {
    id?: number;
    grade: string;
    min_marks: number;
    max_marks: number;
    description: string;
}

interface GradeScale {
    id: number;
    scale_name: string;
    scale_description: string;
    location: string;
    branch: string;
    academic_year: string;
    total_marks: number;
}

const GradeScaleManager: React.FC = () => {
    // Context State
    const [academicYear, setAcademicYear] = useState<string>('');
    const [branch, setBranch] = useState<string>('');
    const [location, setLocation] = useState<string>('Hyderabad'); // Default
    const [, setAcademicYears] = useState<any[]>([]);
    const [, setBranches] = useState<any[]>([]);
    const [availableClasses, setAvailableClasses] = useState<any[]>([]);

    // Data State
    const [scales, setScales] = useState<GradeScale[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State (Master)
    const [selectedScaleId, setSelectedScaleId] = useState<number | null>(null);
    const [scaleName, setScaleName] = useState('');
    const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
    const [totalMarks, setTotalMarks] = useState<number>(100);
    const [scaleDescription, setScaleDescription] = useState('');

    // Form State (Details)
    const [details, setDetails] = useState<GradeScaleDetail[]>([]);

    // Row Editing State
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [tempRowData, setTempRowData] = useState<GradeScaleDetail | null>(null);

    // Which screen is showing: the list of scales, or one scale being added/edited
    const [mode, setMode] = useState<'list' | 'edit'>('list');

    // Validation State
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // --- Initialization ---
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Load User & Context from LocalStorage/API
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const storedYear = localStorage.getItem('academicYear');
                const storedBranch = localStorage.getItem('currentBranch') || user.branch;

                // Load Academic Years
                const resYears = await api.get('/org/academic-years');
                const yearsList = resYears.data.academic_years || [];
                setAcademicYears(yearsList);

                if (storedYear) {
                    // Resolve Name vs ID
                    const y = yearsList.find((y: any) => y.name === storedYear || String(y.id) === storedYear);
                    if (y) setAcademicYear(y.name);
                    else setAcademicYear(storedYear);
                } else if (yearsList.length > 0) {
                    setAcademicYear(yearsList[0].name);
                }

                // Load Branches
                const resBranches = await api.get('/branches');
                const branchList = resBranches.data.branches || [];
                setBranches(branchList);

                // Set Branch
                if (storedBranch) {
                    // Check if it matches a name or code
                    const b = branchList.find((br: any) => br.branch_name === storedBranch || String(br.id) === storedBranch);
                    if (b) {
                        setBranch(b.branch_name);
                        setLocation(b.location_name || "Hyderabad");
                    } else {
                        setBranch(storedBranch);
                    }
                } else if (branchList.length > 0) {
                    setBranch(branchList[0].branch_name);
                }

            } catch (err) {
                console.error("Failed to load context", err);
            }
        };
        init();
    }, []);

    // --- Fetch Scales ---
    useEffect(() => {
        if (!academicYear || !branch) return;
        fetchScales();
    }, [academicYear, branch]);

    const fetchScales = async () => {
        setLoading(true);
        try {
            const [resScales, resClasses] = await Promise.all([
                api.get('/grade-scales', {
                    params: { academic_year: academicYear, branch: branch, location: location }
                }),
                api.get('/classes', {
                    params: { academic_year: academicYear, branch: branch }
                })
            ]);
            setScales(resScales.data);
            setAvailableClasses(resClasses.data.classes || []);
        } catch (err) {
            console.error("Failed to fetch scales or classes", err);
        } finally {
            setLoading(false);
        }
    };

    // --- Load Specific Scale ---
    const loadScale = async (id: number) => {
        setLoading(true);
        setError(null);
        setEditingRowIndex(null);
        setTempRowData(null);
        try {
            const res = await api.get(`/grade-scales/${id}`);
            const data = res.data;

            setSelectedScaleId(data.id);
            setScaleName(data.scale_name);
            setSelectedClasses(data.class_ids || []);
            setTotalMarks(data.total_marks || 100);
            setScaleDescription(data.scale_description || '');
            setDetails(data.details || []);

        } catch (err) {
            console.error("Failed to load scale details", err);
            setError("Could not open this grade scale. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---
    const handleReset = () => {
        setSelectedScaleId(null);
        setSelectedScaleId(null);
        setScaleName('');
        setSelectedClasses([]);
        setTotalMarks(100);
        setScaleDescription('');
        setDetails([]);
        setError(null);
        setSuccess(null);
        setEditingRowIndex(null);
        setTempRowData(null);
    };

    const handleAddDetailRow = () => {
        const newRow = { grade: '', min_marks: 0, max_marks: 0, description: '' };
        // Add to list and immediately start editing it
        const newDetails = [...details, newRow];
        setDetails(newDetails);

        // Start editing the new last row
        setEditingRowIndex(newDetails.length - 1);
        setTempRowData(newRow);
    };

    // Start Editing a Row
    const handleStartEdit = (index: number) => {
        // If already editing another row, maybe warn or auto-cancel? For now, nice switch.
        setEditingRowIndex(index);
        setTempRowData({ ...details[index] });
    };

    // Cancel Edit
    const handleCancelEdit = () => {
        // If the row was empty/new (brand new add), maybe remove it?
        // Logic: If we added a row and cancelled immediately, user might expect it to disappear if it was blank.
        // But for simplicity, we just revert to original state handling.
        // If it was a new row (no ID?) and completely empty, we could pop it.
        // Let's just reset state.

        // However, if we just added a row (useEffect logic missing), it might remain as blank in table.
        // Let's check if the currently editing row is "empty" (blank grade) and at the end? 
        // Or just leave it. Leaving it is safer UI behavior to avoid magic deletions.

        setEditingRowIndex(null);
        setTempRowData(null);
    };

    // Save Edit (Local State Save)
    const handleSaveEdit = () => {
        if (editingRowIndex === null || !tempRowData) return;

        // Basic Inline Validation
        if (!tempRowData.grade.trim()) {
            notify("Type a grade, like A or B1.");
            return;
        }
        if (Number(tempRowData.min_marks) > Number(tempRowData.max_marks)) {
            notify('"From" marks cannot be more than "To" marks.');
            return;
        }
        if (Number(tempRowData.max_marks) > Number(totalMarks)) {
            notify(`"To" marks cannot be more than the total marks (${totalMarks}).`);
            return;
        }

        const newDetails = [...details];
        newDetails[editingRowIndex] = tempRowData;
        setDetails(newDetails);

        setEditingRowIndex(null);
        setTempRowData(null);
    };

    const handleTempChange = (field: keyof GradeScaleDetail, value: any) => {
        if (!tempRowData) return;
        setTempRowData({ ...tempRowData, [field]: value });
    };

    const handleRemoveDetailRow = (index: number) => {
        if (editingRowIndex === index) {
            handleCancelEdit();
        }
        const newDetails = [...details];
        newDetails.splice(index, 1);
        setDetails(newDetails);

        // Adjust editing index if needed
        if (editingRowIndex !== null && editingRowIndex > index) {
            setEditingRowIndex(editingRowIndex - 1);
        }
    };

    const handleSave = async (): Promise<boolean> => {
        if (!scaleName.trim()) {
            setError("Type a name for this grade scale.");
            return false;
        }
        if (!academicYear || !branch) {
            setError("The year or branch is missing. Choose them at the top of the screen.");
            return false;
        }

        if (editingRowIndex !== null) {
            setError("Finish the grade you are editing first (tap Done or Cancel).");
            return false;
        }

        if (selectedClasses.length === 0) {
            setError("Choose at least one class.");
            return false;
        }

        // Validate Details
        for (const d of details) {
            if (!d.grade.trim()) {
                setError("Every row needs a grade name, like A or B1.");
                return false;
            }
            if (d.min_marks < 0 || d.max_marks < 0) {
                setError("Marks cannot be less than 0.");
                return false;
            }
            if (Number(d.min_marks) > Number(d.max_marks)) {
                setError(`For grade ${d.grade}, "From" marks cannot be more than "To" marks.`);
                return false;
            }
            if (Number(d.max_marks) > Number(totalMarks)) {
                setError(`For grade ${d.grade}, "To" marks cannot be more than the total marks (${totalMarks}).`);
                return false;
            }
        }

        // Check for overlap (simple check)
        // Sort by min
        const sorted = [...details].sort((a, b) => Number(a.min_marks) - Number(b.min_marks));
        for (let i = 0; i < sorted.length - 1; i++) {
            if (Number(sorted[i].max_marks) >= Number(sorted[i + 1].min_marks)) {
                setError(`The marks for ${sorted[i].grade} and ${sorted[i + 1].grade} overlap. Each mark should belong to only one grade.`);
                return false;
            }
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        const payload = {
            scale_name: scaleName,
            scale_description: scaleDescription,
            location: location,
            branch: branch,
            academic_year: academicYear,
            total_marks: totalMarks,
            class_ids: selectedClasses,
            details: details
        };

        try {
            if (selectedScaleId) {
                // Update
                await api.put(`/grade-scales/${selectedScaleId}`, payload);
                setSuccess("Grade scale saved");
                setSelectedScaleId(null);
            } else {
                // Create
                await api.post('/grade-scales', payload);
                setSuccess("Grade scale added");
                handleReset(); // Reset form for new entry or keep? Usually reset.
            }
            fetchScales(); // Refresh list
            return true;
        } catch (err: any) {
            console.error("Save failed", err);
            setError(err.response?.data?.error || "Could not save the grade scale. Please try again.");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog("Delete this grade scale? This cannot be undone.")) return;

        setLoading(true);
        try {
            await api.delete(`/grade-scales/${id}`);
            setSuccess("Grade scale deleted");
            if (selectedScaleId === id) {
                handleReset();
            }
            fetchScales();
        } catch (err: any) {
            console.error("Delete failed", err);
            setError(err.response?.data?.error || "Could not delete the grade scale. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    // ---------------------------------------------------------------- UI only
    const contextLine = [
        academicYear ? `Year ${academicYear}` : 'Loading year…',
        `${location} · all branches`,
    ];

    const openNew = () => {
        handleReset();
        setMode('edit');
    };

    const openExisting = async (id: number) => {
        setSuccess(null);
        await loadScale(id);
        setMode('edit');
    };

    const backToList = () => {
        handleReset();
        setMode('list');
    };

    const submit = async () => {
        const wasEdit = !!selectedScaleId;
        const ok = await handleSave();
        if (ok) {
            notify.success(wasEdit ? 'Grade scale saved' : 'Grade scale added');
            setSuccess(null); // the toast already says it
            setMode('list');
        }
    };

    const classNames = (sc: any) => sc.classes && sc.classes.length > 0
        ? sc.classes.map((c: any) => c.class_name).join(', ')
        : 'No classes';

    const scaleActions = (sc: any) => (
        <>
            <button type="button" onClick={() => openExisting(sc.id)} className="btn-secondary btn-sm">
                <Edit size={14} /> Edit
            </button>
            <button type="button" onClick={() => handleDelete(sc.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700">
                <Trash2 size={14} /> Delete
            </button>
        </>
    );

    const scaleColumns: Column<any>[] = [
        { key: 'scale_name', header: 'Grade scale', primary: true, render: sc => <span className="font-medium text-slate-900">{sc.scale_name}</span> },
        { key: 'classes', header: 'Classes', secondary: true, render: sc => <span className="text-slate-600">{classNames(sc)}</span> },
        { key: 'actions', header: '', align: 'right', hideOnMobile: true, render: sc => <div className="flex justify-end gap-1.5">{scaleActions(sc)}</div> },
    ];

    /* ------------------------------------------------------------ List */
    if (mode === 'list') {
        return (
            <div className="max-w-4xl">
                <SetupIntro
                    title="Grades"
                    context={contextLine}
                    action={(
                        <button type="button" className="btn-primary" onClick={openNew} disabled={!academicYear || !branch}>
                            <Plus size={18} /> Add grade scale
                        </button>
                    )}
                >
                    A grade scale says which marks get which grade (for example 91–100 = A1). Each scale is used for the classes you choose.
                </SetupIntro>

                {(!academicYear || !branch) && !loading && (
                    <Alert tone="warning" className="mb-4">The year or branch is missing. Choose them at the top of the screen.</Alert>
                )}
                {error && <Alert tone="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}
                {success && <Alert tone="success" className="mb-4" onClose={() => setSuccess(null)}>{success}</Alert>}

                <DataList
                    columns={scaleColumns}
                    rows={scales}
                    rowKey={sc => sc.id}
                    loading={loading && scales.length === 0}
                    emptyTitle="No grade scales yet"
                    emptyHint='Tap "Add grade scale" to make the first one.'
                    mobileActions={scaleActions}
                />
            </div>
        );
    }

    /* ------------------------------------------------------------ Add / edit */
    const editingNew = !selectedScaleId;

    return (
        <div className="max-w-3xl">
            <button type="button" onClick={backToList} className="mb-2 inline-flex items-center gap-1.5 min-h-[44px] px-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All grade scales
            </button>
            <SetupIntro title={editingNew ? 'Add grade scale' : `Edit: ${scaleName || 'grade scale'}`} context={contextLine} />

            {/* About this scale */}
            <section className="card mb-4">
                <div className="card-header"><h2 className="text-base font-semibold text-slate-900">About this scale</h2></div>
                <div className="card-body space-y-4">
                    <Field label="Name" htmlFor="gs-name" required>
                        <input
                            id="gs-name"
                            type="text"
                            className="input"
                            placeholder="For example: Primary grades"
                            value={scaleName}
                            onChange={e => setScaleName(e.target.value)}
                        />
                    </Field>

                    <Field label="Classes that use it" required hint={`${selectedClasses.length} chosen`}>
                        <div className="flex flex-wrap gap-2">
                            {availableClasses.map(c => {
                                const on = selectedClasses.includes(c.id);
                                return (
                                    <label key={c.id} className={`inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border cursor-pointer text-sm ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-brand-600"
                                            checked={on}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedClasses([...selectedClasses, c.id]);
                                                } else {
                                                    setSelectedClasses(selectedClasses.filter(id => id !== c.id));
                                                }
                                            }}
                                        />
                                        {c.class_name}
                                    </label>
                                );
                            })}
                            {availableClasses.length === 0 && <span className="text-sm text-slate-500">No classes found.</span>}
                        </div>
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Total marks" htmlFor="gs-total" required hint="Grades are worked out out of this total.">
                            <input
                                id="gs-total"
                                type="number"
                                inputMode="numeric"
                                className="input"
                                placeholder="For example: 100"
                                value={totalMarks}
                                onChange={e => setTotalMarks(Number(e.target.value))}
                            />
                        </Field>
                        <Field label="Note (optional)" htmlFor="gs-desc">
                            <input
                                id="gs-desc"
                                type="text"
                                className="input"
                                placeholder="Anything to remember about this scale"
                                value={scaleDescription}
                                onChange={e => setScaleDescription(e.target.value)}
                            />
                        </Field>
                    </div>
                </div>
            </section>

            {/* Grades */}
            <section className="card">
                <div className="card-header">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Grades</h2>
                        <p className="text-sm text-slate-500">Marks from – to for each grade, out of {totalMarks}.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddDetailRow}
                        className="btn-soft"
                        disabled={editingNew || editingRowIndex !== null}
                    >
                        <Plus size={16} /> Add grade
                    </button>
                </div>
                <div className="card-body">
                    {editingNew ? (
                        <Alert tone="info">Save this grade scale first. Then open it again to add grades.</Alert>
                    ) : details.length === 0 ? (
                        <EmptyState compact title="No grades yet" description='Tap "Add grade" to add the first one, like A1 for 91 to 100.' />
                    ) : (
                        <ul className="space-y-2">
                            {details.map((row, idx) => {
                                const isEditing = editingRowIndex === idx;
                                const currentData = isEditing && tempRowData ? tempRowData : row;

                                if (isEditing) {
                                    return (
                                        <li key={idx} className="rounded-xl border border-brand-300 bg-brand-50/50 p-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                <Field label="Grade" htmlFor={`gd-grade-${idx}`}>
                                                    <input
                                                        id={`gd-grade-${idx}`}
                                                        type="text"
                                                        className="input text-center uppercase"
                                                        value={currentData.grade}
                                                        onChange={e => handleTempChange('grade', e.target.value)}
                                                        placeholder="A1"
                                                        autoFocus
                                                    />
                                                </Field>
                                                <Field label="From" htmlFor={`gd-min-${idx}`}>
                                                    <input
                                                        id={`gd-min-${idx}`}
                                                        type="number"
                                                        inputMode="decimal"
                                                        className="input text-center"
                                                        value={currentData.min_marks}
                                                        onChange={e => handleTempChange('min_marks', e.target.value)}
                                                    />
                                                </Field>
                                                <Field label="To" htmlFor={`gd-max-${idx}`}>
                                                    <input
                                                        id={`gd-max-${idx}`}
                                                        type="number"
                                                        inputMode="decimal"
                                                        className="input text-center"
                                                        value={currentData.max_marks}
                                                        onChange={e => handleTempChange('max_marks', e.target.value)}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Meaning (optional)" htmlFor={`gd-desc-${idx}`} className="mt-3">
                                                <input
                                                    id={`gd-desc-${idx}`}
                                                    type="text"
                                                    className="input"
                                                    value={currentData.description || ''}
                                                    onChange={e => handleTempChange('description', e.target.value)}
                                                    placeholder="For example: Excellent"
                                                />
                                            </Field>
                                            <div className="mt-3 flex justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                                                <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                                                    <X size={16} /> Cancel
                                                </button>
                                                <button type="button" onClick={handleSaveEdit} className="btn-primary">
                                                    <Check size={16} /> Done
                                                </button>
                                            </div>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={idx} className="rounded-xl border border-slate-200 bg-white flex flex-wrap items-center gap-3 px-3 py-2">
                                        <span className="w-12 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-semibold text-slate-900">{row.grade}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-slate-900">{row.min_marks} to {row.max_marks} marks</p>
                                            {row.description && <p className="text-sm text-slate-500 break-words">{row.description}</p>}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button type="button" onClick={() => handleStartEdit(idx)} className="btn-secondary btn-sm" disabled={editingRowIndex !== null}>
                                                <Edit size={14} /> Edit
                                            </button>
                                            <button type="button" onClick={() => handleRemoveDetailRow(idx)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700" aria-label={`Remove grade ${row.grade}`}>
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

            {error && <Alert tone="error" className="mt-4">{error}</Alert>}

            <ActionBar note={editingRowIndex !== null ? 'Tap Done on the grade you are editing, then save.' : (!editingNew ? 'Grade changes are kept only after you save.' : undefined)}>
                <button type="button" onClick={backToList} className="btn-secondary btn-lg">
                    Cancel
                </button>
                <button type="button" onClick={submit} disabled={loading} className="btn-primary btn-lg">
                    <Save size={16} /> {editingNew ? 'Add grade scale' : 'Save grade scale'}
                </button>
            </ActionBar>
        </div>
    );
};

export default GradeScaleManager;
