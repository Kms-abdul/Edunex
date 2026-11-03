import React from 'react';
import { ChevronRight } from 'lucide-react';
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
            name: 'Exams, marks and subjects',
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
            name: 'Lesson plan',
            icon: <PencilIcon className="w-6 h-6" />,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            comingSoon: true
        },
        {
            id: 'time-table',
            name: 'Timetable',
            hint: 'See and plan the periods for each class',
            icon: <TimeIcon className="w-6 h-6" />,
            iconBg: 'bg-teal-50',
            iconColor: 'text-teal-600',
            page: 'timetable'
        },
        {
            id: 'online-exam',
            name: 'Online exam',
            icon: <DocumentReportIcon className="w-6 h-6" />,
            iconBg: 'bg-pink-50',
            iconColor: 'text-pink-600',
            comingSoon: true
        },
        {
            id: 'academic-content',
            name: 'Study material',
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
            name: 'Online class',
            hint: 'Start or join a live class',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-cyan-50',
            iconColor: 'text-cyan-600',
            page: 'online-class'
        },
        {
            id: 'activity-planner',
            name: 'Activity planner',
            icon: <PencilIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            comingSoon: true
        }
    ];

    const ready = academicModules.filter(m => m.page && !m.comingSoon);
    const soon = academicModules.filter(m => m.comingSoon);

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
                <PageHeader
                    eyebrow="Academics"
                    title="Teaching and exams"
                    subtitle="What do you want to do?"
                    icon={<AcademicIcon className="w-6 h-6" />}
                    className="mb-5"
                />

                <section className="card overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {ready.map(module => (
                            <li key={module.id}>
                                <button
                                    type="button"
                                    onClick={() => module.page && navigateTo(module.page)}
                                    className="w-full min-h-[64px] flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus-visible:bg-brand-50"
                                >
                                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${module.iconBg} ${module.iconColor}`} aria-hidden="true">
                                        {module.icon}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-medium text-slate-900">{module.name}</span>
                                        {module.hint && <span className="block text-sm text-slate-500">{module.hint}</span>}
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>

                {soon.length > 0 && (
                    <section className="mt-5">
                        <h2 className="text-sm font-medium text-slate-500 mb-2">Coming soon</h2>
                        <ul className="flex flex-wrap gap-2">
                            {soon.map(module => (
                                <li key={module.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                                    <span className={`w-5 h-5 flex items-center justify-center ${module.iconColor} opacity-70 [&>svg]:w-4 [&>svg]:h-4`} aria-hidden="true">{module.icon}</span>
                                    {module.name}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
};

export default AcademicManagement;
