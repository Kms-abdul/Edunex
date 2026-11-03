import React, { useMemo } from 'react';
import { Check, CheckCircle2, Search } from 'lucide-react';
import { EmptyState, LoadingState } from '../ui';

/** Page frame shared by the student jobs (change section, promote, …). */
export const JobPage: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
    <div className="p-4 sm:p-6 bg-surface-muted min-h-full">
        <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto space-y-4`}>{children}</div>
    </div>
);

/** One short line that says what this job is for. */
export const JobIntro: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-sm text-slate-600">{children}</p>
);

/** Small "what you chose" card shown at the top of later steps, with a Change button. */
export const ChoiceSummary: React.FC<{ title: React.ReactNode; detail?: React.ReactNode; onChange?: () => void; changeLabel?: string }> = ({
    title, detail, onChange, changeLabel = 'Change',
}) => (
    <div className="card">
        <div className="card-body flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 break-words">{title}</p>
                {detail && <p className="text-sm text-slate-600 break-words">{detail}</p>}
            </div>
            {onChange && (
                <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={onChange}>
                    {changeLabel}
                </button>
            )}
        </div>
    </div>
);

/** Big success panel at the end of a job. */
export const DoneCard: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
    <div className="card">
        <div className="card-body flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-9 h-9" />
            </div>
            <p className="text-xl font-semibold text-slate-900">{title}</p>
            {children && <div className="mt-1 text-slate-600 space-y-1">{children}</div>}
        </div>
    </div>
);

export interface PickItem {
    id: number;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Shown on the right, e.g. dues */
    aside?: React.ReactNode;
    /** When set, the student cannot be picked and this says why */
    blockedReason?: string;
}

/**
 * Tap-to-pick list of students with "Select all" and a search box.
 * Works the same on phones and desktop (each row is a 44px+ tap target).
 */
export const StudentPickList: React.FC<{
    items: PickItem[];
    selected: number[];
    onChange: (ids: number[]) => void;
    loading?: boolean;
    search?: string;
    onSearch?: (v: string) => void;
    searchPlaceholder?: string;
    emptyTitle?: string;
    emptyHint?: React.ReactNode;
    onBlockedTap?: (item: PickItem) => void;
}> = ({ items, selected, onChange, loading, search, onSearch, searchPlaceholder = 'Search by name or admission number', emptyTitle = 'No students found', emptyHint, onBlockedTap }) => {
    const pickable = useMemo(() => items.filter(i => !i.blockedReason), [items]);
    const allPicked = pickable.length > 0 && pickable.every(i => selected.includes(i.id));

    const toggle = (item: PickItem) => {
        if (item.blockedReason) { onBlockedTap?.(item); return; }
        onChange(selected.includes(item.id) ? selected.filter(i => i !== item.id) : [...selected, item.id]);
    };

    return (
        <div className="card overflow-hidden">
            <div className="card-body space-y-3 border-b border-slate-100">
                {onSearch && (
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search || ''}
                            onChange={e => onSearch(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="input pl-9"
                            aria-label="Search students"
                        />
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-600">
                        <b className="text-slate-900">{selected.length}</b> chosen
                        {items.length > 0 && <> of {items.length}</>}
                    </p>
                    {pickable.length > 0 && (
                        <button
                            type="button"
                            className="btn-secondary btn-sm min-h-[44px] sm:min-h-0"
                            onClick={() => onChange(allPicked ? [] : pickable.map(i => i.id))}
                        >
                            {allPicked ? 'Clear all' : `Choose all ${pickable.length}`}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <LoadingState label="Loading students…" />
            ) : items.length === 0 ? (
                <EmptyState compact title={emptyTitle} description={emptyHint} />
            ) : (
                <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                    {items.map(item => {
                        const on = selected.includes(item.id);
                        const blocked = !!item.blockedReason;
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    aria-disabled={blocked || undefined}
                                    onClick={() => toggle(item)}
                                    className={`w-full min-h-[56px] flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                        ${blocked ? 'bg-slate-50 cursor-not-allowed' : on ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                                >
                                    <span
                                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0
                                            ${blocked ? 'border-slate-200 bg-slate-100' : on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}
                                    >
                                        {on && <Check className="w-4 h-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={`block font-medium break-words ${blocked ? 'text-slate-500' : 'text-slate-900'}`}>{item.title}</span>
                                        {item.subtitle && <span className="block text-sm text-slate-500 break-words">{item.subtitle}</span>}
                                        {blocked && <span className="block text-sm text-red-600">{item.blockedReason}</span>}
                                    </span>
                                    {item.aside && <span className="flex-shrink-0 text-sm text-right">{item.aside}</span>}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

/** "Ayesha, Rahul, Sana and 20 more" */
export const namesPreview = (names: string[], max = 3) => {
    const clean = names.filter(Boolean);
    if (clean.length <= max) return clean.join(', ');
    return `${clean.slice(0, max).join(', ')} and ${clean.length - max} more`;
};

/** "1 student" / "23 students" */
export const studentsCount = (n: number) => `${n} student${n === 1 ? '' : 's'}`;
