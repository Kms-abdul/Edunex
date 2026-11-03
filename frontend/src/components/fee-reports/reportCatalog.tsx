import React from 'react';
import { AlertCircle, CalendarCheck, CalendarDays, CalendarRange, Clock, Layers, School, Search } from 'lucide-react';

export type FeeReportId = 'today' | 'daily' | 'monthly' | 'class' | 'installment' | 'due' | 'late-due' | 'search';

export interface FeeReportInfo {
    id: FeeReportId;
    title: string;
    description: string;
    icon: React.ReactNode;
}

/** The fee reports, in the order people look for them. */
export const FEE_REPORTS: FeeReportInfo[] = [
    { id: 'today', title: "Today's collection", description: 'Money collected today, receipt by receipt.', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'due', title: 'Who still owes fees', description: 'Students with unpaid fees, with a phone number to call.', icon: <AlertCircle className="w-5 h-5" /> },
    { id: 'search', title: "One student's receipts", description: 'Find a student and see all their receipts.', icon: <Search className="w-5 h-5" /> },
    { id: 'daily', title: 'Collection between two dates', description: 'Money collected from one date to another.', icon: <CalendarRange className="w-5 h-5" /> },
    { id: 'monthly', title: 'Collection in a month', description: 'Money collected in one month.', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'class', title: 'Collection by class', description: 'How much one class has paid and still has to pay.', icon: <School className="w-5 h-5" /> },
    { id: 'installment', title: 'Collection for one fee', description: 'Who paid a fee such as "June Fee", and how much is left.', icon: <Layers className="w-5 h-5" /> },
    { id: 'late-due', title: 'Who owes late fees', description: 'Students with unpaid late-payment fees.', icon: <Clock className="w-5 h-5" /> },
];
