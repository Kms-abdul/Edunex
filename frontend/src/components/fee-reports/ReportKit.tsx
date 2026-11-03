import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui';

/* Shared building blocks for the fee report screens. Display only — no data logic. */

export const rupees = (n: number | string | null | undefined) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** "1 Nov 2026" from "2026-11-01" (falls back to the input). */
export const niceDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(`${String(iso).split('T')[0]}T00:00:00`);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Current branch for summary lines, or '' when all branches are shown. */
export const currentBranchLabel = () => {
    try {
        const b = localStorage.getItem('currentBranch') || '';
        return b && b !== 'All' && b !== 'All Branches' ? b : '';
    } catch {
        return '';
    }
};

/** Joins the parts of a summary line that are set, e.g. "Class 5 · Cash · Tolichowki". */
export const joinSummary = (...parts: (string | false | null | undefined)[]) =>
    parts.filter(p => p && p !== 'All').join(' · ');

/* ------------------------------------------------------------------ Filters */

export const SelectField: React.FC<{
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
    className?: string;
}> = ({ id, label, value, onChange, options, disabled, className = '' }) => (
    <div className={className}>
        <label htmlFor={id} className="block text-sm font-medium text-slate-800 mb-1.5">{label}</label>
        <select id={id} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="input min-h-[44px]">
            {options.map((o, i) => <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);

/**
 * Filter card at the top of a report.
 * On phones, once results are shown the filters fold away behind a "Change filters" button
 * and only a one-line summary of what is shown stays visible.
 */
export const FilterCard: React.FC<{
    summary?: React.ReactNode;
    hasResults?: boolean;
    onApply?: () => void;
    applyLabel?: string;
    applying?: boolean;
    applyDisabled?: boolean;
    applyNote?: React.ReactNode;
    children: React.ReactNode;
}> = ({ summary, hasResults, onApply, applyLabel = 'Show report', applying, applyDisabled, applyNote, children }) => {
    const [open, setOpen] = useState(!hasResults);
    useEffect(() => { if (hasResults) setOpen(false); }, [hasResults]);
    const folded = !!hasResults && !open;

    return (
        <section className="card">
            {folded && (
                <div className="md:hidden flex items-center gap-3 p-4">
                    <p className="flex-1 min-w-0 text-sm text-slate-700 break-words">{summary}</p>
                    <button type="button" className="btn-secondary btn-sm min-h-[44px] flex-shrink-0" onClick={() => setOpen(true)}>
                        <SlidersHorizontal className="w-4 h-4" /> Change filters
                    </button>
                </div>
            )}
            <div className={`p-4 sm:p-5 ${folded ? 'hidden md:block' : ''}`}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Choose what to see</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    {onApply ? (
                        <Button
                            className="w-full sm:w-auto min-h-[44px]"
                            loading={applying}
                            disabled={applyDisabled}
                            onClick={() => { onApply(); setOpen(false); }}
                        >
                            {applyLabel}
                        </Button>
                    ) : hasResults ? (
                        <button type="button" className="md:hidden btn-secondary w-full min-h-[44px]" onClick={() => setOpen(false)}>Done</button>
                    ) : null}
                    {applyNote && <p className="text-sm text-slate-500">{applyNote}</p>}
                </div>
                {summary && hasResults && (
                    <p className="hidden md:block mt-4 pt-3 border-t border-slate-100 text-sm text-slate-600">
                        <span className="font-medium text-slate-800">Showing:</span> {summary}
                    </p>
                )}
            </div>
        </section>
    );
};

/* ------------------------------------------------------------------ Totals */

export const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
);

export const StatTile: React.FC<{
    label: string;
    value: React.ReactNode;
    money?: boolean;
    hint?: string;
    tone?: 'default' | 'good' | 'bad';
    className?: string;
}> = ({ label, value, money, hint, tone = 'default', className = '' }) => {
    const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
    return (
        <div className={`card p-4 min-w-0 ${className}`}>
            <p className="text-xs sm:text-sm text-slate-500">{label}</p>
            <p className={`mt-1 text-lg sm:text-2xl font-bold break-words ${color}`}>
                {money && (typeof value === 'number' || typeof value === 'string') ? rupees(value) : value}
            </p>
            {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
    );
};

/* ------------------------------------------------------------- Result bar */

export const ExportButtons: React.FC<{ onExcel: () => void; onPdf: () => void; disabled?: boolean }> = ({ onExcel, onPdf, disabled }) => (
    <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
        <button type="button" onClick={onExcel} disabled={disabled} className="btn-secondary btn-sm min-h-[44px] sm:min-h-0 text-emerald-700" title={disabled ? 'Nothing to download' : undefined}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>
        <button type="button" onClick={onPdf} disabled={disabled} className="btn-secondary btn-sm min-h-[44px] sm:min-h-0 text-red-700" title={disabled ? 'Nothing to download' : undefined}>
            <FileText className="w-4 h-4" /> PDF
        </button>
    </div>
);

/** Heading row above a result list: "Receipts (24)" + download buttons. */
export const ResultsBar: React.FC<{ title: string; count?: number; children?: React.ReactNode }> = ({ title, count, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">
            {title}{typeof count === 'number' && <span className="ml-1 font-normal text-slate-500">({count})</span>}
        </h3>
        {children}
    </div>
);

/* -------------------------------------------------------------- Pagination */

export const Pager: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (p: number) => void;
    totalRecords: number;
    perPage: number;
}> = ({ currentPage, totalPages, onPageChange, totalRecords, perPage }) => {
    if (totalPages <= 1) return null;

    const visiblePages = 3;
    const startPage = Math.max(1, Math.min(currentPage, totalPages - visiblePages + 1));
    const endPage = Math.min(totalPages, startPage + visiblePages - 1);
    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
    const showLastPage = endPage < totalPages;
    const pageBtn = (p: number) => (
        <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={currentPage === p ? 'page' : undefined}
            className={`min-w-[44px] min-h-[44px] sm:min-h-[36px] sm:min-w-[36px] rounded-lg text-sm font-medium ${currentPage === p ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
            {p}
        </button>
    );

    return (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-slate-500">
                Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalRecords)} of {totalRecords}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
                <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="btn-ghost btn-sm min-h-[44px] sm:min-h-[36px]">
                    Previous
                </button>
                {pages.map(pageBtn)}
                {showLastPage && (
                    <>
                        <span className="px-1 text-sm text-slate-400">…</span>
                        {pageBtn(totalPages)}
                    </>
                )}
                <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="btn-ghost btn-sm min-h-[44px] sm:min-h-[36px]">
                    Next
                </button>
            </div>
        </div>
    );
};

/** A label/value pair for phone cards. */
export const CardField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
    <div className={`min-w-0 ${className}`}>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-slate-800 break-words">{children}</dd>
    </div>
);
