import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { FileDown, RotateCcw, CheckCircle2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { notify, confirmDialog } from './ui/feedback';
import { PageHeader, Alert, Steps, ActionBar, Field, Button, LoadingState, EmptyState } from './ui';
import { markProblem, hasMark } from './marks/markCheck';

const LAST_CHOICE_KEY = 'edunex.marksEntry.lastChoice';
const STEPS = ['Choose exam', 'Enter marks', 'Saved'];

/** Last class / section / exam / subject used, so the teacher does not pick them again. */
const readLastChoice = (): { classId?: string; section?: string; testId?: string; subjectId?: string } => {
    try {
        const raw = localStorage.getItem(LAST_CHOICE_KEY);
        return raw ? JSON.parse(raw) || {} : {};
    } catch {
        return {};
    }
};


 
interface StudentMarkEntry {
    student_id: number;
    admission_no: string;
    roll_number: string | number;
    name: string;
    marks_obtained: string | number; // Input value
    is_absent: boolean;
    grade?: string; // Display only
}

interface MarksEntryProps {
    /** Called by "Back to all exam tasks" on the finished screen. */
    onDone?: () => void;
}

const MarksEntry: React.FC<MarksEntryProps> = ({ onDone }) => {
    const [lastChoice] = useState(readLastChoice);
    // 0 = choose exam, 1 = enter marks, 2 = saved
    const [step, setStep] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const saveButtonRef = useRef<HTMLButtonElement | null>(null);

    // --- State ---
    const [academicYear, setAcademicYear] = useState<string>("");
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>(lastChoice.classId || "");
    const [sections, setSections] = useState<string[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>(lastChoice.section || "");

    const [tests, setTests] = useState<any[]>([]);
    const [selectedTestId, setSelectedTestId] = useState<string>(lastChoice.testId || "");

    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>(lastChoice.subjectId || "");

    const [students, setStudents] = useState<StudentMarkEntry[]>([]);
    const [subjectTotalMarks, setSubjectTotalMarks] = useState<number>(0);
    const [gradingScale, setGradingScale] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // --- Init ---
    useEffect(() => {
        const storedYear = localStorage.getItem("academicYear") || "";
        const userStr = localStorage.getItem("user");
        let storedBranch = "All";

        if (userStr) {
            try {
                JSON.parse(userStr);
                const selected = localStorage.getItem("currentBranch");
                if (selected && selected !== "All Locations") {
                    storedBranch = selected;
                }
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }

        setAcademicYear(storedYear);
        setSelectedBranch(storedBranch);

        // Mock/Fetch Branches list if needed for the dropdown to be useful
        // For now, we ensure selectedBranch is set correctly for filtering
        setBranches([{ branch_name: storedBranch, branch_code: storedBranch }]);

    }, []);

    // --- Fetch Classes ---
    useEffect(() => {
        if (!selectedBranch) return;
        // In a real scenario, fetch classes for branch. 
        api.get(`/classes?branch=${selectedBranch}`)
            .then(res => setClasses(res.data.classes || res.data)) // Handle potential { classes: [] } or []
            .catch(err => console.error(err));
    }, [selectedBranch]);

    // --- Fetch Sections ---
    useEffect(() => {
        // Find class name from selected ID
        const clsObj = classes.find(c => c.id == selectedClass);
        if (!clsObj) {
            setSections([]);
            return;
        }

        api.get(`/sections?class=${clsObj.class_name}`)
            .then(res => setSections(res.data.sections || []))
            .catch(err => {
                console.error(err);
                setSections([]);
            });
    }, [selectedClass, classes]);


    // --- Fetch Tests for Class ---
    useEffect(() => {
        if (!selectedClass || !academicYear) return;

        api.get(`/class-tests/list`, {
            params: {
                academic_year: academicYear,
                branch: selectedBranch,
                class_id: selectedClass // Keep sending ID as backend likely expects ID now or handles it
            }
        })
            .then(res => {
                setTests(res.data);
            })
            .catch(err => console.error(err));
    }, [selectedClass, academicYear, selectedBranch]);

    // --- Fetch Subjects for Test ---
    useEffect(() => {
        if (!selectedTestId) {
            setSubjects([]);
            return;
        }

        const selectedTest = tests.find(t => t.test_id == selectedTestId);
        if (selectedTest && selectedTest.subjects) {
            setSubjects(selectedTest.subjects);
        } else {
            setSubjects([]);
        }

    }, [selectedTestId, tests]);


    const [activeClassTestId, setActiveClassTestId] = useState<number | null>(null);

    // --- Fetch Marks Grid ---
    const handleGetMarks = () => {
        if (!selectedTestId || !selectedSubjectId) {
            setMessage({ type: 'error', text: "Choose the exam and the subject first." });
            return;
        }

        setLoading(true);
        setMessage(null);
        setActiveClassTestId(null);
        setStudents([]);

        api.get(`/marks/entry/subject`, {
            params: {
                academic_year: academicYear,
                branch: selectedBranch,
                class_id: selectedClass,
                section: selectedSection,
                test_id: selectedTestId,
                subject_id: selectedSubjectId
            }
        })
            .then(res => {
                setStudents(res.data.students);
                setSubjectTotalMarks(res.data.subject_total_marks);
                setGradingScale(res.data.grading_scale);
                setActiveClassTestId(res.data.class_test_id); // Store for save
                setStep(1);
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: err.response?.data?.error || "Could not load the students. Please try again." });
            })
            .finally(() => setLoading(false));
    };


    // --- Handle Input Change ---
    const handleInputChange = (studentId: number, value: string) => {
        setStudents(prev => prev.map(s => {
            if (s.student_id !== studentId) return s;
            // Typing replaces "Absent"; the blur logic below decides the final value as before.
            return { ...s, marks_obtained: value, is_absent: false };
        }));
    };

    const handleInputBlur = (studentId: number) => {
        setStudents(prev => prev.map(s => {
            if (s.student_id !== studentId) return s;

            let val = s.marks_obtained;
            let isAbsent = false;


            if (typeof val === 'string') {
                const trimmed = val.trim().toUpperCase();

                if (trimmed === 'AB') {
                    isAbsent = true;
                    val = 'AB'; // Normalize to AB
                } else if (trimmed === '') {
                    val = '';
                } else {
                    // Strict Int / Rounding Logic
                    // We allow user to type loose numbers, but we lock them to Int on blur
                    const parsed = parseFloat(trimmed);

                    if (!isNaN(parsed) && isFinite(parsed)) {
                        let num = Math.round(parsed); // Round to nearest int

                        if (num < 0) {
                            num = 0;
                        }

                        if (num > subjectTotalMarks) {
                            notify.error(`Marks can't be more than ${subjectTotalMarks}. Please type again.`);
                            val = ''; // Clear only if out of bounds
                        } else {
                            val = String(num); // Set normalized integer string
                        }
                    } else {
                        // Truly invalid debris
                        val = '';
                    }
                }
            }

            // Calc Grade Locally
            let grade = '';
            if (isAbsent) {
                // Grade for absent? Usually empty or F. Let's leave empty.
            } else if (val !== '' && val !== null && val !== undefined) {
                const numVal = parseInt(String(val), 10); // Ensure int
                const g = gradingScale.find(g => numVal >= g.min && numVal <= g.max);
                if (g) grade = g.grade;
            }

            return { ...s, marks_obtained: val, is_absent: isAbsent, grade };
        }));
    };

    // --- Save Marks ---
    const handleSave = () => {
        if (students.length === 0) return;
        if (!activeClassTestId) {
            setMessage({ type: 'error', text: "Something went wrong. Go back and tap Show students again." });
            return;
        }

        setSaving(true);
        setMessage(null);
        const payload = {
            class_test_id: activeClassTestId, // Use the real ID
            subject_id: selectedSubjectId,
            academic_year: academicYear,
            branch: selectedBranch,
            class_id: selectedClass,
            section: selectedSection, // optional context
            marks: students.map(s => ({
                student_id: s.student_id,
                value: s.is_absent ? "AB" : s.marks_obtained
            }))
        };

        api.post(`/marks/entry/subject`, payload)
            .then(() => {
                notify.success("Marks saved");
                setStep(2);
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: err.response?.data?.error || "Could not save the marks. Please try again." });
            })
            .finally(() => setSaving(false));
    };

    const handleCancel = () => {
        // Reload the data to reset any changes made by the user
        handleGetMarks();
    };

    const handleDownloadExcel = () => {
        if (students.length === 0) {
            setMessage({ type: 'error', text: "There is nothing to download yet." });
            return;
        }

        // Get the selected class name
        const className = classes.find(c => c.id == selectedClass)?.class_name || 'Class';
        // Get the selected subject name
        const subjectName = subjects.find(s => s.id == selectedSubjectId)?.subject_name || 'Subject';
        // Get the selected test name
        const testName = tests.find(t => t.test_id == selectedTestId)?.test_name || 'Test';

        const header = ["S.No", "Roll No", "Admission No", "Student Name", "Marks", "Grade", "Status"];
        const data = students.map((student, index) => [
            index + 1,
            student.roll_number,
            student.admission_no,
            student.name,
            student.is_absent ? 'AB' : student.marks_obtained,
            student.grade || '-',
            student.is_absent ? 'Absent' : (student.marks_obtained !== '' && student.marks_obtained !== null && student.marks_obtained !== undefined) ? 'Present' : '-'
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Marks");

        // Define a filename
        const fileName = `${className}_${subjectName}_${testName}_Marks.xlsx`;

        // Trigger the download
        XLSX.writeFile(workbook, fileName);
    };

    // ------------------------------------------------------------------
    // UI helpers (no data rules here — they only move the screen along)
    // ------------------------------------------------------------------

    // Remember the last choice on this device
    useEffect(() => {
        try {
            localStorage.setItem(LAST_CHOICE_KEY, JSON.stringify({
                classId: selectedClass,
                section: selectedSection,
                testId: selectedTestId,
                subjectId: selectedSubjectId,
            }));
        } catch { /* storage may be blocked; nothing to do */ }
    }, [selectedClass, selectedSection, selectedTestId, selectedSubjectId]);

    const changeClass = (value: string) => {
        setSelectedClass(value);
        setSelectedSection("");
        setSelectedTestId("");
        setSelectedSubjectId("");
        setMessage(null);
    };
    const changeTest = (value: string) => {
        setSelectedTestId(value);
        setSelectedSubjectId("");
        setMessage(null);
    };

    const classObj = classes.find(c => String(c.id) === String(selectedClass));
    const testObj = tests.find(t => String(t.test_id) === String(selectedTestId));
    const subjectIndex = subjects.findIndex(s => String(s.id) === String(selectedSubjectId));
    const subjectObj = subjectIndex >= 0 ? subjects[subjectIndex] : undefined;
    const nextSubject = subjectIndex >= 0 ? subjects[subjectIndex + 1] : undefined;

    const chooseNote = !academicYear
        ? "No school year is chosen. Choose one at the top of the screen."
        : !classObj ? "Choose a class first."
        : !testObj ? "Choose the exam."
        : !subjectObj ? "Choose the subject."
        : null;

    const enteredCount = students.filter(s => hasMark(s.marks_obtained, s.is_absent)).length;
    const missingCount = students.length - enteredCount;
    const examLabel = [
        classObj?.class_name,
        selectedSection ? `Section ${selectedSection}` : null,
        testObj?.test_name,
        subjectObj?.subject_name,
    ].filter(Boolean).join(' · ');

    const toggleAbsent = (studentId: number) => {
        setStudents(prev => prev.map(s => {
            if (s.student_id !== studentId) return s;
            // Same result as typing "AB" (or clearing it) in the marks box
            return s.is_absent
                ? { ...s, marks_obtained: '', is_absent: false, grade: '' }
                : { ...s, marks_obtained: 'AB', is_absent: true, grade: '' };
        }));
    };

    // Enter moves to the next student's box (fast keyboard entry on a computer)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = inputRefs.current[index + 1];
        if (next) {
            next.focus();
            next.select();
        } else {
            e.currentTarget.blur();
            saveButtonRef.current?.focus();
        }
    };

    const handleUndo = async () => {
        const ok = await confirmDialog("Throw away the marks you changed and load the saved marks again?", {
            title: "Undo my changes",
            confirmText: "Yes, undo",
            cancelText: "No, keep them",
            tone: 'warning',
        });
        if (ok) handleCancel();
    };

    const goToStep = (n: number) => {
        setMessage(null);
        setStep(n);
    };

    const goToNextSubject = () => {
        setSelectedSubjectId(nextSubject ? String(nextSubject.id) : "");
        setStudents([]);
        goToStep(0);
    };

    const messageAlert = message && (
        <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4" onClose={() => setMessage(null)}>
            {message.text}
        </Alert>
    );

    return (
        <div className="max-w-3xl">
            <PageHeader title="Enter marks for one subject" className="mb-4" />
            <Steps steps={STEPS} current={step} onJump={step < 2 ? goToStep : undefined} className="mb-5" />

            {/* ---------------- Step 1: Choose exam ---------------- */}
            {step === 0 && (
                <>
                    {messageAlert}
                    <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Branch" htmlFor="me-branch">
                            <select
                                id="me-branch"
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                className="input"
                                disabled={branches.length <= 1}
                            >
                                {branches.map(b => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Class" htmlFor="me-class">
                            <select id="me-class" value={selectedClass} onChange={e => changeClass(e.target.value)} className="input">
                                <option value="">Choose class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Section" htmlFor="me-section">
                            <select
                                id="me-section"
                                value={selectedSection}
                                onChange={e => setSelectedSection(e.target.value)}
                                className="input"
                                disabled={!classObj}
                            >
                                <option value="">Choose section</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>

                        <Field label="Exam" htmlFor="me-test">
                            <select
                                id="me-test"
                                value={selectedTestId}
                                onChange={e => changeTest(e.target.value)}
                                className="input"
                                disabled={!classObj}
                            >
                                <option value="">Choose exam</option>
                                {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.test_name}</option>)}
                                {/* Note: t.test_id here is the generic ID, not class_test.id */}
                            </select>
                        </Field>

                        <Field
                            label="Subject"
                            htmlFor="me-subject"
                            className="sm:col-span-2"
                            hint={testObj && subjects.length === 0 ? "This exam has no subjects yet." : undefined}
                        >
                            <select
                                id="me-subject"
                                value={selectedSubjectId}
                                onChange={e => { setSelectedSubjectId(e.target.value); setMessage(null); }}
                                className="input"
                                disabled={!testObj}
                            >
                                <option value="">Choose subject</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                            </select>
                        </Field>
                    </div>

                    <ActionBar note={chooseNote}>
                        <Button
                            onClick={handleGetMarks}
                            loading={loading}
                            disabled={!!chooseNote || !selectedTestId || !selectedSubjectId}
                        >
                            {loading ? "Loading students…" : "Show students"}
                        </Button>
                    </ActionBar>
                </>
            )}

            {/* ---------------- Step 2: Enter marks ---------------- */}
            {step === 1 && (
                <>
                    {messageAlert}

                    <div className="card p-4 mb-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 break-words">{examLabel}</p>
                                <p className="text-sm text-slate-600 mt-0.5">Marks are out of {subjectTotalMarks}</p>
                            </div>
                            <button type="button" className="btn-ghost btn-sm flex-shrink-0" onClick={() => goToStep(0)}>
                                Change
                            </button>
                        </div>
                        {students.length > 0 && (
                            <div className="mt-3">
                                <p className="text-sm font-medium text-slate-800" aria-live="polite">
                                    {enteredCount} of {students.length} entered
                                </p>
                                <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full bg-brand-600 transition-all"
                                        style={{ width: `${students.length ? (enteredCount / students.length) * 100 : 0}%` }}
                                    />
                                </div>
                                <p className="hidden md:block text-xs text-slate-500 mt-2">
                                    Tip: press Enter to go to the next student. You can also type AB for absent.
                                </p>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="card"><LoadingState label="Loading students…" /></div>
                    ) : students.length === 0 ? (
                        <div className="card">
                            <EmptyState
                                title="No students found"
                                description="No students are linked to this class, exam and subject."
                            />
                        </div>
                    ) : (
                        <ul className="card divide-y divide-slate-100 overflow-hidden">
                            {students.map((student, index) => {
                                const shown = student.is_absent
                                    ? 'AB'
                                    : (student.marks_obtained !== null && student.marks_obtained !== undefined ? String(student.marks_obtained).split('.')[0] : '');
                                const problem = student.is_absent ? null : markProblem(student.marks_obtained, subjectTotalMarks);
                                const inputId = `me-mark-${student.student_id}`;
                                return (
                                    <li key={student.student_id} className={`px-4 py-3 ${problem ? 'bg-red-50/60' : ''}`}>
                                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
                                            <div className="w-11 flex-shrink-0 text-center">
                                                <div className="text-[11px] text-slate-500 leading-none">Roll</div>
                                                <div className="font-semibold text-slate-900">{student.roll_number || '–'}</div>
                                            </div>
                                            <label htmlFor={inputId} className="min-w-0 flex-1">
                                                <span className="block font-medium text-slate-900 truncate">{student.name}</span>
                                                <span className="block text-xs text-slate-500">
                                                    Admission number {student.admission_no}
                                                    {student.grade ? ` · Grade ${student.grade}` : ''}
                                                </span>
                                            </label>
                                            <div className="w-full sm:w-auto flex items-center gap-2">
                                                <input
                                                    id={inputId}
                                                    ref={el => { inputRefs.current[index] = el; }}
                                                    type="text"
                                                    inputMode="decimal"
                                                    enterKeyHint={index < students.length - 1 ? 'next' : 'done'}
                                                    autoComplete="off"
                                                    value={shown}
                                                    onChange={(e) => handleInputChange(student.student_id, e.target.value)}
                                                    onBlur={() => handleInputBlur(student.student_id)}
                                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                                    aria-invalid={!!problem}
                                                    aria-describedby={problem ? `${inputId}-err` : undefined}
                                                    className={`input min-h-[44px] flex-1 sm:flex-none sm:w-24 text-center text-base font-semibold
                                                        ${student.is_absent ? 'bg-red-50 border-red-300 text-red-700' : ''}
                                                        ${problem ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder="–"
                                                />
                                                <span className="text-sm text-slate-500 whitespace-nowrap">out of {subjectTotalMarks}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAbsent(student.student_id)}
                                                    aria-pressed={student.is_absent}
                                                    className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors
                                                        ${student.is_absent
                                                            ? 'bg-red-600 border-red-600 text-white'
                                                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                                >
                                                    Absent
                                                </button>
                                            </div>
                                        </div>
                                        {problem && (
                                            <p id={`${inputId}-err`} role="alert" className="mt-1.5 text-sm text-red-700 sm:pl-14">
                                                {problem}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {students.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={handleDownloadExcel} disabled={saving} className="btn-secondary btn-sm">
                                <FileDown size={16} /> Download Excel
                            </button>
                            <button type="button" onClick={handleUndo} disabled={saving || loading} className="btn-ghost btn-sm">
                                <RotateCcw size={16} /> Undo my changes
                            </button>
                        </div>
                    )}

                    <ActionBar
                        note={students.length === 0
                            ? "There are no students to save."
                            : missingCount > 0
                                ? `${missingCount} ${missingCount === 1 ? 'student has' : 'students have'} no marks yet. You can still save.`
                                : "All students have marks."}
                    >
                        <Button variant="secondary" onClick={() => goToStep(0)} disabled={saving}>Back</Button>
                        <Button
                            ref={saveButtonRef}
                            variant="success"
                            onClick={handleSave}
                            loading={saving}
                            disabled={students.length === 0 || loading}
                        >
                            {saving ? "Saving…" : "Save marks"}
                        </Button>
                    </ActionBar>
                </>
            )}

            {/* ---------------- Step 3: Saved ---------------- */}
            {step === 2 && (
                <div className="card p-6 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">Marks saved</h2>
                    <p className="text-sm text-slate-600 mt-1 break-words">{examLabel}</p>
                    <p className="text-sm text-slate-600">{enteredCount} of {students.length} students have marks.</p>

                    <div className="mt-6 flex flex-col sm:flex-row sm:justify-center gap-2">
                        <Button onClick={goToNextSubject}>
                            {nextSubject ? `Next subject: ${nextSubject.subject_name}` : "Choose another subject"}
                        </Button>
                        <Button variant="secondary" onClick={() => goToStep(1)}>Change these marks</Button>
                        {onDone && <Button variant="ghost" onClick={onDone}>Back to all exam tasks</Button>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarksEntry;
