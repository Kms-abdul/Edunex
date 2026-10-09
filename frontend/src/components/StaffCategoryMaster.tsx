import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

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
                setMsg({ type: 'success', text: `Category "${form.category_name}" updated.` });
            } else {
                await api.post('/hr/staff-categories', payload);
                setMsg({ type: 'success', text: `Category "${form.category_name}" created.` });
            }
            setForm(blank);
            setShowForm(false);
            fetchData();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to create category.' });
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
        setShowForm(true);
        window.scrollTo(0, 0);
    };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return (
            <div className="card p-6 text-center mt-6">
                <h2 className="text-base font-semibold text-slate-900 mb-2">Staff Categories</h2>
                <p className="text-slate-500 text-sm">Please select a specific school from the top navigation to view and manage staff categories.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Staff Categories</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        HR classification types — Teaching, Non-Teaching, Menial, etc.
                    </p>
                </div>
                {canWrite && (
                    <button
                        id="btn-add-category"
                        onClick={() => { setShowForm(!showForm); setMsg(null); }}
                        className="btn-primary"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
                        </svg>
                        {showForm ? 'Cancel' : 'Add Category'}
                    </button>
                )}
            </div>

            {/* Message */}
            {msg && (
                <div className={`rounded-lg border p-3 text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {msg.text}
                </div>
            )}

            {/* Form */}
            {showForm && canWrite && (
                <div className="card p-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-5">New Staff Category</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label">
                                Category Code <span className="text-red-500">*</span>
                            </label>
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
                            <p className="text-xs text-slate-400 mt-1">Short unique code. Stored as uppercase.</p>
                        </div>
                        <div>
                            <label className="label">
                                Category Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="cat-name"
                                className="input"
                                placeholder="e.g. Teaching"
                                value={form.category_name}
                                onChange={e => setForm({ ...form, category_name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Description</label>
                            <input
                                className="input"
                                placeholder="Optional description"
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Display Order</label>
                            <input
                                type="number"
                                className="input"
                                value={form.display_order}
                                onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                                min={0}
                            />
                        </div>
                        <div className="md:col-span-4 flex justify-end gap-3 pt-2 border-t border-slate-100">
                            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button
                                id="btn-save-category"
                                type="submit"
                                disabled={saving}
                                className="btn-primary"
                            >
                                {saving ? 'Saving…' : editingId ? 'Update Category' : 'Save Category'}
                            </button>
                            {editingId && (
                                <button type="button" onClick={() => { setEditingId(null); setForm(blank); setShowForm(false); }} className="btn-secondary ml-2">Cancel</button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Order</th>
                            <th className="px-4 py-3">Status</th>
                            {canWrite && <th className="px-4 py-3">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 text-xs">{c.id}</td>
                                <td className="px-4 py-3">
                                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-semibold">
                                        {c.category_code}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800">{c.category_name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{c.description ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-500">{c.display_order}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {c.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                {canWrite && (
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleEdit(c)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {list.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                                    {loading ? 'Loading…' : 'No categories found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
