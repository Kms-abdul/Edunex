import React from 'react';
import { Page } from '../../App';
import {
    DashboardIcon, FinancialIcon, DocumentIcon, UserIcon, ReceiptIcon, TimeIcon, SchoolIcon,
    ChartBarIcon, DiscountIcon, TrashIcon, RefreshIcon, DocumentReportIcon,
} from '../icons';

export interface FeeNavItem {
    name: string;
    /** One plain line saying what the page is for (shown on the Fees home). */
    hint: string;
    page: Page;
    icon: React.ReactNode;
    permission?: string;
}

export interface FeeNavGroup {
    id: string;
    name: string;
    icon: React.ReactNode;
    /** The whole group needs this permission too (same rule as before). */
    permission?: string;
    items: FeeNavItem[];
}

/**
 * The Fees section menu. Same pages and the same permission keys as before,
 * with plain names. A page is shown only if the group's permission AND the
 * page's own permission are allowed.
 */
export const feeNavGroups: FeeNavGroup[] = [
    {
        id: 'home',
        name: 'Fees home',
        icon: <DashboardIcon className="w-5 h-5" />,
        permission: 'fees.fee.fee-dashboard',
        items: [
            { name: 'Fees home', hint: 'Start here', page: 'fee' as Page, icon: <DashboardIcon className="w-4 h-4" />, permission: 'fees.fee.fee-dashboard' },
        ],
    },
    {
        id: 'collect',
        name: 'Collect fee',
        icon: <ReceiptIcon className="w-5 h-5" />,
        items: [
            { name: 'Collect fee', hint: 'Take a payment and print a receipt', page: 'take-fee' as Page, icon: <ReceiptIcon className="w-4 h-4" /> },
        ],
    },
    {
        id: 'setup',
        name: 'Fee setup',
        icon: <FinancialIcon className="w-5 h-5" />,
        permission: 'fees.fee.fee-type',
        items: [
            { name: 'Fee types', hint: 'Names of fees, like Tuition or Bus', page: 'fee-type' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.fee-type' },
            { name: 'Installments', hint: 'Split a fee into months and set last dates', page: 'fee-installments' as Page, icon: <TimeIcon className="w-4 h-4" />, permission: 'fees.fee.fee-installments' },
            { name: 'Class fees', hint: 'How much each class pays', page: 'class-fee-structure' as Page, icon: <SchoolIcon className="w-4 h-4" />, permission: 'fees.fee.class-fee-structure' },
            { name: 'Extra fees for students', hint: 'Give a special fee to some students', page: 'assign-special-fee' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'fees.fee.assign-special-fee' },
            { name: "Change a student's fees", hint: 'Edit or remove fees for one student', page: 'update-student-fee-structure' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'fees.fee.update-student-fee-structure' },
            { name: 'Last date to pay', hint: 'Move the last date for an installment', page: 'update-rebate-date' as Page, icon: <TimeIcon className="w-4 h-4" />, permission: 'fees.fee.update-rebate-date' },
            { name: 'Cancel a receipt', hint: 'Delete a wrong fee receipt', page: 'delete-fee-receipt' as Page, icon: <TrashIcon className="w-4 h-4" />, permission: 'fees.fee.delete-fee-receipt' },
        ],
    },
    {
        id: 'reports',
        name: 'Reports',
        icon: <DocumentIcon className="w-5 h-5" />,
        permission: 'fees.fee.fee-reports',
        items: [
            { name: 'Fee reports', hint: 'Fees collected and fees due', page: 'fee-reports' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.fee-report-components' },
            { name: 'Discount report', hint: 'Discounts given to students', page: 'fee-concession-report' as Page, icon: <DiscountIcon className="w-4 h-4" />, permission: 'fees.fee.fee-concession-report' },
            { name: 'Cancelled receipts', hint: 'Receipts that were deleted', page: 'deleted-receipts' as Page, icon: <TrashIcon className="w-4 h-4" />, permission: 'fees.fee.deleted-receipts' },
            { name: 'Fee changes report', hint: 'Fees that were changed for students', page: 'adjust-fee-report' as Page, icon: <RefreshIcon className="w-4 h-4" />, permission: 'fees.fee.adjust-fee-report' },
            { name: 'Petty cash report', hint: 'Small cash spending', page: 'petty-cash-report' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-report' },
        ],
    },
    {
        id: 'cash',
        name: 'Petty cash',
        icon: <FinancialIcon className="w-5 h-5" />,
        items: [
            { name: 'Petty cash entry', hint: 'Write down small cash spending', page: 'petty-cash' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash' },
            { name: 'Deposit cash', hint: 'Send collected cash to the bank or office', page: 'remittance-deposit' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.remittance-deposit' },
            { name: 'Approve deposits', hint: 'Check and approve cash deposits', page: 'remittance-approvals' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.remittance-approvals' },
            { name: 'Give petty cash', hint: 'Give money to a branch for small spending', page: 'fund-allocation' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-fund-allocation' },
            { name: 'Monthly spending', hint: 'Petty cash month by month', page: 'month-wise-ledger' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-monthly-expenses' },
            { name: 'Approve petty cash', hint: 'Check and approve spending', page: 'petty-cash-approval' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-approval' },
            { name: 'Cash check', hint: 'Match cash collected with cash deposited', page: 'reconciliation-dashboard' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.reconciliation-dashboard' },
        ],
    },
    {
        id: 'discounts',
        name: 'Discounts',
        icon: <DiscountIcon className="w-5 h-5" />,
        permission: 'fees.fee.concession-master',
        items: [
            { name: 'Discount types', hint: 'Set up discounts, like Sibling discount', page: 'concession-master' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'fees.fee.concession-master' },
            { name: 'Give a discount', hint: 'Give a discount to one student', page: 'student-concession' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'administration.student.student-concession' },
        ],
    },
];

/** Groups and pages this person may open (same checks as before: read permission). */
export const visibleFeeNav = (canAccess: (permission?: string) => boolean) =>
    feeNavGroups
        .filter(g => canAccess(g.permission))
        .map(g => ({ ...g, items: g.items.filter(i => canAccess(i.permission)) }))
        .filter(g => g.items.length > 0);
