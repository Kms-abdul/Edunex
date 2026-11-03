import React, { useState, useEffect } from 'react';
import { Page } from '../App';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { notify, confirmDialog } from './ui/feedback';
import { Alert, LoadingState, EmptyState, PageHeader } from './ui';

interface SmsCenterProps {
    navigateTo: (page: Page) => void;
}

type SmsTab = 'send' | 'reports' | 'events' | 'templates' | 'account';
type PermAction = 'read' | 'write' | 'append' | 'delete';

// Permission codes: must match erp-backend/permission_catalog.py
const PERM_SMS_SEND    = 'administration.sms.send-sms';
const PERM_SMS_REPORTS = 'administration.sms.reports';
const PERM_SMS_TEMPLATES = 'administration.sms.templates';
const PERM_SMS_EVENTS    = 'administration.sms.events';
const PERM_SMS_ACCOUNT          = 'administration.sms.provider-settings';  // Key 1: school box
const PERM_SMS_BRANCH_ACCOUNT   = 'administration.sms.branch-account';     // Key 2: branch box
const PERM_SMS_ACCOUNT_CHOICE   = 'administration.sms.account-choice';     // Key 3: account choice

// Each tab shows only if the user has its permission (same pattern as StaffProfile)
// permission can be one code, or a list (tab shows if the user has ANY of them)
const TAB_DEFS: { id: SmsTab; label: string; permission: string | string[]; action: PermAction }[] = [
    { id: 'send',    label: '📱 Send SMS',    permission: PERM_SMS_SEND,    action: 'read' },
        { id: 'reports', label: '📊 SMS Reports', permission: PERM_SMS_REPORTS, action: 'read' },
        { id: 'events',    label: '🗂 Events',    permission: PERM_SMS_EVENTS,    action: 'read' },
        { id: 'templates', label: '📝 Templates', permission: PERM_SMS_TEMPLATES, action: 'read' },
        { id: 'account',   label: '🔐 SMS Account',
      permission: [PERM_SMS_ACCOUNT, PERM_SMS_BRANCH_ACCOUNT, PERM_SMS_ACCOUNT_CHOICE], action: 'read' },
];

// ─── Shared helper ────────────────────────────────────────────────────────────
const ResultBar: React.FC<{ result: { sent: number; failed: number; skipped: number } | null }> = ({ result }) => {
    if (!result) return null;
    return (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex gap-4">
            <span>✅ Sent: <strong>{result.sent}</strong></span>
            <span>⏭ Skipped: <strong>{result.skipped}</strong></span>
            {result.failed > 0 && <span>❌ Failed: <strong>{result.failed}</strong></span>}
        </div>
    );
};

// ─── Tab 3: SMS Reports ───────────────────────────────────────────────────────
const SMS_TYPE_LABELS: Record<string, string> = {
    ABSENT:      '📋 Absent',
    GENERAL:     '📢 General',
    ATTENDANCE:  '📋 Attendance',
    FEE_RECEIPT: '💰 Fee Receipt',
    FEE_DUE:     '🔔 Fee Due',
};

