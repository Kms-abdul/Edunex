import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Alert, Badge, DataList, Field } from '../ui';
import type { Column } from '../ui';
import { MasterTop, FormCard, EditButton, CheckRow, scrollToForm } from '../hr-setup/MasterParts';


interface DocumentType {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_required: boolean;
    allowed_extensions: string;
    max_file_size: number;
    requires_expiry: boolean;
    requires_document_number: boolean;
    is_active: boolean;
}

export const StaffDocumentTypeMaster: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const canWrite = hasPermission('hr.hr.staff-document-types', 'write');

    const [list, setList] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);

    const blank = { 
        code: '', 
        name: '', 
        description: '', 
        is_required: false, 
        allowed_extensions: 'pdf,jpg,jpeg,png', 
        max_file_size: 5242880, 
        requires_expiry: false, 
        requires_document_number: false, 
        is_active: true 
    };
    
    const [form, setForm] = useState(blank);

    const fetchData = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if ((!schoolId || schoolId === 'all') && user?.role !== 'SuperAdmin') return;
        setLoading(true);
        try {
            const res = await api.get('/hr/staff-document-types');
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
            if (editingId) {
                await api.put(`/hr/staff-document-types/${editingId}`, form);
                setMsg({ type: 'success', text: 'Document type saved.' });
            } else {
                await api.post('/hr/staff-document-types', form);
                setMsg({ type: 'success', text: 'Document type added.' });
            }
            setShowForm(false);
            fetchData();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Could not save the document type. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (item: DocumentType) => {
        setForm({ ...item, description: item.description || '' });
        setEditingId(item.id);
        setShowForm(true);
        setMsg(null);
        scrollToForm('doc-type-form');
    };

    const openAdd = () => { setForm(blank); setEditingId(null); setShowForm(true); setMsg(null); scrollToForm('doc-type-form'); };

    const columns: Column<DocumentType>[] = [
        { key: 'name', header: 'Document', primary: true, render: t => <span className="font-medium text-slate-900">{t.name}</span> },
        { key: 'description', header: 'Note', secondary: true, render: t => t.description || <span className="text-slate-400">—</span> },
        { key: 'code', header: 'Code', render: t => <span className="font-mono text-xs">{t.code}</span> },
        { key: 'allowed_extensions', header: 'File types' },
        { key: 'is_required', header: 'Must upload?', render: t => t.is_required ? <Badge tone="danger">Yes</Badge> : <span className="text-slate-500">No</span> },
        { key: 'is_active', header: 'Status', render: t => <Badge tone={t.is_active ? 'success' : 'danger'}>{t.is_active ? 'Active' : 'Inactive'}</Badge> },
        ...(canWrite ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (t: DocumentType) => <EditButton onClick={() => handleEdit(t)} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="The papers you collect from staff, like Aadhaar card, degree certificate or experience letter."
                addLabel={canWrite && !showForm ? 'Add document type' : undefined}
                onAdd={canWrite ? openAdd : undefined}
                count={list.length}
                countLabel={list.length === 1 ? 'document type' : 'document types'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm ? (
                <FormCard
                    id="doc-type-form"
                    title={editingId ? 'Change document type' : 'New document type'}
                    onSubmit={handleSubmit}
                    onCancel={() => setShowForm(false)}
                    saveLabel="Save document type"
                    saving={saving}
                >
                    <Field label="Document name" required>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="input"
                            placeholder="e.g. Aadhaar card"
                        />
                    </Field>
                    <Field label="Short code" required hint={editingId ? 'The code cannot be changed.' : 'For example AADHAAR.'}>
                        <input
                            type="text"
                            required
                            disabled={!!editingId}
                            value={form.code}
                            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            className="input disabled:bg-slate-100"
                            placeholder="e.g. AADHAAR"
                        />
                    </Field>
                    <Field label="Note (optional)" className="sm:col-span-2">
                        <input
                            type="text"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="input"
                        />
                    </Field>
                    <Field label="Allowed file types" hint="Separate with commas, for example pdf,jpg,png.">
                        <input
                            type="text"
                            value={form.allowed_extensions}
                            onChange={e => setForm({ ...form, allowed_extensions: e.target.value })}
                            className="input"
                            placeholder="pdf,jpg,jpeg,png"
                        />
                    </Field>
                    <Field label="Biggest file allowed (MB)">
                        <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={Math.round(form.max_file_size / 1048576)}
                            onChange={e => setForm({ ...form, max_file_size: parseInt(e.target.value) * 1048576 })}
                            className="input"
                        />
                    </Field>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <CheckRow label="Must upload" hint="Every staff member needs this document." checked={form.is_required} onChange={v => setForm({ ...form, is_required: v })} />
                        <CheckRow label="Ask for document number" hint="For example the Aadhaar number." checked={form.requires_document_number} onChange={v => setForm({ ...form, requires_document_number: v })} />
                        <CheckRow label="Ask for expiry date" hint="For documents that run out, like a licence." checked={form.requires_expiry} onChange={v => setForm({ ...form, requires_expiry: v })} />
                        <CheckRow label="In use" hint="Turn off to hide it from upload lists." checked={form.is_active} onChange={v => setForm({ ...form, is_active: v })} />
                    </div>
                </FormCard>
            ) : (
                <DataList
                    columns={columns}
                    rows={list}
                    rowKey={t => t.id}
                    loading={loading}
                    emptyTitle="No document types yet"
                    emptyHint={canWrite ? 'Add a document type to start collecting staff documents.' : undefined}
                    mobileActions={canWrite ? t => <EditButton onClick={() => handleEdit(t)} /> : undefined}
                />
            )}
        </div>
    );
};
