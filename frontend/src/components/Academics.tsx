import React, { useState } from "react";
import { GraduationCap, ChevronDown, ArrowLeft, MousePointerClick } from "lucide-react";
import PageHeader from "./ui/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import SubjectMaster from "./SubjectMaster";
import ClassSubjectAssignment from "./ClassSubjectAssignment";
import ClassTestAssignment from "./ClassTestAssignment";
import AssignStudentSubjects from "./AssignStudentSubjects";
import TestTypeManager from "./TestTypeManager";
import AssignSubjectTests from "./AssignSubjectTests";
import AssignStudentTests from "./AssignStudentTests";
import GradeScaleManager from "./GradeScaleManager";
import MarksEntry from "./MarksEntry";
import MarksUpload from "./MarksUpload";
import StudentReportCard from "./StudentReportCard";
import SetExamAttendance from "./SetExamAttendance";
import MarksEntryAllSubjects from "./MarksEntryAllSubjects";


// --- Types ---
type AcademicView =
    | "HOME"
    | "SUBJECTS"
    | "ASSIGN_STUDENT_SUBJECTS"
    | "ASSIGN_SUBJECTS"
    | "SUBJECTWISE_MARKS"
    | "CREATE_TEST"
    | "ASSIGN_SUBJECT_TESTS"
    | "ASSIGN_STUDENT_TESTS"
    | "GRADING"
    | "ADD_EXAM"
    | "MARKS_ENTRY_SUBJECT"
    | "MARKS_ENTRY_UPLOAD"
    | "MARKS_ENTRY_ALL_SUBJECTS"
    | "ACADEMIC_SETTING"
    | "STUDENT_REPORT_CARD"
    | "SET_EXAM_ATTENDANCE";

interface DropdownItem {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
}

interface DropdownProps {
    title: string;
    items: DropdownItem[];
}

// --- Reusable Dropdown ---
const NavDropdown: React.FC<DropdownProps> = ({ title, items }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button className={`btn-secondary ${isOpen ? "border-brand-300 bg-brand-50/60 text-slate-900" : ""}`}>
                {title} <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 w-64 pt-1.5">
                <div className="card shadow-pop py-1.5 animate-scale-in origin-top">
                    {items.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={item.disabled ? undefined : item.onClick}
                            disabled={item.disabled}
                            className={`menu-item ${item.disabled ? "text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400" : ""}`}
                        >
                            {item.label}
                            {item.disabled && (
                                <span className="ml-2 text-xs">(Coming soon)</span>
                            )}
                        </button>
                    ))}
                </div>
                </div>
            )}
        </div>
    );
};

