import React from 'react';
import { Page } from '../App';
import {
    TimeIcon,
    DocumentReportIcon,
    DownloadIcon,
    SearchIcon,
    HomeIcon,
    UserIcon,
    ChartBarIcon,
    DashboardIcon,
    SetupIcon,
    HeadphoneIcon,
} from './icons';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from './ui/PageHeader';
import ModuleTile from './ui/ModuleTile';

interface AdministrationProps {
    navigateTo: (page: Page) => void;
}

interface AdministrationModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    page?: Page;
    comingSoon?: boolean;
    permission?: string | string[];
}

const Administration: React.FC<AdministrationProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();

    const administrationModules: AdministrationModule[] = [
        {
            id: 'calendar',
            name: 'Calendar',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            comingSoon: true
        },
        {
            id: 'document',
            name: 'Document',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            comingSoon: false,
            page: 'document-management',
            permission: 'documents.documents.document-management',
        },
        {
            id: 'download',
            name: 'Download',
            icon: <DownloadIcon className="w-6 h-6" />,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            comingSoon: true
        },
        {
            id: 'inquiry',
            name: 'Inquiry',
            icon: <SearchIcon className="w-6 h-6" />,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            comingSoon: true
        },
        {
            id: 'hostel',
            name: 'Hostel',
            icon: <HomeIcon className="w-6 h-6" />,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            comingSoon: true
        },
        {
            id: 'leave',
            name: 'Leave',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            comingSoon: true
        },
        {
            id: 'library',
            name: 'Library',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            comingSoon: true
        },
        {
            id: 'student-attendance',
            name: 'Student Attendance',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-teal-50',
            iconColor: 'text-teal-600',
            page: 'student-attendance',
            permission: 'attendance.attendance.student-attendance',
        },
        {
            id: 'student',
            name: 'Student',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            page: 'student-administration',
            permission: 'administration.student.student-administration',
        },
        {
            id: 'summary',
            name: 'Summary',
            icon: <DashboardIcon className="w-6 h-6" />,
            iconBg: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            comingSoon: true
        },
        {
            id: 'attendance-staff',
            name: 'Attendance(Stf)',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            comingSoon: true
        },
        {
            id: 'team',
            name: 'Team',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
            comingSoon: true
        },
        {
            id: 'transport',
            name: 'Transport',
            icon: <HomeIcon className="w-6 h-6" />,
            iconBg: 'bg-yellow-50',
            iconColor: 'text-yellow-600',
            comingSoon: true
        },
        {
            id: 'alumni',
            name: 'Alumni',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-lime-50',
            iconColor: 'text-lime-600',
            comingSoon: true
        },
        {
            id: 'post-jobs',
            name: 'Post Jobs',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-fuchsia-50',
            iconColor: 'text-fuchsia-600',
            comingSoon: true
        },
        {
            id: 'survey',
            name: 'Survey',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-rose-50',
            iconColor: 'text-rose-600',
            comingSoon: true
        },
        {
            id: 'helpdesk',
            name: 'Helpdesk',
            icon: <HeadphoneIcon className="w-6 h-6" />,
            iconBg: 'bg-sky-50',
            iconColor: 'text-sky-600',
            comingSoon: true
        },
        {
            id: 'sms-center',
            name: 'SMS Center',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            page: 'sms-center',
            permission: 'administration.sms.sms-center',
        }
    ];

    const handleModuleClick = (module: AdministrationModule) => {
        if (module.page) {
            navigateTo(module.page);
        }
    };

    const visibleModules = administrationModules
        .filter(module => {
            if (!module.permission) return true;
            if (Array.isArray(module.permission)) {
                return module.permission.some(p => hasPermission(p, 'read'));
            }
            return hasPermission(module.permission, 'read');
        })
        .sort((a, b) => {
            if (a.comingSoon === b.comingSoon) return 0;
            return a.comingSoon ? 1 : -1;
        });

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
                    <PageHeader
                        eyebrow="Administration"
                        title="Administration"
                        subtitle="Take control of your school operations"
                        icon={<SetupIcon className="w-6 h-6" />}
                        className="mb-5"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleModules.map((module) => (
                        <ModuleTile
                            key={module.id}
                            name={module.name}
                            icon={module.icon}
                            iconClassName={`${module.iconBg} ${module.iconColor}`}
                            comingSoon={module.comingSoon}
                            active={!!module.page && !module.comingSoon}
                            onClick={() => handleModuleClick(module)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Administration;
