import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    eyebrow?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

/**
 * Standard page heading used by module landing pages and section layouts.
 * Presentation only.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, eyebrow, icon, actions, className }) => (
    <div className={`page-header ${className || ''}`}>
        <div className="flex items-center gap-3.5 min-w-0">
            {icon && (
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-brand-600/10">
                    {icon}
                </div>
            )}
            <div className="min-w-0">
                {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
                <h1 className="page-title truncate">{title}</h1>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
);

export default PageHeader;
