import { useEffect, useState } from "react";
import api from "../api";
import { Save } from "lucide-react";
import { notify } from './ui/feedback';
import { LoadingState, EmptyState, ErrorState, ActionBar, Field, Alert } from './ui';
import { SetupIntro, GridCard, GridCheck } from './exam-setup/shared';

const getNormalizedBranch = (): string => {
    const b = localStorage.getItem('currentBranch') || 'All';
    if (b === 'All Locations' || b === 'All Branches' || b === 'All') {
        return 'All Locations';
    }
    return b;
};

interface TestColumn {
    class_test_id: number;
    test_name: string;
    test_order: number;
} 

interface StudentRow {
    student_id: number;
    name: string;
    roll_number: number | null;
    admission_no: string;
    section: string | null;
}

interface AssignmentsMap {
    [studentId: number]: number[]; // List of assigned class_test_ids
}

export default function AssignStudentTests() {
    /* ---------------- STATE ---------------- */
    const [filters, setFilters] = useState({
        academic_year_id: localStorage.getItem("academicYear") || "",
        branch_id: getNormalizedBranch(),
        class_id: "",
    });

    const [columns, setColumns] = useState<TestColumn[]>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [assignments, setAssignments] = useState<AssignmentsMap>({});

    const [dropdowns, setDropdowns] = useState({
        years: [],
        branches: [],
        classes: []
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");

    // Tracking changes for efficient save: { student_id, class_test_id, status }
    const [changes, setChanges] = useState<{ student_id: number, class_test_id: number, status: boolean }[]>([]);

    /* ---------------- INIT ---------------- */
    useEffect(() => {
        fetchDropdowns();
    }, []);

    useEffect(() => {
        if (filters.academic_year_id && filters.branch_id && filters.class_id) {
            fetchMatrix();
        } else {
            setStudents([]);
            setColumns([]);
            setAssignments({});
        }
    }, [filters]);

    /* ---------------- API CALLS ---------------- */
    const fetchDropdowns = async () => {
        try {
            const [y, b, c] = await Promise.all([
                api.get("/org/academic-years"),
                api.get("/branches"),
                api.get("/classes")
            ]);
            setDropdowns({
                years: y.data.academic_years,
                branches: b.data.branches,
                classes: c.data.classes
            });
        } catch (e) {
            console.error("Failed to load dropdowns", e);
        }
    };

    const fetchMatrix = async () => {
        setLoading(true);
        setLoadError("");
        setChanges([]); // Clear pending changes on reload
        try {
            const res = await api.get("/student-test-assignments", { params: filters });
            setColumns(res.data.columns);
            setStudents(res.data.rows);
            setAssignments(res.data.assignments);
        } catch (e: any) {
            console.error(e);
            setLoadError(e.response?.data?.error || "Could not load the students. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (changes.length === 0) {
            notify("Nothing has changed yet.");
            return;
        }
        setSaving(true);
        try {
            await api.post("/student-test-assignments", {
                ...filters,
                updates: changes
            });
            notify.success("Students in each exam saved");
            fetchMatrix(); // Reload to refresh state and clear changes
        } catch (e: any) {
            console.error(e);
            notify.error("Could not save: " + (e.response?.data?.error || "Please try again."));
        } finally {
            setSaving(false);
        }
    };

    /* ---------------- HELPERS ---------------- */
    const isAssigned = (studentId: number, testId: number) => {
        // Check current state (including unsaved changes)
        // Actually, easier to let 'assignments' be source of truth + logic to update it
        // But for efficient patches, we track 'changes'.
        // Let's rely on 'assignments' state for rendering, and 'changes' for API.
        return assignments[studentId]?.includes(testId) || false;
    };

    const toggleAssignment = (studentId: number, testId: number, checked: boolean) => {
        // Update local UI state
        setAssignments(prev => {
            const currentList = prev[studentId] || [];
            if (checked) {
                return { ...prev, [studentId]: [...currentList, testId] };
            } else {
                return { ...prev, [studentId]: currentList.filter(id => id !== testId) };
            }
        });

        // Track change
        setChanges(prev => {
            // Remove any existing change for this exact cell to avoid duplicates/conflicts in patches
            const filtered = prev.filter(c => !(c.student_id === studentId && c.class_test_id === testId));
            return [...filtered, { student_id: studentId, class_test_id: testId, status: checked }];
        });
    };

    const toggleColumn = (testId: number, checked: boolean) => {
        // Setup bulk changes
        const newUpdates: { student_id: number, class_test_id: number, status: boolean }[] = [];
        const newAssignments = { ...assignments };

        students.forEach(s => {
            const currentAssigned = newAssignments[s.student_id]?.includes(testId);
            if (currentAssigned !== checked) {
                // Update map
                if (checked) {
                    newAssignments[s.student_id] = [...(newAssignments[s.student_id] || []), testId];
                } else {
                    newAssignments[s.student_id] = (newAssignments[s.student_id] || []).filter(id => id !== testId);
                }
                // Track update
                newUpdates.push({ student_id: s.student_id, class_test_id: testId, status: checked });
            }
        });

        setAssignments(newAssignments);
        setChanges(prev => {
            // Merge new bulk updates, removing old conflicting ones
            const prevFiltered = prev.filter(c => !(c.class_test_id === testId));
            return [...prevFiltered, ...newUpdates];
        });
    };

    /* ---------------- RENDER ---------------- */
    const n = changes.length;
    const allInColumn = (testId: number) => students.length > 0 && students.every(s => isAssigned(s.student_id, testId));
    const branchLabel = filters.branch_id === 'All Locations' ? 'All branches' : filters.branch_id;

    return (
        <div className="min-h-full flex flex-col">
            <SetupIntro
                title="Students in each exam"
                context={[filters.academic_year_id ? `Year ${filters.academic_year_id}` : null, branchLabel]}
            >
                Choose a class, then tick the exams each student writes.
            </SetupIntro>

            {/* FILTERS */}
            <div className="card p-4 mb-4">
                <Field label="Class" htmlFor="ast-class" className="sm:max-w-xs">
                    <select
                        id="ast-class"
                        className="input"
                        value={filters.class_id}
                        onChange={e => setFilters({ ...filters, class_id: e.target.value })}
                    >
                        <option value="">Choose a class</option>
                        {dropdowns.classes.map((c: any) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                </Field>
            </div>

            {/* CONTENT */}
            {loading && <div className="card"><LoadingState label="Loading students…" /></div>}
            {loadError && <div className="card"><ErrorState message={loadError} onRetry={fetchMatrix} /></div>}

            {!loading && !loadError && !filters.class_id && (
                <div className="card"><EmptyState title="Choose a class" description="The students of that class will show here." /></div>
            )}

            {!loading && !loadError && students.length > 0 && (
                <>
                    {columns.length === 0 && (
                        <Alert tone="info" className="mb-3">
                            This class has no exams yet. Add exams to the class first in "Add an exam to classes".
                        </Alert>
                    )}
                    <GridCard>
                        <table className="border-separate border-spacing-0 text-sm text-left">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 min-w-[170px]">Student</th>
                                    {columns.map(col => (
                                        <th key={col.class_test_id} className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center min-w-[96px]">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-semibold text-slate-800 leading-tight">{col.test_name}</span>
                                                <GridCheck
                                                    checked={allInColumn(col.class_test_id)}
                                                    onChange={checked => toggleColumn(col.class_test_id, checked)}
                                                    label={`${col.test_name} for all students`}
                                                />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s, idx) => (
                                    <tr key={s.student_id} className="hover:bg-slate-50/60">
                                        <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-1.5">
                                            <div className="font-medium text-slate-900 leading-snug">{idx + 1}. {s.name}</div>
                                            <div className="text-xs text-slate-500">
                                                {s.section ? `Section ${s.section} · ` : ''}Roll {s.roll_number ?? '—'} · Adm. {s.admission_no}
                                            </div>
                                        </td>
                                        {columns.map(col => (
                                            <td key={col.class_test_id} className="border-b border-slate-100 p-0.5 text-center">
                                                <GridCheck
                                                    checked={isAssigned(s.student_id, col.class_test_id)}
                                                    onChange={checked => toggleAssignment(s.student_id, col.class_test_id, checked)}
                                                    label={`${col.test_name} for ${s.name}`}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </GridCard>

                    <ActionBar note={n > 0 ? `${n} change${n !== 1 ? 's' : ''} not saved yet` : 'No changes yet. Tick or untick boxes above.'}>
                        <button
                            type="button"
                            onClick={() => fetchMatrix()}
                            disabled={saving || n === 0}
                            className="btn-secondary btn-lg"
                        >
                            Undo changes
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || n === 0}
                            className="btn-primary btn-lg"
                        >
                            <Save size={18} />
                            <span>{saving ? "Saving…" : `Save changes (${n})`}</span>
                        </button>
                    </ActionBar>
                </>
            )}

            {!loading && !loadError && students.length === 0 && filters.class_id && (
                <div className="card"><EmptyState title="No students found" description="There are no students in this class." /></div>
            )}
        </div>
    );
}
