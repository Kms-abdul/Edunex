import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm } from './hr-setup/MasterParts';

interface Category {
    id: number;
    category_code: string;
    category_name: string;
    description: string | null;
    display_order: number;
    is_active: boolean;
}

export const StaffCategoryMaster: React.FC = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('hr.hr.staff-categories', 'write');

    const [list, setList]         = useState<Category[]>([]);
    const [loading, setLoading]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);

    const blank = { category_code: '', category_name: '', description: '', display_order: 0, is_active: true };
    const [form, setForm] = useState(blank);

    const fetchData = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if (!schoolId || schoolId === 'all') return;
        setLoading(true);
        try {
            const res = await api.get('/hr/staff-categories');
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
                category_code: form.category_code.toUpperCase().trim(),
                display_order: Number(form.display_order),
            };
            if (editingId) {
                await api.put(`/hr/staff-categories/${editingId}`, payload);
                setMsg({ type: 'success', text: `Staff type "${form.category_name}" saved.` });
            } else {
                await api.post('/hr/staff-categories', payload);
                setMsg({ type: 'success', text: `Staff type "${form.category_name}" added.` });
            }
            setForm(blank);
            setEditingId(null);
            setShowForm(false);
            fetchData();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Could not save the staff type. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (c: Category) => {
        setEditingId(c.id);
        setForm({
            category_code: c.category_code,
            category_name: c.category_name,
            description: c.description || '',
            display_order: c.display_order || 0,
            is_active: c.is_active
        });
        setMsg(null);
        setShowForm(true);
        scrollToForm('category-form');
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(blank);
        setMsg(null);
        setShowForm(true);
        scrollToForm('category-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blank); setShowForm(false); };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="staff types" />;
    }

    const columns: Column<Category>[] = [
        { key: 'category_name', header: 'Staff type', primary: true, render: c => <span className="font-medium text-slate-900">{c.category_name}</span> },
        { key: 'description', header: 'Note', secondary: true, render: c => c.description || '—' },
        { key: 'category_code', header: 'Code', render: c => <span className="font-mono text-xs">{c.category_code}</span> },
        { key: 'display_order', header: 'Order in lists', hideOnMobile: true },
        { key: 'is_active', header: 'Status', render: c => <Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
        ...(canWrite ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (c: Category) => <EditButton onClick={() => handleEdit(c)} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Staff types (categories) like Teaching, Non-teaching or Support staff."
                addLabel={canWrite && !(showForm && !editingId) ? 'Add staff type' : undefined}
                onAdd={canWrite ? openAdd : undefined}
                count={list.length}
                countLabel={list.length === 1 ? 'staff type' : 'staff types'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && canWrite && (
                <FormCard
                    id="category-form"
                    title={editingId ? 'Change staff type' : 'New staff type'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save staff type"
                    saving={saving}
                >
                    <Field label="Name" required>
                        <input
                            id="cat-name"
                            className="input"
                            placeholder="e.g. Teaching"
                            value={form.category_name}
                            onChange={e => setForm({ ...form, category_name: e.target.value })}
                            required
                        />
                    </Field>
                    <Field label="Short code" required hint={editingId ? 'The code cannot be changed.' : 'Up to 20 letters, for example TEACH.'}>
                        <input
                            id="cat-code"
                            className="input font-mono uppercase"
                            placeholder="e.g. TEACH"
                            value={form.category_code}
                            onChange={e => setForm({ ...form, category_code: e.target.value })}
                            required
                            maxLength={20}
                            disabled={!!editingId}
                        />
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
                rowKey={c => c.id}
                loading={loading}
                emptyTitle="No staff types yet"
                emptyHint={canWrite ? 'Tap \u201cAdd staff type\u201d to make the first one.' : undefined}
                mobileActions={canWrite ? c => <EditButton onClick={() => handleEdit(c)} /> : undefined}
            />
        </div>
    );
};
