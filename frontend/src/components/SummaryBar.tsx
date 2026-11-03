import React, { useState, useEffect } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { UserIcon, CurrencyRupeeIcon } from './icons';
import { UserCheck } from 'lucide-react';
import api from '../api';

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; tone: string; hint?: string; className?: string }> = ({ title, value, icon, tone, hint, className = '' }) => (
    <div className={`card relative overflow-hidden flex items-center gap-3 p-3 sm:p-5 sm:gap-4 min-w-0 ${className}`}>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight mt-0.5 tabular-nums break-words">{value}</p>
            {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
    </div>
);


const SummaryBar: React.FC = () => {
    const { students } = useSchool();
    const [presentToday, setPresentToday] = useState(0);

    // Read selected branch from localStorage (matches api.ts usage)
    const currentBranch = (localStorage.getItem('currentBranch') || 'All').trim();
    const normalizedBranch = currentBranch.toLowerCase();
    const isAll = !normalizedBranch || normalizedBranch.startsWith('all');

    // Resolve Branch Name from ID (SAFE fix for Mixed Data)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const allowed = user.allowed_branches || [];
    let targetBranchName = currentBranch;

    if (Array.isArray(allowed)) {
        const branchObj = allowed.find((b: any) => String(b.branch_id) === currentBranch);
        if (branchObj) targetBranchName = branchObj.branch_name;
    }

    const filteredStudents = isAll
        ? students
        : students.filter(s => {
            const sBranch = (s.branch || '').toLowerCase().trim();
            return sBranch === normalizedBranch || sBranch === targetBranchName.toLowerCase().trim();
        });

    const totalStudents = filteredStudents.length;

    const totalDues = filteredStudents.reduce((total, student) => {
        return total + (student.total_due || 0);
    }, 0);

    useEffect(() => {
        const fetchAttendance = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const res = await api.get(`/attendance?date=${today}`);
                const attendanceMap = res.data.attendance || {};

                // If branch filter is applied, we only count students who are in the filtered list
                // The attendanceMap contains student_id -> status
                const filteredStudentIds = new Set(filteredStudents.map(s => s.student_id));

                const count = Object.entries(attendanceMap).filter(([studentId, status]) => {
                    return filteredStudentIds.has(Number(studentId)) && status === 'Present';
                }).length;

                setPresentToday(count);
            } catch (err) {
                console.error('Failed to fetch today\'s attendance:', err);
                setPresentToday(0);
            }
        };

        fetchAttendance();
    }, [filteredStudents]); // Re-run when filtered students change (e.g. branch change)

    const scopeHint = isAll ? 'All branches' : targetBranchName;

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
            <SummaryCard
                title="Students"
                value={totalStudents.toLocaleString('en-IN')}
                icon={<UserIcon className="w-6 h-6" />}
                tone="bg-brand-50 text-brand-600"
                hint={scopeHint}
            />
            <SummaryCard
                title="Fees still due"
                value={`₹ ${totalDues.toLocaleString('en-IN')}`}
                icon={<CurrencyRupeeIcon className="w-6 h-6" />}
                tone="bg-rose-50 text-rose-600"
                hint="Not yet paid by students"
                className="col-span-2 md:col-span-1 order-last md:order-none"
            />

            <SummaryCard
                title="Present today"
                value={presentToday.toLocaleString('en-IN')}
                icon={<UserCheck className="w-6 h-6" />}
                tone="bg-emerald-50 text-emerald-600"
                hint="Students marked present"
            />

        </div>
    );
};

export default SummaryBar;
