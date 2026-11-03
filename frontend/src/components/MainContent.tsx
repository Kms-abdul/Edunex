import React from 'react';
import { Page } from '../App';
import SummaryBar from './SummaryBar';
import ModuleTile from './ui/ModuleTile';
import { useAuth } from '../contexts/AuthContext';
import {
    AcademicIcon, FinancialIcon, AdministrationIcon, SetupIcon, UserIcon, ControlPanelIcon, HeadphoneIcon, ReceiptIcon
} from './icons';
import { CalendarDays } from 'lucide-react';

interface MainContentProps {
    navigateTo: (page: Page) => void;
}

interface WelcomeBarProps {
    navigateTo: (page: Page) => void;
}

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const WelcomeBar: React.FC<WelcomeBarProps> = ({ navigateTo }) => {
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    const { hasPermission } = useAuth();

    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const academicYear = localStorage.getItem('academicYear');
    const canCollectFee = hasPermission('fees.collections.receipt-entry', 'read');

    return (
        <div className="bg-white border-b border-slate-200">
            <div className="px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="page-eyebrow">Dashboard</p>
                    <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight truncate">
                        {greeting()}, {user?.username || 'User'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        {today}
                        {academicYear && <span className="badge-brand ml-1">Session {academicYear}</span>}
                    </p>
                </div>

                {canCollectFee && (
                    <button onClick={() => navigateTo('take-fee')} className="btn-primary">
                        <ReceiptIcon className="w-4 h-4" />
                        Collect Fee
                    </button>
                )}
            </div>
        </div>
    );
};

const quickLinks: { title: string; description: string; icon: React.ReactNode; page: Page; permission: string; tone: string }[] = [
    { title: 'Academic', description: 'Subjects, exams, marks & report cards', icon: <AcademicIcon className="w-6 h-6" />, page: 'academic', permission: 'academics.academic.management', tone: 'bg-brand-50 text-brand-600' },
    { title: 'Financial', description: 'Fee collection, masters & reports', icon: <FinancialIcon className="w-6 h-6" />, page: 'fee', permission: 'fees.collections.receipt-entry', tone: 'bg-emerald-50 text-emerald-600' },
    { title: 'Administration', description: 'Students, attendance & documents', icon: <AdministrationIcon className="w-6 h-6" />, page: 'administration', permission: 'administration.students.management', tone: 'bg-amber-50 text-amber-600' },
    { title: 'HR & Staff', description: 'Staff master, shifts & attendance', icon: <UserIcon className="w-6 h-6" />, page: 'hr-management', permission: 'hr.hr.hr-management,hr.hr.staff-profile', tone: 'bg-teal-50 text-teal-600' },
    { title: 'Setup Your School', description: 'Classes, sections & configuration', icon: <SetupIcon className="w-6 h-6" />, page: 'setup', permission: 'setup.school.setup', tone: 'bg-rose-50 text-rose-600' },
];

const DashboardHome: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();
    const canAccess = (permission: string) => permission.split(',').some(p => hasPermission(p.trim(), 'read'));

    const showControlPanel =
        hasPermission('system.users.management', 'read') ||
        hasPermission('system.roles.permissions', 'read') ||
        hasPermission('system.franchise.management', 'read') ||
        hasPermission('system.school.school-management', 'read');

    const links = quickLinks.filter(l => canAccess(l.permission));

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <SummaryBar />

            <section>
                <div className="flex items-end justify-between mb-3">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Quick access</h3>
                        <p className="text-xs text-slate-500">Jump straight into the modules you use most.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {links.map(link => (
                        <ModuleTile
                            key={link.page}
                            name={link.title}
                            description={link.description}
                            icon={link.icon}
                            iconClassName={link.tone}
                            onClick={() => navigateTo(link.page)}
                        />
                    ))}
                    {showControlPanel && (
                        <ModuleTile
                            name="Control Panel"
                            description="Users, roles, franchises & schools"
                            icon={<ControlPanelIcon className="w-6 h-6" />}
                            iconClassName="bg-slate-100 text-slate-700"
                            onClick={() => navigateTo('control-panel')}
                        />
                    )}
                    <ModuleTile
                        name="StaffSupport"
                        description="Raise and track support requests"
                        icon={<HeadphoneIcon className="w-6 h-6" />}
                        iconClassName="bg-sky-50 text-sky-600"
                        onClick={() => navigateTo('staffsupport')}
                    />
                </div>
            </section>
        </div>
    );
};

const MainContent: React.FC<MainContentProps> = ({ navigateTo }) => {
    return (
        <>
            <WelcomeBar navigateTo={navigateTo} />
            <DashboardHome navigateTo={navigateTo} />
        </>
    );
};

export default MainContent;
