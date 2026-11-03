import React, { useState } from 'react';
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

const HRLayout: React.FC<HRLayoutProps> = ({ children, currentPage, navigateTo }) => {
    const [activeTab, setActiveTab] = useState<string>('Dashboard');
    const { hasPermission } = useAuth();
    
    const canAccess = (permission?: string) => {
        if (!permission) return true;
        return hasPermission(permission, 'read');
    };

    const menuItems = [
        { 
            name: 'Dashboard', 
            page: 'hr-management' as Page, 
            icon: <DashboardIcon className="w-5 h-5" />, 
            permission: 'hr.hr.hr-management' 
        },
        {
            name: 'HR Masters',
            id: 'hrMasters',
            icon: <DocumentIcon className="w-5 h-5" />,
            permission: 'hr.hr.departments', // Base permission
            subItems: [
                { name: 'Departments',      page: 'hr-departments'      as Page, icon: <HomeIcon className="w-4 h-4" />,  permission: 'hr.hr.departments' },
                { name: 'Designations',     page: 'hr-designations'     as Page, icon: <UserIcon className="w-4 h-4" />,  permission: 'hr.hr.designations' },
                { name: 'Shifts',           page: 'hr-shifts'           as Page, icon: <TimeIcon className="w-4 h-4" />,  permission: 'hr.hr.shifts' },
                { name: 'Staff Categories', page: 'hr-staff-categories' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-categories' },
                { name: 'Staff Statuses',   page: 'hr-staff-statuses'   as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'hr.hr.staff-statuses' },
            ]
        },
        {
            name: 'Staff Directory',
            id: 'staffDirectory',
            page: 'hr-staff-directory' as Page,
            icon: <UserIcon className="w-5 h-5" />,
            permission: 'hr.hr.staff-directory', // Or whatever general view permission you have
        },
        {
            name: 'Staff Master',
            id: 'staffMaster',
            page: 'hr-staff-master' as Page,
            icon: <DocumentIcon className="w-5 h-5" />,
            permission: 'hr.hr.staff-master',
        },
        {
            name: 'My Profile',
            id: 'myStaffProfile',
            page: 'staff-profile' as Page,
            icon: <UserIcon className="w-5 h-5" />,
            permission: 'hr.hr.staff-profile',
        },

        {
            name: 'Attendance',
            id: 'attendance',
            icon: <ChartBarIcon className="w-5 h-5" />,
            subItems: [
                { name: 'Attendance Summary', page: 'hr-attendance-summary' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'hr.attendance.summary' },
                { name: 'Punch Log', page: 'hr-punch-log' as Page, icon: <TimeIcon className="w-4 h-4" />, permission: 'hr.attendance.punch-log' },
            ]
        }
    ];

    const activeMenu = menuItems.find(item => 
        item.page === currentPage || 
        (item.subItems && item.subItems.some(sub => sub.page === currentPage))
    ) || menuItems[0];

    const handleTabClick = (item: typeof menuItems[0]) => {
        if (item.page) {
            navigateTo(item.page);
        } else if (item.subItems && item.subItems.length > 0) {
            const firstAccessible = item.subItems.find(sub => canAccess(sub.permission));
            if (firstAccessible) {
                navigateTo(firstAccessible.page);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* HR Header */}
                <div className="bg-white border-b border-slate-200 z-20 relative flex flex-col">
                    <div className="px-4 sm:px-6 pt-5">
                        <PageHeader
                            eyebrow="Human Resources"
                            title="HR & Staff Management"
                            subtitle="Masters, staff directory, profiles and attendance."
                            icon={<UserIcon className="w-6 h-6" />}
                            className="mb-4"
                        />
                    </div>

                </div>

                {/* Sub-navigation Menu for Active Tab */}
                {activeMenu.subItems && activeMenu.subItems.length > 0 && (
                    <div className="bg-white/80 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto z-10">
                        <div className="segmented">
                            {activeMenu.subItems.map(sub => (
                                canAccess(sub.permission) && (
                                    <button
                                        key={sub.name}
                                        onClick={() => navigateTo(sub.page)}
                                        className={`segmented-item flex items-center gap-1.5 whitespace-nowrap ${currentPage === sub.page ? 'segmented-item-active' : ''}`}
                                    >
                                        <span className={currentPage === sub.page ? 'text-brand-600' : 'text-slate-400'}>{sub.icon}</span>
                                        <span>{sub.name}</span>
                                    </button>
                                )
                            ))}
                        </div>
                    </div>
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
