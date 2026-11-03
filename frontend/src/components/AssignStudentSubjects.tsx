import React, { useEffect, useState } from "react";
import api from "../api";
import { notify } from './ui/feedback';
import { LoadingState, EmptyState, ActionBar, Field } from './ui';
import { SetupIntro, GridCard, GridCheck, Choice } from './exam-setup/shared';

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
    // What was last loaded from the server (only used to count unsaved changes)
    const [savedMap, setSavedMap] = useState<Record<number, Record<number, boolean>>>({});

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
            setSavedMap(JSON.parse(JSON.stringify(initialMap)));

        } catch (e) {
            console.error("Failed to fetch assignment data", e);
            notify.error("Could not load the students. Please try again.");
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

            notify.success("Subjects for students saved");
            // Refresh to sync
            fetchData();

        } catch (e) {
            console.error("Save failed", e);
            notify.error("Could not save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // Count boxes that differ from what was loaded (for the Save button)
    let changeCount = 0;
    students.forEach(std => {
        subjects.forEach(sub => {
            const now = !!assignmentMap[std.student_id]?.[sub.subject_id];
            const before = !!savedMap[std.student_id]?.[sub.subject_id];
            if (now !== before) changeCount++;
        });
    });

    const isChecked = (studentId: number, subjectId: number) => assignmentMap[studentId]?.[subjectId] || false;
    const allInColumn = (subjectId: number) => students.length > 0 && students.every(st => isChecked(st.student_id, subjectId));
    const allInRow = (studentId: number) => subjects.length > 0 && subjects.every(sub => isChecked(studentId, sub.subject_id));
    const allTicked = students.length > 0 && students.every(st => allInRow(st.student_id));

    return (
        <div className="min-h-full">
            <SetupIntro
                title="Subjects for students"
                context={[academicYear ? `Year ${academicYear}` : null, branch === 'All' ? 'All branches' : branch]}
            >
                Choose a class, then tick the subjects each student studies.
            </SetupIntro>

            {/* Choose class */}
            <div className="card p-4 mb-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Class" htmlFor="ass-class">
                        <select
                            id="ass-class"
                            className="input"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">Choose a class</option>
                            {classList.map((c: any) => (
                                <option key={c.id} value={c.class_name}>{c.class_name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Section (optional)" htmlFor="ass-section">
                        <select
                            id="ass-section"
                            className="input"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClass}
                        >
                            <option value="">All sections</option>
                            {sectionList.map((sec) => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                <Field label="Subject group">
                    <Choice
                        label="Subject group"
                        value={subjectType}
                        onChange={setSubjectType}
                        options={[{ value: 'Academic', label: 'Academic' }, { value: 'Deeniyath', label: 'Deeniyath' }]}
                    />
                </Field>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="card"><LoadingState label="Loading students…" /></div>
            ) : !selectedClass ? (
                <div className="card"><EmptyState title="Choose a class" description="The students of that class will show here." /></div>
            ) : students.length === 0 ? (
                <div className="card"><EmptyState title="No students found" description="There are no students in this class and section." /></div>
            ) : (
                <GridCard>
                    <table className="border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left min-w-[160px]">
                                    Student
                                </th>
                                {subjects.map(sub => (
                                    <th key={sub.subject_id} className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center min-w-[88px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-semibold text-slate-800 leading-tight">{sub.subject_name}</span>
                                            <GridCheck
                                                checked={allInColumn(sub.subject_id)}
                                                onChange={checked => handleSelectAllColumn(sub.subject_id, checked)}
                                                label={`${sub.subject_name} for all students shown`}
                                            />
                                        </div>
                                    </th>
                                ))}
                                <th className="sticky top-0 z-10 bg-slate-50 border-b border-l border-slate-200 px-2 py-2 text-center min-w-[80px]">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="font-semibold text-slate-800">All</span>
                                        <GridCheck
                                            tone="emerald"
                                            checked={allTicked}
                                            onChange={checked => handleSelectAllCheckboxes(checked)}
                                            label="Every subject for every student"
                                        />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-700">
                            {students.map((student, idx) => (
                                <tr key={student.student_id} className="hover:bg-slate-50/60">
                                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-1.5">
                                        <div className="font-medium text-slate-900 leading-snug">{idx + 1}. {student.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Roll {student.roll_number ?? '—'} · Adm. {student.admission_no}
                                        </div>
                                    </td>

                                    {subjects.map(sub => (
                                        <td key={sub.subject_id} className="border-b border-slate-100 p-0.5 text-center">
                                            <GridCheck
                                                checked={isChecked(student.student_id, sub.subject_id)}
                                                onChange={() => handleToggle(student.student_id, sub.subject_id)}
                                                label={`${sub.subject_name} for ${student.name}`}
                                            />
                                        </td>
                                    ))}

                                    <td className="border-b border-l border-slate-100 p-0.5 text-center">
                                        <GridCheck
                                            tone="emerald"
                                            checked={allInRow(student.student_id)}
                                            onChange={checked => handleSelectAllRow(student.student_id, checked)}
                                            label={`Every subject for ${student.name}`}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </GridCard>
            )}

            {students.length > 0 && (
                <ActionBar note={changeCount > 0 ? `${changeCount} change${changeCount !== 1 ? 's' : ''} not saved yet` : 'No changes yet. Tick or untick boxes above.'}>
                    <button
                        type="button"
                        onClick={() => fetchData()}
                        disabled={saving || changeCount === 0}
                        className="btn-secondary btn-lg"
                    >
                        Undo changes
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || changeCount === 0}
                        className="btn-primary btn-lg"
                    >
                        {saving ? "Saving…" : `Save changes (${changeCount})`}
                    </button>
                </ActionBar>
            )}
        </div>
    );
};

export default AssignStudentSubjects;