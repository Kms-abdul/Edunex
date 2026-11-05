import React from 'react';
import { Page } from '../App';
import PageHeader from './ui/PageHeader';
import { Settings, School, SlidersHorizontal, Info } from 'lucide-react';
import { ChoiceList } from './school-setup';

interface SetupSchoolProps {
    navigateTo?: (page: Page) => void;
}

const SetupSchool: React.FC<SetupSchoolProps> = ({ navigateTo }) => {
    const choices = [
        {
            key: 'classes',
            title: 'Classes and sections',
            hint: 'Add classes, their sections and how many students each holds',
            icon: <School className="w-5 h-5" />,
            onClick: () => navigateTo?.('classes-management'),
        },
        {
            key: 'configuration',
            title: 'School settings',
            hint: 'Holidays, weekly days off and other settings',
            icon: <SlidersHorizontal className="w-5 h-5" />,
            onClick: () => navigateTo?.('configuration'),
        },
    ];

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
                <PageHeader
                    eyebrow="Setup"
                    title="Set up your school"
                    subtitle="What do you want to set up?"
                    icon={<Settings className="w-6 h-6" />}
                />

                <ChoiceList choices={choices} />

                <div className="mt-6 card p-4 sm:p-5 border-l-4 border-l-brand-500">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Info className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900 mb-1">New here? Start in this order</h2>
                            <ol className="text-slate-600 text-sm leading-relaxed list-decimal pl-5 space-y-0.5">
                                <li>Add your <span className="font-medium text-slate-800">classes and sections</span>.</li>
                                <li>Then open <span className="font-medium text-slate-800">school settings</span> to add holidays and weekly days off.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupSchool;
