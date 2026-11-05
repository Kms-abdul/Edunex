import React from 'react';
import { Page } from '../App';
import {
    UserIcon,
    ControlPanelIcon,
    BuildingOfficeIcon,
    ShieldCheckIcon,
} from './icons';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from './ui/PageHeader';
import ModuleTile from './ui/ModuleTile';

interface ControlPanelProps {
    navigateTo: (page: Page) => void;
}

interface ControlPanelModule {
    id: string;
    name: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    page: Page;
    permission?: string;
    description?: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();

    const modules: ControlPanelModule[] = [
        {
            id: 'user-management',
            name: 'Users',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            description: 'Add staff logins and turn them on or off',
            page: 'user-management',
            permission: 'system.users.management',
        },
        {
            id: 'role-permissions',
            name: 'Roles and access',
            icon: <ShieldCheckIcon className="w-6 h-6" />,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            description: 'Choose what each role can open',
            page: 'role-permissions',
            permission: 'system.roles.permissions',
        },
        {
            id: 'franchise-management',
            name: 'Franchises',
            icon: <BuildingOfficeIcon className="w-6 h-6" />,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            description: 'Groups of schools and their branches',
            page: 'franchise-management',
            permission: 'system.franchise.management',
        },
        {
            id: 'school-management',
            name: 'Schools',
            icon: <BuildingOfficeIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            description: 'School names, addresses and details',
            page: 'school-management',
            permission: 'system.school.school-management',
        }
    ];

    const handleModuleClick = (module: ControlPanelModule) => {
        if (module.page) {
            navigateTo(module.page);
        }
    };

    const visibleModules = modules.filter(module => {
        return hasPermission(module.permission || '', 'read');
    });

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5">
                    <PageHeader
                        eyebrow="System"
                        title="Control panel"
                        subtitle="Add people who can sign in, choose what they can open, and set up schools."
                        icon={<ControlPanelIcon className="w-6 h-6" />}
                        className="mb-5"
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {visibleModules.map((module) => (
                        <ModuleTile
                            key={module.id}
                            name={module.name}
                            description={module.description}
                            icon={module.icon}
                            iconClassName={`${module.iconBg} ${module.iconColor}`}
                            active
                            onClick={() => handleModuleClick(module)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
