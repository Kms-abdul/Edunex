import React from 'react';
import { Page } from '../App';
import PageHeader from './ui/PageHeader';
import { Settings, ArrowRight, Info } from 'lucide-react';

interface SetupSchoolProps {
    navigateTo?: (page: Page) => void;
}

const SetupSchool: React.FC<SetupSchoolProps> = ({ navigateTo }) => {
    const modules = [
        {
            id: 'classes',
            title: 'Classes',
            description: 'Manage class divisions, sections, and class-specific configurations',
            icon: (
                <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="12" width="48" height="32" rx="2" fill="#E8F4F8" stroke="#3B82F6" strokeWidth="2" />
                    <path d="M16 20 L24 20 M16 26 L28 26 M16 32 L22 32" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="44" cy="26" r="6" fill="#F97316" />
                    <path d="M44 32 Q38 38 32 40 Q44 38 56 40 Q50 38 44 32" fill="#F97316" />
                    <circle cx="24" cy="48" r="4" fill="#3B82F6" />
                    <rect x="20" y="52" width="8" height="8" rx="1" fill="#3B82F6" />
                </svg>
            ),
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-50',
            hoverColor: 'hover:shadow-blue-200',
            onClick: () => {
                navigateTo?.('classes-management');
            }
        },
        {
            id: 'configuration',
            title: 'Configuration',
            description: 'System settings, preferences, and general configurations',
            icon: (
                <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="12" fill="#E8F4F8" stroke="#8B5CF6" strokeWidth="2" />
                    <circle cx="32" cy="32" r="6" fill="#8B5CF6" />
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                        const rad = (angle * Math.PI) / 180;
                        const x1 = 32 + Math.cos(rad) * 16;
                        const y1 = 32 + Math.sin(rad) * 16;
                        const x2 = 32 + Math.cos(rad) * 24;
                        const y2 = 32 + Math.sin(rad) * 24;
                        return (
                            <g key={i}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
                                <circle cx={x2} cy={y2} r="3" fill="#8B5CF6" />
                            </g>
                        );
                    })}
                </svg>
            ),
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-50',
            hoverColor: 'hover:shadow-purple-200',
            onClick: () => {
                navigateTo?.('configuration');
            }
        }
    ];

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
                    <PageHeader
                        eyebrow="Setup"
                        title="Setup your School"
                        subtitle="Configure your institution's core modules and settings"
                        icon={<Settings className="w-6 h-6" />}
                        className="mb-5"
                    />
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {/* Module Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                    {modules.map((module) => (
                        <div
                            key={module.id}
                            onClick={module.onClick}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); module.onClick(); } }}
                            className="group tile cursor-pointer p-6 flex gap-5 items-start"
                        >
                            <div className={`${module.bgColor} w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                                {module.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                                    {module.title}
                                </h2>
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                    {module.description}
                                </p>
                                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600">
                                    Configure
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Info Section */}
                <div className="mt-6 max-w-4xl">
                    <div className="card p-5 border-l-4 border-l-brand-500">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                                <Info className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">Getting Started</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    Start by configuring your <span className="font-medium text-brand-600">Classes</span> to organize students into different grades and sections.
                                    Then, use the <span className="font-medium text-brand-600">Configuration</span> module to set up system-wide preferences,
                                    academic years, and other essential settings.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupSchool;
