import React from 'react';
import { Field } from '../ui';

/* Shared, presentation-only helpers for the staff attendance pages. */

export interface MonthOption {
  value: string;
  label: string;
  firstDay: string;
  lastDay: string;
}

/** The last 12 months. Same date range values as before; only the label is simpler ("November 2026"). */
export const generateMonthOptions = (): MonthOption[] => {
  const options: MonthOption[] = [];
  const currentDate = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${d.toLocaleDateString('en-US', { month: 'long' })} ${year}`;

    const localFirstDayStr = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const localLastDayStr = new Date(lastDay.getTime() - (lastDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    options.push({ value, label, firstDay: localFirstDayStr, lastDay: localLastDayStr });
  }

  return options;
};

/** "08:52" or "08:52:00" -> "8:52 AM". Empty -> fallback. */
export const formatTime = (t: string | null | undefined, fallback = '—') => {
  if (!t) return fallback;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return t;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
};

/** "2026-11-03" -> "Tue, 3 Nov 2026" (local date, no timezone shift). */
export const formatDay = (dateStr: string) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'brand';

/** Plain words + tone for every attendance status the server sends. */
export const statusInfo = (status: string | null | undefined): { label: string; tone: Tone } => {
  const s = (status || '').toUpperCase();
  if (s === 'PRESENT') return { label: 'Present', tone: 'success' };
  if (s === 'HALF_DAY') return { label: 'Half day', tone: 'warning' };
  if (s === 'ABSENT') return { label: 'Absent', tone: 'danger' };
  if (s.includes('LEAVE')) return { label: 'Leave', tone: 'warning' };
  if (s === 'HOLIDAY') return { label: 'Holiday', tone: 'brand' };
  if (s === 'WEEK_OFF' || s === 'WEEKOFF') return { label: 'Week off', tone: 'neutral' };
  if (!s) return { label: 'No record', tone: 'neutral' };
  return { label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '), tone: 'neutral' };
};

/** Status shown in words (never colour alone). Adds a "Late" badge when late minutes > 0. */
export const AttendanceStatus: React.FC<{ status: string | null | undefined; lateMinutes?: number | null }> = ({ status, lateMinutes }) => {
  const { label, tone } = statusInfo(status);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`badge-${tone}`}>{label}</span>
      {!!lateMinutes && lateMinutes > 0 && (
        <span className="badge-warning">Late {lateMinutes} min</span>
      )}
    </span>
  );
};

/** One-column (on phones) filter card used by the attendance pages. */
export const AttendanceFilters: React.FC<{
  monthOptions: MonthOption[];
  selectedMonth: string;
  onMonthChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  branches: string[];
  branch: string;
  onBranchChange: (v: string) => void;
  employee: string;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  employeeDisabled?: boolean;
  status: string;
}> = ({ monthOptions, selectedMonth, onMonthChange, branches, branch, onBranchChange, employee, onFilterChange, employeeDisabled, status }) => (
  <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <Field label="Month" htmlFor="att-month">
      <select id="att-month" value={selectedMonth} onChange={onMonthChange} className="input min-h-[44px]">
        <option value="">Choose a month</option>
        {monthOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </Field>
    {branches.length > 1 && (
      <Field label="Branch" htmlFor="att-branch">
        <select id="att-branch" value={branch} onChange={e => onBranchChange(e.target.value)} className="input min-h-[44px]">
          <option value="">All branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </Field>
    )}
    <Field label="Find staff (optional)" htmlFor="att-employee">
      <input
        id="att-employee"
        type="search"
        name="employee"
        placeholder="Name or employee number"
        value={employee}
        onChange={onFilterChange}
        disabled={employeeDisabled}
        className={`input min-h-[44px] ${employeeDisabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
      />
    </Field>
    <Field label="Show" htmlFor="att-status">
      <select id="att-status" name="status" value={status} onChange={onFilterChange} className="input min-h-[44px]">
        <option value="ALL">Everyone</option>
        <option value="PRESENT">Present only</option>
        <option value="ABSENT">Absent only</option>
        <option value="HALF_DAY">Half day only</option>
      </select>
    </Field>
  </div>
);

/** Unique, sorted branch names from loaded rows (for the client-side branch filter). */
export const branchesOf = (rows: { branch_name?: string | null }[]) =>
  Array.from(new Set(rows.map(r => r.branch_name).filter((b): b is string => !!b && b !== '-'))).sort();