// --- Main ERP Component ---
const Academics: React.FC = () => {
    const [view, setView] = useState<AcademicView>("HOME");
    const { hasPermission } = useAuth();

    const canSubjectMaster = hasPermission('academics.academic.subject-master', 'read');
    // const canTimetable = hasPermission('academics.timetable.timetable-management', 'read');
    const canClassSubjects = hasPermission('academics.academic.class-subject-assignment', 'read');
    const canStudentSubjects = hasPermission('academics.academic.assign-student-subjects', 'read');
    const canSubjectTests = hasPermission('academics.academic.assign-subject-tests', 'read');
    const canStudentTests = hasPermission('academics.academic.assign-student-tests', 'read');
    const canTestType = hasPermission('academics.academic.test-type-manager', 'read');
    const canClassTest = hasPermission('academics.academic.class-test-assignment', 'read');
    const canGrading = hasPermission('academics.academic.grade-scale-manager', 'read');
    const canMarksEntry = hasPermission('academics.academic.marks-entry', 'read');
    const canMarksEntryAll = hasPermission('academics.academic.marks-entry-all-subjects', 'read');
    const canMarksUpload = hasPermission('academics.academic.marks-upload', 'read');
    const canExamAttendance = hasPermission('attendance.attendance.set-exam-attendance', 'read');
    const canReportCard = hasPermission('home.dashboard.student-report-card', 'read');

    const enterMarksItems = [
        ...(canMarksEntry ? [{ label: "Subject Wise", onClick: () => setView("MARKS_ENTRY_SUBJECT") }] : []),
        ...(canMarksEntryAll ? [{ label: "Enter All Subject Marks", onClick: () => setView("MARKS_ENTRY_ALL_SUBJECTS") }] : []),
        ...(canMarksUpload ? [{ label: "Upload Exam Marks", onClick: () => setView("MARKS_ENTRY_UPLOAD") }] : []),
    ];

    const academicActionItems = [
        ...(canClassSubjects ? [{ label: "Assign Class Subjects", onClick: () => setView("ASSIGN_SUBJECTS") }] : []),
        ...(canStudentSubjects ? [{ label: "Assign Student Subjects", onClick: () => setView("ASSIGN_STUDENT_SUBJECTS") }] : []),
        ...(canSubjectTests ? [{ label: "Assign Subject Tests", onClick: () => setView("ASSIGN_SUBJECT_TESTS") }] : []),
        ...(canStudentTests ? [{ label: "Assign Test to Students", onClick: () => setView("ASSIGN_STUDENT_TESTS") }] : []),
        ...(canExamAttendance ? [{ label: "Set Exam Attendance", onClick: () => setView("SET_EXAM_ATTENDANCE") }] : []),
    ];

    const mastersItems = [
        ...(canSubjectMaster ? [{ label: "Subjects", onClick: () => setView("SUBJECTS") }] : []),
        // ...(canTimetable ? [{ label: "Timetable", onClick: () => setView("TIMETABLE") }] : []),
        ...(canTestType ? [{ label: "Create Test", onClick: () => setView("CREATE_TEST") }] : []),
        ...(canClassTest ? [{ label: "Add Exam", onClick: () => setView("ADD_EXAM") }] : []),
        ...(canGrading ? [{ label: "Grading", onClick: () => setView("GRADING") }] : []),
    ];

    const reportsItems = [
        ...(canReportCard ? [{ label: "Student Report Card", onClick: () => setView("STUDENT_REPORT_CARD") }] : []),
    ];

    return (
        <div className="min-h-full bg-surface-muted flex flex-col">
            <div className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col">

                    {/* Header - Only show if NO sub-view is selected (HOME) */}
                    {view === "HOME" && (
                        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-5">
                            <PageHeader
                                eyebrow="Academics"
                                title="Academics Management"
                                subtitle="Marks entry, academic actions, masters and reports."
                                icon={<GraduationCap className="w-6 h-6" />}
                                className="mb-5"
                                actions={(
                            <div className="flex gap-2 flex-wrap">
                                {enterMarksItems.length > 0 && (
                                    <NavDropdown title="Enter Marks" items={enterMarksItems} />
                                )}
                                {academicActionItems.length > 0 && (
                                    <NavDropdown title="Academic Actions" items={academicActionItems} />
                                )}
                                {mastersItems.length > 0 && (
                                    <NavDropdown title="Masters" items={mastersItems} />
                                )}
                                {reportsItems.length > 0 && (
                                    <NavDropdown title="Reports" items={reportsItems} />
                                )}
                            </div>
                                )}
                            />
                        </div>
                    )}

                    {/* Content Area */}
                    <div className={`flex-1 bg-surface-muted ${view === 'ADD_EXAM' ? 'p-2' : 'p-4 sm:p-6'}`}>

                        {view !== "HOME" && (
                            <button
                                onClick={() => setView("HOME")}
                                className="no-print mb-4 btn-secondary btn-sm"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Menu
                            </button>
                        )}

                        {view === "HOME" && (
                            <div className="card flex flex-col items-center justify-center text-center h-full py-20 px-6">
                                <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                                    <MousePointerClick className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Choose an academic action</h3>
                                <p className="text-sm text-slate-500 mt-1 max-w-md">Select an action from the menu above to manage academic data.</p>
                            </div>
                        )}

                        {view === "SUBJECTS" && <SubjectMaster />}
                        {view === "ASSIGN_SUBJECTS" && <ClassSubjectAssignment />}
                        {view === "ASSIGN_STUDENT_SUBJECTS" && <AssignStudentSubjects />}
                        {view === "ASSIGN_SUBJECT_TESTS" && <AssignSubjectTests />}
                        {view === "ASSIGN_STUDENT_TESTS" && <AssignStudentTests />}
                        {view === "CREATE_TEST" && <TestTypeManager />}
                        {view === "ADD_EXAM" && <ClassTestAssignment />}
                        {view === "GRADING" && <GradeScaleManager />}
                        {view === "MARKS_ENTRY_SUBJECT" && <MarksEntry />}
                        {view === "MARKS_ENTRY_UPLOAD" && <MarksUpload />}
                        {view === "STUDENT_REPORT_CARD" && <StudentReportCard />}
                        {view === "SET_EXAM_ATTENDANCE" && <SetExamAttendance />}
                        {/* {view === "TIMETABLE" && <Timetable />} */}
                        {view === "MARKS_ENTRY_ALL_SUBJECTS" && <MarksEntryAllSubjects />}




                        {!["HOME", "SUBJECTS", "ASSIGN_SUBJECTS", "ASSIGN_STUDENT_SUBJECTS"].includes(view) && (
                            <div className="text-gray-500">
                                {/*This module will be enabled soon.*/}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Academics;
