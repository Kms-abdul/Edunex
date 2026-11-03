import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Badge, Button, DataList, Field } from '../ui';
import type { Column } from '../ui';

/**
 * Staff search + list used by "Find staff" (StaffDirectory) and the staff master / update lists.
 * The parent owns all the filter state and the API call; this only lays it out:
 * a search box that is always visible, extra filters behind "More filters" on phones,
 * and the results as cards on phones / a table on desktop.
 */

export interface StaffRow {
    id: number;
    staff_code: string;
    employee_id: string | null;
    first_name: string;
    display_name: string;
    department_name: string | null;
    designation_name: string | null;
    staff_category_name: string | null;
    staff_status_name: string | null;
    employment_type: string;
    employment_status: string;
    mobile: string | null;
    email: string | null;
    branch_name?: string | null;
    school_name?: string | null;
}

export interface StaffFilters {
    branchId: string; setBranchId: (v: string) => void;
    deptId: string; setDeptId: (v: string) => void;
    status: string; setStatus: (v: string) => void;
    searchBy: string; setSearchBy: (v: string) => void;
    query: string; setQuery: (v: string) => void;
}

const SEARCH_BY: Array<{ value: string; label: string; placeholder: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }> = [
    { value: 'first_name', label: 'Name', placeholder: 'Type the name' },
    { value: 'staff_code', label: 'Staff code', placeholder: 'Type the staff code' },
    { value: 'employee_id', label: 'Employee ID', placeholder: 'Type the employee ID' },
    { value: 'biometric_id', label: 'Attendance machine ID', placeholder: 'Type the machine ID' },
    { value: 'mobile', label: 'Mobile number', placeholder: 'Type the mobile number', inputMode: 'tel' },
    { value: 'email', label: 'Email', placeholder: 'Type the email', inputMode: 'email' },
];

const statusTone = (s: string) => {
    const v = s.toUpperCase();
    if (v === 'ACTIVE') return 'success' as const;
    if (/PROBATION|NOTICE/.test(v)) return 'warning' as const;
    if (/SUSPEND|TERMINAT|RESIGN|INACTIVE/.test(v)) return 'danger' as const;
    return 'neutral' as const;
};

const plainType = (t?: string | null) => {
    if (!t) return '—';
    const s = t.toLowerCase().replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const StaffListView: React.FC<{
    rows: StaffRow[];
    loading: boolean;
    filters: StaffFilters;
    onSearch: () => void;
    departments: Array<{ id: number; label: string }>;
    branches: Array<{ branch_id: number; branch_name: string }>;
    showBranchFilter: boolean;
    showSchool?: boolean;
    onRowClick?: (row: StaffRow) => void;
    actions?: (row: StaffRow) => React.ReactNode;
    emptyHint?: React.ReactNode;
}> = ({ rows, loading, filters, onSearch, departments, branches, showBranchFilter, showSchool, onRowClick, actions, emptyHint }) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const by = SEARCH_BY.find(o => o.value === filters.searchBy) || SEARCH_BY[0];

    const activeFilters = [
        filters.branchId && branches.find(b => String(b.branch_id) === String(filters.branchId))?.branch_name,
        filters.deptId && departments.find(d => String(d.id) === String(filters.deptId))?.label,
        filters.status === 'ACTIVE' ? 'Active only' : filters.status === 'INACTIVE' ? 'Inactive only' : '',
    ].filter(Boolean) as string[];

    const columns: Column<StaffRow>[] = [
        {
            key: 'name', header: 'Staff member', primary: true, render: st => (
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-sm">{st.first_name?.[0] ?? '?'}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-900 break-words">{st.display_name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                            {st.staff_code}{st.employee_id ? ` · ID ${st.employee_id}` : ''}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'job', header: 'Job', secondary: true, render: st => (
                <span>{[st.designation_name, st.department_name].filter(Boolean).join(' · ') || '—'}</span>
            ),
        },
        {
            key: 'status', header: 'Status', render: st => {
                const s = st.staff_status_name ?? st.employment_status;
                return <Badge tone={statusTone(s || '')}>{s ? plainType(s) : '—'}</Badge>;
            },
        },
        { key: 'staff_category_name', header: 'Staff type', render: st => st.staff_category_name ?? '—' },
        { key: 'employment_type', header: 'Type of job', hideOnMobile: true, render: st => plainType(st.employment_type) },
        ...(showSchool ? [{
            key: 'school', header: 'School and branch', render: (st: StaffRow) => (
                <span>{[st.school_name, st.branch_name].filter(Boolean).join(' · ') || '—'}</span>
            ),
        }] : []),
        {
            key: 'mobile', header: 'Mobile', render: st => st.mobile
                ? <a href={`tel:${st.mobile.replace(/[^\d+]/g, '')}`} onClick={e => e.stopPropagation()} className="text-brand-700 hover:underline">{st.mobile}</a>
                : '—',
        },
        ...(actions ? [{
            key: 'actions', header: '', align: 'right' as const, hideOnMobile: true,
            render: (st: StaffRow) => <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>{actions(st)}</div>,
        }] : []),
    ];

    return (
        <div className="space-y-4">
            <form
                className="card p-4 space-y-3"
                onSubmit={e => { e.preventDefault(); onSearch(); }}
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                    <Field label="Search by" htmlFor="staff-search-by">
                        <select id="staff-search-by" className="input" value={filters.searchBy} onChange={e => filters.setSearchBy(e.target.value)}>
                            {SEARCH_BY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label={by.label} htmlFor="staff-search-q">
                        <input
                            id="staff-search-q"
                            type="search"
                            inputMode={by.inputMode}
                            placeholder={by.placeholder}
                            className="input"
                            value={filters.query}
                            onChange={e => filters.setQuery(e.target.value)}
                        />
                    </Field>
                    <Button type="submit" icon={<Search className="w-4 h-4" />} loading={loading} className="w-full sm:w-auto">
                        Search
                    </Button>
                </div>

                <button
                    type="button"
                    onClick={() => setMoreOpen(o => !o)}
                    className="sm:hidden btn-ghost btn-sm w-full"
                    aria-expanded={moreOpen}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    {moreOpen ? 'Hide filters' : activeFilters.length ? `Change filters (${activeFilters.length})` : 'More filters'}
                </button>

                <div className={`${moreOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 gap-3 sm:grid-cols-3`}>
                    {showBranchFilter && (
                        <Field label="Branch">
                            <select className="input" value={filters.branchId} onChange={e => filters.setBranchId(e.target.value)}>
                                <option value="">All branches</option>
                                {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                            </select>
                        </Field>
                    )}
                    <Field label="Department">
                        <select className="input" value={filters.deptId} onChange={e => filters.setDeptId(e.target.value)}>
                            <option value="">All departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Status">
                        <select className="input" value={filters.status} onChange={e => filters.setStatus(e.target.value)}>
                            <option value="">All</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </Field>
                </div>
            </form>

            <p className="text-sm text-slate-600">
                {loading
                    ? 'Loading…'
                    : <>Showing <span className="font-semibold text-slate-900">{rows.length}</span> staff member{rows.length !== 1 ? 's' : ''}{activeFilters.length ? ` · ${activeFilters.join(' · ')}` : ''}</>}
            </p>

            <DataList
                columns={columns}
                rows={rows}
                rowKey={st => st.id}
                loading={loading}
                onRowClick={onRowClick}
                emptyTitle="No staff found"
                emptyHint={emptyHint}
                mobileActions={actions ? st => actions(st) : undefined}
            />
        </div>
    );
};

export default StaffListView;