const exportToExcel = (records: SmsReportRow[], fromDate: string, toDate: string) => {
    const headers = ['Sent At', 'SMS Type', 'Event', 'Student', 'Phone', 'Branch', 'Status', 'Reason'];
    const rows = records.map(r => [
        r.sent_at,
        SMS_TYPE_LABELS[r.sms_type] || r.sms_type,
        r.event_name || '—',
        r.student_name || '—',
        r.phone,
        r.branch_name || '—',
        r.status,
        r.reason || '—',
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sms_report_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

const STATUS_COLORS: Record<string, string> = {
    sent:    'badge-success',
    failed:  'badge-danger',
    skipped: 'badge-warning',
};

interface SmsReportRow {
    id: number;
    sms_type: string;
    event_name: string;
    phone: string;
    status: string;
    reason: string | null;
    sent_at: string;
    student_id: number | null;
    student_name: string;
    school_id: number | null;
    branch_id: number | null;
    branch_name: string;
}

interface SmsGrand {
    total: number; sent: number; failed: number; skipped: number; delivery_rate: number;
}

interface SmsSummaryEntry {
    total: number; sent: number; failed: number; skipped: number;
}

const SmsReportsTab: React.FC = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.slice(0, 8) + '01';

    const [fromDate, setFromDate]         = useState(firstOfMonth);
    const [toDate, setToDate]             = useState(today);
    const [smsType, setSmsType]           = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    const [branchOptions, setBranchOptions] = useState<{ id: number; branch_name: string }[]>([]);
    const [page, setPage]                 = useState(1);
    const [loading, setLoading]           = useState(false);

    const [grand, setGrand]     = useState<SmsGrand | null>(null);
    const [summary, setSummary] = useState<Record<string, SmsSummaryEntry>>({});
    const [daily, setDaily]     = useState<{ day: string; total: number; sent: number }[]>([]);
    const [records, setRecords] = useState<SmsReportRow[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages]     = useState(1);

    useEffect(() => {
        api.get('/branches').then(r => setBranchOptions(r.data.branches || []));
    }, []);

    const fetchReport = async (p = 1) => {
        setLoading(true);
        try {
            // Always send the currently active navbar branch so backend filters correctly
            const navBranchId = localStorage.getItem('currentBranchId') || '';
            const effectiveBranch = branchFilter || navBranchId;

            const params: any = { from_date: fromDate, to_date: toDate, page: p, per_page: 50 };
            if (smsType) params.sms_type = smsType;
            if (statusFilter) params.status = statusFilter;
            if (effectiveBranch) params.branch_id = effectiveBranch;
            const res = await api.get('/sms/reports', { params });
            const d = res.data;
            setGrand(d.grand);
            setSummary(d.summary || {});
            setDaily(d.daily || []);
            setRecords(d.records || []);
            setTotalRecords(d.total_records || 0);
            setTotalPages(d.total_pages || 1);
            setPage(p);
        } catch (e: any) {
            notify(`Failed to load report: ${e.response?.data?.error || e.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReport(1); }, []); // eslint-disable-line

    // Mini bar chart using pure divs
    const maxDaily = Math.max(...daily.map(d => d.total), 1);

    return (
        <div className="space-y-5">
            {/* ── Filters ── */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div>
                    <label className="label">From Date</label>
                    <input type="date" value={fromDate} max={toDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="input" />
                </div>
                <div>
                    <label className="label">To Date</label>
                    <input type="date" value={toDate} max={today} min={fromDate}
                        onChange={e => setToDate(e.target.value)}
                        className="input" />
                </div>
                <div>
                    <label className="label">Branch</label>
                    <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                        className="input">
                        <option value="">All Branches</option>
                        {branchOptions.map(b => (
                            <option key={b.id} value={b.id}>{b.branch_name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">SMS Type</label>
                    <select value={smsType} onChange={e => setSmsType(e.target.value)}
                        className="input">
                        <option value="">All Types</option>
                        {Object.entries(SMS_TYPE_LABELS).map(([code, label]) => (
                            <option key={code} value={code}>{label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="input">
                        <option value="">All Statuses</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                        <option value="skipped">Skipped</option>
                    </select>
                </div>
                <button onClick={() => fetchReport(1)} disabled={loading}
                    className="btn-primary">
                    {loading ? 'Loading…' : '🔍 Run Report'}
                </button>
            </div>

            {grand && (
                <>
                    {/* ── Grand KPI Cards ── */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Total Sent',      value: grand.total,         bg: 'bg-slate-800',   text: 'text-white' },
                            { label: '✅ Delivered',    value: grand.sent,          bg: 'bg-emerald-600', text: 'text-white' },
                            { label: '❌ Failed',       value: grand.failed,        bg: 'bg-red-500',     text: 'text-white' },
                            { label: '⏭ Skipped',      value: grand.skipped,       bg: 'bg-amber-400',   text: 'text-white' },
                            { label: '📈 Delivery Rate', value: `${grand.delivery_rate}%`, bg: 'bg-brand-600', text: 'text-white' },
                        ].map(c => (
                            <div key={c.label} className={`${c.bg} rounded-xl p-4 flex flex-col items-center justify-center shadow-sm`}>
                                <span className={`text-2xl font-bold ${c.text}`}>{c.value}</span>
                                <span className={`text-xs mt-1 opacity-80 ${c.text}`}>{c.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Per-Type Breakdown ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(SMS_TYPE_LABELS).map(([type, label]) => {
                            const s = summary[type];
                            if (!s) return null;
                            const rate = s.total ? Math.round(s.sent / s.total * 100) : 0;
                            return (
                                <div key={type} className="card p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-semibold text-slate-700">{label}</span>
                                        <span className="badge-neutral font-mono">
                                            {s.total} msgs
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                                        <div className="bg-emerald-500 h-2 rounded-full transition-all"
                                             style={{ width: `${rate}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="text-emerald-600 font-medium">✅ {s.sent}</span>
                                        <span className="text-red-500 font-medium">❌ {s.failed}</span>
                                        <span className="text-amber-500 font-medium">⏭ {s.skipped}</span>
                                        <span className="text-brand-600 font-bold">{rate}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Daily Activity Bar Chart ── */}
                    {daily.length > 0 && (
                        <div className="card p-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-4">Daily SMS Activity</h4>
                            <div className="flex items-end gap-1 h-20 overflow-x-auto">
                                {daily.map(d => {
                                    const heightPct = Math.round((d.total / maxDaily) * 100);
                                    const sentPct   = d.total ? Math.round((d.sent  / d.total) * 100) : 0;
                                    return (
                                        <div key={d.day} className="flex flex-col items-center flex-shrink-0 group relative" style={{ minWidth: '28px' }}>
                                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                {d.day}<br />Total: {d.total} | Sent: {d.sent}
                                            </div>
                                            <div className="w-5 rounded-t overflow-hidden flex flex-col-reverse"
                                                 style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: '4px' }}>
                                                <div className="bg-emerald-500" style={{ height: `${sentPct}%` }} />
                                                <div className="bg-slate-300 flex-1" />
                                            </div>
                                            <span className="text-slate-400 mt-1" style={{ fontSize: '9px' }}>
                                                {d.day.slice(8)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 inline-block rounded" /> Delivered</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-slate-300 inline-block rounded" /> Other</span>
                            </div>
                        </div>
                    )}

                    {/* ── Detail Table ── */}
                    <div className="card overflow-hidden">
                        <div className="card-header bg-slate-50">
                            <span className="text-sm font-semibold text-slate-700">
                                SMS Log &nbsp;
                                <span className="text-slate-400 font-normal">({totalRecords.toLocaleString()} records)</span>
                            </span>
                            <div className="flex items-center gap-3">
                            <button
                                onClick={() => exportToExcel(records, fromDate, toDate)}
                                disabled={records.length === 0}
                                className="btn-success btn-sm">
                                ⬇ Export Excel
                            </button>
                            <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
                        </div>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                            <table className="min-w-full text-sm divide-y divide-slate-100">
                                <thead className="sticky top-0">
                                    <tr>
                                                                                {['Sent At', 'Type', 'Event', 'Student', 'Phone', 'Branch', 'Status', 'Reason'].map(h => (
                                            <th key={h} className="px-3 py-2.5 text-left">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {records.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.sent_at}</td>
                                            <td className="px-3 py-2">
                                                <span className="badge-neutral">
                                                    {SMS_TYPE_LABELS[r.sms_type] || r.sms_type}
                                                </span>
                                            </td>
                                                                                        <td className="px-3 py-2 text-xs text-slate-700">{r.event_name || '—'}</td>
                                            <td className="px-3 py-2 text-sm font-medium text-slate-800">
                                                {r.student_name || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-xs font-mono text-slate-600">{r.phone}</td>
                                            <td className="px-3 py-2 text-xs text-slate-500">{r.branch_name || '—'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`${STATUS_COLORS[r.status] || 'badge-neutral'}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-slate-400 max-w-xs truncate">
                                                {r.reason || <span className="text-slate-200">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {records.length === 0 && (
                                        <tr>
                                            <td colSpan={8}>
                                                <EmptyState compact title="No SMS records found for this period." />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                                <button onClick={() => fetchReport(page - 1)} disabled={page <= 1 || loading}
                                    className="btn-secondary btn-sm">
                                    ← Prev
                                </button>
                                <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                                <button onClick={() => fetchReport(page + 1)} disabled={page >= totalPages || loading}
                                    className="btn-secondary btn-sm">
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!grand && !loading && (
                <div className="card">
                    <EmptyState title="No report yet" description={<>Select a date range and click <strong>Run Report</strong></>} />
                </div>
            )}
        </div>
    );
};

// ─── Templates tab ────────────────────────────────────────────────────────────
interface TemplateEventOption {
    id: number; name: string; event_type: string; type_label: string;
    is_common: boolean; applies_to: string; variables: string[];
}
interface SmsTemplateRow {
    id: number; event_id: number; event_name: string; event_type: string; event_active: boolean;
    variables: string[]; is_common: boolean; applies_to: string;
    name: string; body: string; dlt_template_id: string | null; sender_id: string | null;
    recipient: string; is_default: boolean; is_active: boolean; in_use: boolean;
    updated_at: string | null; updated_by: string | null;
}
interface SmsTemplatesPayload {
    school_name: string; branch: { id: number; name: string } | null;
    can_create_common: boolean; can_create_branch: boolean;
    events: TemplateEventOption[]; templates: SmsTemplateRow[];
}
interface TemplateHistoryItem {
    when: string; user: string; action: string;
    changes: Record<string, { from: any; to: any }>;
}

const RECIPIENT_OPTIONS = [
    { value: 'FATHER',   label: "Father's phone" },
    { value: 'MOTHER',   label: "Mother's phone" },
    { value: 'SMS_NO',   label: 'SMS number' },
    { value: 'GUARDIAN', label: "Guardian's phone" },
];
const RECIPIENT_LABEL: Record<string, string> = Object.fromEntries(RECIPIENT_OPTIONS.map(o => [o.value, o.label]));

// Sample values used only for the live preview
const SAMPLE_VALUES: Record<string, string> = {
    student_name: 'Ali Khan', first_name: 'Ali', admission_no: 'MSAM0001',
    class: '1', section: 'A', date: '9-oct-2026', school_name: 'Your School',
    branch_name: 'Main Branch', due_amount: '5000', cutoff_date: '10-oct-2026',
    paid_amount: '1000', total_amount: '2080', balance: '1080',
};

const HISTORY_FIELD_LABEL: Record<string, string> = {
    name: 'Name', body: 'Message', dlt_template_id: 'DLT ID', sender_id: 'Sender ID',
    recipient: 'Recipient', is_default: 'Default', is_active: 'Active',
};

// Approximate SMS length / parts (Unicode messages use 70 chars per part)
const smsParts = (text: string) => {
    const unicode = /[^\x00-\x7F]/.test(text);
    const single = unicode ? 70 : 160;
    const multi  = unicode ? 67 : 153;
    const len = text.length;
    const parts = len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / multi);
    return { len, parts, unicode };
};

const EMPTY_TEMPLATE_FORM = {
    event_id: 0, is_common: true, name: '', body: '', dlt_template_id: '', sender_id: '',
    recipient: 'FATHER', is_default: false, is_active: true,
};

const TemplatesTab: React.FC = () => {
    const { hasPermission } = useAuth();
    const canEdit   = hasPermission(PERM_SMS_TEMPLATES, 'write');
    const canToggle = hasPermission(PERM_SMS_TEMPLATES, 'delete');

    const [data, setData]                 = useState<SmsTemplatesPayload | null>(null);
    const [eventFilter, setEventFilter]   = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');

    const [showForm, setShowForm]   = useState(false);
    const [editing, setEditing]     = useState<SmsTemplateRow | null>(null);
    const [form, setForm]           = useState({ ...EMPTY_TEMPLATE_FORM });
    const [saving, setSaving]       = useState(false);
    const [formError, setFormError] = useState('');
    const bodyRef = React.useRef<HTMLTextAreaElement>(null);

    const [historyFor, setHistoryFor] = useState<SmsTemplateRow | null>(null);
    const [history, setHistory]       = useState<TemplateHistoryItem[]>([]);

    const events        = data?.events || [];
    const selectedEvent = events.find(e => e.id === form.event_id);
    const variables     = editing ? editing.variables : (selectedEvent?.variables || []);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const params: any = { status: statusFilter };
            if (eventFilter) params.event_id = eventFilter;
            const res = await api.get('/sms/templates', { params });
            setData(res.data);
        } catch (e: any) {
            setData(null);
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, [eventFilter, statusFilter]); // eslint-disable-line

    // Common event → common template if the user may; branch-only event → branch template
    const defaultScopeFor = (ev?: TemplateEventOption) =>
        ev ? (ev.is_common ? !!data?.can_create_common : false) : !!data?.can_create_common;

    const openNew = () => {
        const ev = events.find(e => String(e.id) === eventFilter) || events[0];
        setEditing(null);
        setForm({ ...EMPTY_TEMPLATE_FORM, event_id: ev?.id || 0, is_common: defaultScopeFor(ev) });
        setFormError('');
        setShowForm(true);
    };

    const changeEvent = (id: number) => {
        const ev = events.find(e => e.id === id);
        setForm(f => ({ ...f, event_id: id, is_common: defaultScopeFor(ev) }));
    };

    const openEdit = (t: SmsTemplateRow) => {
        setEditing(t);
        setForm({
            event_id: t.event_id, is_common: t.is_common, name: t.name, body: t.body,
            dlt_template_id: t.dlt_template_id || '', sender_id: t.sender_id || '',
            recipient: t.recipient || 'FATHER', is_default: t.is_default, is_active: t.is_active,
        });
        setFormError('');
        setShowForm(true);
    };

    // Insert {variable} at the cursor position in the message box
    const insertVariable = (v: string) => {
        const token = `{${v}}`;
        const el = bodyRef.current;
        const start = el?.selectionStart ?? form.body.length;
        const end   = el?.selectionEnd ?? form.body.length;
        const next  = form.body.slice(0, start) + token + form.body.slice(end);
        setForm(f => ({ ...f, body: next }));
        requestAnimationFrame(() => {
            if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }
        });
    };

    const usedVars    = Array.from(new Set((form.body.match(/\{(\w+)\}/g) || []).map(m => m.slice(1, -1))));
    const unknownVars = usedVars.filter(v => !variables.includes(v));
    const sample: Record<string, string> = { ...SAMPLE_VALUES, school_name: data?.school_name || SAMPLE_VALUES.school_name };
    const preview     = form.body.replace(/\{(\w+)\}/g, (_m: string, k: string) => sample[k] ?? `[${k}]`);
    const stats       = smsParts(preview);

    const handleSave = async () => {
        setFormError('');
        if (!form.event_id)    { setFormError('Please choose an event.'); return; }
        if (!form.name.trim()) { setFormError('Template name is required.'); return; }
        if (!form.body.trim()) { setFormError('Message text is required.'); return; }
        if (unknownVars.length) {
            setFormError(`Remove unknown variables: ${unknownVars.map(v => `{${v}}`).join(', ')}`);
            return;
        }
        if (!editing && !form.is_common && !data?.branch) {
            setFormError('Select a branch in the top bar to create a branch-only template.');
            return;
        }
        setSaving(true);
        try {
            if (editing) await api.put(`/sms/templates/${editing.id}`, form);
            else         await api.post('/sms/templates', form);
            setShowForm(false);
            await load();
        } catch (e: any) {
            setFormError(e.response?.data?.error || e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (t: SmsTemplateRow) => {
        const action = t.is_active ? 'Deactivate' : 'Activate';
        if (!await confirmDialog(`${action} template "${t.name}"?`)) return;
        try {
            await api.patch(`/sms/templates/${t.id}/active`, { is_active: !t.is_active });
            await load();
        } catch (e: any) {
            notify(e.response?.data?.error || e.message);
        }
    };

    const openHistory = async (t: SmsTemplateRow) => {
        setHistoryFor(t);
        setHistory([]);
        try {
            const res = await api.get(`/sms/templates/${t.id}/history`);
            setHistory(res.data || []);
        } catch (e: any) {
            notify(e.response?.data?.error || e.message);
            setHistoryFor(null);
        }
    };

    const inputCls = 'input disabled:bg-slate-100';

    // ── Editor view ──────────────────────────────────────────────────────────
    if (showForm) {
        const commonDisabled = !!editing || !data?.can_create_common || (!!selectedEvent && !selectedEvent.is_common);
        const branchDisabled = !!editing || !data?.can_create_branch;
        const branchLabel = editing && !editing.is_common
            ? `Only ${editing.applies_to}`
            : data?.branch ? `Only ${data.branch.name}` : 'Only one branch (select it in the top bar)';

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">
                        {editing ? `Edit template: ${editing.name}` : 'New template'}
                    </h3>
                    <button onClick={() => setShowForm(false)}
                        className="btn-secondary btn-sm">
                        ← Back to list
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: form */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Event</label>
                                <select value={form.event_id} disabled={!!editing}
                                    onChange={e => changeEvent(Number(e.target.value))} className={inputCls}>
                                    {editing && <option value={editing.event_id}>{editing.event_name}</option>}
                                    {!editing && events.map(ev => (
                                        <option key={ev.id} value={ev.id}>
                                            {ev.name} · {ev.type_label}{ev.is_common ? '' : ` (${ev.applies_to})`}
                                        </option>
                                    ))}
                                </select>
                                {editing && <p className="text-xs text-slate-400 mt-1">Event can't be changed after creation.</p>}
                            </div>
                            <div>
                                <label className="label">Template name</label>
                                <input value={form.name} maxLength={150} placeholder="e.g. Absent – English"
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                            </div>
                        </div>

                        <div>
                            <label className="label">Applies to</label>
                            <div className="flex flex-wrap gap-5">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="radio" name="tpl-scope" checked={form.is_common} disabled={commonDisabled}
                                        onChange={() => setForm(f => ({ ...f, is_common: true }))} className="h-4 w-4 accent-brand-600" />
                                    Common for all branches
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="radio" name="tpl-scope" checked={!form.is_common} disabled={branchDisabled}
                                        onChange={() => setForm(f => ({ ...f, is_common: false }))} className="h-4 w-4 accent-brand-600" />
                                    {branchLabel}
                                </label>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {editing ? "\"Applies to\" can't be changed after creation."
                                         : 'A branch template is used instead of the common one for that branch.'}
                            </p>
                        </div>

                        <div>
                            <label className="label">
                                Variables <span className="text-slate-400 font-normal">(click to insert)</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {variables.map(v => (
                                    <button key={v} type="button" onClick={() => insertVariable(v)}
                                        className="px-2 py-1 text-xs font-mono rounded-md bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100">
                                        {`{${v}}`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="label">Message</label>
                            <textarea ref={bodyRef} rows={5} maxLength={1000} value={form.body}
                                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                                placeholder="Dear Parent, your ward {student_name} was absent on {date}..."
                                className={`${inputCls} font-mono`} />
                            {unknownVars.length > 0 && (
                                <p className="text-xs text-red-600 mt-1">
                                    Not allowed for this event: {unknownVars.map(v => `{${v}}`).join(', ')}
                                </p>
                            )}
                            <p className="text-xs text-amber-700 mt-1">
                                ⚠ The text must match your DLT-approved template exactly, or the operator will reject the SMS.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="label">Send to</label>
                                <select value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} className={inputCls}>
                                    {RECIPIENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label">DLT Template ID</label>
                                <input value={form.dlt_template_id} inputMode="numeric" placeholder="Digits only"
                                    onChange={e => setForm(f => ({ ...f, dlt_template_id: e.target.value.replace(/\D/g, '') }))}
                                    className={inputCls} />
                            </div>
                            <div>
                                <label className="label">Sender ID</label>
                                <input value={form.sender_id} maxLength={20} placeholder="Blank = account default"
                                    onChange={e => setForm(f => ({ ...f, sender_id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                    className={inputCls} />
                            </div>
                        </div>

                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.is_default} className="h-4 w-4 accent-brand-600"
                                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                                Default for this event
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" checked={form.is_active} className="h-4 w-4 accent-brand-600"
                                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                                Active
                            </label>
                        </div>

                        {formError && <Alert tone="error">{formError}</Alert>}

                        <div className="flex gap-3">
                            <button onClick={handleSave} disabled={saving}
                                className="btn-primary">
                                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
                            </button>
                            <button onClick={() => setShowForm(false)}
                                className="btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>

                    {/* Right: live preview */}
                    <div>
                        <label className="label">Preview (sample data)</label>
                        <div className="rounded-2xl bg-slate-100 p-4 min-h-[160px]">
                            <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 text-sm text-slate-800 whitespace-pre-wrap break-words">
                                {preview || <span className="text-slate-300">Your message will appear here…</span>}
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>{stats.len} characters{stats.unicode ? ' (Unicode)' : ''}</span>
                            <span className={stats.parts > 1 ? 'text-amber-600 font-medium' : ''}>
                                ≈ {stats.parts} SMS {stats.parts === 1 ? 'credit' : 'credits'} per recipient
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Extra fields show as [field_name]. Real values can make the message longer.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── List view ────────────────────────────────────────────────────────────
    const canCreate = !!data && (data.can_create_common || data.can_create_branch) && events.length > 0;
    const rows = data?.templates || [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="label">Event</label>
                    <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
                        className="input w-auto">
                        <option value="">All events</option>
                        {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="input w-auto">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="all">All</option>
                    </select>
                </div>
                {data && (
                    <span className="text-sm text-slate-500 pb-2">
                        {data.school_name}{data.branch ? ` › ${data.branch.name}` : ' › All branches'}
                    </span>
                )}
                <div className="flex-1" />
                <button onClick={load} disabled={loading}
                    className="btn-secondary btn-sm">
                    ↻ Refresh
                </button>
                {canCreate && (
                    <button onClick={openNew}
                        className="btn-primary">
                        + New template
                    </button>
                )}
            </div>

            {error && <Alert tone="warning">{error}</Alert>}

            {!error && data && events.length === 0 && !loading && (
                <Alert tone="warning">
                    No active events yet. Create an event in the <strong>Events</strong> tab first.
                </Alert>
            )}

            {!error && (
                <div className="card overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-slate-200">
                        <thead>
                            <tr>
                                {['Name', 'Event', 'Applies to', 'Send to', 'DLT ID', 'Default', 'Status', 'Updated', ''].map(h => (
                                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {rows.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-800">{t.name}</div>
                                        <div className="text-xs text-slate-400 truncate max-w-xs">{t.body}</div>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{t.event_name}</td>
                                    <td className="px-3 py-2">
                                        <span className={`${t.is_common ? 'badge-brand' : 'badge-neutral'}`}>
                                            {t.applies_to}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{RECIPIENT_LABEL[t.recipient] || t.recipient}</td>
                                    <td className="px-3 py-2 text-xs font-mono text-slate-500">{t.dlt_template_id || '—'}</td>
                                    <td className="px-3 py-2 space-y-1">
                                        {t.is_default && <div><span className="badge-brand">Default</span></div>}
                                        {t.in_use && <div><span className="badge-success whitespace-nowrap">✓ Used for this branch</span></div>}
                                    </td>
                                    <td className="px-3 py-2 space-y-1">
                                        <div>
                                            <span className={`${t.is_active ? 'badge-success' : 'badge-neutral'}`}>
                                                {t.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        {!t.event_active && <div><span className="badge-warning whitespace-nowrap">Event off</span></div>}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                                        {t.updated_at}{t.updated_by ? ` · ${t.updated_by}` : ''}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                                        {canEdit && <button onClick={() => openEdit(t)} className="text-xs text-brand-600 hover:underline">Edit</button>}
                                        {canToggle && (
                                            <button onClick={() => toggleActive(t)} className="text-xs text-slate-600 hover:underline">
                                                {t.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        )}
                                        <button onClick={() => openHistory(t)} className="text-xs text-slate-500 hover:underline">History</button>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && !loading && events.length > 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <EmptyState compact title="No templates yet" description="SMS for an event is sent only when it has an active template." />
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr><td colSpan={9}><LoadingState className="py-8" /></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {historyFor && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setHistoryFor(null)}>
                    <div className="card shadow-pop w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-slate-800">History: {historyFor.name}</h4>
                            <button onClick={() => setHistoryFor(null)} className="btn-icon">✕</button>
                        </div>
                        {history.length === 0 && <LoadingState className="py-6" />}
                        <div className="space-y-3">
                            {history.map((h, i) => (
                                <div key={i} className="border border-slate-200 rounded-lg p-3">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                        <span><strong className="text-slate-700">{h.user}</strong> · {h.action}</span>
                                        <span>{h.when}</span>
                                    </div>
                                    {Object.entries(h.changes).map(([field, c]) => (
                                        <div key={field} className="text-xs text-slate-600 mt-1">
                                            <span className="font-medium">{HISTORY_FIELD_LABEL[field] || field}:</span>{' '}
                                            <span className="line-through text-red-400">{String(c.from ?? '—')}</span>{' → '}
                                            <span className="text-emerald-700">{String(c.to ?? '—')}</span>
                                        </div>
                                    ))}
                                    {h.action === 'CREATE' && Object.keys(h.changes).length === 0 && (
                                        <div className="text-xs text-slate-400">Template created</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── SMS Account tab ──────────────────────────────────────────────────────────
type AccountSource = 'SCHOOL' | 'OWN' | 'NONE';

interface SmsProviderMeta {
    code: string; label: string; key_label?: string; token_label?: string; uses_route?: boolean;
}
interface SmsAccountView {
    id: number; provider: string; auth_key: string; default_sender_id: string; route: string;
    dlt_entity_id: string | null; is_active: boolean; has_token: boolean;
    updated_at: string | null; updated_by: string | null;
}
interface SmsAccountPayload {
    school_id: number; school_name: string;
    branch: { id: number; name: string } | null;
    can_view_school: boolean; can_edit_school: boolean;
    can_view_branch: boolean; can_edit_branch: boolean;
    can_change_choice: boolean;
    providers: SmsProviderMeta[];
    school_account: SmsAccountView | null;
    branch_account: SmsAccountView | null;
    branch_status: { account_source: AccountSource; ready: boolean; message: string } | null;
    warning?: string;
}
interface AccountForm {
    provider: string; auth_key: string; auth_token: string; default_sender_id: string;
    route: string; dlt_entity_id: string; is_active: boolean;
}

const EMPTY_ACCOUNT_FORM: AccountForm = {
    provider: 'SMSCOUNTRY', auth_key: '', auth_token: '', default_sender_id: '',
    route: 'Trans', dlt_entity_id: '', is_active: true,
};

const accountToForm = (a: SmsAccountView | null): AccountForm => a ? {
    provider: a.provider, auth_key: a.auth_key, auth_token: '',
    default_sender_id: a.default_sender_id, route: a.route,
    dlt_entity_id: a.dlt_entity_id || '', is_active: a.is_active,
} : { ...EMPTY_ACCOUNT_FORM };

const ACCOUNT_SOURCE_OPTIONS: { value: AccountSource; label: string }[] = [
    { value: 'SCHOOL', label: 'School account' },
    { value: 'OWN',    label: 'Own account' },
    { value: 'NONE',   label: 'Not set' },
];

// One account form (used for the school card and the branch card)
const AccountCard: React.FC<{
    title: string; subtitle: string; account: SmsAccountView | null;
    providers: SmsProviderMeta[]; canEdit: boolean;
    onSave: (form: AccountForm) => Promise<void>;
}> = ({ title, subtitle, account, providers, canEdit, onSave }) => {
    const [form, setForm]           = useState<AccountForm>(accountToForm(account));
    const [showToken, setShowToken] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState('');

    useEffect(() => {
        setForm(accountToForm(account));
        setShowToken(false);
        setError('');
    }, [account?.id, account?.updated_at]); // eslint-disable-line

    const set = (key: keyof AccountForm, value: any) => setForm(f => ({ ...f, [key]: value }));
    const meta = providers.find(p => p.code === form.provider);

    const handleSave = async () => {
        setError('');
        if (!form.auth_key.trim())          { setError('Auth key / account ID is required.'); return; }
        if (!account?.has_token && !form.auth_token.trim()) { setError('Auth token / password is required for a new account.'); return; }
        if (!form.default_sender_id.trim()) { setError('Sender ID is required.'); return; }
        if (!await confirmDialog(`Save ${title}?`)) return;
        setSaving(true);
        try {
            await onSave(form);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setSaving(false);
        }
    };

    const badge = !account
        ? { text: 'Not set up', cls: 'badge-neutral' }
        : account.is_active
            ? { text: 'Saved · Active', cls: 'badge-success' }
            : { text: 'Saved · Off', cls: 'badge-warning' };

    const inputCls = 'input disabled:bg-slate-100';

    return (
        <div className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h4 className="font-semibold text-slate-800">{title}</h4>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                    {account?.updated_at && (
                        <p className="text-xs text-slate-400 mt-1">
                            Last updated {account.updated_at}{account.updated_by ? ` by ${account.updated_by}` : ''}
                        </p>
                    )}
                </div>
                <span className={`whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="label">Provider</label>
                    <select value={form.provider} disabled={!canEdit} onChange={e => set('provider', e.target.value)} className={inputCls}>
                        {providers.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                                        <label className="label">{meta?.key_label || 'Auth key / Account ID'}</label>
                    <input value={form.auth_key} disabled={!canEdit} autoComplete="off" maxLength={120}
                        onChange={e => set('auth_key', e.target.value.trim())} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                                        <label className="label">{meta?.token_label || 'Auth token / Password'}</label>
                    <div className="flex gap-2">
                        <input type={showToken ? 'text' : 'password'} value={form.auth_token}
                            disabled={!canEdit} autoComplete="new-password" maxLength={500}
                            placeholder={account?.has_token ? '•••••••• saved (leave blank to keep)' : 'Enter auth token'}
                            onChange={e => set('auth_token', e.target.value)} className={inputCls} />
                        {canEdit && (
                            <button type="button" onClick={() => setShowToken(s => !s)}
                                className="btn-secondary btn-sm h-auto">
                                {showToken ? 'Hide' : 'Show'}
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Stored encrypted. Never shown again after saving.</p>
                </div>
                <div>
                    <label className="label">Default Sender ID</label>
                    <input value={form.default_sender_id} disabled={!canEdit} maxLength={20} placeholder="e.g. MSACAD"
                        onChange={e => set('default_sender_id', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        className={inputCls} />
                </div>
                                {(meta?.uses_route ?? true) && (
                <div>
                    <label className="label">Route</label>
                    <input value={form.route} disabled={!canEdit} maxLength={20} placeholder="Trans"
                        onChange={e => set('route', e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} className={inputCls} />
                </div>
                )}
                <div>
                    <label className="label">DLT Entity ID (PE ID)</label>
                    <input value={form.dlt_entity_id} disabled={!canEdit} inputMode="numeric" placeholder="Digits only"
                        onChange={e => set('dlt_entity_id', e.target.value.replace(/\D/g, ''))} className={inputCls} />
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                        <input type="checkbox" checked={form.is_active} disabled={!canEdit}
                            onChange={e => set('is_active', e.target.checked)} className="h-4 w-4 accent-brand-600" />
                        Active
                    </label>
                </div>
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            {canEdit ? (
                <button onClick={handleSave} disabled={saving}
                    className="btn-primary">
                    {saving ? 'Saving…' : account ? 'Save changes' : 'Save account'}
                </button>
            ) : (
                <p className="text-xs text-slate-400">You can view this account but not change it.</p>
            )}
        </div>
    );
};

const AccountTab: React.FC = () => {
    const [data, setData]           = useState<SmsAccountPayload | null>(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [notice, setNotice]       = useState('');
    const [switching, setSwitching] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await api.get('/sms/account');
            setData(res.data);
        } catch (e: any) {
            setData(null);
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line

    const applyResult = (d: SmsAccountPayload, msg: string) => {
        setData(d);
        setError('');
        setNotice(d.warning ? `${msg} ⚠ ${d.warning}` : msg);
    };

    // Errors are re-thrown so the card can show them next to its own form
    const saveSchool = async (form: AccountForm) => {
        const res = await api.put('/sms/account/school', form);
        applyResult(res.data, 'School account saved.');
    };
    const saveBranch = async (form: AccountForm) => {
        const res = await api.put('/sms/account/branch', form);
        applyResult(res.data, 'Branch account saved.');
    };

    const changeSource = async (source: AccountSource) => {
        if (!data?.branch || data.branch_status?.account_source === source) return;
        const label = source === 'SCHOOL' ? 'the school account'
                    : source === 'OWN'    ? 'its own account'
                    : 'no account (SMS will NOT be sent)';
        if (!await confirmDialog(`Set ${data.branch.name} to use ${label}?`)) return;
        setSwitching(true);
        setNotice('');
        setError('');
        try {
            const res = await api.put('/sms/account/source', { account_source: source });
            applyResult(res.data, 'Branch setting updated.');
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setSwitching(false);
        }
    };

    if (loading && !data) {
        return <LoadingState />;
    }
    if (!data) {
        return (
            <Alert tone="warning" onRetry={load}>
                {error || 'Could not load SMS accounts.'}
            </Alert>
        );
    }

    const status = data.branch_status;

    return (
        <div className="space-y-5">
            <div className="flex justify-end">
                <button onClick={load} disabled={loading}
                    className="btn-secondary btn-sm">
                    {loading ? 'Refreshing…' : '↻ Refresh'}
                </button>
            </div>

            {data.branch ? (
                <div className={`p-4 rounded-xl border ${status?.ready ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="text-sm text-slate-800 mb-2">
                        Branch <strong>{data.branch.name}</strong> uses:
                    </div>
                    <div className="flex flex-wrap gap-5 mb-2">
                        {ACCOUNT_SOURCE_OPTIONS.map(o => (
                            <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="radio" name="sms-account-source"
                                    checked={status?.account_source === o.value}
                                    disabled={!data.can_change_choice || switching}
                                    onChange={() => changeSource(o.value)}
                                    className="h-4 w-4 accent-brand-600" />
                                {o.label}
                            </label>
                        ))}
                    </div>
                                        <div className={`text-sm ${status?.ready ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {status?.ready ? '✅ ' : '⚠ '}{status?.message}
                    </div>
                    {!data.can_change_choice && (
                        <div className="text-xs text-slate-500 mt-1">You can see this choice but not change it.</div>
                    )}
                </div>
            ) : (
                <Alert tone="info">
                    Select a branch in the top bar to choose which account it uses. Showing the school account only.
                </Alert>
            )}

            {error  && <Alert tone="error">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}

                        {!data.can_view_school && !(data.branch && data.can_view_branch) && (
                <p className="text-sm text-slate-400">You don't have access to view any SMS account details.</p>
            )}

            <div className={`grid grid-cols-1 ${data.can_view_school && data.branch && data.can_view_branch ? 'lg:grid-cols-2' : ''} gap-4`}>
                {data.can_view_school && (
                <AccountCard
                    title={`School account (${data.school_name})`}
                    subtitle="Shared account. Used only by branches set to “School account”."
                    account={data.school_account}
                    providers={data.providers}
                                        canEdit={data.can_edit_school}
                    onSave={saveSchool}
                />
                )}
                {data.branch && data.can_view_branch && (
                    <AccountCard
                        title={`${data.branch.name} – own account`}
                        subtitle="Used only when this branch is set to “Own account”."
                        account={data.branch_account}
                        providers={data.providers}
                        canEdit={data.can_edit_branch}
                        onSave={saveBranch}
                    />
                )}
            </div>
        </div>
    );
};
// ─── Events tab ───────────────────────────────────────────────────────────────
interface SmsEventTypeDef {
    code: string; label: string; description: string;
    variables: string[]; allows_custom_fields: boolean; auto: boolean;
}
interface SmsEventRow {
    id: number; name: string; event_type: string; type_label: string;
    is_common: boolean; applies_to: string; custom_fields: string[];
    description: string | null; variables: string[]; is_active: boolean;
    updated_at: string | null; updated_by: string | null;
}
interface SmsEventsPayload {
    school_name: string; branch: { id: number; name: string } | null;
    can_create_common: boolean; can_create_branch: boolean; events: SmsEventRow[];
}

const CUSTOM_FIELD_PATTERN = /^[a-z][a-z0-9_]{1,29}$/;
const MAX_EVENT_FIELDS = 5;
const EMPTY_EVENT_FORM = {
    name: '', event_type: 'GENERAL', is_common: true,
    custom_fields: [] as string[], description: '', is_active: true,
};
const EVENT_HISTORY_LABEL: Record<string, string> = {
    name: 'Name', description: 'Description', custom_fields: 'Extra fields', is_active: 'Active',
};

// ─── Fee receipt settings card (shown at the top of the Events tab) ──────────
type FeeCommonMode = 'ON' | 'OFF';
type FeeBranchMode = 'COMMON' | 'ON' | 'OFF';

interface FeeReceiptPayload {
    school_name: string; branch: { id: number; name: string } | null;
    common: { mode: FeeCommonMode; event_id: number | null };
    branch_setting: { mode: FeeBranchMode; event_id: number | null } | null;
    common_events: { id: number; name: string }[];
    branch_events: { id: number; name: string; is_common: boolean }[];
    can_edit_common: boolean; can_edit_branch: boolean;
    status: { on: boolean; ready: boolean; message: string } | null;
}

const FeeReceiptCard: React.FC = () => {
    const [data, setData]               = useState<FeeReceiptPayload | null>(null);
    const [commonMode, setCommonMode]   = useState<FeeCommonMode>('OFF');
    const [commonEvent, setCommonEvent] = useState(0);
    const [branchMode, setBranchMode]   = useState<FeeBranchMode>('OFF');
    const [branchEvent, setBranchEvent] = useState(0);
    const [saving, setSaving]           = useState<'' | 'common' | 'branch'>('');
    const [error, setError]             = useState('');
    const [notice, setNotice]           = useState('');

    const apply = (d: FeeReceiptPayload) => {
        setData(d);
        setCommonMode(d.common.mode);
        setCommonEvent(d.common.event_id || d.common_events[0]?.id || 0);
        setBranchMode(d.branch_setting?.mode || 'OFF');
        setBranchEvent(d.branch_setting?.event_id || d.branch_events[0]?.id || 0);
    };

    const load = async () => {
        setError('');
        try {
            const res = await api.get('/sms/fee-receipt-settings');
            apply(res.data);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        }
    };
    useEffect(() => { load(); }, []); // eslint-disable-line

    const save = async (which: 'common' | 'branch') => {
        setError('');
        setNotice('');
        const mode     = which === 'common' ? commonMode : branchMode;
        const event_id = which === 'common' ? commonEvent : branchEvent;
        if (mode === 'ON' && !event_id) { setError('Please choose a Fee receipt event.'); return; }
        const label = which === 'common' ? 'the common fee receipt setting' : `fee receipt for ${data?.branch?.name}`;
        if (!await confirmDialog(`Save ${label}?`)) return;
        setSaving(which);
        try {
            const res = await api.put(`/sms/fee-receipt-settings/${which}`, { mode, event_id: event_id || null });
            apply(res.data);
            setNotice('Saved.');
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setSaving('');
        }
    };

    if (!data) {
        return error
            ? <Alert tone="warning">{error}</Alert>
            : null;
    }

    const selectCls = 'input w-auto disabled:bg-slate-100';
    const status = data.status;

    return (
        <div className="card p-4 space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-semibold text-slate-800">💰 Automatic fee receipt SMS</h4>
                    <p className="text-xs text-slate-500">Sent after a fee payment. Payments are never affected by SMS.</p>
                </div>
                <button onClick={load} className="btn-secondary btn-sm">
                    ↻ Refresh
                </button>
            </div>

            {/* School common setting */}
            <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-slate-700 w-56">School (common for all branches):</span>
                {(['ON', 'OFF'] as FeeCommonMode[]).map(m => (
                    <label key={m} className="flex items-center gap-1.5 text-sm text-slate-700">
                        <input type="radio" name="fee-common-mode" checked={commonMode === m}
                            disabled={!data.can_edit_common} onChange={() => setCommonMode(m)}
                            className="h-4 w-4 accent-brand-600" />
                        {m === 'ON' ? 'On' : 'Off'}
                    </label>
                ))}
                <select value={commonEvent} disabled={!data.can_edit_common || data.common_events.length === 0}
                    onChange={e => setCommonEvent(Number(e.target.value))} className={selectCls}>
                    {data.common_events.length === 0 && <option value={0}>No common Fee receipt event</option>}
                    {data.common_events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
                {data.can_edit_common && (
                    <button onClick={() => save('common')} disabled={saving !== ''}
                        className="btn-primary btn-sm">
                        {saving === 'common' ? 'Saving…' : 'Save'}
                    </button>
                )}
            </div>

            {/* Branch setting */}
            {data.branch ? (
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-56">This branch ({data.branch.name}):</span>
                    {(['COMMON', 'ON', 'OFF'] as FeeBranchMode[]).map(m => (
                        <label key={m} className="flex items-center gap-1.5 text-sm text-slate-700">
                            <input type="radio" name="fee-branch-mode" checked={branchMode === m}
                                disabled={!data.can_edit_branch} onChange={() => setBranchMode(m)}
                                className="h-4 w-4 accent-brand-600" />
                            {m === 'COMMON' ? 'Use common' : m === 'ON' ? 'On' : 'Off'}
                        </label>
                    ))}
                    {branchMode === 'ON' && (
                        <select value={branchEvent} disabled={!data.can_edit_branch || data.branch_events.length === 0}
                            onChange={e => setBranchEvent(Number(e.target.value))} className={selectCls}>
                            {data.branch_events.length === 0 && <option value={0}>No Fee receipt event</option>}
                            {data.branch_events.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.name}{ev.is_common ? ' (common)' : ''}</option>
                            ))}
                        </select>
                    )}
                    {data.can_edit_branch && (
                        <button onClick={() => save('branch')} disabled={saving !== ''}
                            className="btn-primary btn-sm">
                            {saving === 'branch' ? 'Saving…' : 'Save'}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-xs text-slate-500">Select a branch in the top bar to set its fee receipt option.</p>
            )}

            {status && (
                <div className={`p-2 rounded-lg text-sm ${
                    status.ready ? 'bg-emerald-50 text-emerald-800'
                    : status.on ? 'bg-amber-50 text-amber-800'
                    : 'bg-slate-50 text-slate-600'}`}>
                    {status.ready ? '✅ ' : status.on ? '⚠ ' : 'ℹ '}{status.message}
                </div>
            )}

            {error  && <Alert tone="error">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}
        </div>
    );
};

const EventsTab: React.FC = () => {
    const { hasPermission } = useAuth();
    const canEdit   = hasPermission(PERM_SMS_EVENTS, 'write');
    const canToggle = hasPermission(PERM_SMS_EVENTS, 'delete');

    const [types, setTypes]               = useState<SmsEventTypeDef[]>([]);
    const [data, setData]                 = useState<SmsEventsPayload | null>(null);
    const [statusFilter, setStatusFilter] = useState('active');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');

    const [showForm, setShowForm]   = useState(false);
    const [editing, setEditing]     = useState<SmsEventRow | null>(null);
    const [form, setForm]           = useState({ ...EMPTY_EVENT_FORM });
    const [newField, setNewField]   = useState('');
    const [saving, setSaving]       = useState(false);
    const [formError, setFormError] = useState('');

    const [historyFor, setHistoryFor] = useState<SmsEventRow | null>(null);
    const [history, setHistory]       = useState<TemplateHistoryItem[]>([]);

    const currentType = types.find(t => t.code === form.event_type);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/sms/events', { params: { status: statusFilter } });
            setData(res.data);
        } catch (e: any) {
            setData(null);
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        api.get('/sms/event-types').then(r => setTypes(r.data || [])).catch(() => setTypes([]));
    }, []);
    useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line

    const openNew = () => {
        setEditing(null);
        setForm({ ...EMPTY_EVENT_FORM, is_common: !!data?.can_create_common });
        setNewField('');
        setFormError('');
        setShowForm(true);
    };

    const openEdit = (ev: SmsEventRow) => {
        setEditing(ev);
        setForm({
            name: ev.name, event_type: ev.event_type, is_common: ev.is_common,
            custom_fields: [...ev.custom_fields], description: ev.description || '', is_active: ev.is_active,
        });
        setNewField('');
        setFormError('');
        setShowForm(true);
    };

    const addField = () => {
        const f = newField.trim().toLowerCase();
        setFormError('');
        if (!CUSTOM_FIELD_PATTERN.test(f)) {
            setFormError('Field name: lowercase letters, numbers and _ (start with a letter, 2–30 characters).');
            return;
        }
        if ((currentType?.variables || []).includes(f)) { setFormError(`{${f}} is already a standard variable.`); return; }
        if (form.custom_fields.includes(f))             { setFormError(`{${f}} is already added.`); return; }
        if (form.custom_fields.length >= MAX_EVENT_FIELDS) { setFormError(`Maximum ${MAX_EVENT_FIELDS} extra fields.`); return; }
        setForm(x => ({ ...x, custom_fields: [...x.custom_fields, f] }));
        setNewField('');
    };

    const removeField = (f: string) =>
        setForm(x => ({ ...x, custom_fields: x.custom_fields.filter(c => c !== f) }));

    const handleSave = async () => {
        setFormError('');
        if (!form.name.trim()) { setFormError('Event name is required.'); return; }
        if (!editing && !form.is_common && !data?.branch) {
            setFormError('Select a branch in the top bar to create a branch-only event.');
            return;
        }
        const payload = {
            ...form,
            custom_fields: currentType?.allows_custom_fields ? form.custom_fields : [],
        };
        setSaving(true);
        try {
            if (editing) await api.put(`/sms/events/${editing.id}`, payload);
            else         await api.post('/sms/events', payload);
            setShowForm(false);
            await load();
        } catch (e: any) {
            setFormError(e.response?.data?.error || e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (ev: SmsEventRow) => {
        const action = ev.is_active ? 'Deactivate' : 'Activate';
        if (!await confirmDialog(`${action} event "${ev.name}"?`)) return;
        try {
            await api.patch(`/sms/events/${ev.id}/active`, { is_active: !ev.is_active });
            await load();
        } catch (e: any) {
            notify(e.response?.data?.error || e.message);
        }
    };

    const openHistory = async (ev: SmsEventRow) => {
        setHistoryFor(ev);
        setHistory([]);
        try {
            const res = await api.get(`/sms/events/${ev.id}/history`);
            setHistory(res.data || []);
        } catch (e: any) {
            notify(e.response?.data?.error || e.message);
            setHistoryFor(null);
        }
    };

    const inputCls = 'input disabled:bg-slate-100';

    // ── Editor view ──────────────────────────────────────────────────────────
    if (showForm) {
        const allVars = [...(currentType?.variables || []),
                         ...(currentType?.allows_custom_fields ? form.custom_fields : [])];
        return (
            <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">
                        {editing ? `Edit event: ${editing.name}` : 'New event'}
                    </h3>
                    <button onClick={() => setShowForm(false)}
                        className="btn-secondary btn-sm">
                        ← Back to list
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="label">Event name</label>
                        <input value={form.name} maxLength={150} placeholder="e.g. Circular, PTM Reminder"
                            onChange={e => setForm(x => ({ ...x, name: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                        <label className="label">Type</label>
                        <select value={form.event_type} disabled={!!editing}
                            onChange={e => setForm(x => ({ ...x, event_type: e.target.value }))} className={inputCls}>
                            {types.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                        </select>
                        <p className="text-xs text-slate-400 mt-1">
                            {editing ? "Type can't be changed after creation." : currentType?.description}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="label">Applies to</label>
                    <div className="flex flex-wrap gap-5">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="radio" name="event-scope" checked={form.is_common}
                                disabled={!!editing || !data?.can_create_common}
                                onChange={() => setForm(x => ({ ...x, is_common: true }))}
                                className="h-4 w-4 accent-brand-600" />
                            Common for all branches
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="radio" name="event-scope" checked={!form.is_common}
                                disabled={!!editing || !data?.can_create_branch}
                                onChange={() => setForm(x => ({ ...x, is_common: false }))}
                                className="h-4 w-4 accent-brand-600" />
                            {editing && !editing.is_common
                                ? `Only ${editing.applies_to}`
                                : data?.branch ? `Only ${data.branch.name}` : 'Only one branch (select it in the top bar)'}
                        </label>
                    </div>
                    {editing && <p className="text-xs text-slate-400 mt-1">"Applies to" can't be changed after creation.</p>}
                </div>

                {currentType?.allows_custom_fields && (
                    <div>
                        <label className="label">
                            Extra fields <span className="text-slate-400 font-normal">(typed when sending, max {MAX_EVENT_FIELDS})</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {form.custom_fields.map(f => (
                                <span key={f} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                                    {`{${f}}`}
                                    <button type="button" onClick={() => removeField(f)} className="text-brand-400 hover:text-red-500">✕</button>
                                </span>
                            ))}
                            {form.custom_fields.length === 0 && <span className="text-xs text-slate-400">No extra fields yet.</span>}
                        </div>
                        <div className="flex gap-2 max-w-md">
                            <input value={newField} placeholder="e.g. circular_text"
                                onChange={e => setNewField(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
                                className={inputCls} />
                            <button type="button" onClick={addField}
                                className="btn-secondary h-auto">
                                + Add
                            </button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="label">
                        Variables templates can use <span className="text-slate-400 font-normal">(for information)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {allVars.map(v => (
                            <span key={v} className="px-2 py-1 text-xs font-mono rounded-md bg-slate-50 text-slate-600 border border-slate-200">{`{${v}}`}</span>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="label">Description (optional)</label>
                    <input value={form.description} maxLength={255}
                        onChange={e => setForm(x => ({ ...x, description: e.target.value }))} className={inputCls} />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.is_active} className="h-4 w-4 accent-brand-600"
                        onChange={e => setForm(x => ({ ...x, is_active: e.target.checked }))} />
                    Active
                </label>

                {formError && <Alert tone="error">{formError}</Alert>}

                <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving}
                        className="btn-primary">
                        {saving ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
                    </button>
                    <button onClick={() => setShowForm(false)}
                        className="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // ── List view ────────────────────────────────────────────────────────────
    const canCreate = !!data && (data.can_create_common || data.can_create_branch);
    return (
                <div className="space-y-4">
            <FeeReceiptCard key={(data?.events || []).map(e => `${e.id}${e.is_active ? 'a' : 'i'}`).join(',')} />

            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="label">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="input w-auto">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="all">All</option>
                    </select>
                </div>
                {data && (
                    <span className="text-sm text-slate-500 pb-2">
                        {data.school_name}{data.branch ? ` › ${data.branch.name}` : ' › All branches'}
                    </span>
                )}
                <div className="flex-1" />
                <button onClick={load} disabled={loading}
                    className="btn-secondary btn-sm">
                    ↻ Refresh
                </button>
                {canCreate && (
                    <button onClick={openNew} disabled={types.length === 0}
                        className="btn-primary">
                        + New event
                    </button>
                )}
            </div>

            {error && <Alert tone="warning">{error}</Alert>}

            {!error && (
                <div className="card overflow-x-auto">
                    <table className="min-w-full text-sm divide-y divide-slate-200">
                        <thead>
                            <tr>
                                {['Name', 'Type', 'Applies to', 'Extra fields', 'Status', 'Updated', ''].map(h => (
                                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {(data?.events || []).map(ev => (
                                <tr key={ev.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-800">{ev.name}</div>
                                        {ev.description && <div className="text-xs text-slate-400 truncate max-w-xs">{ev.description}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{ev.type_label}</td>
                                    <td className="px-3 py-2">
                                        <span className={`${ev.is_common ? 'badge-brand' : 'badge-neutral'}`}>
                                            {ev.applies_to}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs font-mono text-slate-500">
                                        {ev.custom_fields.length ? ev.custom_fields.map(f => `{${f}}`).join(' ') : '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`${ev.is_active ? 'badge-success' : 'badge-neutral'}`}>
                                            {ev.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                                        {ev.updated_at}{ev.updated_by ? ` · ${ev.updated_by}` : ''}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                                        {canEdit && <button onClick={() => openEdit(ev)} className="text-xs text-brand-600 hover:underline">Edit</button>}
                                        {canToggle && (
                                            <button onClick={() => toggleActive(ev)} className="text-xs text-slate-600 hover:underline">
                                                {ev.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        )}
                                        <button onClick={() => openHistory(ev)} className="text-xs text-slate-500 hover:underline">History</button>
                                    </td>
                                </tr>
                            ))}
                            {(data?.events || []).length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7}>
                                        <EmptyState compact title="No events yet" description="Create one to start sending this kind of SMS." />
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr><td colSpan={7}><LoadingState className="py-8" /></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {historyFor && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => setHistoryFor(null)}>
                    <div className="card shadow-pop w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-slate-800">History: {historyFor.name}</h4>
                            <button onClick={() => setHistoryFor(null)} className="btn-icon">✕</button>
                        </div>
                        {history.length === 0 && <LoadingState className="py-6" />}
                        <div className="space-y-3">
                            {history.map((h, i) => (
                                <div key={i} className="border border-slate-200 rounded-lg p-3">
                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                        <span><strong className="text-slate-700">{h.user}</strong> · {h.action}</span>
                                        <span>{h.when}</span>
                                    </div>
                                    {Object.entries(h.changes).map(([field, c]) => (
                                        <div key={field} className="text-xs text-slate-600 mt-1">
                                            <span className="font-medium">{EVENT_HISTORY_LABEL[field] || field}:</span>{' '}
                                            <span className="line-through text-red-400">{JSON.stringify(c.from ?? '—')}</span>{' → '}
                                            <span className="text-emerald-700">{JSON.stringify(c.to ?? '—')}</span>
                                        </div>
                                    ))}
                                    {h.action === 'CREATE' && Object.keys(h.changes).length === 0 && (
                                        <div className="text-xs text-slate-400">Event created</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Send SMS ─────────────────────────────────────────────────────────────────
interface SendEventOption {
    id: number; name: string; event_type: string; type_label: string;
    is_common: boolean; custom_fields: string[]; ready: boolean; reasons: string[];
}
interface SendOptionsPayload {
    branch: { id: number; name: string } | null;
    account_ready: boolean; account_message: string; events: SendEventOption[];
}
interface SendRecipient { student_id: number; name: string; cls: string; phone: string; info?: string; }
interface SendResultRow { student_id: number; name: string; status: string; phone?: string; reason?: string; }

const todayStr = () => new Date().toISOString().split('T')[0];

const SendSmsTab: React.FC<{ canSend: boolean }> = ({ canSend }) => {
    const [options, setOptions]               = useState<SendOptionsPayload | null>(null);
    const [optionsError, setOptionsError]     = useState('');
    const [loadingOptions, setLoadingOptions] = useState(false);

    const [eventId, setEventId]             = useState(0);
    const [date, setDate]                   = useState(todayStr());
    const [cutoffDate, setCutoffDate]       = useState(todayStr());
    const [classOptions, setClassOptions]   = useState<{ id: number; class_name: string }[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [fields, setFields]               = useState<Record<string, string>>({});

    const [recipients, setRecipients]   = useState<SendRecipient[]>([]);
    const [selected, setSelected]       = useState<Set<number>>(new Set());
    const [loadingList, setLoadingList] = useState(false);
    const [listLoaded, setListLoaded]   = useState(false);

    const [preview, setPreview] = useState<{ text: string | null; student: string; count: number; problem: string | null } | null>(null);
    const [busy, setBusy]       = useState(false);
    const [result, setResult]   = useState<{ sent: number; failed: number; skipped: number; results: SendResultRow[] } | null>(null);
    const [error, setError]     = useState('');

    const event = options?.events.find(e => e.id === eventId);
    const branchName = localStorage.getItem('currentBranch') || 'All';

    const loadOptions = async () => {
        setLoadingOptions(true);
        setOptionsError('');
        try {
            const res = await api.get('/sms/send-options');
            const d: SendOptionsPayload = res.data;
            setOptions(d);
            setEventId(prev => (prev && d.events.some(e => e.id === prev))
                ? prev
                : (d.events.find(e => e.ready)?.id || d.events[0]?.id || 0));
        } catch (e: any) {
            setOptions(null);
            setOptionsError(e.response?.data?.error || e.message);
        } finally {
            setLoadingOptions(false);
        }
    };

    useEffect(() => {
        loadOptions();
        api.get('/classes').then(r => setClassOptions(r.data.classes || [])).catch(() => setClassOptions([]));
    }, []); // eslint-disable-line

    const resetList = () => {
        setRecipients([]); setSelected(new Set()); setListLoaded(false);
        setPreview(null); setResult(null); setError('');
    };
    useEffect(() => { resetList(); setFields({}); }, [eventId]); // eslint-disable-line

    const loadRecipients = async () => {
        if (!event) return;
        resetList();
        setLoadingList(true);
        try {
            let list: SendRecipient[] = [];
            if (event.event_type === 'ABSENT') {
                const params: any = { date, branch: branchName };
                if (selectedClass) params.class = selectedClass;
                const res = await api.get('/attendance', { params });
                const att = res.data.attendance || {};
                list = (res.data.students || [])
                    .filter((s: any) => att[s.student_id] === 'Absent')
                    .map((s: any) => ({
                        student_id: s.student_id, name: s.name,
                        cls: `${s.class || ''} ${s.section || ''}`.trim(),
                        phone: s.smsNo || s.fatherMobile || '—',
                    }));
            } else if (event.event_type === 'FEE_DUE') {
                const res = await api.get('/reports/fees/due-by-cutoff', { params: { branch: branchName, cutoff_date: cutoffDate } });
                list = (res.data || []).map((s: any) => ({
                    student_id: s.student_id, name: s.name,
                    cls: `${s.class || ''} ${s.section || ''}`.trim(),
                    phone: s.father_mobile || '—',
                    info: `₹${(s.overdue_amount || 0).toLocaleString()}`,
                }));
            } else {
                const params: any = { branch: branchName, status: 'Active' };
                if (selectedClass) params.class = selectedClass;
                const res = await api.get('/students', { params });
                list = (res.data.students || []).map((s: any) => ({
                    student_id: s.student_id,
                    name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
                    cls: `${s.class || ''} ${s.section || ''}`.trim(),
                    phone: s.smsNo || s.fatherMobile || '—',
                }));
            }
            setRecipients(list);
            setSelected(new Set(list.map(r => r.student_id)));
            setListLoaded(true);
        } catch (e: any) {
            setError(`Failed to load students: ${e.response?.data?.error || e.message}`);
        } finally {
            setLoadingList(false);
        }
    };

    const toggleOne = (id: number) => {
        setPreview(null);
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleAll = (checked: boolean) => {
        setPreview(null);
        setSelected(checked ? new Set(recipients.map(r => r.student_id)) : new Set());
    };

    const missingFields = (event?.custom_fields || []).filter(f => !(fields[f] || '').trim());
    const payload = () => ({ event_id: eventId, student_ids: Array.from(selected), date, cutoff_date: cutoffDate, fields });

    const handlePreview = async () => {
        setError('');
        setResult(null);
        if (selected.size === 0) { setError('Select at least one student.'); return; }
        if (missingFields.length) { setError(`Please fill in: ${missingFields.join(', ')}`); return; }
        setBusy(true);
        try {
            const res = await api.post('/sms/send', { ...payload(), preview_only: true });
            setPreview({ text: res.data.preview, student: res.data.preview_student,
                         count: res.data.recipients, problem: res.data.problem });
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleSend = async () => {
        if (!preview) return;
        if (!await confirmDialog(`Send "${event?.name}" SMS to ${preview.count} parent(s)?`)) return;
        setBusy(true);
        setError('');
        try {
            const res = await api.post('/sms/send', payload());
            setResult(res.data);
            setPreview(null);
            setSelected(new Set());
        } catch (e: any) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setBusy(false);
        }
    };

    const inputCls = 'input';

    if (loadingOptions && !options) return <LoadingState />;
    if (!options) {
        return <Alert tone="warning" onRetry={loadOptions}>{optionsError || 'Could not load SMS options.'}</Alert>;
    }

    return (
        <div className="space-y-5">
            {/* Branch / account status */}
            {!options.branch ? (
                <Alert tone="warning">{options.account_message}</Alert>
            ) : !options.account_ready ? (
                <Alert tone="warning">
                    ⚠ {options.account_message}. Ask your admin to set it up in <strong>SMS Account</strong>.
                </Alert>
            ) : null}

            {!canSend && (
                <Alert tone="warning">
                    You can view this screen but don't have permission to send SMS.
                </Alert>
            )}

            {/* Step 1: event */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[280px]">
                    <label className="label">1. Event</label>
                    <select value={eventId} onChange={e => setEventId(Number(e.target.value))} className={inputCls}
                        disabled={options.events.length === 0}>
                        {options.events.length === 0 && <option value={0}>No events available</option>}
                        {options.events.map(ev => (
                            <option key={ev.id} value={ev.id}>
                                {ev.name} · {ev.type_label}{ev.ready ? '' : ' (not ready)'}
                            </option>
                        ))}
                    </select>
                </div>
                <button onClick={loadOptions} disabled={loadingOptions}
                    className="btn-secondary btn-sm">
                    ↻ Refresh
                </button>
            </div>

            {options.branch && options.events.length === 0 && (
                <Alert tone="warning">
                    No events for this branch yet. Create events in <strong>Events</strong> and templates in <strong>Templates</strong>.
                </Alert>
            )}

            {event && !event.ready && (
                <Alert tone="warning">
                    <div className="font-semibold mb-1">This event can't be sent yet:</div>
                    <ul className="list-disc ml-5">{event.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </Alert>
            )}

            {event && event.ready && (
                <>
                    {/* Step 2: recipients */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        {event.event_type === 'ABSENT' && (
                            <div>
                                <label className="label">2. Attendance date</label>
                                <input type="date" value={date} max={todayStr()} className={inputCls}
                                    onChange={e => { setDate(e.target.value); resetList(); }} />
                            </div>
                        )}
                        {event.event_type === 'FEE_DUE' && (
                            <div>
                                <label className="label">2. Dues up to</label>
                                <input type="date" value={cutoffDate} max={todayStr()} className={inputCls}
                                    onChange={e => { setCutoffDate(e.target.value); resetList(); }} />
                            </div>
                        )}
                        {event.event_type !== 'FEE_DUE' && (
                            <div>
                                <label className="label">
                                    {event.event_type === 'GENERAL' ? '2. Class' : 'Class (optional)'}
                                </label>
                                <select value={selectedClass} className={inputCls}
                                    onChange={e => { setSelectedClass(e.target.value); resetList(); }}>
                                    <option value="">All classes</option>
                                    {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                                </select>
                            </div>
                        )}
                        <button onClick={loadRecipients} disabled={loadingList}
                            className="btn-primary">
                            {loadingList ? 'Loading…'
                                : event.event_type === 'ABSENT' ? 'Get absent students'
                                : event.event_type === 'FEE_DUE' ? 'Get overdue students'
                                : 'Load students'}
                        </button>
                    </div>

                    {/* Step 3: extra fields (General) */}
                    {event.custom_fields.length > 0 && (
                        <div className="space-y-2">
                            <label className="label">3. Message details</label>
                            {event.custom_fields.map(f => (
                                <div key={f}>
                                    <label className="block text-xs text-slate-500 mb-1 font-mono">{`{${f}}`}</label>
                                    <textarea rows={2} maxLength={500} value={fields[f] || ''} className={inputCls}
                                        onChange={e => { setPreview(null); setFields(x => ({ ...x, [f]: e.target.value })); }} />
                                </div>
                            ))}
                            <p className="text-xs text-amber-700">⚠ Your DLT template may limit how long each variable can be.</p>
                        </div>
                    )}

                    {/* Recipient list */}
                    {recipients.length > 0 && (
                        <div className="card overflow-hidden">
                            <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                                    <input type="checkbox" checked={selected.size === recipients.length}
                                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < recipients.length; }}
                                        onChange={e => toggleAll(e.target.checked)} className="h-3.5 w-3.5 accent-brand-600" />
                                    Select all ({recipients.length})
                                </label>
                                <span className="badge-brand">{selected.size} selected</span>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                <table className="min-w-full text-sm divide-y divide-slate-200">
                                    <thead className="sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 w-8"></th>
                                            <th className="px-3 py-2 text-left">Name</th>
                                            <th className="px-3 py-2 text-left">Class</th>
                                            <th className="px-3 py-2 text-left">Phone</th>
                                            {event.event_type === 'FEE_DUE' && <th className="px-3 py-2 text-right">Overdue</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {recipients.map(r => (
                                            <tr key={r.student_id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2">
                                                    <input type="checkbox" checked={selected.has(r.student_id)}
                                                        onChange={() => toggleOne(r.student_id)} className="h-4 w-4 accent-brand-600 cursor-pointer" />
                                                </td>
                                                <td className="px-3 py-2 font-medium">{r.name}</td>
                                                <td className="px-3 py-2 text-slate-600">{r.cls}</td>
                                                <td className="px-3 py-2 text-slate-500">{r.phone}</td>
                                                {event.event_type === 'FEE_DUE' && <td className="px-3 py-2 text-right text-red-600 font-semibold">{r.info}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {listLoaded && recipients.length === 0 && (
                        <EmptyState compact title="No students found." />
                    )}

                    {/* Step 4: preview → send */}
                    {recipients.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            <button onClick={handlePreview} disabled={busy || selected.size === 0}
                                className="btn-soft">
                                {busy && !preview ? 'Checking…' : '👁 Preview'}
                            </button>
                            <button onClick={handleSend}
                                disabled={!canSend || busy || !preview || !!preview.problem}
                                className="btn-warn">
                                {busy && preview ? 'Sending…' : `📱 Send${preview ? ` to ${preview.count}` : ''}`}
                            </button>
                        </div>
                    )}

                    {preview && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 max-w-2xl">
                            <div className="text-xs text-slate-500">
                                Preview for <strong>{preview.student}</strong> · {preview.count} parent(s) will receive this SMS
                            </div>
                            {preview.text && (
                                <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 text-sm text-slate-800 whitespace-pre-wrap break-words">
                                    {preview.text}
                                </div>
                            )}
                            {preview.problem && (
                                <div className="text-sm text-red-600">⚠ {preview.problem}</div>
                            )}
                        </div>
                    )}
                </>
            )}

            {error && <Alert tone="error">{error}</Alert>}

            {result && (
                <div className="space-y-2">
                    <ResultBar result={result} />
                    {result.results.filter(r => r.status !== 'sent').length > 0 && (
                        <div className="border border-slate-200 rounded-lg p-3 text-sm max-h-60 overflow-y-auto">
                            <div className="label">Not sent:</div>
                            {result.results.filter(r => r.status !== 'sent').map(r => (
                                <div key={r.student_id} className="text-slate-600">
                                    {r.name} — <span className={r.status === 'failed' ? 'text-red-600' : 'text-amber-600'}>{r.status}</span>: {r.reason}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main SMS Center ──────────────────────────────────────────────────────────
const SmsCenter: React.FC<SmsCenterProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();
        const visibleTabs = TAB_DEFS.filter(t =>
        (Array.isArray(t.permission) ? t.permission : [t.permission]).some(p => hasPermission(p, t.action))
    );
    const [activeTab, setActiveTab] = useState<SmsTab | null>(visibleTabs[0]?.id ?? null);

    // If permissions finish loading after the first render, select the first allowed tab
    useEffect(() => {
        if (!activeTab || !visibleTabs.some(t => t.id === activeTab)) {
            setActiveTab(visibleTabs[0]?.id ?? null);
        }
    }, [visibleTabs.map(t => t.id).join(',')]); // eslint-disable-line

    const renderTab = () => {
        switch (activeTab) {
            case 'send':    return <SendSmsTab canSend={hasPermission(PERM_SMS_SEND, 'write')} />;
            case 'reports': return <SmsReportsTab />;
            case 'events':    return <EventsTab />;
            case 'templates': return <TemplatesTab />;
            case 'account':   return <AccountTab />;
            default:
                return (
                    <EmptyState title="No access" description="You don't have access to any SMS Center tabs. Please contact your administrator." />
                );
        }
    };

    return (
        <div className="min-h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-5">
                <PageHeader
                    eyebrow="Administration"
                    title="SMS Center"
                    subtitle="Send attendance, fee, announcement and custom SMS"
                    className="mb-4"
                    actions={
                        <button onClick={() => navigateTo('administration')}
                            className="btn-secondary btn-sm">
                            ← Back
                        </button>
                    }
                />
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
                <div className="flex gap-1 overflow-x-auto">
                                        {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                activeTab === tab.id
                                    ? 'border-brand-600 text-brand-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6">
                <div className="card p-4 md:p-5">
                    {renderTab()}
                </div>
            </div>
        </div>
    );
};

export default SmsCenter;