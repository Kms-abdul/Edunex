import React, { useState, useEffect } from "react";
import api from "../api";
import { Save, Edit, FileDown, Check } from "lucide-react";
import * as XLSX from 'xlsx';
import { notify } from './ui/feedback';
import { PageHeader, Alert, Steps, ActionBar, Field, Button, LoadingState } from './ui';
import { markProblem } from './marks/markCheck';

const STEPS = ['Choose exam', 'Enter marks'];

// --- Types ---
interface Student {
    student_id: number;
    admission_no: string;
    roll_number: string | number;
    name: string;
}

interface Subject {
    id: number;
    subject_name: string;
    subject_type?: string;
    max_marks?: number;
}

interface MarksData {
    [studentId: number]: {
        [subjectId: number]: {
            value: string; // "34", "AB", etc.
            is_absent: boolean;
        };
    };
}

const MarksEntryAllSubjects: React.FC = () => {
    // --- State ---
    const [academicYear, setAcademicYear] = useState<string>("");
    const [, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");

    // Filters
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [sections, setSections] = useState<string[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>("");

    const [tests, setTests] = useState<any[]>([]);
    const [selectedTestId, setSelectedTestId] = useState<string>("");

    const [selectedSubjectType, setSelectedSubjectType] = useState<string>("All");

    // Data
    const [subjects, setSubjects] = useState<Subject[]>([]);
    // Metadata map for filtering if subject objects don't have type directly (fetched separately)
    const [allSubjectsMeta, setAllSubjectsMeta] = useState<{ [id: number]: { type: string, name: string } }>({});
    const [subjectMaxMarks, setSubjectMaxMarks] = useState<{ [id: number]: number }>({});
    const [subjectClassTestIds, setSubjectClassTestIds] = useState<{ [key: number]: number }>({});

    const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [marksData, setMarksData] = useState<MarksData>({});

    // UI State
    const [loading, setLoading] = useState(false);
    const [editingRows, setEditingRows] = useState<Set<number>>(new Set()); // Per-row editing
    const [rowSaving, setRowSaving] = useState<Set<number>>(new Set()); // Per-row saving
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    // 0 = choose exam, 1 = enter marks
    const [step, setStep] = useState(0);
    const [savingAll, setSavingAll] = useState(false);

    // --- Init ---
    useEffect(() => {
        const storedYear = localStorage.getItem("academicYear") || "";
        const userStr = localStorage.getItem("user");
        let storedBranch = "All";

        if (userStr) {
            try {
                const selected = localStorage.getItem("currentBranch");
                if (selected && selected !== "All Locations") {
                    storedBranch = selected;
                }
            } catch (e) { console.error(e); }
        }

        setAcademicYear(storedYear);
        setSelectedBranch(storedBranch);
        setBranches([{ branch_name: storedBranch, branch_code: storedBranch }]);

        // Load Subject Metadata (for Types)
        api.get("/academic/subjects", { params: { academic_year: storedYear } })
            .then(res => {
                const meta: { [id: number]: { type: string, name: string } } = {};
                res.data.forEach((s: any) => {
                    meta[s.id] = { type: s.subject_type || 'Academic', name: s.subject_name };
                });
                setAllSubjectsMeta(meta);
            })
            .catch(console.error);
    }, []);

    // --- Fetch Classes ---
    useEffect(() => {
        if (!selectedBranch) return;
        api.get(`/classes?branch=${selectedBranch}`)
            .then(res => setClasses(res.data.classes || res.data))
            .catch(err => console.error(err));
    }, [selectedBranch]);

    // --- Fetch Sections ---
    useEffect(() => {
        const clsObj = classes.find(c => c.id == selectedClass);
        if (!clsObj) { setSections([]); return; }
        api.get(`/sections?class=${clsObj.class_name}`)
            .then(res => setSections(res.data.sections || []))
            .catch(() => setSections([]));
    }, [selectedClass, classes]);

    // --- Fetch Tests & Subjects ---
    useEffect(() => {
        if (!selectedClass || !academicYear) return;
        api.get(`/class-tests/list`, {
            params: { academic_year: academicYear, branch: selectedBranch, class_id: selectedClass }
        })
            .then(res => setTests(res.data))
            .catch(console.error);
    }, [selectedClass, academicYear, selectedBranch]);

    // Update Subjects when Test changes
    useEffect(() => {
        const test = tests.find(t => t.test_id == selectedTestId);
        if (test && test.subjects) {
            setSubjects(test.subjects);
            // Default select all subject IDs initially
            // But we will filter them in the render/fetch logic based on type
            setSelectedSubjectIds(test.subjects.map((s: any) => s.id));
        } else {
            setSubjects([]);
            setSelectedSubjectIds([]);
        }
    }, [selectedTestId, tests]);



    // --- Filtering Logic ---
    const getFilteredSubjects = () => {
        if (!subjects || subjects.length === 0) return [];
        if (selectedSubjectType === "All") return subjects;

        return subjects.filter(s => {
            const sId = s.id;
            const meta = allSubjectsMeta[sId];
            const type = meta ? (meta.type || "Academic") : "Academic";
            return type.toLowerCase() === selectedSubjectType.toLowerCase();
        });
    };

    const filteredSubjects = getFilteredSubjects();

    // Auto-select filtered subjects when type changes
    useEffect(() => {
        const ids = filteredSubjects.map(s => s.id);
        setSelectedSubjectIds(ids);
    }, [selectedSubjectType, subjects, allSubjectsMeta]); // Re-run if meta loads later

    // --- Fetch Data (Students + Marks) ---
    const handleGetData = async () => {
        if (!selectedTestId || subjects.length === 0) {
            setMessage({ type: 'error', text: "Choose an exam that has subjects." });
            return;
        }

        setLoading(true);
        setMessage(null);
        setEditingRows(new Set()); // Reset editing
        setMarksData({});
        setSubjectClassTestIds({}); // Reset
        setSubjectMaxMarks({});

        try {
            // 1. Fetch Students
            const clsObj = classes.find(c => c.id == selectedClass);
            const studentsRes = await api.get('/students', {
                params: {
                    branch: selectedBranch,
                    class: clsObj?.class_name,
                    section: selectedSection,
                    academic_year: academicYear
                }
            });
            const studentsList = studentsRes.data.students || studentsRes.data || [];
            if (studentsList.length === 0) {
                setMessage({ type: 'error', text: "No students found in this class." });
                setLoading(false);
                return;
            }
            // Sort
            studentsList.sort((a: any, b: any) => parseInt(a.roll_number || 0) - parseInt(b.roll_number || 0));
            setStudents(studentsList);

            // 2. Identify subjects to fetch (based on selection)
            const subjectsToFetch = subjects.filter(s => selectedSubjectIds.includes(s.id));

            // 3. Fetch Marks for EACH (filtered) subject
            const newMarksData: MarksData = {};
            const newSubjectClassTestIds: { [key: number]: number } = {};
            const newSubjectMaxMarks: { [key: number]: number } = {};

            // Init marks container
            studentsList.forEach((s: any) => {
                newMarksData[s.student_id || (s as any).id] = {};
            });

            // Parallel requests
            const subjectPromises = subjectsToFetch.map(async (subj) => {
                try {
                    const res = await api.get(`/marks/entry/subject`, {
                        params: {
                            academic_year: academicYear,
                            branch: selectedBranch,
                            class_id: selectedClass,
                            section: selectedSection,
                            test_id: selectedTestId,
                            subject_id: subj.id
                        }
                    });

                    if (res.data.class_test_id) {
                        newSubjectClassTestIds[subj.id] = res.data.class_test_id;
                    }

                    if (res.data.subject_total_marks) {
                        newSubjectMaxMarks[subj.id] = res.data.subject_total_marks;
                    }

                    // Map students
                    res.data.students.forEach((sMeta: any) => {
                        const sId = sMeta.student_id;
                        if (newMarksData[sId]) {
                            newMarksData[sId][subj.id] = {
                                value: sMeta.is_absent ? "AB" : (sMeta.marks_obtained !== null ? String(sMeta.marks_obtained).split('.')[0] : ""),
                                is_absent: sMeta.is_absent
                            };
                        }
                    });
                } catch (err) {
                    console.error(`Failed to fetch marks for subject ${subj.id}`, err);
                }
            });

            await Promise.all(subjectPromises);
            setMarksData(newMarksData);
            setSubjectClassTestIds(newSubjectClassTestIds);
            setSubjectMaxMarks(newSubjectMaxMarks);
            setStep(1);

        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: "Could not load the students. Check your internet and try again." });
        } finally {
            setLoading(false);
        }
    };

    // --- Input Handlers ---
    const handleMarkChange = (studentId: number, subjectId: number, value: string) => {
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    ...prev[studentId]?.[subjectId],
                    value: value,
                    is_absent: value.trim().toUpperCase() === "AB"
                }
            }
        }));
    };

    const handleMarkBlur = (studentId: number, subjectId: number) => {
        const valStr = marksData[studentId]?.[subjectId]?.value || "";
        const max = subjectMaxMarks[subjectId] || 100;

        let normalized = valStr;
        let isAbsent = false;

        if (valStr.trim().toUpperCase() === "AB") {
            normalized = "AB";
            isAbsent = true;
        } else if (valStr.trim() !== "") {
            const num = parseFloat(valStr);
            if (!isNaN(num)) {
                let rounded = Math.round(num);
                if (rounded < 0) rounded = 0;
                if (rounded > max) rounded = Math.round(max); // Clamp to max
                normalized = String(rounded);
            } else {
                normalized = ""; // clear invalid
            }
        }

        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    value: normalized,
                    is_absent: isAbsent
                }
            }
        }));
    };

    // --- Row Actions ---
    const handleEditRow = (studentId: number) => {
        setEditingRows(prev => new Set(prev).add(studentId));
    };

    const handleSaveRow = async (studentId: number) => {
        setRowSaving(prev => new Set(prev).add(studentId));

        try {
            // Save for ALL selected subjects for this student
            const promises = subjects.filter(s => selectedSubjectIds.includes(s.id)).map(async (subj) => {
                const classTestId = subjectClassTestIds[subj.id];
                if (!classTestId) return; // Skip if ID missing (maybe not part of this class/exam config)

                const m = marksData[studentId]?.[subj.id];
                // Only save if data exists or was edited.
                // Note: user might want to calculate empty strings as "clear mark".

                // If marksData entry maps to undefined but we are iterating it in the loop,
                // it implies we might never have fetched it or it's not valid.
                // But if we are here, we are only iterating visible filtered subjects.

                // Construct Payload
                const val = m?.is_absent ? "AB" : (m?.value || "");

                await api.post(`/marks/entry/subject`, {
                    class_test_id: classTestId,
                    subject_id: subj.id, // Subject ID
                    academic_year: academicYear,
                    branch: selectedBranch,
                    class_id: selectedClass,
                    section: selectedSection,
                    marks: [{
                        student_id: studentId,
                        value: val
                    }],
                });
            });

            await Promise.all(promises);

            // Success (functional update so several rows can be saved at once)
            setEditingRows(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });

            // Use toast or small checkmark? For now, nothing blocking, maybe just remove edit mode.
        } catch (err) {
            console.error("Save failed for student " + studentId, err);
            notify.error("Could not save marks for this student. Please check the marks and try again.");
        } finally {
            setRowSaving(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
        }
    };

    // --- Helper for Excel Download ---
    const handleDownload = () => {
        // Logic to download current view
        if (students.length === 0) return;

        const tableData = students.map((std: any) => {
            const row: any = {
                "Roll No": std.roll_number,
                "Name": std.name,
                "Admission No": std.admission_no
            };
            subjects.filter(s => selectedSubjectIds.includes(s.id)).forEach(s => {
                const m = marksData[std.student_id || std.id]?.[s.id];
                row[s.subject_name] = m?.is_absent ? "AB" : m?.value || "";
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(tableData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks");
        XLSX.writeFile(wb, "Marks_Export.xlsx");
    };

    // ------------------------------------------------------------------
    // UI helpers (screen flow only — saving still goes through handleSaveRow)
    // ------------------------------------------------------------------
    const visibleSubjects = subjects.filter(s => selectedSubjectIds.includes(s.id));
    const classObj = classes.find(c => String(c.id) === String(selectedClass));
    const testObj = tests.find(t => String(t.test_id) === String(selectedTestId));

    const chooseNote = !academicYear
        ? "No school year is chosen. Choose one at the top of the screen."
        : !classObj ? "Choose a class first."
        : !selectedTestId ? "Choose the exam."
        : selectedSubjectIds.length === 0 ? "Choose at least one subject."
        : null;

    const toggleSubject = (id: number) => {
        setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const openRows = Array.from(editingRows);
    const handleSaveAllOpen = async () => {
        setSavingAll(true);
        try {
            await Promise.all(openRows.map(id => handleSaveRow(id)));
        } finally {
            setSavingAll(false);
        }
    };

    const studentId = (student: Student) => student.student_id || (student as any).id;

    /** One marks box. Used by both the phone cards and the desktop table. */
    const renderMarkInput = (sId: number, subj: Subject, isRowEditing: boolean, wide = false) => {
        const cellData = marksData[sId]?.[subj.id];
        const val = cellData?.value || "";
        const isAbsent = cellData?.is_absent || false;
        // If check failed (cellData undefined), student doesn't have this subject allocated in backend
        const isAssigned = cellData !== undefined;
        const problem = isAssigned && !isAbsent ? markProblem(val, subjectMaxMarks[subj.id]) : null;
        return (
            <>
                <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={!isAssigned ? "" : val}
                    disabled={!isRowEditing || !isAssigned}
                    onChange={(e) => handleMarkChange(sId, subj.id, e.target.value)}
                    onBlur={() => handleMarkBlur(sId, subj.id)}
                    placeholder={!isAssigned ? "–" : ""}
                    aria-label={`${subj.subject_name} marks`}
                    aria-invalid={!!problem}
                    title={!isAssigned ? "This student does not take this subject" : problem || undefined}
                    className={`input min-h-[44px] text-center ${wide ? 'w-full' : 'w-16'}
                        ${isAbsent ? 'bg-red-50 text-red-600 font-bold border-red-300' : ''}
                        ${problem ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
                {wide && problem && <p className="mt-1 text-xs text-red-700">{problem}</p>}
            </>
        );
    };

    const renderRowButton = (sId: number, isRowEditing: boolean, isRowSaving: boolean, full = false) =>
        !isRowEditing ? (
            <button type="button" onClick={() => handleEditRow(sId)} className={`btn-soft min-h-[44px] ${full ? 'w-full' : 'btn-sm'}`}>
                <Edit size={14} /> Edit
            </button>
        ) : (
            <button
                type="button"
                onClick={() => handleSaveRow(sId)}
                disabled={isRowSaving}
                className={`btn-success min-h-[44px] ${full ? 'w-full' : 'btn-sm'}`}
            >
                {isRowSaving ? 'Saving…' : <><Save size={14} /> Save</>}
            </button>
        );

    const messageAlert = message && (
        <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4" onClose={() => setMessage(null)}>
            {message.text}
        </Alert>
    );

    return (
        <div>
            <PageHeader title="Enter marks for all subjects" className="mb-4" />
            <Steps steps={STEPS} current={step} onJump={() => setStep(0)} className="mb-5 max-w-3xl" />

            {/* ---------------- Step 1: Choose exam ---------------- */}
            {step === 0 && (
                <div className="max-w-3xl">
                    {messageAlert}
                    <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Class" htmlFor="mas-class">
                            <select
                                id="mas-class"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                className="input"
                            >
                                <option value="">Choose class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Section" htmlFor="mas-section">
                            <select
                                id="mas-section"
                                value={selectedSection}
                                onChange={e => setSelectedSection(e.target.value)}
                                className="input"
                            >
                                <option value="">Choose section</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>

                        <Field label="Exam" htmlFor="mas-test">
                            <select
                                id="mas-test"
                                value={selectedTestId}
                                onChange={e => setSelectedTestId(e.target.value)}
                                className="input"
                            >
                                <option value="">Choose exam</option>
                                {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.test_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Kind of subject" htmlFor="mas-type">
                            <select
                                id="mas-type"
                                value={selectedSubjectType}
                                onChange={e => setSelectedSubjectType(e.target.value)}
                                className="input"
                            >
                                <option value="All">All subjects</option>
                                <option value="Academic">Academic subjects</option>
                                <option value="Deeniyath">Deeniyath subjects</option>
                                {/* Dynamic types? Maybe in future */}
                            </select>
                        </Field>

                        {/* Subjects: tap to add or remove (no hover needed) */}
                        <div className="sm:col-span-2">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="block text-sm font-medium text-slate-800">
                                    Subjects to show ({selectedSubjectIds.length} of {filteredSubjects.length})
                                </span>
                                {filteredSubjects.length > 0 && (
                                    <div className="flex gap-1">
                                        <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedSubjectIds(filteredSubjects.map(s => s.id))}>
                                            All
                                        </button>
                                        <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedSubjectIds([])}>
                                            None
                                        </button>
                                    </div>
                                )}
                            </div>
                            {filteredSubjects.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    {selectedTestId ? "This exam has no subjects of this kind." : "Choose an exam to see its subjects."}
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {filteredSubjects.map(s => {
                                        const on = selectedSubjectIds.includes(s.id);
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => toggleSubject(s.id)}
                                                aria-pressed={on}
                                                className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 rounded-full border text-sm font-medium transition-colors
                                                    ${on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                {on && <Check size={14} aria-hidden="true" />}
                                                {s.subject_name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <ActionBar note={chooseNote}>
                        <Button onClick={handleGetData} loading={loading} disabled={!!chooseNote || !selectedTestId}>
                            {loading ? "Loading students…" : "Show students"}
                        </Button>
                    </ActionBar>
                </div>
            )}

            {/* ---------------- Step 2: Enter marks ---------------- */}
            {step === 1 && (
                <>
                    <div className="max-w-3xl">{messageAlert}</div>

                    <div className="card p-4 mb-4 flex items-start justify-between gap-3 max-w-3xl">
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-900 break-words">
                                {[classObj?.class_name, selectedSection ? `Section ${selectedSection}` : null, testObj?.test_name].filter(Boolean).join(' · ')}
                            </p>
                            <p className="text-sm text-slate-600 mt-0.5">
                                Tap <strong>Edit</strong> on a student, type the marks, then tap <strong>Save</strong>. Type AB if the student was absent.
                            </p>
                        </div>
                        <button type="button" className="btn-ghost btn-sm flex-shrink-0" onClick={() => setStep(0)}>Change</button>
                    </div>

                    {loading ? (
                        <div className="card"><LoadingState label="Loading students…" /></div>
                    ) : (
                        <>
                            {/* Phones: one card per student */}
                            <ul className="md:hidden space-y-3">
                                {students.map((student) => {
                                    const sId = studentId(student);
                                    const isRowEditing = editingRows.has(sId);
                                    const isRowSaving = rowSaving.has(sId);
                                    return (
                                        <li key={sId} className={`card p-4 ${isRowEditing ? 'ring-2 ring-brand-200' : ''}`}>
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="font-medium text-slate-900 min-w-0 truncate">{student.name}</p>
                                                <span className="text-sm text-slate-500 flex-shrink-0">Roll {student.roll_number || '–'}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">Admission number {student.admission_no}</p>
                                            <div className="mt-3 grid grid-cols-2 gap-3">
                                                {visibleSubjects.map(s => (
                                                    <div key={s.id} className="min-w-0">
                                                        <span className="block text-xs text-slate-600 mb-1 truncate">
                                                            {s.subject_name}{subjectMaxMarks[s.id] !== undefined ? ` (out of ${subjectMaxMarks[s.id]})` : ''}
                                                        </span>
                                                        {renderMarkInput(sId, s, isRowEditing, true)}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-3">{renderRowButton(sId, isRowEditing, isRowSaving, true)}</div>
                                        </li>
                                    );
                                })}
                            </ul>

                            {/* Desktop: table */}
                            <div className="hidden md:block card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50 text-slate-600 text-sm">
                                            <tr>
                                                <th className="px-4 py-3 text-left sticky left-0 z-10 bg-slate-50">No.</th>
                                                <th className="px-4 py-3 text-left sticky left-12 z-10 bg-slate-50">Student name</th>
                                                <th className="px-4 py-3 text-left">Roll No.</th>
                                                <th className="px-4 py-3 text-left">Admission No.</th>
                                                {visibleSubjects.map(s => {
                                                    const max = subjectMaxMarks[s.id];
                                                    return (
                                                        <th key={s.id} className="px-4 py-3 text-center min-w-[100px]">
                                                            {s.subject_name}
                                                            <span className="block text-xs font-normal text-slate-500">out of {max !== undefined ? max : '–'}</span>
                                                        </th>
                                                    );
                                                })}
                                                <th className="px-4 py-3 text-left"><span className="sr-only">Edit or save</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {students.map((student, idx) => {
                                                const sId = studentId(student);
                                                const isRowEditing = editingRows.has(sId);
                                                const isRowSaving = rowSaving.has(sId);
                                                return (
                                                    <tr key={sId} className={isRowEditing ? 'bg-brand-50/40' : ''}>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 sticky left-0 bg-white">{idx + 1}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-12 bg-white">{student.name}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{student.roll_number}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{student.admission_no}</td>
                                                        {visibleSubjects.map(s => (
                                                            <td key={s.id} className="px-2 py-2 text-center">
                                                                <div className="flex justify-center">{renderMarkInput(sId, s, isRowEditing)}</div>
                                                            </td>
                                                        ))}
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                                                            {renderRowButton(sId, isRowEditing, isRowSaving)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {students.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button type="button" onClick={handleDownload} className="btn-secondary btn-sm">
                                        <FileDown size={16} /> Download Excel
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <ActionBar
                        note={openRows.length === 0
                            ? "Tap Edit on a student to change marks."
                            : `${openRows.length} ${openRows.length === 1 ? 'student is' : 'students are'} open for editing. Save to keep the marks.`}
                    >
                        <Button variant="secondary" onClick={() => setStep(0)} disabled={savingAll}>Back</Button>
                        <Button
                            variant="success"
                            onClick={handleSaveAllOpen}
                            loading={savingAll}
                            disabled={openRows.length === 0}
                        >
                            {openRows.length > 1 ? `Save marks (${openRows.length} students)` : "Save marks"}
                        </Button>
                    </ActionBar>
                </>
            )}
        </div>
    );
};

export default MarksEntryAllSubjects;
