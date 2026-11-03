import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, X } from 'lucide-react';
import { EmptyState } from '../ui';

/* ------------------------------------------------------------------ Money / dates */

/** ₹12,500 style text. */
export const rupees = (value: number | string | null | undefined) => {
    const n = Number(value) || 0;
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/** 03 Nov 2026 style text; shows the raw value if it is not a date. */
export const prettyDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** The branch picked in the header, and whether it is "all branches". */
export const currentBranchInfo = () => {
    const branch = localStorage.getItem('currentBranch') || 'All';
    const isAll = branch === 'All' || branch === 'All Branches' || branch === 'All Locations';
    return { branch, isAll, label: isAll ? 'All branches' : branch };
};

/* ------------------------------------------------------------------ Small intro line */

export const Intro: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-sm text-slate-600 ${className}`}>{children}</p>
);

/* ------------------------------------------------------------------ Tap-friendly checkbox row */

export const CheckRow: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    children: React.ReactNode;
    hint?: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
}> = ({ checked, onChange, disabled, children, hint, right, className = '' }) => (
    <label
        className={`flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-xl border transition-colors
            ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer'}
            ${checked && !disabled ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'} ${className}`}
    >
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={e => onChange(e.target.checked)}
            className="w-5 h-5 accent-brand-600 rounded border-slate-300 flex-shrink-0"
        />
        <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-slate-900 break-words">{children}</span>
            {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
        </span>
        {right}
    </label>
);

/* ------------------------------------------------------------------ "More options" disclosure */

export const MoreOptions: React.FC<{ label?: string; children: React.ReactNode; defaultOpen?: boolean; className?: string }> = ({
    label = 'More options', children, defaultOpen = false, className = '',
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className="btn-ghost min-h-[44px] px-2 -ml-2 text-brand-700"
            >
                <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                {label}
            </button>
            {open && <div className="mt-2 space-y-3">{children}</div>}
        </div>
    );
};

/* ------------------------------------------------------------------ Dialog / bottom sheet */

/** A dialog that slides up from the bottom on phones and is centred on desktop. */
export const Sheet: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}> = ({ title, onClose, children, footer }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-pop max-h-[90vh] flex flex-col"
            >
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
                    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="btn-icon">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto space-y-4">{children}</div>
                {footer && (
                    <div className="px-5 py-3 border-t border-slate-100 flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ Success state */

export const SuccessPanel: React.FC<{ title: string; children?: React.ReactNode; extra?: React.ReactNode }> = ({ title, children, extra }) => (
    <div className="card">
        <div className="card-body flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-9 h-9" />
            </div>
            <p className="text-xl font-semibold text-slate-900">{title}</p>
            {children && <div className="mt-1 text-slate-600 max-w-md">{children}</div>}
            {extra && <div className="mt-4">{extra}</div>}
        </div>
    </div>
);

/* ------------------------------------------------------------------ Summary rows (review steps) */

export const SummaryRow: React.FC<{ label: string; children: React.ReactNode; strong?: boolean }> = ({ label, children, strong }) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
        <span className="text-sm text-slate-600">{label}</span>
        <span className={`text-right break-words ${strong ? 'text-base font-semibold text-slate-900' : 'text-sm text-slate-900'}`}>{children}</span>
    </div>
);

/* ------------------------------------------------------------------ Copy to other branches */

export interface BranchOption {
    id: number | string;
    name: string;
    location_name: string;
}

/** Groups branches by city, leaving out the current one and "All". */
export const groupBranches = (allBranches: BranchOption[], sourceBranchId: string | number) => {
    const available = allBranches.filter(b => String(b.id) !== String(sourceBranchId) && b.name !== 'All Branches' && b.name !== 'All');
    const byLocation: { [key: string]: BranchOption[] } = {};
    available.forEach(b => {
        if (!byLocation[b.location_name]) byLocation[b.location_name] = [];
        byLocation[b.location_name].push(b);
    });
    return byLocation;
};

/**
 * Inline (tap-friendly) panel for copying setup to other branches.
 * Pure presentation: the page keeps the selection state and the copy call.
 */
export const CopyToBranches: React.FC<{
    what: string;
    branchesByLocation: { [key: string]: BranchOption[] };
    selected: Set<string>;
    onToggle: (branchId: string) => void;
    onCopy: () => void;
    copying: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Extra fields shown before the branch list (e.g. which fee to copy). */
    children?: React.ReactNode;
    /** Why the copy button is disabled, if it is. */
    blockedReason?: string;
    note?: string;
}> = ({ what, branchesByLocation, selected, onToggle, onCopy, copying, open, onOpenChange, children, blockedReason, note }) => {
    const locations = Object.keys(branchesByLocation);
    return (
        <div className="card">
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-left"
            >
                <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                    <Copy className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Copy {what} to other branches</span>
                    <span className="block text-xs text-slate-500">{note || 'Saves typing the same setup again.'}</span>
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4">
                    {children}
                    {locations.length === 0 ? (
                        <EmptyState compact title="No other branches to copy to" />
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-slate-800">Copy to these branches</p>
                            {locations.map(loc => (
                                <div key={loc}>
                                    <p className="text-xs font-semibold text-slate-500 mb-1.5">{loc}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {branchesByLocation[loc].map(b => (
                                            <CheckRow key={b.id} checked={selected.has(String(b.id))} onChange={() => onToggle(String(b.id))}>
                                                {b.name}
                                            </CheckRow>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                        <span className="text-sm text-slate-600">
                            {blockedReason || (selected.size === 0 ? 'Choose at least one branch' : `${selected.size} branch${selected.size === 1 ? '' : 'es'} chosen`)}
                        </span>
                        <button
                            type="button"
                            onClick={onCopy}
                            disabled={copying || selected.size === 0 || !!blockedReason}
                            className="btn-primary"
                        >
                            <Copy className="w-4 h-4" />
                            {copying ? 'Copying…' : `Copy to ${selected.size || ''} branch${selected.size === 1 ? '' : 'es'}`.replace('  ', ' ')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
