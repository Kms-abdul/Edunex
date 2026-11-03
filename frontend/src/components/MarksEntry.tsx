import React, { useState, useEffect } from "react";
import api from "../api";
import { Save, FileDown } from "lucide-react";
import * as XLSX from 'xlsx';
import { notify } from './ui/feedback';
import { PageHeader, Alert, Badge } from './ui';


 
interface StudentMarkEntry {
    student_id: number;
    admission_no: string;
    roll_number: string | number;
    name: string;
    marks_obtained: string | number; // Input value
    is_absent: boolean;
    grade?: string; // Display only
}

interface MarksEntryProps { }

const MarksEntry: React.FC<MarksEntryProps> = () => {
    // --- State ---
    const [academicYear, setAcademicYear] = useState<string>("");
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [sections, setSections] = useState<string[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>("");

    const [tests, setTests] = useState<any[]>([]);
    const [selectedTestId, setSelectedTestId] = useState<string>("");

    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

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
            setMessage({ type: 'error', text: "Please select Test and Subject" });
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
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: err.response?.data?.error || "Failed to load marks" });
            })
            .finally(() => setLoading(false));
    };


    // --- Handle Input Change ---
    const handleInputChange = (studentId: number, value: string) => {
        setStudents(prev => prev.map(s => {
            if (s.student_id !== studentId) return s;
            return { ...s, marks_obtained: value };
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
                            notify(`Marks cannot exceed ${subjectTotalMarks}`);
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
            setMessage({ type: 'error', text: "Internal Error: Missing Class Test ID. Please reload data." });
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
            user_id: 1, // TODO: Get from auth context
            marks: students.map(s => ({
                student_id: s.student_id,
                value: s.is_absent ? "AB" : s.marks_obtained
            }))
        };

        api.post(`/marks/entry/subject`, payload)
            .then(() => {
                setMessage({ type: 'success', text: "Marks saved successfully!" });
                // Optional: reload data to verify?
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: err.response?.data?.error || "Failed to save marks" });
            })
            .finally(() => setSaving(false));
    };

    const handleCancel = () => {
        // Reload the data to reset any changes made by the user
        handleGetMarks();
    };

    const handleDownloadExcel = () => {
        if (students.length === 0) {
            setMessage({ type: 'error', text: "No data to download." });
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

    // Note: I missed `activeClassTestId` state in the component. 
    // I will fix this in the next edit or complete it now.
    // I will write the full component now including that state.

    return (
        <div>
            <PageHeader title="Enter Subject Marks" />

            {/* Filters */}
            <div className="card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4">
                {/* Branch */}
                <div>
                    <label className="label">Branch</label>
                    <select
                        value={selectedBranch}
                        onChange={e => setSelectedBranch(e.target.value)}
                        className="input mt-1"
                        disabled={branches.length <= 1}
                    >
                        {branches.map(b => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
                    </select>
                </div>

                {/* Class */}
                <div>
                    <label className="label">Class</label>
                    <select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                        className="input mt-1"
                    >
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                    </select>
                </div>

                {/* Section */}
                <div>
                    <label className="label">Section</label>
                    <select
                        value={selectedSection}
                        onChange={e => setSelectedSection(e.target.value)}
                        className="input mt-1"
                    >
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Test */}
                <div>
                    <label className="label">Test</label>
                    <select
                        value={selectedTestId}
                        onChange={e => setSelectedTestId(e.target.value)}
                        className="input mt-1"
                    >
                        <option value="">Select Test</option>
                        {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.test_name}</option>)}
                        {/* Note: t.test_id here is the generic ID, not class_test.id */}
                    </select>
                </div>

                {/* Subject */}
                <div>
                    <label className="label">Subject</label>
                    <select
                        value={selectedSubjectId}
                        onChange={e => setSelectedSubjectId(e.target.value)}
                        className="input mt-1"
                    >
                        <option value="">Select Subject</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                    </select>
                </div>
            </div>

            <div className="mb-4">
                <button
                    type="button"
                    onClick={handleGetMarks}
                    disabled={loading || !selectedTestId || !selectedSubjectId}
                    className="btn-primary"
                >
                    {loading ? "Loading..." : "Get Marks"}
                </button>
            </div>

            {/* Message */}
            {message && (
                <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4">
                    {message.text}
                </Alert>
            )}

            {/* Grid */}
            {students.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
                        <span className="text-base font-semibold text-slate-900">
                            Max Marks: {subjectTotalMarks}
                        </span>
                        <div className="text-sm text-slate-500">
                            Valid inputs: 0-{subjectTotalMarks}, "AB" (Absent)
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-6 py-3 text-left">S.No</th>
                                <th className="px-6 py-3 text-left">Roll No</th>
                                <th className="px-6 py-3 text-left">Admission No</th>
                                <th className="px-6 py-3 text-left">Student Name</th>
                                <th className="px-6 py-3 text-left">Marks</th>
                                <th className="px-6 py-3 text-left">Grade</th>
                                <th className="px-6 py-3 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {students.map((student, index) => (
                                <tr key={student.student_id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{index + 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{student.roll_number}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{student.admission_no}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{student.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="text"
                                            value={student.is_absent ? 'AB' : (student.marks_obtained !== null && student.marks_obtained !== undefined ? String(student.marks_obtained).split('.')[0] : '')}
                                            onChange={(e) => handleInputChange(student.student_id, e.target.value)}
                                            onBlur={() => handleInputBlur(student.student_id)}
                                            className={`input w-24 ${student.is_absent ? 'bg-red-50 border-red-300 text-red-700 font-bold' : ''}`}
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-bold">
                                        {student.grade || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {student.is_absent ? (
                                            <Badge tone="danger">Absent</Badge>
                                        ) : (student.marks_obtained !== '' && student.marks_obtained !== null && student.marks_obtained !== undefined) ? (
                                            <Badge tone="success">Present</Badge>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={saving}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>


                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={saving || students.length === 0}
                            className="btn-soft"
                        >
                            <FileDown size={18} />
                            Download Excel
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-success"
                        >
                            <Save size={18} />
                            {saving ? "Saving..." : "Save Marks"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarksEntry;
