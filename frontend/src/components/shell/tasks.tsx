import React from 'react';
import {
  Wallet, UserSearch, UserPlus, CalendarCheck, PenLine, Clock, FileBarChart,
  HandCoins, MessageSquareText, Contact, LifeBuoy, BookOpen, CalendarDays,
  Users, Settings, ShieldCheck, Receipt, Percent, FolderOpen, GraduationCap,
} from 'lucide-react';
import type { Page } from '../../App';

/**
 * Everything a person can DO in KampusOps, written in plain words.
 * Used by the Home screen, the bottom tab bar and the Menu.
 *
 * `permission` is a comma-separated list; the task shows if the user can read ANY of them.
 * `view` deep-links into a page's internal screen (see utils/intent.ts).
 */
export interface Task {
  id: string;
  title: string;
  hint: string;
  page: Page;
  view?: string;
  permission: string;
  icon: React.ReactNode;
  group: 'daily' | 'students' | 'fees' | 'staff' | 'school';
}

const i = (C: React.ComponentType<{ className?: string }>) => <C className="w-5 h-5" />;

export const TASKS: Task[] = [
  // ---- Daily work (shown first)
  { id: 'collect-fee', group: 'daily', title: 'Collect fee', hint: 'Take a payment and print the receipt', page: 'take-fee', permission: 'fees.collections.receipt-entry,fees.fee.take-fee', icon: i(Wallet) },
  { id: 'attendance', group: 'daily', title: 'Take student attendance', hint: 'Mark who is present or absent today', page: 'student-attendance', permission: 'attendance.attendance.student-attendance', icon: i(CalendarCheck) },
  { id: 'find-student', group: 'daily', title: 'Find a student', hint: 'Search by name, admission no. or phone', page: 'student-administration', view: 'search', permission: 'administration.student.search-student,administration.student.student-administration', icon: i(UserSearch) },
  { id: 'enter-marks', group: 'daily', title: 'Enter exam marks', hint: 'Type marks for one subject', page: 'academics', view: 'MARKS_ENTRY_SUBJECT', permission: 'academics.academic.marks-entry', icon: i(PenLine) },
  { id: 'staff-attendance', group: 'daily', title: 'Staff attendance', hint: 'See who came in and when', page: 'hr-attendance-summary', permission: 'hr.attendance.summary', icon: i(Clock) },

  // ---- Students
  { id: 'add-student', group: 'students', title: 'Add a new student', hint: 'Fill in admission details step by step', page: 'student-administration', view: 'addStudent', permission: 'administration.student.create-student', icon: i(UserPlus) },
  { id: 'all-students', group: 'students', title: 'All students', hint: 'See and edit the student list', page: 'student-administration', view: 'students', permission: 'administration.student.student-administration', icon: i(Users) },
  { id: 'report-card', group: 'students', title: 'Report cards', hint: 'View and print a student’s report card', page: 'academics', view: 'STUDENT_REPORT_CARD', permission: 'home.dashboard.student-report-card,home.dashboard.report-card', icon: i(GraduationCap) },
  { id: 'documents', group: 'students', title: 'Student documents', hint: 'Upload or view certificates and ID proofs', page: 'document-management', permission: 'documents.documents.document-management', icon: i(FolderOpen) },
  { id: 'sms', group: 'students', title: 'Send SMS to parents', hint: 'Fee reminders, holidays and notices', page: 'sms-center', permission: 'administration.sms.sms-center', icon: i(MessageSquareText) },

  // ---- Fees & money
  { id: 'fee-reports', group: 'fees', title: 'Fee reports', hint: 'Today’s collection, dues and more', page: 'fee-reports', permission: 'fees.fee.fee-reports,fees.fee.fee-report-components', icon: i(FileBarChart) },
  { id: 'concession', group: 'fees', title: 'Give a fee discount', hint: 'Set a concession for a student', page: 'student-concession', permission: 'administration.student.student-concession', icon: i(Percent) },
  { id: 'petty-cash', group: 'fees', title: 'Petty cash', hint: 'Record small office expenses', page: 'petty-cash', permission: 'fees.fee.petty-cash', icon: i(HandCoins) },
  { id: 'deposit', group: 'fees', title: 'Deposit cash to bank', hint: 'Send collected cash for deposit', page: 'remittance-deposit', permission: 'fees.fee.remittance-deposit', icon: i(Receipt) },

  // ---- Staff
  { id: 'my-profile', group: 'staff', title: 'My details', hint: 'Your profile, salary and documents', page: 'staff-profile', permission: 'hr.hr.staff-profile', icon: i(Contact) },
  { id: 'staff-list', group: 'staff', title: 'Staff list', hint: 'Find a staff member and their details', page: 'hr-staff-directory', permission: 'hr.hr.staff-directory', icon: i(Users) },
  { id: 'punch-log', group: 'staff', title: 'In / out times', hint: 'Daily punch-in and punch-out log', page: 'hr-punch-log', permission: 'hr.attendance.punch-log', icon: i(Clock) },

  // ---- School setup
  { id: 'timetable', group: 'school', title: 'Timetable', hint: 'Class periods and teacher timetable', page: 'timetable', permission: 'academics.timetable.timetable-management,academics.timetable.subject-teacher-assignment', icon: i(CalendarDays) },
  { id: 'exams-subjects', group: 'school', title: 'Subjects and exams', hint: 'Set up subjects, tests and grading', page: 'academics', permission: 'academics.academic.management', icon: i(BookOpen) },
  { id: 'school-setup', group: 'school', title: 'School setup', hint: 'Classes, sections, fees and holidays', page: 'setup', permission: 'setup.school.setup', icon: i(Settings) },
  { id: 'users', group: 'school', title: 'Users and access', hint: 'Who can log in and what they can do', page: 'control-panel', permission: 'system.users.management,system.roles.permissions,system.franchise.management,system.school.school-management', icon: i(ShieldCheck) },

  // ---- Always available
  { id: 'help', group: 'school', title: 'Get help', hint: 'Guides and contact for support', page: 'staffsupport', permission: '*', icon: i(LifeBuoy) },
];

export const GROUP_TITLES: Record<Task['group'], string> = {
  daily: 'Daily work',
  students: 'Students',
  fees: 'Fees and money',
  staff: 'Staff',
  school: 'School',
};

export const canDo = (task: Task, hasPermission: (code: string, action?: 'read' | 'write' | 'append' | 'delete') => boolean) =>
  task.permission === '*' || task.permission.split(',').some(p => hasPermission(p.trim(), 'read'));
