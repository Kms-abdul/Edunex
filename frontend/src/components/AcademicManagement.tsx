import React from 'react';
import { Page } from '../App';
import {
    AcademicIcon,
    ChartBarIcon,
    DocumentReportIcon,
    TimeIcon,
    DashboardIcon,
    PencilIcon,
    UserIcon,
} from './icons';
import PageHeader from './ui/PageHeader';
import ModuleTile from './ui/ModuleTile';

interface AcademicManagementProps {
    navigateTo: (page: Page) => void;
}

interface AcademicModule {
    id: string;
    name: string;
    hint?: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    page?: Page;
    comingSoon?: boolean;
}

const AcademicManagement: React.FC<AcademicManagementProps> = ({ navigateTo }) => {
    const academicModules: AcademicModule[] = [
        {
            id: 'academic',
            name: 'Academic',
            hint: 'Enter marks, set up exams and subjects, print report cards',
            icon: <AcademicIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            page: 'academics'
        },
        {
            id: 'classwork',
            name: 'Classwork',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            comingSoon: true
        },
        {
            id: 'homework',
            name: 'Homework',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-orange-50',
            iconColor: 'text-orange-600',
            comingSoon: true
        },
        {
            id: 'lesson-plan',
            name: 'Lesson Plan',
            icon: <PencilIcon className="w-6 h-6" />,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            comingSoon: true
        },
        {
            id: 'time-table',
            name: 'Time Table',
            hint: 'See and plan the periods for each class',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-teal-50',
            iconColor: 'text-teal-600',
            page: 'timetable'
        },
        {
            id: 'online-exam',
            name: 'Online Exam',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            comingSoon: true
        },
        {
            id: 'academic-content',
            name: 'Academic Content',
            icon: <DashboardIcon className="w-6 h-6" />,
            iconBg: 'bg-indigo-50',
            iconColor: 'text-indigo-600',
            comingSoon: true
        },
        {
            id: 'assessment',
            name: 'Assessment',
            icon: <ChartBarIcon className="w-6 h-6" />,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            comingSoon: true
        },
        {
            id: 'online-class',
            name: 'Online Class',
            hint: 'Start or join a live class',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            page: 'online-class'
        },
        {
            id: 'activity-planner',
            name: 'Activity Planner',
            icon: <PencilIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            comingSoon: true
        }
    ];

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
                <PageHeader
                    title="Academic Management"
                    subtitle="Manage all academic activities and resources"
                    icon={<AcademicIcon className="w-6 h-6" />}
                    className="mb-5"
                />

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {academicModules.map(module => (
                        <ModuleTile
                            key={module.id}
                            name={module.name}
                            description={module.hint}
                            icon={module.icon}
                            iconClassName={`${module.iconBg} ${module.iconColor}`}
                            active={!!module.page && !module.comingSoon}
                            comingSoon={module.comingSoon}
                            onClick={() => module.page && navigateTo(module.page)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AcademicManagement;
