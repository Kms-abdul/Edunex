import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, LoadingState, EmptyState, Badge } from './ui';

interface Designation {
    id: number;
    department_id: number;
    department_name: string;
    designation_code: string;
    designation_name: string;
    description: string;
    display_order: number;
    status: string;
}

export const DesignationMaster: React.FC = () => {
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('hr.hr.designations', 'write');

    const [form, setForm] = useState({
        department_id: '',
        designation_code: '',
        designation_name: '',
        description: '',
        display_order: 0,
        status: 'ACTIVE'
    });

    const fetchData = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if (!schoolId || schoolId === 'all') return;
        setLoading(true);
        try {
            const [desigRes, deptRes] = await Promise.all([
                api.get('/hr/designations'),
                api.get('/hr/departments')
            ]);
            setDesignations(desigRes.data || []);
            setDepartments(deptRes.data || []);
        } catch (e: any) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (d: Designation) => {
        setEditingId(d.id);
        setMsg(null);
        setForm({
            department_id: String(d.department_id),
            designation_code: d.designation_code,
            designation_name: d.designation_name,
            description: d.description || '',
            display_order: d.display_order || 0,
            status: d.status || 'ACTIVE'
        });
        // The app scrolls inside the main panel, not the window
        document.getElementById('designation-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                department_id: Number(form.department_id)
            };
            if (editingId) {
                await api.put(`/hr/designations/${editingId}`, payload);
                setMsg({ type: 'success', text: 'Designation updated successfully' });
            } else {
                await api.post('/hr/designations', payload);
                setMsg({ type: 'success', text: 'Designation created successfully' });
            }
            setForm({ department_id: '', designation_code: '', designation_name: '', description: '', display_order: 0, status: 'ACTIVE' });
            setEditingId(null);
            fetchData();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} designation` });
        }
    };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return (
            <div className="card p-6 text-center">
                <h2 className="text-base font-semibold text-slate-900 mb-2">Designation Master</h2>
                <p className="text-slate-500 text-sm">Please select a specific school from the top navigation to view and manage designations.</p>
            </div>
        );
    }

    return (
        <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Designation Master</h2>

            {msg && (
                <Alert tone={msg.type} className="mb-4" onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            <form id="designation-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div>
                    <label className="label">Department *</label>
                    <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="input">
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Code *</label>
                    <input type="text" required value={form.designation_code} onChange={e => setForm({ ...form, designation_code: e.target.value.replace(/^0+/, '') })} disabled={!!editingId} className="input" />
                </div>
                <div>
                    <label className="label">Name *</label>
                    <input type="text" required value={form.designation_name} onChange={e => setForm({ ...form, designation_name: e.target.value })} className="input" />
                </div>
                <div className="md:col-span-3 flex gap-2">
                    <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Save'} Designation</button>
                    {editingId && (
                        <button type="button" onClick={() => { setEditingId(null); setForm({ department_id: '', designation_code: '', designation_name: '', description: '', display_order: 0, status: 'ACTIVE' }); }} className="btn-secondary">Cancel</button>
                    )}
                </div>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2.5 border-b border-slate-200">Department</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Code</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Name</th>
                            <th className="px-3 py-2.5 border-b border-slate-200">Status</th>
                            {canEdit && <th className="px-3 py-2.5 border-b border-slate-200 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <tr><td colSpan={canEdit ? 5 : 4}><LoadingState label="Loading designations…" /></td></tr> :
                            designations.length === 0 ? <tr><td colSpan={canEdit ? 5 : 4}><EmptyState compact title="No designations yet" description="Add a designation using the form above." /></td></tr> :
                            designations.map(d => (
                                <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-3 py-2.5">{d.department_name}</td>
                                    <td className="px-3 py-2.5">{d.designation_code}</td>
                                    <td className="px-3 py-2.5">{d.designation_name}</td>
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

export default DesignationMaster;
