import React, { useState } from 'react';
import { Page } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, HomeIcon, TimeIcon, DocumentIcon, ChartBarIcon } from './icons';
import ModuleTile from './ui/ModuleTile';
import { ArrowLeft } from 'lucide-react';

interface HRManagementProps {
    navigateTo?: (page: Page) => void;
}

type MainCategory = 'hr_master' | 'employee_details' | 'attendance' | null;

const HRManagement: React.FC<HRManagementProps> = ({ navigateTo }) => {
    const { user, hasPermission } = useAuth();
    const [activeCategory, setActiveCategory] = useState<MainCategory>(null);

    const canAccess = (permission?: string) => {
        if (!permission) return true;
        return hasPermission(permission, 'read');
    };

    const categories = [
        {
            id: 'hr_master' as MainCategory,
            name: 'HR Master',
            icon: <DocumentIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
        },
        {
            id: 'employee_details' as MainCategory,
            name: 'Employee Details',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
        },
        {
            id: 'attendance' as MainCategory,
            name: 'Attendance',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
        }
    ];

    const hrModules = [
        {
            id: 'departments',
            name: 'Departments',
            icon: <HomeIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            page: 'hr-departments' as Page,
            permission: 'hr.hr.departments',
            category: 'hr_master'
        },
        {
            id: 'staff-categories',
            name: 'Staff Categories',
            icon: <DocumentIcon className="w-6 h-6" />,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            page: 'hr-staff-categories' as Page,
            permission: 'hr.hr.staff-categories',
            category: 'hr_master'
        },
        {
            id: 'staff-document-types',
            name: 'Document Types',
            icon: <DocumentIcon className="w-8 h-8" />,
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            page: 'hr-staff-document-types' as Page,
            permission: 'hr.hr.staff-document-types',
            category: 'hr_master'
        },
        {
            id: 'staff-statuses',
            name: 'Staff Statuses',
            icon: <DocumentIcon className="w-6 h-6" />,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            page: 'hr-staff-statuses' as Page,
            permission: 'hr.hr.staff-statuses',
            category: 'hr_master'
        },
        {
            id: 'designations',
            name: 'Designations',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            page: 'hr-designations' as Page,
            permission: 'hr.hr.designations',
            category: 'hr_master'
        },
        {
            id: 'shifts',
            name: 'Shifts',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            page: 'hr-shifts' as Page,
            permission: 'hr.hr.shifts',
            category: 'hr_master'
        },
        {
            id: 'staff-master',
            name: 'Staff Master',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            page: 'hr-staff-master' as Page,
            permission: 'hr.hr.staff-master',
            category: 'employee_details'
        },
        {
            id: 'staff-profile-list',
            name: 'Staff Profile',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-teal-50',
            iconColor: 'text-teal-600',
            page: hasPermission('hr.hr.staff-master', 'read') ? 'hr-staff-profile-list' as Page : 'staff-profile' as Page,
            permission: 'hr.hr.staff-profile',
            category: 'employee_details'
        },
        {
            id: 'staff-update-list',
            name: 'Staff Update',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            page: 'hr-staff-update-list' as Page,
            permission: 'hr.hr.staff-update',
            category: 'employee_details'
        },
        {
            id: 'attendance-summary',
            name: 'Attendance Summary',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            page: 'hr-attendance-summary' as Page,
            permission: 'hr.attendance.summary',
            category: 'attendance'
        },
        {
            id: 'punch-log',
            name: 'Punch Log',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            page: 'hr-punch-log' as Page,
            permission: 'hr.attendance.punch-log',
            category: 'attendance',
            comingSoon: true
        }
    ];

    const visibleModules = hrModules.filter(module => 
        module.category === activeCategory && canAccess(module.permission)
    );

    const activeCategoryMeta = categories.find(c => c.id === activeCategory);

    return (
        <div className="max-w-7xl mx-auto">
            {activeCategory ? (
                <div className="mb-5 flex items-center gap-3">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className="btn-secondary btn-sm"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Categories
                    </button>
                    <div className="h-5 w-px bg-slate-200" />
                    <h3 className="text-base font-semibold text-slate-900">{activeCategoryMeta?.name}</h3>
                    <span className="badge-neutral">{visibleModules.length}</span>
                </div>
            ) : (
                <div className="mb-5">
                    <h3 className="text-base font-semibold text-slate-900">Categories</h3>
                    <p className="text-xs text-slate-500">Choose a category to see its modules.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in" key={activeCategory || 'root'}>
                {!activeCategory ? (
                    categories.map((category) => (
                        <ModuleTile
                            key={category.id}
                            name={category.name}
                            icon={category.icon}
                            iconClassName={`${category.iconBg} ${category.iconColor}`}
                            onClick={() => setActiveCategory(category.id)}
                        />
                    ))
                ) : (
                    visibleModules.map((module) => (
                        <ModuleTile
                            key={module.id}
                            name={module.name}
                            icon={module.icon}
                            iconClassName={`${module.iconBg} ${module.iconColor}`}
                            comingSoon={module.comingSoon}
                            onClick={() => {
                                if (!module.comingSoon && navigateTo && module.page) {
                                    navigateTo(module.page);
                                }
                            }}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default HRManagement;
