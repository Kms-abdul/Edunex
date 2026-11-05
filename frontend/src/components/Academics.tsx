import React, { useState } from "react";
import { GraduationCap, ChevronRight, ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState } from "./ui";
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
import { consumeIntent } from '../utils/intent';


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

interface MenuItem {
    label: string;
    hint: string;
    view: AcademicView;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

// --- Tap-friendly task list (works the same with a finger or a mouse) ---
const TaskGroup: React.FC<{ group: MenuGroup; onOpen: (v: AcademicView) => void }> = ({ group, onOpen }) => (
    <section className="card overflow-hidden">
        <h2 className="px-4 pt-4 pb-2 text-base font-semibold text-slate-900">{group.title}</h2>
        <ul className="divide-y divide-slate-100">
            {group.items.map(item => (
                <li key={item.view}>
                    <button
                        type="button"
                        onClick={() => onOpen(item.view)}
                        className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:bg-brand-50"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-medium text-slate-900">{item.label}</span>
                            <span className="block text-sm text-slate-500">{item.hint}</span>
                        </span>
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    </section>
);

// --- Main ERP Component ---
const Academics: React.FC = () => {
    // A shortcut (e.g. Home → "Enter marks") may open a specific screen directly
    const [view, setView] = useState<AcademicView>(() => (consumeIntent('academics') as AcademicView | null) || "HOME");
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

    // Same permission checks as before; only the way the list is shown has changed.
    const groups: MenuGroup[] = [
        {
            title: "Marks",
            items: [
                ...(canMarksEntry ? [{ label: "Enter marks for one subject", hint: "One exam, one subject, the whole class", view: "MARKS_ENTRY_SUBJECT" as AcademicView }] : []),
                ...(canMarksEntryAll ? [{ label: "Enter marks for all subjects", hint: "Each student's marks in every subject", view: "MARKS_ENTRY_ALL_SUBJECTS" as AcademicView }] : []),
                ...(canMarksUpload ? [{ label: "Upload marks from Excel", hint: "Fill marks in a sheet, then upload it", view: "MARKS_ENTRY_UPLOAD" as AcademicView }] : []),
            ],
        },
        {
            title: "Exams",
            items: [
                ...(canClassTest ? [{ label: "Add an exam to classes", hint: "Choose which exams each class writes", view: "ADD_EXAM" as AcademicView }] : []),
                ...(canTestType ? [{ label: "Exam names", hint: "Create exam names like Unit test 1", view: "CREATE_TEST" as AcademicView }] : []),
                ...(canSubjectTests ? [{ label: "Subjects in each exam", hint: "Choose the subjects for an exam", view: "ASSIGN_SUBJECT_TESTS" as AcademicView }] : []),
                ...(canStudentTests ? [{ label: "Students in each exam", hint: "Choose which students write an exam", view: "ASSIGN_STUDENT_TESTS" as AcademicView }] : []),
                ...(canExamAttendance ? [{ label: "Exam attendance", hint: "Choose which months count for attendance", view: "SET_EXAM_ATTENDANCE" as AcademicView }] : []),
                ...(canGrading ? [{ label: "Grades", hint: "Marks needed for each grade (A, B, C…)", view: "GRADING" as AcademicView }] : []),
            ],
        },
        {
            title: "Subjects",
            items: [
                ...(canSubjectMaster ? [{ label: "Subject list", hint: "Add or change subjects", view: "SUBJECTS" as AcademicView }] : []),
                // ...(canTimetable ? [{ label: "Timetable", hint: "", view: "TIMETABLE" }] : []),
                ...(canClassSubjects ? [{ label: "Subjects for a class", hint: "Choose the subjects each class studies", view: "ASSIGN_SUBJECTS" as AcademicView }] : []),
                ...(canStudentSubjects ? [{ label: "Subjects for students", hint: "Choose optional subjects for each student", view: "ASSIGN_STUDENT_SUBJECTS" as AcademicView }] : []),
            ],
        },
        {
            title: "Report cards",
            items: [
                ...(canReportCard ? [{ label: "Student report card", hint: "See and print a student's report card", view: "STUDENT_REPORT_CARD" as AcademicView }] : []),
            ],
        },
    ].filter(g => g.items.length > 0);

    return (
        <div className="min-h-full bg-surface-muted flex flex-col">
            {view === "HOME" ? (
                <div className="flex-1 p-4 sm:p-6">
                    <PageHeader
                        eyebrow="Academics"
                        title="Exams and marks"
                        subtitle="What do you want to do?"
                        icon={<GraduationCap className="w-6 h-6" />}
                        className="mb-5"
                    />
                    {groups.length === 0 ? (
                        <div className="card">
                            <EmptyState
                                title="Nothing to show"
                                description="You do not have access to any exam tasks. Ask your school admin if you need it."
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            {groups.map(g => <TaskGroup key={g.title} group={g} onOpen={setView} />)}
                        </div>
                    )}
                </div>
            ) : (
                <div className={`flex-1 ${view === 'ADD_EXAM' ? 'p-2' : 'p-4 sm:p-6'}`}>
                    <button
                        type="button"
                        onClick={() => setView("HOME")}
                        className="no-print mb-4 inline-flex items-center gap-1.5 min-h-[44px] px-1 text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> All exam tasks
                    </button>

                    {view === "SUBJECTS" && <SubjectMaster />}
                    {view === "ASSIGN_SUBJECTS" && <ClassSubjectAssignment />}
                    {view === "ASSIGN_STUDENT_SUBJECTS" && <AssignStudentSubjects />}
                    {view === "ASSIGN_SUBJECT_TESTS" && <AssignSubjectTests />}
                    {view === "ASSIGN_STUDENT_TESTS" && <AssignStudentTests />}
                    {view === "CREATE_TEST" && <TestTypeManager />}
                    {view === "ADD_EXAM" && <ClassTestAssignment />}
                    {view === "GRADING" && <GradeScaleManager />}
                    {view === "MARKS_ENTRY_SUBJECT" && <MarksEntry onDone={() => setView("HOME")} />}
                    {view === "MARKS_ENTRY_UPLOAD" && <MarksUpload />}
                    {view === "STUDENT_REPORT_CARD" && <StudentReportCard />}
                    {view === "SET_EXAM_ATTENDANCE" && <SetExamAttendance />}
                    {/* {view === "TIMETABLE" && <Timetable />} */}
                    {view === "MARKS_ENTRY_ALL_SUBJECTS" && <MarksEntryAllSubjects />}
                </div>
            )}
        </div>
    );
};

export default Academics;
