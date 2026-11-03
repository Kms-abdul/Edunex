import React from 'react';

/**
 * Read-only "label: value" blocks used by the staff profile tabs.
 * One column on phones, two on wider screens.
 */

export const InfoSection: React.FC<{
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, action, children, className = '' }) => (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {action}
        </div>
        <div className="px-4 py-3">{children}</div>
    </section>
);

export const InfoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
);

export const InfoItem: React.FC<{
    label: string;
    value?: React.ReactNode;
    mono?: boolean;
    wide?: boolean;
}> = ({ label, value, mono, wide }) => {
    const empty = value === null || value === undefined || value === '';
    return (
        <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={`mt-0.5 break-words text-[15px] font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
                {empty ? <span className="text-slate-400">—</span> : value}
            </dd>
        </div>
    );
};

/** Small text button used in section headers ("Change bank details"). */
export const SectionAction: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button type="button" onClick={onClick} className="btn-soft btn-sm">{children}</button>
);

/** "ACTIVE" → "Active", "BANK_TRANSFER" → "Bank transfer". */
export const plainWord = (v?: string | null) => {
    if (!v) return '';
    const s = String(v).replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Date as 03/11/2026, or empty. */
export const shortDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB') : '');

export const yesNo = (v: any) => (v ? 'Yes' : 'No');
