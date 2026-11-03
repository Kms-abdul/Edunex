import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm, plain } from './hr-setup/MasterParts';

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
    const [showForm, setShowForm] = useState(false);
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
        setShowForm(true);
        scrollToForm('department-form');
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
            setShowForm(false);
            fetchData();
            setMsg({ type: 'success', text: editingId ? 'Department saved' : 'Department added' });
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} department` });
        }
    };

    const blankForm = { department_code: '', department_name: '', description: '', display_order: 0, status: 'ACTIVE' };
    const openAdd = () => {
        setEditingId(null);
        setForm(blankForm);
        setMsg(null);
        setShowForm(true);
        scrollToForm('department-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blankForm); setShowForm(false); };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="departments" />;
    }

    const columns: Column<Department>[] = [
        { key: 'department_name', header: 'Name', primary: true, render: d => <span className="font-medium text-slate-900">{d.department_name}</span> },
        { key: 'department_code', header: 'Code', secondary: true, render: d => <span className="text-slate-600">Code {d.department_code}</span> },
        { key: 'status', header: 'Status', render: d => <Badge tone={d.status === 'ACTIVE' ? 'success' : 'danger'}>{plain(d.status)}</Badge> },
        ...(canEdit ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (d: Department) => <EditButton onClick={() => handleEdit(d)} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Departments group your staff, for example Teaching, Office or Transport."
                addLabel={showForm && !editingId ? undefined : 'Add department'}
                onAdd={openAdd}
                count={departments.length}
                countLabel={departments.length === 1 ? 'department' : 'departments'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && (
                <FormCard
                    id="department-form"
                    title={editingId ? 'Change department' : 'New department'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save department"
                >
                    <Field label="Department number" required hint={editingId ? 'The number cannot be changed.' : 'Numbers only, for example 1, 2, 3.'}>
                        <input type="text" inputMode="numeric" required value={form.department_code} onChange={e => setForm({ ...form, department_code: e.target.value.replace(/\D/g, '').replace(/^0+/, '') })} disabled={!!editingId} className="input" />
                    </Field>
                    <Field label="Department name" required>
                        <input type="text" required value={form.department_name} onChange={e => setForm({ ...form, department_name: e.target.value })} className="input" placeholder="e.g. Teaching" />
                    </Field>
                    <Field label="Note (optional)" className="sm:col-span-2">
                        <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" />
                    </Field>
                </FormCard>
            )}

            <DataList
                columns={columns}
                rows={departments}
                rowKey={d => d.id}
                loading={loading}
                emptyTitle="No departments yet"
                emptyHint={'Tap \u201cAdd department\u201d to make the first one.'}
                mobileActions={canEdit ? d => <EditButton onClick={() => handleEdit(d)} /> : undefined}
            />
        </div>
    );
};

export default DepartmentMaster;
