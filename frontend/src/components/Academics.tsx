import React, { Suspense, lazy, useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { EmptyState, LoadingState, ModuleMenuBar } from "./ui";
import type { ModuleMenu } from "./ui";
import type { Page } from "../App";
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
import { consumeIntent, setIntent } from '../utils/intent';


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
    | "SET_EXAM_ATTENDANCE"
    | "TIMETABLE"
    | "ONLINE_CLASS";

const Timetable = lazy(() => import("./Timetable"));
const OnlineClass = lazy(() => import("./OnlineClass"));

interface Entry {
    view: AcademicView;
    label: string;
    hint: string;
    allowed: boolean;
}

/** View shown when the module opens on one of the Academics pages. */
const viewForPage = (page: Page): AcademicView | null =>
    page === 'timetable' ? 'TIMETABLE' : page === 'online-class' ? 'ONLINE_CLASS' : null;

// --- Academics Management: one header with dropdown menus, the chosen screen below ---
const Academics: React.FC<{ currentPage: Page; navigateTo: (page: Page) => void }> = ({ currentPage, navigateTo }) => {
    // A shortcut (e.g. Home → "Enter marks") may open a specific screen directly
    const [view, setView] = useState<AcademicView>(() =>
        viewForPage(currentPage) || (consumeIntent('academics') as AcademicView | null) || "HOME");
    const { hasPermission } = useAuth();
    const can = (codes: string) => codes.split(',').some(c => hasPermission(c.trim(), 'read'));

    // Keep the screen in step with the page (sidebar, back button, links from other modules)
    useEffect(() => {
        const fromPage = viewForPage(currentPage);
        if (fromPage) { setView(fromPage); return; }
        const intent = consumeIntent('academics') as AcademicView | null;
        if (intent) setView(intent);
        else setView(v => (v === 'TIMETABLE' || v === 'ONLINE_CLASS' ? 'HOME' : v));
    }, [currentPage]);

    const open = (v: AcademicView) => {
        const page = v === 'TIMETABLE' ? 'timetable' : v === 'ONLINE_CLASS' ? 'online-class' : null;
        if (page) { if (page !== currentPage) navigateTo(page); setView(v); return; }
        // Screens inside Academics: stay on this page; coming from Timetable/Online class, hand the choice over
        if (viewForPage(currentPage)) { setIntent('academics', v); navigateTo('academics'); return; }
        setView(v);
    };

    // Same permission keys as before: each screen can be given to a user on its own.
    const groups: { id: string; label: string; entries: Entry[] }[] = [
        {
            id: 'marks', label: 'Enter Marks', entries: [
                { view: 'MARKS_ENTRY_SUBJECT', label: 'Subject wise', hint: 'One exam, one subject, the whole class', allowed: can('academics.academic.marks-entry') },
                { view: 'MARKS_ENTRY_ALL_SUBJECTS', label: 'All subjects', hint: "Each student's marks in every subject", allowed: can('academics.academic.marks-entry-all-subjects') },
                { view: 'MARKS_ENTRY_UPLOAD', label: 'Upload marks from Excel', hint: 'Fill marks in a sheet, then upload it', allowed: can('academics.academic.marks-upload') },
            ],
        },
        {
            id: 'actions', label: 'Academic Actions', entries: [
                { view: 'ADD_EXAM', label: 'Add exams to classes', hint: 'Choose which exams each class writes', allowed: can('academics.academic.class-test-assignment') },
                { view: 'ASSIGN_SUBJECT_TESTS', label: 'Subjects in each exam', hint: 'Choose the subjects for an exam', allowed: can('academics.academic.assign-subject-tests') },
                { view: 'ASSIGN_STUDENT_TESTS', label: 'Students in each exam', hint: 'Choose which students write an exam', allowed: can('academics.academic.assign-student-tests') },
                { view: 'ASSIGN_SUBJECTS', label: 'Subjects for a class', hint: 'Choose the subjects each class studies', allowed: can('academics.academic.class-subject-assignment') },
                { view: 'ASSIGN_STUDENT_SUBJECTS', label: 'Subjects for students', hint: 'Choose optional subjects for each student', allowed: can('academics.academic.assign-student-subjects') },
                { view: 'SET_EXAM_ATTENDANCE', label: 'Exam attendance', hint: 'Choose which months count for attendance', allowed: can('attendance.attendance.set-exam-attendance') },
            ],
        },
        {
            id: 'masters', label: 'Masters', entries: [
                { view: 'CREATE_TEST', label: 'Exam names', hint: 'Create exam names like Unit test 1', allowed: can('academics.academic.test-type-manager') },
                { view: 'SUBJECTS', label: 'Subject list', hint: 'Add or change subjects', allowed: can('academics.academic.subject-master') },
                { view: 'GRADING', label: 'Grades', hint: 'Marks needed for each grade (A, B, C…)', allowed: can('academics.academic.grade-scale-manager') },
            ],
        },
        {
            id: 'classroom', label: 'Classroom', entries: [
                { view: 'TIMETABLE', label: 'Time table', hint: 'Class periods and teacher timetable', allowed: can('academics.timetable.timetable-management,academics.timetable.subject-teacher-assignment') },
                // Online class had no permission check before; it stays open to everyone in Academics.
                { view: 'ONLINE_CLASS', label: 'Online class', hint: 'Start or join a live class', allowed: true },
            ],
        },
        {
            id: 'reports', label: 'Reports', entries: [
                { view: 'STUDENT_REPORT_CARD', label: 'Student report card', hint: "See and print a student's report card", allowed: can('home.dashboard.student-report-card') },
            ],
        },
    ];

    const menus: ModuleMenu[] = groups.map(g => ({
        id: g.id,
        label: g.label,
        items: g.entries.filter(e => e.allowed).map(e => ({
            id: e.view, label: e.label, hint: e.hint, active: view === e.view, onSelect: () => open(e.view),
        })),
    }));
    const anyAllowed = menus.some(m => m.items.length > 0);
    const currentGroup = groups.find(g => g.entries.some(e => e.view === view));
    const currentEntry = currentGroup?.entries.find(e => e.view === view);
    // A screen opened by a link the user has no access to is not shown.
    const allowed = !!currentEntry?.allowed;

    return (
        <div className="min-h-full bg-surface-muted flex flex-col">
            <ModuleMenuBar title="Academics Management" icon={<GraduationCap className="w-6 h-6" />} menus={menus} />

            {view === "HOME" || !allowed ? (
                <div className="flex-1 flex items-center justify-center p-6">
                    {anyAllowed ? (
                        <div className="text-center text-slate-500 max-w-sm">
                            <GraduationCap className="w-12 h-12 mx-auto text-slate-300" aria-hidden="true" />
                            <p className="mt-3 text-base">Select an action from the menu above to manage academic data.</p>
                        </div>
                    ) : (
                        <div className="card w-full max-w-lg">
                            <EmptyState
                                title="Nothing to show"
                                description="You do not have access to any Academics screens. Ask your school admin if you need it."
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className={`flex-1 ${view === 'ADD_EXAM' ? 'p-2' : view === 'TIMETABLE' || view === 'ONLINE_CLASS' ? '' : 'p-4 sm:p-6'}`}>
                    <p className={`no-print text-sm text-slate-500 ${view === 'TIMETABLE' || view === 'ONLINE_CLASS' ? 'px-4 sm:px-6 pt-4' : 'mb-3'}`}>
                        {currentGroup?.label} <span aria-hidden="true">›</span> <span className="font-semibold text-slate-800">{currentEntry?.label}</span>
                    </p>

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
                    {view === "MARKS_ENTRY_ALL_SUBJECTS" && <MarksEntryAllSubjects />}
                    {(view === "TIMETABLE" || view === "ONLINE_CLASS") && (
                        <Suspense fallback={<LoadingState label="Loading page…" className="py-24" />}>
                            {view === "TIMETABLE" ? <Timetable /> : <OnlineClass />}
                        </Suspense>
                    )}
                </div>
            )}
        </div>
    );
};

export default Academics;
