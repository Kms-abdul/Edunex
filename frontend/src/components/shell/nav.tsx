import React from 'react';
import { Home, Wallet, Users, BookOpen, Contact, Settings } from 'lucide-react';
import type { Page } from '../../App';

export interface NavSection { title: string; short: string; icon: React.ReactNode; page: Page; permission: string; match?: string[] }

// Plain-language sections. `match` = page-name prefixes/pages that belong to the section,
// so the right item stays highlighted while working inside it.
export const navCategories: NavSection[] = [
  { title: 'Home', short: 'Home', icon: <Home className="w-5 h-5" />, page: 'dashboard', permission: '*' },
  { title: 'Administration', short: 'Admin', icon: <Users className="w-5 h-5" />, page: 'administration', permission: 'administration.students.management',
    match: ['administration', 'student-administration', 'student-attendance', 'student-document-management', 'document-management', 'document-administration', 'sms-center', 'create-student', 'import-student-data'] },
  { title: 'Academics', short: 'Academics', icon: <BookOpen className="w-5 h-5" />, page: 'academic', permission: 'academics.academic.management',
    match: ['academic', 'academics', 'timetable', 'online-class'] },
  { title: 'Finance', short: 'Finance', icon: <Wallet className="w-5 h-5" />, page: 'fee', permission: 'fees.collections.receipt-entry',
    match: ['fee', 'take-fee', 'class-fee-structure', 'assign-special-fee', 'concession-master', 'student-concession', 'update-student-fee-structure', 'update-rebate-date', 'delete-fee-receipt', 'deleted-receipts', 'adjust-fee-report', 'petty-cash', 'fund-allocation', 'month-wise-ledger', 'reconciliation-dashboard', 'remittance-'] },
  { title: 'HR Management', short: 'HR', icon: <Contact className="w-5 h-5" />, page: 'hr-management', permission: 'hr.hr.hr-management,hr.hr.staff-profile',
    match: ['hr-', 'staff-profile'] },
  { title: 'School Set Up', short: 'Setup', icon: <Settings className="w-5 h-5" />, page: 'setup', permission: 'setup.school.setup',
    match: ['setup', 'classes-management', 'configuration'] },
];

export const isInSection = (current: Page, cat: { page: Page; match?: string[] }) =>
  current === cat.page || (cat.match || []).some(m => (m.endsWith('-') ? current.startsWith(m) : current === m));
