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
}

const ControlPanel: React.FC<ControlPanelProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();

    const modules: ControlPanelModule[] = [
        {
            id: 'user-management',
            name: 'User Management',
            icon: <UserIcon className="w-6 h-6" />,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            page: 'user-management',
            permission: 'system.users.management',
        },
        {
            id: 'role-permissions',
            name: 'Role Permissions',
            icon: <ShieldCheckIcon className="w-6 h-6" />,
            iconBg: 'bg-slate-50',
            iconColor: 'text-slate-600',
            page: 'role-permissions',
            permission: 'system.roles.permissions',
        },
        {
            id: 'franchise-management',
            name: 'Franchise Mgmt',
            icon: <BuildingOfficeIcon className="w-6 h-6" />,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            page: 'franchise-management',
            permission: 'system.franchise.management',
        },
        {
            id: 'school-management',
            name: 'School Mgmt',
            icon: <BuildingOfficeIcon className="w-6 h-6" />,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
                    <PageHeader
                        eyebrow="System"
                        title="Control Panel"
                        subtitle="Manage system users, roles, and franchises"
                        icon={<ControlPanelIcon className="w-6 h-6" />}
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
