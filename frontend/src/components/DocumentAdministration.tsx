import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { canWrite } from '../utils/permissions';
import { PencilIcon, TrashIcon } from './icons';
import { SetupIcon } from './icons';
import { auth } from '../api';
import { Alert, LoadingState, EmptyState } from './ui';

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
            setError(err.response?.data?.message || 'Failed to fetch document types');
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
                setSuccessMessage('Document type updated successfully.');
            } else {
                await axios.post(`${API_URL}/documents/types`, formData, { headers });
                setSuccessMessage('Document type created successfully.');
            }

            fetchDocumentTypes();
            handleReset();
            setTimeout(() => setSuccessMessage(''), 4000);

        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save document type');
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

    return (
        <div className="min-h-full bg-surface-muted p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-brand-600/10">
                        <SetupIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Add Document Category</h2>
                        <p className="text-sm text-slate-500">Manage allowed document categories for the institution</p>
                    </div>
                </div>

                {/* Main Content: Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* LEFT: Add / Edit Form — Admin @ All Branches only */}
                    <div className="lg:col-span-2">
                        {isAdminAllBranches ? (
                            <div className="card">
                                <div className="card-header bg-slate-50 rounded-t-xl">
                                    <h3 className="text-base font-semibold text-slate-900">
                                        {editingDocType ? '✏️ Edit Document Category' : '➕ Add Document Category'}
                                    </h3>
                                </div>

                                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                                    {error && (
                                        <Alert tone="error">{error}</Alert>
                                    )}
                                    {successMessage && (
                                        <Alert tone="success">{successMessage}</Alert>
                                    )}

                                    {/* Document Name */}
                                    <div>
                                        <label className="label">
                                            Document Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="input"
                                            placeholder="e.g. Aadhaar Card"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Document Code */}
                                    <div>
                                        <label className="label">
                                            Document Code <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                required
                                                disabled={!!editingDocType}
                                                className={`input flex-1 ${editingDocType ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                placeholder="e.g. AADHAAR"
                                                value={formData.code}
                                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                            />
                                            <label className="flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                    checked={formData.is_active}
                                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                />
                                                Is Active
                                            </label>
                                        </div>
                                        {!editingDocType && (
                                            <p className="text-xs text-slate-400 mt-1">Unique code. Cannot be changed later. E.g. AADHAAR, TC</p>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea
                                            rows={3}
                                            className="input resize-none"
                                            placeholder="Document Description"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="btn-primary"
                                        >
                                            {loading ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="btn-secondary"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="card border-amber-200 flex flex-col items-center justify-center p-8 text-center h-full min-h-[200px]">
                                <div className="text-3xl mb-3">🔒</div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-1">Access Restricted</h3>
                                <p className="text-xs text-slate-500">
                                    Only <span className="font-medium text-amber-600">Admins</span> at{' '}
                                    <span className="font-medium text-amber-600">All Branches</span> level can
                                    add or edit document categories.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Document Categories Table */}
                    <div className="lg:col-span-3">
                        <div className="card">
                            <div className="card-header flex-wrap bg-slate-50 rounded-t-xl">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-semibold text-slate-900">📋 Document categories</h3>
                                    <span className="badge-brand">
                                        Total: {filteredTypes.length}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Category name"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="input w-40"
                                    />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) =>
                                            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                                        }
                                        className="input w-auto"
                                    >
                                        <option value="all">All Type</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                    <button
                                        onClick={fetchDocumentTypes}
                                        className="btn-warn"
                                        title="Refresh"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="">
                                        <tr>
                                            <th className="px-5 py-3 text-left">
                                                Document category
                                            </th>
                                            <th className="px-5 py-3 text-left">
                                                Code
                                            </th>
                                            <th className="px-5 py-3 text-left">
                                                Type
                                            </th>
                                            <th className="px-5 py-3 text-right">
                                                Edit | Delete
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {loading && filteredTypes.length === 0 ? (
                                            <tr>
                                                <td colSpan={4}>
                                                    <LoadingState />
                                                </td>
                                            </tr>
                                        ) : filteredTypes.length === 0 ? (
                                            <tr>
                                                <td colSpan={4}>
                                                    <EmptyState compact title="No category" />
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTypes.map((type) => (
                                                <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3 text-sm font-medium text-slate-900">
                                                        {type.name}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="badge-neutral font-mono">
                                                            {type.code}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {type.is_active ? (
                                                            <span className="badge-success">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="badge-danger">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        {isAdminAllBranches ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(type)}
                                                                    className="btn-soft btn-sm mr-1"
                                                                    title="Edit"
                                                                >
                                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700"
                                                                    title="Delete (Deactivate)"
                                                                    onClick={() => {
                                                                        handleEdit(type);
                                                                        setFormData(prev => ({ ...prev, is_active: false }));
                                                                    }}
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">View only</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DocumentAdministration;
