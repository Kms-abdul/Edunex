import React from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '../ui';

/**
 * Small building blocks shared by the HR setup lists (departments, designations,
 * shifts, staff types, statuses, devices, document types).
 */

/** Shown when "All schools" is chosen at the top and the list needs one school. */
export const NeedSchool: React.FC<{ what: string }> = ({ what }) => (
    <div className="card p-6 text-center">
        <p className="text-base font-semibold text-slate-900">Choose a school first</p>
        <p className="mt-1 text-sm text-slate-500">
            Pick one school at the top of the screen to see and change {what}.
        </p>
    </div>
);

/** Intro line saying what the list is for, plus the "Add <thing>" button. */
export const MasterTop: React.FC<{
    intro: React.ReactNode;
    addLabel?: string;
    onAdd?: () => void;
    count?: number;
    countLabel?: string;
}> = ({ intro, addLabel, onAdd, count, countLabel }) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
            <p className="text-sm text-slate-600">{intro}</p>
            {typeof count === 'number' && (
                <p className="mt-0.5 text-xs text-slate-500">{count} {countLabel || 'saved'}</p>
            )}
        </div>
        {onAdd && addLabel && (
            <Button icon={<Plus className="w-4 h-4" />} onClick={onAdd} className="w-full sm:w-auto">
                {addLabel}
            </Button>
        )}
    </div>
);

/**
 * One-column (two on wider screens) add / edit form inside a card,
 * with a plain title and a clear "Save <thing>" button.
 */
export const FormCard: React.FC<{
    id?: string;
    title: string;
    hint?: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    saveLabel: string;
    saving?: boolean;
    children: React.ReactNode;
}> = ({ id, title, hint, onSubmit, onCancel, saveLabel, saving, children }) => (
    <form id={id} onSubmit={onSubmit} className="card scroll-mt-4">
        <div className="card-header">
            <div>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
            </div>
        </div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{saveLabel}</Button>
        </div>
    </form>
);

/** Row "Edit" button, big enough to tap. Clicks don't bubble to the row. */
export const EditButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Edit' }) => (
    <Button
        variant="soft"
        size="sm"
        icon={<Pencil className="w-3.5 h-3.5" />}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
        {label}
    </Button>
);

/** A tap-friendly yes/no checkbox row with an optional plain explanation. */
export const CheckRow: React.FC<{
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
        <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-800">{label}</span>
            {hint && <span className="block text-xs text-slate-500">{hint}</span>}
        </span>
    </label>
);

/** Bring the add / edit form into view (the app scrolls inside the main panel, not the window). */
export const scrollToForm = (id: string) => {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
};

/** "ACTIVE" → "Active", "NOTICE_PERIOD" → "Notice period". */
export const plain = (v?: string | null) => {
    if (!v) return '—';
    const s = String(v).replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};
