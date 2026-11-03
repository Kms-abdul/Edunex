import React, { useEffect, useState } from "react";
import api from "../api";
import { notify } from './ui/feedback';
import { PageHeader, LoadingState, EmptyState } from './ui';

interface Student {
    student_id: number;
    admission_no: string;
    name: string;
    roll_number: any;
} 

interface Subject {
    subject_id: number;
    subject_name: string;
    subject_type: string;
}

const AssignStudentSubjects: React.FC = () => {
    // Context / Filters
    const [academicYear, setAcademicYear] = useState("");
    const [branch, setBranch] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [subjectType, setSubjectType] = useState("Academic");

    // Options
    const [classList, setClassList] = useState<any[]>([]);
    const [sectionList, setSectionList] = useState<string[]>([]);

    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    // assignmentMap: student_id -> { subject_id : boolean }
    const [assignmentMap, setAssignmentMap] = useState<Record<number, Record<number, boolean>>>({});

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Initialize Context
    useEffect(() => {
        const storedYear = localStorage.getItem("academicYear") || "";
        const userStr = localStorage.getItem("user");
        let storedBranch = "All";

        if (userStr) {
            try {
                const selected = localStorage.getItem("currentBranch");
                if (selected) {
                    if (selected === "All Locations" || selected === "All Branches" || selected === "All") {
                        storedBranch = "All";
                    } else {
                        storedBranch = selected;
                    }
                }
            } catch (e) {
                console.error("Error parsing user", e);
            }
        }

        setAcademicYear(storedYear);
        setBranch(storedBranch);

        // Fetch Classes
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await api.get("/classes");
            if (res.data && res.data.classes) {
                // Sort standard numeric/roman?
                setClassList(res.data.classes);
            }
        } catch (e) {
            console.error("Failed to load classes", e);
        }
    };

    // Fetch sections when class, branch, or academicYear changes
    useEffect(() => {
        setSelectedSection(""); // Reset section
        setSectionList([]);
        if (selectedClass) {
            fetchSections(selectedClass);
        }
    }, [selectedClass, branch, academicYear]);

    const fetchSections = async (cls: string) => {
        try {
            const res = await api.get('/sections', {
                params: {
                    class: cls,
                    branch: branch,
                    academic_year: academicYear
                }
            });
            if (res.data && res.data.sections) {
                setSectionList(res.data.sections);
            }
        } catch (e) {
            console.error("Failed to load sections", e);
        }
    };

    // Fetch Assignment Data
    const fetchData = async () => {
        if (!selectedClass || !academicYear || !branch) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                class_id: selectedClass,
                academic_year: academicYear,
                branch: branch,
                subject_type: subjectType
            });
            if (selectedSection) params.append("section_id", selectedSection);

            const res = await api.get(`/academics/assignment-data?${params.toString()}`);

            const { students, subjects, overrides } = res.data;

            setStudents(students);
            setSubjects(subjects);

            // CHANGED: Default to FALSE (unchecked) instead of TRUE
            // Only if an explicit override exists with status=1, then it's checked
            const initialMap: Record<number, Record<number, boolean>> = {};

            students.forEach((std: Student) => {
                initialMap[std.student_id] = {};
                subjects.forEach((sub: Subject) => {
                    // Check override
                    const studentOverrides = overrides[std.student_id];

                    let isAssigned = false; // CHANGED: Default to unchecked

                    // Check if this student has an override for this subject
                    if (studentOverrides && studentOverrides.hasOwnProperty(sub.subject_id)) {
                        // override.status is boolean/1/0
                        const status = studentOverrides[sub.subject_id];
                        // Handle 1/0/true/false nuances
                        isAssigned = status === true || status === 1;
                    }

                    initialMap[std.student_id][sub.subject_id] = isAssigned;
                });
            });

            setAssignmentMap(initialMap);

        } catch (e) {
            console.error("Failed to fetch assignment data", e);
            notify("Error fetching data");
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when filters are ready
    useEffect(() => {
        if (selectedClass) {
            // Debounce slightly or just fetch? 
            fetchData();
        }
    }, [selectedClass, selectedSection, subjectType, academicYear, branch]);


    const handleToggle = (studentId: number, subjectId: number) => {
        setAssignmentMap(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: !prev[studentId][subjectId]
            }
        }));
    };

    const handleSelectAllRow = (studentId: number, checked: boolean) => {
        setAssignmentMap(prev => {
            const newRow: Record<number, boolean> = {};
            subjects.forEach(s => {
                newRow[s.subject_id] = checked;
            });
            return {
                ...prev,
                [studentId]: newRow
            };
        });
    };

    const handleSelectAllColumn = (subjectId: number, checked: boolean) => {
        setAssignmentMap(prev => {
            const newMap = { ...prev };
            students.forEach(student => {
                if (!newMap[student.student_id]) {
                    newMap[student.student_id] = {};
                }
                newMap[student.student_id][subjectId] = checked;
            });
            return newMap;
        });
    };

    const handleSelectAllCheckboxes = (checked: boolean) => {
        setAssignmentMap(_prev => {
            const newMap: Record<number, Record<number, boolean>> = {};
            students.forEach(student => {
                newMap[student.student_id] = {};
                subjects.forEach(sub => {
                    newMap[student.student_id][sub.subject_id] = checked;
                });
            });
            return newMap;
        });
    };

    const handleSave = async () => {
        if (!students.length) return;

        setSaving(true);
        try {
            // Prepare Payload
            const payloadData = students.map(std => {
                const subMap = assignmentMap[std.student_id];
                return {
                    student_id: std.student_id,
                    subjects: subMap // { sub_id: true/false }
                };
            });

            await api.post("/academics/save-student-subjects", {
                academic_year: academicYear,
                branch: branch,
                class_id: selectedClass,
                data: payloadData
            });

            notify("Saved successfully!");
            // Refresh to sync
            fetchData();

        } catch (e) {
            console.error("Save failed", e);
            notify("Failed to save assignments.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full">
            <PageHeader title="Assign Student-Subjects" />

            {/* Top Bar / Filters */}
            <div className="card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4">
                {/* Academic Year (Read Only) */}
                <div className="flex flex-col">
                    <label className="label">Academic Year</label>
                    <div className="input bg-slate-50 text-slate-700 font-medium">
                        {academicYear}
                    </div>
                </div>

                {/* Branch (Read Only) */}
                <div className="flex flex-col">
                    <label className="label">Branch</label>
                    <div className="input bg-slate-50 text-slate-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {branch}
                    </div>
                </div>

                {/* Class Dropdown */}
                <div className="flex flex-col">
                    <label className="label">Class</label>
                    <select
                        className="input"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">Select Class</option>
                        {classList.map((c: any) => (
                            <option key={c.id} value={c.class_name}>{c.class_name}</option>
                        ))}
                    </select>
                </div>

                {/* Section Dropdown */}
                <div className="flex flex-col">
                    <label className="label">Section</label>
                    <select
                        className="input"
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        disabled={!selectedClass}
                    >
                        <option value="">All Sections</option>
                        {sectionList.map((sec) => (
                            <option key={sec} value={sec}>{sec}</option>
                        ))}
                    </select>
                </div>

                {/* Subject Type */}
                <div className="flex flex-col">
                    <label className="label">Subject Type</label>
                    <div className="flex items-center space-x-4 h-full">
                        <label className="flex items-center cursor-pointer text-sm text-slate-700">
                            <input
                                type="radio"
                                name="subjectType"
                                className="mr-2 accent-brand-600"
                                value="Academic"
                                checked={subjectType === "Academic"}
                                onChange={(e) => setSubjectType(e.target.value)}
                            />
                            Academic
                        </label>
                        <label className="flex items-center cursor-pointer text-sm text-slate-700">
                            <input
                                type="radio"
                                name="subjectType"
                                className="mr-2 accent-brand-600"
                                value="Deeniyath"
                                checked={subjectType === "Deeniyath"}
                                onChange={(e) => setSubjectType(e.target.value)}
                            />
                            Deeniyath
                        </label>
                    </div>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="card"><LoadingState label="Loading data..." /></div>
            ) : (
                students.length === 0 ? (
                    <div className="card">
                        <EmptyState title="No students found or no class selected." />
                    </div>
                ) : (
                    <div className="card overflow-hidden"><div className="overflow-x-auto">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="py-3 px-4 text-left w-16">S.No</th>
                                    <th className="py-3 px-4 text-left w-48 sticky left-0 z-10 bg-slate-50">Student Name</th>
                                    <th className="py-3 px-4 text-left w-24">Roll No</th>
                                    <th className="py-3 px-4 text-left w-32">Adm No</th>
                                    {subjects.map(sub => (
                                        <th key={sub.subject_id} className="py-3 px-4 text-center min-w-[100px]">
                                            <div className="flex flex-col items-center gap-2">
                                                <span>{sub.subject_name}</span>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 accent-brand-600 rounded"
                                                    onChange={(e) => handleSelectAllColumn(sub.subject_id, e.target.checked)}
                                                    title="Assign this subject to all shown students"
                                                />
                                            </div>
                                        </th>
                                    ))}
                                    <th className="py-3 px-4 text-center w-24">
                                        <div className="flex flex-col items-center gap-2">
                                            <span>All</span>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 accent-emerald-600 rounded"
                                                onChange={(e) => handleSelectAllCheckboxes(e.target.checked)}
                                                title="Select/Deselect all checkboxes"
                                            />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {students.map((student, idx) => (
                                    <tr key={student.student_id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                        <td className="py-2 px-4">{idx + 1}</td>
                                        <td className="py-2 px-4 font-medium sticky left-0 z-10 bg-inherit border-r">
                                            {student.name}
                                        </td>
                                        <td className="py-2 px-4">{student.roll_number}</td>
                                        <td className="py-2 px-4">{student.admission_no}</td>

                                        {subjects.map(sub => {
                                            const isChecked = assignmentMap[student.student_id]?.[sub.subject_id] || false;
                                            return (
                                                <td key={sub.subject_id} className="py-2 px-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
                                                        checked={isChecked}
                                                        onChange={() => handleToggle(student.student_id, sub.subject_id)}
                                                    />
                                                </td>
                                            );
                                        })}

                                        <td className="py-2 px-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                                                onChange={(e) => handleSelectAllRow(student.student_id, e.target.checked)}
                                                title="Select/Deselect All"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div></div>
                )
            )}

            {/* Save Button */}
            {students.length > 0 && (
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={() => fetchData()}
                        disabled={saving}
                        className="btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary btn-lg"
                    >
                        {saving ? "Saving..." : "Save Assignments"}
                    </button>
                </div>
            )}

        </div>
    );
};

export default AssignStudentSubjects;