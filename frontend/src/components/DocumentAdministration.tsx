import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { canWrite } from '../utils/permissions';
import { Plus, RefreshCw } from 'lucide-react';
import { PencilIcon } from './icons';
import { auth } from '../api';
import { Alert, ActionBar, Button, DataList, Field, notify } from './ui';
import type { Column } from './ui';

interface DocumentType {
    id: number;
    code: string;
    name: string;
    description: string;
    is_active: boolean;
}

const DocumentAdministration: React.FC = () => {
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // ── Access control ────────────────────────────────────────────
    const isAdminAllBranches = useMemo(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const currentBranch = (localStorage.getItem('currentBranch') || '').trim();
        const isAdmin = canWrite(user, 'setup.school-setup.setup-school');
        const isAllBranches = currentBranch === '' || currentBranch === 'All' || currentBranch === 'All Branches';
        return isAdmin && isAllBranches;
    }, []);

    const [editingDocType, setEditingDocType] = useState<DocumentType | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        is_active: true
    });

    const API_URL = import.meta.env.VITE_API_URL;

        if (!API_URL) {
        throw new Error("VITE_API_URL is not defined");
        }

    useEffect(() => {
        fetchDocumentTypes();
    }, []);

    const fetchDocumentTypes = async () => {
        setLoading(true);
        try {
            const token = auth.getToken();
            const response = await axios.get(`${API_URL}/documents/types`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocumentTypes(response.data);
            setError('');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Could not load document types');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (docType: DocumentType) => {
        setEditingDocType(docType);
        setFormData({
            code: docType.code,
            name: docType.name,
            description: docType.description,
            is_active: docType.is_active
        });
    };

    const handleReset = () => {
        setEditingDocType(null);
        setFormData({ code: '', name: '', description: '', is_active: true });
        setError('');
        setSuccessMessage('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            const token = auth.getToken();
            const headers = { Authorization: `Bearer ${token}` };

            if (editingDocType) {
                await axios.put(`${API_URL}/documents/types/${editingDocType.id}`, formData, { headers });
                setSuccessMessage('Document type saved.');
            } else {
                await axios.post(`${API_URL}/documents/types`, formData, { headers });
                setSuccessMessage('Document type added.');
            }

            fetchDocumentTypes();
            handleReset();
            setFormOpen(false);
            notify.success(editingDocType ? 'Document type saved' : 'Document type added');
            setTimeout(() => setSuccessMessage(''), 4000);

        } catch (err: any) {
            setError(err.response?.data?.message || 'Could not save the document type. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const filteredTypes = documentTypes.filter((t) => {
    const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
        statusFilter === 'all'
            ? true
            : statusFilter === 'active'
                ? t.is_active
                : !t.is_active;

    return matchesSearch && matchesStatus;
    });

    const openAdd = () => { handleReset(); setFormOpen(true); };
    const openEdit = (type: DocumentType) => { handleEdit(type); setFormOpen(true); };
    const openTurnOff = (type: DocumentType) => {
        handleEdit(type);
        setFormData(prev => ({ ...prev, is_active: false }));
        setFormOpen(true);
    };
    const closeForm = () => { handleReset(); setFormOpen(false); };

    const rowActions = (type: DocumentType) => isAdminAllBranches ? (
        <>
            <button type="button" onClick={() => openEdit(type)} className="btn-soft btn-sm min-h-[40px]">
                <PencilIcon className="w-4 h-4" /> Edit
            </button>
            {type.is_active && (
                <button type="button" onClick={() => openTurnOff(type)} className="btn-ghost btn-sm min-h-[40px] text-red-600">
                    Turn off
                </button>
            )}
        </>
    ) : null;

    const columns: Column<DocumentType>[] = [
        { key: 'name', header: 'Document', primary: true, render: t => <span className="font-medium text-slate-900">{t.name}</span> },
        { key: 'description', header: 'Description', secondary: true, render: t => t.description || <span className="text-slate-400">—</span> },
        { key: 'code', header: 'Short code', render: t => <span className="badge-neutral font-mono">{t.code}</span> },
        { key: 'is_active', header: 'Status', render: t => t.is_active ? <span className="badge-success">In use</span> : <span className="badge-danger">Turned off</span> },
        ...(isAdminAllBranches
            ? [{ key: 'actions', header: '', align: 'right' as const, hideOnMobile: true, render: (t: DocumentType) => <div className="flex justify-end gap-1">{rowActions(t)}</div> }]
            : []),
    ];

    return (
        <div className="min-h-full bg-surface-muted p-4 sm:p-6">
            <div className="max-w-5xl mx-auto space-y-4">

                <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm text-slate-600 max-w-xl">
                        The list of documents the school asks students for (for example Aadhaar card or TC).
                        These show up as “Uploaded / Missing” for every student.
                    </p>
                    {isAdminAllBranches && !formOpen && (
                        <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />} className="w-full sm:w-auto min-h-[44px]">
                            Add document type
                        </Button>
                    )}
                </div>

                {!isAdminAllBranches && (
                    <Alert tone="info">Only an admin with “All branches” chosen can add or change document types.</Alert>
                )}

                {successMessage && <Alert tone="success">{successMessage}</Alert>}

                {/* Add / Edit form — Admin @ All Branches only */}
                {isAdminAllBranches && formOpen && (
                    <form onSubmit={handleSubmit} className="card">
                        <div className="card-header py-3">
                            <h3 className="text-base font-semibold text-slate-900">
                                {editingDocType ? `Change “${editingDocType.name}”` : 'Add document type'}
                            </h3>
                        </div>
                        <div className="card-body space-y-4">
                            {error && <Alert tone="error">{error}</Alert>}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Name" htmlFor="da-name" required>
                                    <input
                                        id="da-name"
                                        type="text"
                                        required
                                        className="input"
                                        placeholder="e.g. Aadhaar Card"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </Field>
                                <Field
                                    label="Short code"
                                    htmlFor="da-code"
                                    required
                                    hint={editingDocType ? 'The short code cannot be changed.' : 'One word, cannot be changed later. E.g. AADHAAR, TC'}
                                >
                                    <input
                                        id="da-code"
                                        type="text"
                                        required
                                        disabled={!!editingDocType}
                                        className={`input ${editingDocType ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                        placeholder="e.g. AADHAAR"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    />
                                </Field>
                            </div>

                            <Field label="Description (optional)" htmlFor="da-desc">
                                <textarea
                                    id="da-desc"
                                    rows={2}
                                    className="input resize-none"
                                    placeholder="What this document is"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </Field>

                            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer text-sm text-slate-800">
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <span>
                                    In use
                                    <span className="block text-slate-500">
                                        {formData.is_active ? 'Students will be asked for this document.' : 'Turned off — press Save to stop asking for it.'}
                                    </span>
                                </span>
                            </label>
                        </div>
                        <div className="px-4 sm:px-5 pb-4">
                            <ActionBar className="!mt-0">
                                <Button variant="secondary" size="lg" onClick={closeForm}>Cancel</Button>
                                <Button type="submit" size="lg" loading={loading}>
                                    {editingDocType ? 'Save changes' : 'Save document type'}
                                </Button>
                            </ActionBar>
                        </div>
                    </form>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                        type="search"
                        placeholder="Search by name or code"
                        aria-label="Search document types"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input sm:max-w-xs"
                    />
                    <div className="flex items-center gap-2">
                        <div className="segmented flex-1 sm:flex-none" role="tablist" aria-label="Show">
                            {([['all', 'All'], ['active', 'In use'], ['inactive', 'Turned off']] as const).map(([v, label]) => (
                                <button
                                    key={v}
                                    type="button"
                                    role="tab"
                                    aria-selected={statusFilter === v}
                                    onClick={() => setStatusFilter(v)}
                                    className={`segmented-item flex-1 min-h-[40px] ${statusFilter === v ? 'segmented-item-active' : ''}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={fetchDocumentTypes} className="btn-secondary min-h-[44px]" title="Refresh" aria-label="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <p className="text-sm text-slate-600">{filteredTypes.length} document type{filteredTypes.length === 1 ? '' : 's'}</p>

                {error && !formOpen && <Alert tone="error" onRetry={fetchDocumentTypes}>{error}</Alert>}

                <DataList
                    columns={columns}
                    rows={filteredTypes}
                    rowKey={t => t.id}
                    loading={loading && filteredTypes.length === 0}
                    emptyTitle={documentTypes.length === 0 ? 'No document types yet' : 'Nothing matches your search'}
                    emptyHint={documentTypes.length === 0 && isAdminAllBranches ? 'Tap “Add document type” to start.' : undefined}
                    mobileActions={isAdminAllBranches ? rowActions : undefined}
                />
            </div>
        </div>
    );
};

export default DocumentAdministration;
