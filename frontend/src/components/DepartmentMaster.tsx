import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, LoadingState, EmptyState, Badge } from './ui';

interface Department {
    id: number;
    department_code: string;
    department_name: string;
    description: string;
    display_order: number;
    status: string;
}

export const DepartmentMaster: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('hr.hr.departments', 'write');


    const [form, setForm] = useState({
        department_code: '',
        department_name: '',
        description: '',
        display_order: 0,
        status: 'ACTIVE'
    });

    const fetchData = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if (!schoolId || schoolId === 'all') return;
        setLoading(true);
        try {
            const res = await api.get('/hr/departments');
            setDepartments(res.data || []);
        } catch (e: any) {
            console.error('Failed to load departments', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (d: Department) => {
        setEditingId(d.id);
        setMsg(null);
        setForm({
            department_code: d.department_code,
            department_name: d.department_name,
            description: d.description || '',
            display_order: d.display_order || 0,
            status: d.status || 'ACTIVE'
        });
        // The app scrolls inside the main panel, not the window
        document.getElementById('department-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/hr/departments/${editingId}`, form);
            } else {
                await api.post('/hr/departments', form);
            }
            setForm({ department_code: '', department_name: '', description: '', display_order: 0, status: 'ACTIVE' });
            setEditingId(null);
            fetchData();
            setMsg({ type: 'success', text: editingId ? 'Department updated successfully' : 'Department created successfully' });
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} department` });
        }
    };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return (
            <div className="card p-6 text-center">
                <h2 className="text-base font-semibold text-slate-900 mb-2">Department Master</h2>
                <p className="text-slate-500 text-sm">Please select a specific school from the top navigation to view and manage departments.</p>
            </div>
        );
    }

    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Department Master</h2>

            {msg && (
                <Alert tone={msg.type} className="mb-4" onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            <form id="department-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div>
                    <label className="label">Code *</label>
                    <input type="text" required value={form.department_code} onChange={e => setForm({ ...form, department_code: e.target.value.replace(/\D/g, '').replace(/^0+/, '') })} disabled={!!editingId} className="input" />
                </div>
                <div>
                    <label className="label">Name *</label>
                    <input type="text" required value={form.department_name} onChange={e => setForm({ ...form, department_name: e.target.value })} className="input" />
                </div>
                <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" />
                </div>
                <div className="flex gap-2">
                    <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Save'} Department</button>
                    {editingId && (
                        <button type="button" onClick={() => { setEditingId(null); setForm({ department_code: '', department_name: '', description: '', display_order: 0, status: 'ACTIVE' }); }} className="btn-secondary">Cancel</button>
                    )}
                </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2.5 border-b border-slate-200">Code</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Name</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Status</th>
                            {canEdit && <th className="px-3 py-2.5 border-b border-slate-200 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={canEdit ? 4 : 3}><LoadingState label="Loading departments…" /></td></tr> :
                            departments.length === 0 ? <tr><td colSpan={canEdit ? 4 : 3}><EmptyState compact title="No departments yet" description="Add a department using the form above." /></td></tr> :
                            departments.map(d => (
                                <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-3 py-2.5">{d.department_code}</td>
                                    <td className="px-3 py-2.5">{d.department_name}</td>
                                    <td className="px-3 py-2.5">
                                        <Badge tone={d.status === 'ACTIVE' ? 'success' : 'danger'}>{d.status}</Badge>
                                    </td>
                                    {canEdit && (
                                        <td className="px-3 py-2.5 text-right">
                                            <button type="button" onClick={() => handleEdit(d)} className="btn-ghost btn-sm">Edit</button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DepartmentMaster;
