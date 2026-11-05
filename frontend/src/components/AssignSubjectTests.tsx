import { useEffect, useState } from "react";
import api from "../api";
import { Copy, Save } from "lucide-react";
import CopySubjectTestModal from "./CopySubjectTestModal";
import { notify } from './ui/feedback';
import { LoadingState, EmptyState, ActionBar, Field, Steps } from './ui';
import { SetupIntro, Choice } from './exam-setup/shared';

const STEP_TITLES = ['Choose class and exam', 'Choose subjects and marks'];

interface SubjectRow {
    subject_id: number;
    subject_name: string;
    subject_type: string; 
    assigned: boolean;
    max_marks: number | null;
    subject_order: number | null;
}

interface DropdownItem {
    id: string | number;
    name: string; // Uniform property for display
}

export default function AssignSubjectTests() {
    /* ---------------- STATE ---------------- */
    const [filters, setFilters] = useState({
        academic_year_id: localStorage.getItem("academicYear") || "",
        branch_id: localStorage.getItem("currentBranch") || "",
        class_id: "",
        test_id: "",
        subject_type: ""
    });

    // Dropdown Lists
    const [, setAcademicYears] = useState<DropdownItem[]>([]);
    const [, setBranches] = useState<DropdownItem[]>([]);
    const [classes, setClasses] = useState<DropdownItem[]>([]);
    const [tests, setTests] = useState<DropdownItem[]>([]);

    // Data
    const [subjects, setSubjects] = useState<SubjectRow[]>([]);
    const [classTestId, setClassTestId] = useState<number | null>(null);
    const [testMaxMarks, setTestMaxMarks] = useState<number>(0);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [step, setStep] = useState<0 | 1>(0);

    /* ---------------- INIT ---------------- */
    useEffect(() => {
        fetchDropdowns();
    }, []);

    useEffect(() => {
        if (
            filters.academic_year_id &&
            filters.branch_id &&
            filters.class_id &&
            filters.test_id
        ) {
            loadMatrix();
        } else {
            setSubjects([]);
            setClassTestId(null);
        }
    }, [filters]);

    /* ---------------- API CALLS ---------------- */
    const fetchDropdowns = async () => {
        try {
            const [yrRes, brRes, clRes] = await Promise.all([
                api.get("/org/academic-years"),
                api.get("/branches"),
                api.get("/classes")
            ]);
            setAcademicYears(yrRes.data.academic_years.map((y: any) => ({ id: y.id, name: y.name })));
            setBranches(brRes.data.branches.map((b: any) => ({ id: b.id, name: b.branch_name })));
            setClasses(clRes.data.classes.map((c: any) => ({ id: c.id, name: c.class_name })));
        } catch (e) {
            console.error("Error loading dropdowns", e);
        }
    };

    useEffect(() => {
        if (filters.academic_year_id && filters.branch_id && filters.class_id) {
            fetchTests();
        } else {
            setTests([]); // Clear tests if filters incomplete
        }
    }, [filters.academic_year_id, filters.branch_id, filters.class_id]);

    const fetchTests = async () => {
        try {
            // Use /class-tests/list to get only tests assigned to this class
            const res = await api.get("/class-tests/list", {
                params: {
                    academic_year: filters.academic_year_id,
                    branch: filters.branch_id,
                    class_id: filters.class_id
                }
            });

            // Map the response (which returns objects with test_id, test_name) to DropdownItem
            setTests(res.data.map((t: any) => ({
                id: t.test_id, // Note: response uses test_id, not id
                name: t.test_name
            })));
        } catch (e) {
            console.error("Error loading tests", e);
            setTests([]);
        }
    };

    const loadMatrix = async () => {
        setLoading(true);
        try {
            const res = await api.get("/class-test-subjects/", {
                params: filters
            });
            setSubjects(res.data.subjects);
            setClassTestId(res.data.class_test_id);
            setTestMaxMarks(res.data.test_max_marks || 0);
        } catch (err: any) {
            console.error(err);
            notify.error(err.response?.data?.error || "Could not load the subjects. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation handled by backend regarding if class/branch/test selected
        if (!filters.academic_year_id || !filters.branch_id || !filters.class_id || !filters.test_id) {
            notify("Choose a class and an exam first.");
            return;
        }

        // Frontend Validation
        const assignedSubjects = subjects.filter(s => s.assigned);
        const totalMarks = assignedSubjects.reduce((sum, s) => sum + (s.max_marks || 0), 0);

        if (totalMarks > testMaxMarks) {
            notify(`The total of subject marks (${totalMarks}) cannot be more than the exam's full marks (${testMaxMarks}).`);
            return;
        }

        const orders = assignedSubjects.map(s => s.subject_order).filter(o => o !== null);
        if (new Set(orders).size !== orders.length) {
            notify("Two subjects have the same position. Give each subject a different number.");
            return;
        }

        setSaving(true);
        const payload = {
            class_test_id: classTestId, // Can be null
            context: filters, // Pass context so backend can create ClassTest if null
            subjects: assignedSubjects.map(s => ({
                subject_id: s.subject_id,
                max_marks: s.max_marks,
                subject_order: s.subject_order
            }))
        };

        try {
            const res = await api.post("/class-test-subjects/", payload);
            notify.success("Subjects for this exam saved");

            // If backend created a new ID, update state
            if (res.data.class_test_id) {
                setClassTestId(res.data.class_test_id);
            }
        } catch (err: any) {
            notify.error(err.response?.data?.error || "Could not save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    /* ---------------- UI HANDLERS ---------------- */
    const updateSubject = (index: number, field: keyof SubjectRow, value: any) => {
        const newSubjects = [...subjects];
        newSubjects[index] = { ...newSubjects[index], [field]: value };

        // Auto-logic: If unchecking assigned, clear values
        if (field === 'assigned' && !value) {
            newSubjects[index].max_marks = null;
            newSubjects[index].subject_order = null;
        }
        // Auto-logic: If setting marks/order, auto-check assigned
        if ((field === 'max_marks' || field === 'subject_order') && value) {
            newSubjects[index].assigned = true;
        }

        setSubjects(newSubjects);
    };

    const calculateTotal = () => {
        return subjects.filter(s => s.assigned).reduce((sum, s) => sum + (s.max_marks || 0), 0);
    };

    /* ---------------- RENDER ---------------- */
    const total = calculateTotal();
    const overLimit = total > testMaxMarks;
    const assignedCount = subjects.filter(s => s.assigned).length;
    const className = classes.find(c => String(c.id) === String(filters.class_id))?.name;
    const testName = tests.find(t => String(t.id) === String(filters.test_id))?.name;
    const ready = !!(filters.class_id && filters.test_id);

    const intro = (
        <SetupIntro
            title="Subjects in each exam"
            context={[filters.academic_year_id ? `Year ${filters.academic_year_id}` : null, filters.branch_id || null]}
        >
            Choose the subjects for one exam in one class, with the full marks for each subject.
        </SetupIntro>
    );

    /* Step 1: choose class and exam */
    if (step === 0) {
        return (
            <div className="min-h-full">
                {intro}
                <Steps steps={STEP_TITLES} current={0} className="mb-4" />
                <div className="card p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Class" htmlFor="ast-class">
                            <select
                                id="ast-class"
                                className="input"
                                value={filters.class_id}
                                onChange={e => setFilters({ ...filters, class_id: e.target.value, test_id: "" })}
                            >
                                <option value="">Choose a class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </Field>

                        <Field
                            label="Exam"
                            htmlFor="ast-test"
                            hint={filters.class_id && tests.length === 0 ? 'This class has no exams yet. Add one in "Add an exam to classes".' : undefined}
                        >
                            <select
                                id="ast-test"
                                className="input"
                                value={filters.test_id}
                                disabled={!filters.class_id}
                                onChange={e => setFilters({ ...filters, test_id: e.target.value })}
                            >
                                <option value="">{filters.class_id ? 'Choose an exam' : 'Choose a class first'}</option>
                                {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>
                <ActionBar note={!filters.class_id ? 'Choose a class first' : !filters.test_id ? 'Choose an exam' : undefined}>
                    <button type="button" className="btn-primary btn-lg" disabled={!ready} onClick={() => setStep(1)}>
                        Show subjects
                    </button>
                </ActionBar>
            </div>
        );
    }

    /* Step 2: tick subjects and enter marks */
    return (
        <div className="min-h-full">
            {intro}
            <Steps steps={STEP_TITLES} current={1} onJump={() => setStep(0)} className="mb-4" />

            <div className="card p-4 mb-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 break-words">{testName || 'Exam'} · Class {className || ''}</p>
                    <p className="text-sm text-slate-600">Full marks for this exam: {testMaxMarks}</p>
                </div>
                <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => setStep(0)}>Change</button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex-1">
                    <Choice
                        label="Show subjects"
                        value={filters.subject_type as '' | 'Academic' | 'Deeniyath'}
                        onChange={v => setFilters({ ...filters, subject_type: v })}
                        options={[{ value: '', label: 'All subjects' }, { value: 'Academic', label: 'Academic' }, { value: 'Deeniyath', label: 'Deeniyath' }]}
                    />
                </div>
                {classTestId && (
                    <button type="button" onClick={() => setIsCopyModalOpen(true)} className="btn-secondary">
                        <Copy size={16} /> <span>Copy to other exams or classes</span>
                    </button>
                )}
            </div>

            {loading ? (
                <div className="card"><LoadingState label="Loading subjects…" /></div>
            ) : !classTestId ? (
                <div className="card">
                    <EmptyState
                        title="This exam is not set up for this class"
                        description='Add this exam to the class first in "Add an exam to classes".'
                        action={<button type="button" className="btn-secondary" onClick={() => setStep(0)}>Choose another</button>}
                    />
                </div>
            ) : (
                <>
                    {/* Total vs full marks */}
                    <div className={`card p-4 mb-3 flex items-center justify-between gap-3 ${overLimit ? 'border-red-300 bg-red-50' : ''}`} aria-live="polite">
                        <div>
                            <p className="text-sm text-slate-600">{assignedCount} subject{assignedCount !== 1 ? 's' : ''} chosen</p>
                            <p className={`text-lg font-semibold ${overLimit ? 'text-red-700' : 'text-slate-900'}`}>
                                Total {total} of {testMaxMarks} marks
                            </p>
                        </div>
                        {overLimit
                            ? <span className="badge-danger">Too many marks</span>
                            : <span className="badge-success">OK</span>}
                    </div>

                    {subjects.length === 0 ? (
                        <div className="card"><EmptyState compact title="No subjects found" description="Add subjects to this class first." /></div>
                    ) : (
                        <ul className="space-y-2">
                            {subjects.map((s, idx) => (
                                <li key={s.subject_id} className={`rounded-xl border bg-white ${s.assigned ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'}`}>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                                        <label className="flex items-center gap-3 min-h-[44px] flex-1 min-w-[180px] cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-brand-600 flex-shrink-0"
                                                checked={s.assigned}
                                                onChange={(e) => updateSubject(idx, 'assigned', e.target.checked)}
                                            />
                                            <span className="min-w-0">
                                                <span className="block font-medium text-slate-900">{s.subject_name}</span>
                                                <span className="block text-xs text-slate-500">{s.subject_type}</span>
                                            </span>
                                        </label>
                                        <div className="flex items-end gap-2 ml-8 sm:ml-0">
                                            <label className="block">
                                                <span className="block text-xs text-slate-500 mb-0.5">Full marks</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    className={`input w-24 ${!s.assigned ? 'bg-slate-100' : ''}`}
                                                    disabled={!s.assigned}
                                                    value={s.max_marks ?? ''}
                                                    onChange={(e) => updateSubject(idx, 'max_marks', Number(e.target.value))}
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-xs text-slate-500 mb-0.5">Position</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    className={`input w-20 ${!s.assigned ? 'bg-slate-100' : ''}`}
                                                    disabled={!s.assigned}
                                                    value={s.subject_order ?? ''}
                                                    onChange={(e) => updateSubject(idx, 'subject_order', Number(e.target.value))}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <ActionBar note={overLimit ? `The total (${total}) is more than the exam's full marks (${testMaxMarks}). Lower some marks.` : undefined}>
                        <button
                            type="button"
                            onClick={() => loadMatrix()}
                            disabled={saving}
                            className="btn-secondary btn-lg"
                        >
                            Undo changes
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || overLimit}
                            className="btn-primary btn-lg"
                        >
                            <Save size={16} /> <span>{saving ? "Saving…" : "Save subjects"}</span>
                        </button>
                    </ActionBar>
                </>
            )}

            {/* COPY MODAL */}
            <CopySubjectTestModal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                sourceClassTestId={classTestId}
                currentAcademicYear={filters.academic_year_id}
                currentBranch={filters.branch_id}
                currentClass={filters.class_id}
                currentTest={filters.test_id}
            />
        </div>
    );
}
