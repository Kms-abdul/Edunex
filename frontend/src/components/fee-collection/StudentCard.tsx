import React from 'react';
import { UserRound } from 'lucide-react';

export interface StudentCardData {
    name: string;
    admNo: string;
    class: string;
    section: string;
    fatherName?: string;
    fatherPhone?: string | number;
}

/**
 * One student shown as a clear card: name, class-section, admission number, father's name.
 * `actions` sits on the right (or below on phones), e.g. "Change student".
 * Reusable for the parent app later.
 */
const StudentCard: React.FC<{
    student: StudentCardData;
    actions?: React.ReactNode;
    compact?: boolean;
    className?: string;
}> = ({ student, actions, compact, className = '' }) => {
    const classSection = [student.class, student.section].filter(Boolean).join('-');
    return (
        <div className={`rounded-xl border border-brand-200 bg-brand-50/60 ${compact ? 'p-3' : 'p-4'} ${className}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-full bg-white text-brand-600 flex items-center justify-center flex-shrink-0">
                        <UserRound className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900 break-words">{student.name}</p>
                        <p className="text-sm text-slate-600">
                            {classSection ? `Class ${classSection}` : 'Class not set'}
                            {' · '}Admission number {student.admNo || '—'}
                        </p>
                        {!compact && (student.fatherName || student.fatherPhone) && (
                            <p className="text-sm text-slate-600 break-words">
                                {student.fatherName ? `Father: ${student.fatherName}` : ''}
                                {student.fatherName && student.fatherPhone ? ' · ' : ''}
                                {student.fatherPhone ? `Phone ${student.fatherPhone}` : ''}
                            </p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex flex-wrap gap-2 sm:flex-shrink-0">{actions}</div>}
            </div>
        </div>
    );
};

export default StudentCard;
