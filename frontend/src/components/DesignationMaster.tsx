import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm, plain } from './hr-setup/MasterParts';

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
    const [showForm, setShowForm] = useState(false);
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
        setShowForm(true);
        scrollToForm('designation-form');
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
                setMsg({ type: 'success', text: 'Job title saved' });
            } else {
                await api.post('/hr/designations', payload);
                setMsg({ type: 'success', text: 'Job title added' });
            }
            setForm({ department_id: '', designation_code: '', designation_name: '', description: '', display_order: 0, status: 'ACTIVE' });
            setEditingId(null);
            setShowForm(false);
            fetchData();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Could not save the job title. Please try again.` });
        }
    };

    const blankForm = { department_id: '', designation_code: '', designation_name: '', description: '', display_order: 0, status: 'ACTIVE' };
    const openAdd = () => {
        setEditingId(null);
        setForm(blankForm);
        setMsg(null);
        setShowForm(true);
        scrollToForm('designation-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blankForm); setShowForm(false); };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="job titles" />;
    }

    const columns: Column<Designation>[] = [
        { key: 'designation_name', header: 'Job title', primary: true, render: d => <span className="font-medium text-slate-900">{d.designation_name}</span> },
        { key: 'department_name', header: 'Department', secondary: true, render: d => d.department_name || '—' },
        { key: 'designation_code', header: 'Code' },
        { key: 'status', header: 'Status', render: d => <Badge tone={d.status === 'ACTIVE' ? 'success' : 'danger'}>{plain(d.status)}</Badge> },
        ...(canEdit ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (d: Designation) => <EditButton onClick={() => handleEdit(d)} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Job titles (designations) like Teacher, Clerk or Driver. Each one belongs to a department."
                addLabel={showForm && !editingId ? undefined : 'Add job title'}
                onAdd={openAdd}
                count={designations.length}
                countLabel={designations.length === 1 ? 'job title' : 'job titles'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && (
                <FormCard
                    id="designation-form"
                    title={editingId ? 'Change job title' : 'New job title'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save job title"
                >
                    <Field label="Department" required className="sm:col-span-2">
                        <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="input">
                            <option value="">Choose a department</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                        </select>
                    </Field>
                    <Field label="Code" required hint={editingId ? 'The code cannot be changed.' : 'A short code, for example TCH.'}>
                        <input type="text" required value={form.designation_code} onChange={e => setForm({ ...form, designation_code: e.target.value.replace(/^0+/, '') })} disabled={!!editingId} className="input" />
                    </Field>
                    <Field label="Job title" required>
                        <input type="text" required value={form.designation_name} onChange={e => setForm({ ...form, designation_name: e.target.value })} className="input" placeholder="e.g. Teacher" />
                    </Field>
                </FormCard>
            )}

            <DataList
                columns={columns}
                rows={designations}
                rowKey={d => d.id}
                loading={loading}
                emptyTitle="No job titles yet"
                emptyHint={'Tap \u201cAdd job title\u201d to make the first one.'}
                mobileActions={canEdit ? d => <EditButton onClick={() => handleEdit(d)} /> : undefined}
            />
        </div>
    );
};

export default DesignationMaster;
