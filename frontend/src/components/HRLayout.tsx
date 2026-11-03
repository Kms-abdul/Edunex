import React from 'react';
import { Page } from '../App';
import {
    DashboardIcon,
    UserIcon,
    TimeIcon,
    DocumentIcon,
    HomeIcon,
    ChartBarIcon
} from './icons';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from './ui/PageHeader';

interface HRLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    navigateTo: (page: Page) => void;
}

interface NavItem {
    name: string;
    page: Page;
    icon: React.ReactNode;
    permission?: string;
}

interface NavGroup {
    id: string;
    name: string;
    icon: React.ReactNode;
    items: NavItem[];
    /** Other pages that belong to this group (so the right tab is highlighted). */
    alsoActiveOn?: Page[];
}

/** Big, tap-friendly pill used for both rows of HR navigation. */
const NavPill: React.FC<{ active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`min-h-[44px] px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0 inline-flex items-center gap-2 transition-colors
            ${active ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
        {icon && <span className={active ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>}
        <span>{children}</span>
    </button>
);

const HRLayout: React.FC<HRLayoutProps> = ({ children, currentPage, navigateTo }) => {
    const { hasPermission } = useAuth();

    const canAccess = (permission?: string) => {
        if (!permission) return true;
        return hasPermission(permission, 'read');
    };

    // Same pages and permission keys as before; plain names; grouped for phones.
    const groups: NavGroup[] = [
        {
            id: 'home',
            name: 'HR home',
            icon: <DashboardIcon className="w-5 h-5" />,
            items: [
                { name: 'HR home', page: 'hr-management' as Page, icon: <DashboardIcon className="w-4 h-4" />, permission: 'hr.hr.hr-management' },
            ],
        },
        {
            id: 'staff',
            name: 'Staff',
            icon: <UserIcon className="w-5 h-5" />,
            items: [
                { name: 'Staff list',    page: 'hr-staff-directory' as Page, icon: <UserIcon className="w-4 h-4" />,     permission: 'hr.hr.staff-directory' },
                { name: 'Staff records', page: 'hr-staff-master'    as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-master' },
                { name: 'My details',    page: 'staff-profile'      as Page, icon: <UserIcon className="w-4 h-4" />,     permission: 'hr.hr.staff-profile' },
            ],
            alsoActiveOn: ['hr-staff-profile-list' as Page, 'hr-staff-update-list' as Page],
        },
        {
            id: 'attendance',
            name: 'Attendance',
            icon: <ChartBarIcon className="w-5 h-5" />,
            items: [
                { name: 'Attendance',     page: 'hr-attendance-summary' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'hr.attendance.summary' },
                { name: 'In / out times', page: 'hr-punch-log'          as Page, icon: <TimeIcon className="w-4 h-4" />,     permission: 'hr.attendance.punch-log' },
            ],
            alsoActiveOn: ['hr-biometric-devices' as Page, 'hr-biometric-mapping' as Page],
        },
        {
            id: 'setup',
            name: 'HR setup',
            icon: <DocumentIcon className="w-5 h-5" />,
            items: [
                { name: 'Departments',     page: 'hr-departments'          as Page, icon: <HomeIcon className="w-4 h-4" />,     permission: 'hr.hr.departments' },
                { name: 'Designations',    page: 'hr-designations'         as Page, icon: <UserIcon className="w-4 h-4" />,     permission: 'hr.hr.designations' },
                { name: 'Shifts',          page: 'hr-shifts'               as Page, icon: <TimeIcon className="w-4 h-4" />,     permission: 'hr.hr.shifts' },
                { name: 'Staff types',     page: 'hr-staff-categories'     as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-categories' },
                { name: 'Staff statuses',  page: 'hr-staff-statuses'       as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-statuses' },
                { name: 'Document types',  page: 'hr-staff-document-types' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-document-types' },
            ],
        },
    ];

    const visibleGroups = groups
        .map(g => ({ ...g, items: g.items.filter(i => canAccess(i.permission)) }))
        .filter(g => g.items.length > 0);

    const activeGroup = visibleGroups.find(g =>
        g.items.some(i => i.page === currentPage) || (g.alsoActiveOn || []).includes(currentPage)
    );

    return (
        <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* HR header + section tabs */}
                <div className="bg-white border-b border-slate-200 z-20 relative flex flex-col">
                    {/* Phones: a slim title so the page itself gets the room */}
                    <p className="sm:hidden px-4 pt-3 pb-1 text-base font-semibold text-slate-900">Staff & HR</p>
                    <div className="hidden sm:block px-6 pt-5">
                        <PageHeader
                            eyebrow="Human resources"
                            title="Staff & HR"
                            subtitle="Staff, attendance and HR setup."
                            icon={<UserIcon className="w-6 h-6" />}
                            className="mb-3"
                        />
                    </div>

                    {visibleGroups.length > 0 && (
                        <nav aria-label="HR sections" className="px-2 sm:px-4 pb-2 flex gap-1 overflow-x-auto">
                            {visibleGroups.map(g => (
                                <NavPill
                                    key={g.id}
                                    active={activeGroup?.id === g.id}
                                    icon={g.icon}
                                    onClick={() => navigateTo(g.items[0].page)}
                                >
                                    {g.name}
                                </NavPill>
                            ))}
                        </nav>
                    )}
                </div>

                {/* Pages inside the chosen section */}
                {activeGroup && activeGroup.items.length > 1 && (
                    <nav aria-label={`${activeGroup.name} pages`} className="bg-white/80 backdrop-blur border-b border-slate-200 px-2 sm:px-4 py-1.5 flex gap-1 overflow-x-auto z-10">
                        {activeGroup.items.map(item => (
                            <NavPill
                                key={item.page}
                                active={currentPage === item.page}
                                icon={item.icon}
                                onClick={() => navigateTo(item.page)}
                            >
                                {item.name}
                            </NavPill>
                        ))}
                    </nav>
                )}

                <div className="flex-1 overflow-hidden relative">
                    <div className="absolute inset-0 overflow-y-auto bg-surface-muted p-4 sm:p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HRLayout;
