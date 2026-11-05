import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { Upload, FileDown, CheckCircle2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { notify } from './ui/feedback';
import { Alert, ActionBar, Field, Steps } from './ui';

const STEP_TITLES = ['Choose class, exam and subject', 'Get the Excel sheet', 'Upload the filled sheet'];

interface MarksUploadProps { }

const MarksUpload: React.FC<MarksUploadProps> = () => { 
    // --- State ---
    const [academicYear, setAcademicYear] = useState<string>("");
    const [, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedSection] = useState<string>("");

    const [tests, setTests] = useState<any[]>([]);
    const [selectedTestId, setSelectedTestId] = useState<string>("");

    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

    const [students, setStudents] = useState<any[]>([]); // For template generation
    const [subjectTotalMarks, setSubjectTotalMarks] = useState<number>(0);
    const [, setGradingScale] = useState<any[]>([]);
    const [activeClassTestId, setActiveClassTestId] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    // UI only
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [fileName, setFileName] = useState("");

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
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }

        setAcademicYear(storedYear);
        setSelectedBranch(storedBranch);
        setBranches([{ branch_name: storedBranch, branch_code: storedBranch }]);
    }, []);

    // --- Fetch Classes ---
    useEffect(() => {
        if (!selectedBranch) return;
        api.get(`/classes?branch=${selectedBranch}`)
            .then(res => setClasses(res.data.classes || res.data))
            .catch(err => console.error(err));
    }, [selectedBranch]);

    // --- Fetch Tests for Class ---
    useEffect(() => {
        if (!selectedClass || !academicYear) return;
        api.get(`/class-tests/list`, {
            params: {
                academic_year: academicYear,
                branch: selectedBranch,
                class_id: selectedClass
            }
        })
            .then(res => setTests(res.data))
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

    // --- Fetch Context (Students & Max Marks) Only for Validation/Template ---
    // We need this to generate template OR validate uploads (max marks)
    useEffect(() => {
        if (!selectedTestId || !selectedSubjectId || !selectedClass) return;

        setLoading(true);
        api.get(`/marks/entry/subject`, {
            params: {
                academic_year: academicYear,
                branch: selectedBranch,
                class_id: selectedClass,
                section: selectedSection, // optional
                test_id: selectedTestId,
                subject_id: selectedSubjectId
            }
        })
            .then(res => {
                setStudents(res.data.students);
                setSubjectTotalMarks(res.data.subject_total_marks);
                setGradingScale(res.data.grading_scale);
                setActiveClassTestId(res.data.class_test_id);
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: "Could not load the students for this subject. Please try again." });
            })
            .finally(() => setLoading(false));

    }, [selectedTestId, selectedSubjectId, selectedClass, selectedSection]);


    // --- Template Download ---
    const handleDownloadTemplate = () => {
        if (students.length === 0) {
            setMessage({ type: 'error', text: "No students found, so there is no sheet to download." });
            return;
        }

        const className = classes.find(c => c.id == selectedClass)?.class_name || 'Class';
        const subjectName = subjects.find(s => s.id == selectedSubjectId)?.subject_name || 'Subject';
        const testName = tests.find(t => t.test_id == selectedTestId)?.test_name || 'Test';

        const header = ["Student ID", "Roll No", "Admission No", "Student Name", "Marks (Max: " + subjectTotalMarks + ")"];
        const data = students.map((student) => [
            student.student_id,
            student.roll_number,
            student.admission_no,
            student.name,
            ""
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MarksEntry");

        const fileName = `${className}_${subjectName}_${testName}_Template.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    // --- Upload & Save ---
    const handleTriggerUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!activeClassTestId) {
            setMessage({ type: 'error', text: "This exam is not set up for this class yet. Go back and choose again." });
            return;
        }

        setSaving(true);
        setMessage(null);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Process Data
                const pendingUpdates: any[] = [];
                let errors: string[] = [];

                // Skip header (index 0)
                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row || row.length === 0) continue;

                    const sId = parseInt(row[0]);
                    let rawMark = row[4];

                    // Validate generic logic
                    const studentExists = students.find(s => s.student_id === sId);
                    if (!studentExists) continue;

                    let val: string | number | null = "";
                    let isAbsent = false;

                    if (rawMark === undefined || rawMark === null || String(rawMark).trim() === "") {
                        continue; // Skip empty rows? or clear? Let's skip empty to avoid overwriting with null unless intended
                    } else {
                        const sVal = String(rawMark).trim().toUpperCase();
                        if (sVal === "AB" || sVal === "ABSENT") {
                            isAbsent = true;
                            val = "AB";
                        } else {
                            const pVal = parseFloat(sVal);
                            if (isNaN(pVal)) {
                                errors.push(`Row ${i + 1}: '${rawMark}' is not a mark (${studentExists.name})`);
                                continue;
                            }
                            if (pVal < 0 || pVal > subjectTotalMarks) {
                                errors.push(`Row ${i + 1}: ${pVal} must be between 0 and ${subjectTotalMarks} (${studentExists.name})`);
                                continue;
                            }
                            val = pVal;
                        }
                    }

                    pendingUpdates.push({
                        student_id: sId,
                        value: isAbsent ? "AB" : val
                    });
                }

                if (errors.length > 0) {
                    notify.error("Nothing was saved. Fix these rows in the sheet and upload again:\n" + errors.slice(0, 10).join("\n"));
                    setSaving(false);
                    return;
                }

                if (pendingUpdates.length === 0) {
                    setMessage({ type: 'error', text: "No marks found in the sheet. Type marks in the last column and try again." });
                    setSaving(false);
                    return;
                }

                // Send to Backend
                const payload = {
                    class_test_id: activeClassTestId,
                    subject_id: selectedSubjectId,
                    academic_year: academicYear,
                    branch: selectedBranch,
                    class_id: selectedClass,
                    marks: pendingUpdates
                };

                api.post(`/marks/entry/subject`, payload)
                    .then(() => {
                        setMessage({ type: 'success', text: `Marks saved for ${pendingUpdates.length} student${pendingUpdates.length !== 1 ? 's' : ''}.` });
                    })
                    .catch(err => {
                        console.error(err);
                        setMessage({ type: 'error', text: err.response?.data?.error || "Could not save the marks. Please try again." });
                    })
                    .finally(() => setSaving(false));

            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: "Could not read this file. Make sure it is the Excel sheet you downloaded here." });
                setSaving(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    // ---------------------------------------------------------------- UI only
    const className = classes.find(c => c.id == selectedClass)?.class_name;
    const subjectName = subjects.find(s => s.id == selectedSubjectId)?.subject_name;
    const testName = tests.find(t => t.test_id == selectedTestId)?.test_name;
    const chosen = !!(selectedClass && selectedTestId && selectedSubjectId);
    const what = `${subjectName || 'Subject'} · ${testName || 'Exam'} · Class ${className || ''}`;

    const fileInput = (
        <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
            onChange={e => { setFileName(e.target.files?.[0]?.name || ''); handleFileUpload(e); }}
        />
    );

    const summaryCard = (
        <div className="card p-4 mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 break-words">{what}</p>
                <p className="text-sm text-slate-600">
                    {loading ? 'Loading students…' : `${students.length} student${students.length !== 1 ? 's' : ''} · full marks ${subjectTotalMarks}`}
                </p>
            </div>
            <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => { setMessage(null); setStep(0); }}>Change</button>
        </div>
    );

    /* Step 1: choose class, exam and subject */
    if (step === 0) {
        return (
            <div className="">
                <Steps steps={STEP_TITLES} current={0} className="mb-4" />
                <div className="card p-4">
                    <p className="text-sm text-slate-600 mb-4">Fill marks in an Excel sheet on your computer, then upload it here. First choose what the marks are for.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Class" htmlFor="mu-class">
                            <select
                                id="mu-class"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                className="input"
                            >
                                <option value="">Choose a class</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Exam" htmlFor="mu-test">
                            <select
                                id="mu-test"
                                value={selectedTestId}
                                onChange={e => setSelectedTestId(e.target.value)}
                                className="input"
                                disabled={!selectedClass}
                            >
                                <option value="">{selectedClass ? 'Choose an exam' : 'Choose a class first'}</option>
                                {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.test_name}</option>)}
                            </select>
                        </Field>

                        <Field label="Subject" htmlFor="mu-subject">
                            <select
                                id="mu-subject"
                                value={selectedSubjectId}
                                onChange={e => setSelectedSubjectId(e.target.value)}
                                className="input"
                                disabled={!selectedTestId}
                            >
                                <option value="">{selectedTestId ? 'Choose a subject' : 'Choose an exam first'}</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>
                <ActionBar note={!selectedClass ? 'Choose a class first' : !selectedTestId ? 'Choose an exam' : !selectedSubjectId ? 'Choose a subject' : undefined}>
                    <button type="button" className="btn-primary btn-lg" disabled={!chosen} onClick={() => { setMessage(null); setStep(1); }}>
                        Next
                    </button>
                </ActionBar>
            </div>
        );
    }

    /* Step 2: download the sheet */
    if (step === 1) {
        return (
            <div className="">
                <Steps steps={STEP_TITLES} current={1} onJump={i => setStep(i as 0 | 1 | 2)} className="mb-4" />
                {summaryCard}
                {message && (
                    <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4">{message.text}</Alert>
                )}
                <div className="card p-4 space-y-4">
                    <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                        <li>Download the sheet. It already has the student names.</li>
                        <li>Type each student's marks in the last column (out of {subjectTotalMarks || 'full marks'}).</li>
                        <li>For a student who was absent, type <strong>AB</strong>.</li>
                        <li>Leave the box empty to skip a student.</li>
                        <li>Do not add, remove or move columns. Up to 80 students at a time.</li>
                    </ol>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        disabled={loading || !selectedTestId || students.length === 0}
                        className="btn-success btn-lg w-full sm:w-auto"
                    >
                        <FileDown size={18} />
                        {loading ? 'Loading students…' : 'Download the sheet'}
                    </button>
                    {!loading && students.length === 0 && (
                        <p className="text-sm text-slate-500">No students found for this class, so there is no sheet to download.</p>
                    )}
                </div>
                <ActionBar note="Already filled the sheet? Go to the next step.">
                    <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(0)}>Back</button>
                    <button type="button" className="btn-primary btn-lg" onClick={() => { setMessage(null); setStep(2); }}>
                        Next: upload
                    </button>
                </ActionBar>
            </div>
        );
    }

    /* Step 3: upload the filled sheet (picking the file saves the marks, as before) */
    const done = message?.type === 'success';
    return (
        <div className="">
            <Steps steps={STEP_TITLES} current={2} onJump={i => setStep(i as 0 | 1 | 2)} className="mb-4" />
            {summaryCard}
            {fileInput}

            {done ? (
                <div className="card">
                    <div className="card-body flex flex-col items-center text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <p className="text-xl font-semibold text-slate-900">Marks saved</p>
                        <p className="mt-1 text-slate-600">{message?.text}</p>
                        <p className="text-sm text-slate-500 mt-1 break-words">{what}</p>
                    </div>
                </div>
            ) : (
                <div className="card p-4 space-y-3">
                    <p className="text-sm text-slate-700">Choose the Excel sheet you filled. The marks are saved as soon as you pick it.</p>
                    <button
                        type="button"
                        onClick={handleTriggerUpload}
                        disabled={saving || !selectedTestId || !selectedSubjectId}
                        className="btn-primary btn-lg w-full sm:w-auto"
                    >
                        <Upload size={18} />
                        {saving ? "Uploading…" : "Choose sheet and upload"}
                    </button>
                    {fileName && <p className="text-sm text-slate-500 break-all">File: {fileName}</p>}
                    {message && (
                        <Alert tone={message.type === 'error' ? 'error' : 'success'}>{message.text}</Alert>
                    )}
                </div>
            )}

            <ActionBar>
                {done ? (
                    <>
                        <button type="button" className="btn-secondary btn-lg" onClick={() => { setMessage(null); setFileName(''); }}>
                            Upload again
                        </button>
                        <button type="button" className="btn-primary btn-lg" onClick={() => { setMessage(null); setFileName(''); setSelectedSubjectId(''); setStep(0); }}>
                            Upload another subject
                        </button>
                    </>
                ) : (
                    <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(1)}>Back</button>
                )}
            </ActionBar>
        </div>
    );
};

export default MarksUpload;
