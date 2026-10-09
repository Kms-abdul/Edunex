import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface ModuleTileProps {
    name: string;
    description?: string;
    icon: React.ReactNode;
    /** Tailwind classes for the icon container, e.g. "bg-blue-50 text-blue-600" */
    iconClassName?: string;
    comingSoon?: boolean;
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
}

/**
 * Card-style launcher used on module landing pages.
 * Presentation only – navigation is supplied by the caller.
 */
const ModuleTile: React.FC<ModuleTileProps> = ({ name, description, icon, iconClassName, comingSoon, active, disabled, onClick }) => {
    const isDisabled = disabled || comingSoon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            className={`group tile ${isDisabled ? 'opacity-60 cursor-not-allowed hover:border-slate-200 hover:shadow-card' : 'cursor-pointer'}`}
        >
            <div className="flex items-start justify-between">
                <div className={`tile-icon ${iconClassName || 'bg-brand-50 text-brand-600'} ${isDisabled ? 'group-hover:scale-100' : ''}`}>
                    {icon}
                </div>
                {!isDisabled && (
                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transition-colors" />
                )}
            </div>

            <h3 className={`font-semibold text-slate-900 text-[15px] leading-snug ${!isDisabled ? 'group-hover:text-brand-700' : ''} transition-colors`}>
                {name}
            </h3>
            {description && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{description}</p>
            )}

            <div className="mt-3">
                {comingSoon ? (
                    <span className="badge-neutral">Coming Soon</span>
                ) : active ? (
                    <span className="badge-success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                ) : null}
            </div>
        </button>
    );
};

export default ModuleTile;
