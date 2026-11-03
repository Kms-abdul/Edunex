import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm } from './hr-setup/MasterParts';

interface StaffStatus {
    id: number;
    status_code: string;
    status_name: string;
    description: string | null;
    display_order: number;
    is_active: boolean;
    status_type: 'ACTIVE' | 'INACTIVE';
}

const statusBadgeColor: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    PROBATION: 'bg-amber-100 text-amber-800',
    NOTICE_PERIOD: 'bg-orange-100 text-orange-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    RESIGNED: 'bg-slate-100 text-slate-600',
    TERMINATED: 'bg-red-200 text-red-900',
    RETIRED: 'bg-purple-100 text-purple-800',
};

export const StaffStatusMaster: React.FC = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('hr.hr.staff-statuses', 'write');

    const [list, setList] = useState<StaffStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);

    const blank: any = { status_code: '', status_name: '', description: '', display_order: 0, is_active: true, status_type: 'ACTIVE' };
    const [form, setForm] = useState(blank);

    const fetchData = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if (!schoolId || schoolId === 'all') return;
        setLoading(true);
        try {
            const res = await api.get('/hr/staff-statuses');
            setList(res.data || []);
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMsg(null);
        try {
            const payload = {
                ...form,
                status_code: form.status_code.toUpperCase().replace(/\s+/g, '_').trim(),
                display_order: Number(form.display_order),
            };
            if (editingId) {
                await api.put(`/hr/staff-statuses/${editingId}`, payload);
                setMsg({ type: 'success', text: `Work status "${form.status_name}" saved.` });
            } else {
                await api.post('/hr/staff-statuses', payload);
                setMsg({ type: 'success', text: `Work status "${form.status_name}" added.` });
            }
            setForm(blank);
            setEditingId(null);
            setShowForm(false);
            fetchData();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Could not save the work status. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (s: StaffStatus) => {
        setEditingId(s.id);
        setForm({
            status_code: s.status_code,
            status_name: s.status_name,
            description: s.description || '',
            display_order: s.display_order || 0,
            is_active: s.is_active
        });
        setMsg(null);
        setShowForm(true);
        scrollToForm('status-form');
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(blank);
        setMsg(null);
        setShowForm(true);
        scrollToForm('status-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blank); setShowForm(false); };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="work statuses" />;
    }

    const columns: Column<StaffStatus>[] = [
        { key: 'status_name', header: 'Work status', primary: true, render: s => <span className="font-medium text-slate-900">{s.status_name}</span> },
        { key: 'description', header: 'Note', secondary: true, render: s => s.description || '—' },
        {
            key: 'status_code', header: 'Code', render: s => (
                <span className={`font-mono text-xs px-2 py-1 rounded font-semibold ${statusBadgeColor[s.status_code] ?? 'bg-slate-100 text-slate-600'}`}>
                    {s.status_code}
                </span>
            ),
        },
        {
            key: 'status_type', header: 'Can log in?', render: s => (
                <Badge tone={s.status_type === 'ACTIVE' ? 'brand' : 'warning'}>
                    {s.status_type === 'ACTIVE' ? 'Yes, can log in' : 'No, login blocked'}
                </Badge>
            ),
        },
        { key: 'display_order', header: 'Order in lists', hideOnMobile: true },
        { key: 'is_active', header: 'In use', render: s => <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Inactive'}</Badge> },
        ...(canWrite ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (s: StaffStatus) => <EditButton onClick={() => handleEdit(s)} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Work statuses like Working, On probation, Notice period or Left. They also decide if the person can log in."
                addLabel={canWrite && !(showForm && !editingId) ? 'Add work status' : undefined}
                onAdd={canWrite ? openAdd : undefined}
                count={list.length}
                countLabel={list.length === 1 ? 'status' : 'statuses'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && canWrite && (
                <FormCard
                    id="status-form"
                    title={editingId ? 'Change work status' : 'New work status'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save work status"
                    saving={saving}
                >
                    <Field label="Name" required>
                        <input
                            id="status-name"
                            className="input"
                            placeholder="e.g. Notice period"
                            value={form.status_name}
                            onChange={e => setForm({ ...form, status_name: e.target.value })}
                            required
                        />
                    </Field>
                    <Field label="Short code" required hint="Spaces become _ automatically, for example NOTICE_PERIOD.">
                        <input
                            id="status-code"
                            className="input font-mono uppercase"
                            placeholder="e.g. NOTICE_PERIOD"
                            value={form.status_code}
                            onChange={e => setForm({ ...form, status_code: e.target.value })}
                            required
                            maxLength={30}
                        />
                    </Field>
                    <Field label="Can staff with this status log in?" className="sm:col-span-2">
                        <select
                            className="input"
                            value={form.status_type}
                            onChange={e => setForm({ ...form, status_type: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                        >
                            <option value="ACTIVE">Yes, they can log in</option>
                            <option value="INACTIVE">No, block their login</option>
                        </select>
                    </Field>
                    <Field label="Note (optional)">
                        <input
                            className="input"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </Field>
                    <Field label="Order in lists" hint="Smaller numbers show first.">
                        <input
                            type="number"
                            inputMode="numeric"
                            className="input"
                            value={form.display_order}
                            onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                            min={0}
                        />
                    </Field>
                </FormCard>
            )}

            <DataList
                columns={columns}
                rows={list}
                rowKey={s => s.id}
                loading={loading}
                emptyTitle="No work statuses yet"
                emptyHint={canWrite ? 'Tap \u201cAdd work status\u201d to make the first one.' : undefined}
                mobileActions={canWrite ? s => <EditButton onClick={() => handleEdit(s)} /> : undefined}
            />
        </div>
    );
};
