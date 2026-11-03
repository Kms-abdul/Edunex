import React, { useEffect } from 'react';
import { X, MoveHorizontal } from 'lucide-react';
import { EmptyState } from '../ui';

/* -------------------------------------------------------------------------- */
/* Small building blocks shared by the exam / subject / grade setup screens.   */
/* They only change how things look; all data work stays in the screens.     */
/* -------------------------------------------------------------------------- */

/** One short line that says what this screen is for, plus where it applies (year · branch). */
export const SetupIntro: React.FC<{ title?: string; children?: React.ReactNode; context?: (string | false | null | undefined)[]; action?: React.ReactNode; className?: string }> = ({
    title, children, context, action, className = '',
}) => {
    const ctx = (context || []).filter(Boolean) as string[];
    return (
        <div className={`flex flex-col sm:flex-row sm:items-end gap-3 mb-4 ${className}`}>
            <div className="min-w-0 flex-1">
                {title && <h1 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug">{title}</h1>}
                {children && <p className="text-sm text-slate-600 mt-0.5">{children}</p>}
                {ctx.length > 0 && <p className="text-xs text-slate-500 mt-1">{ctx.join(' · ')}</p>}
            </div>
            {action && <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{action}</div>}
        </div>
    );
};

/**
 * A simple dialog. On phones it slides up from the bottom and fills the width;
 * on desktop it is a centered box. Press Escape or tap outside to close.
 */
export const SetupSheet: React.FC<{
    open: boolean;
    title: string;
    subtitle?: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    wide?: boolean;
}> = ({ open, title, subtitle, onClose, children, footer, wide }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div
            className="no-print fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] sm:p-4"
            onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-xl shadow-pop flex flex-col max-h-[90vh]`}>
                <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-slate-100 [&>*]:flex-1 sm:[&>*]:flex-none pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export interface CopyTarget { key: string; label: string }

/**
 * "Copy to other branches" picker: branches grouped by location with big tap rows.
 * The caller owns the selected set and the copy call.
 */
export const CopyToBranchesSheet: React.FC<{
    open: boolean;
    onClose: () => void;
    title?: string;
    what: string;
    groups: Record<string, CopyTarget[]>;
    selected: Set<string>;
    onToggle: (key: string) => void;
    onCopy: () => void;
    copying: boolean;
    note?: React.ReactNode;
}> = ({ open, onClose, title = 'Copy to other branches', what, groups, selected, onToggle, onCopy, copying, note }) => {
    const locations = Object.keys(groups);
    const n = selected.size;
    return (
        <SetupSheet
            open={open}
            onClose={onClose}
            title={title}
            subtitle={`Choose the branches that should get the same ${what}.`}
            footer={<>
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="button" className="btn-primary" onClick={onCopy} disabled={copying || n === 0}>
                    {copying ? 'Copying…' : n === 0 ? 'Choose a branch' : `Copy to ${n} branch${n !== 1 ? 'es' : ''}`}
                </button>
            </>}
        >
            {note && <div className="mb-3 text-sm text-slate-600">{note}</div>}
            {locations.length === 0 ? (
                <EmptyState compact title="No other branches" description="There is no other branch to copy to." />
            ) : (
                <div className="space-y-4">
                    {locations.map(loc => (
                        <div key={loc}>
                            <p className="text-xs font-medium text-slate-500 mb-1.5">{loc}</p>
                            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                {groups[loc].map(b => (
                                    <label key={b.key} className="flex items-center gap-3 px-3 min-h-[48px] cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(b.key)}
                                            onChange={() => onToggle(b.key)}
                                            className="w-5 h-5 accent-brand-600 flex-shrink-0"
                                        />
                                        <span className="text-[15px] text-slate-800">{b.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SetupSheet>
    );
};

/** A card that holds a grid (class × subject etc.). Scrolls sideways inside itself, never the page. */
export const GridCard: React.FC<{ children: React.ReactNode; hint?: string; className?: string; maxHeight?: boolean }> = ({
    children, hint = 'Swipe sideways to see more', className = '', maxHeight = true,
}) => (
    <div className={`card overflow-hidden ${className}`}>
        <p className="md:hidden flex items-center gap-1.5 px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
            <MoveHorizontal className="w-4 h-4" aria-hidden="true" /> {hint}
        </p>
        <div className={`overflow-auto overscroll-x-contain ${maxHeight ? 'max-h-[70vh]' : ''}`}>{children}</div>
    </div>
);

/** A checkbox with a 44px tap area, for grid cells. */
export const GridCheck: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    tone?: 'brand' | 'emerald';
}> = ({ checked, onChange, label, tone = 'brand' }) => (
    <label className="inline-flex items-center justify-center w-11 h-11 cursor-pointer rounded-lg hover:bg-slate-100 active:bg-slate-200" title={label}>
        <input
            type="checkbox"
            aria-label={label}
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className={`w-5 h-5 cursor-pointer ${tone === 'emerald' ? 'accent-emerald-600' : 'accent-brand-600'}`}
        />
    </label>
);

/** Group names as the school uses them. */
export const SUBJECT_GROUP_LABEL: Record<string, string> = {
    Academic: 'Academic',
    Deeniyath: 'Deeniyath',
    All: 'All subjects',
};

/** Segmented choice that wraps on small screens. */
export function Choice<T extends string>({ value, onChange, options, label }: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string }[];
    label: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`min-h-[44px] px-4 rounded-lg border text-sm font-medium ${value === o.value
                        ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
