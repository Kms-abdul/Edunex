import React, { useState, useEffect } from 'react';
import api from '../../api';
import { notify } from '../ui/feedback';
import { Alert, LoadingState, EmptyState } from '../ui';

interface DocumentType {
    id: number;
    code: string;
    name: string;
    is_required: boolean;
    allowed_extensions: string;
    max_file_size: number;
    requires_document_number: boolean;
    requires_expiry: boolean;
}

interface StaffDocument {
    id: number;
    document_type_id: number;
    document_type_name: string;
    document_no: string | null;
    issue_date: string | null;
    expiry_date: string | null;
    notes: string | null;
    file_name: string;
    uploaded_at: string;
    is_verified: boolean;
}

interface Props {
    staffId: number;
    mode: 'view' | 'edit';
}

export const StaffDocuments: React.FC<Props> = ({ staffId, mode }) => {
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [documents, setDocuments] = useState<StaffDocument[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Upload state
    const [uploadingTypeId, setUploadingTypeId] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Meta state for the upload
    const [metaForm, setMetaForm] = useState({
        document_no: '',
        issue_date: '',
        expiry_date: '',
        notes: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const fetchDocuments = async () => {
        try {
            const typesRes = await api.get('/hr/staff-document-types');
            setTypes(typesRes.data || []);
            
            const docsRes = await api.get(`/hr/staff/${staffId}/documents`);
            setDocuments(docsRes.data || []);
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [staffId]);

    const handleUploadClick = (typeId: number) => {
        setUploadingTypeId(typeId);
        setMetaForm({ document_no: '', issue_date: '', expiry_date: '', notes: '' });
        setSelectedFile(null);
        setUploadError(null);
    };

    const handleUploadSubmit = async () => {
        if (!selectedFile || !uploadingTypeId) {
            setUploadError("Please select a file to upload.");
            return;
        }

        const docType = types.find(t => t.id === uploadingTypeId);
        if (!docType) return;
        
        if (selectedFile.size > docType.max_file_size) {
            setUploadError(`File size exceeds the limit of ${Math.round(docType.max_file_size / 1048576)}MB.`);
            return;
        }
        
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
        const allowedExts = docType.allowed_extensions.split(',').map(e => e.trim().toLowerCase().replace('.', ''));
        if (!allowedExts.includes(ext)) {
            setUploadError(`Invalid file type. Allowed: ${docType.allowed_extensions}`);
            return;
        }

        if (docType.requires_document_number && !metaForm.document_no) {
            setUploadError("Document Number is required for this document type.");
            return;
        }

        if (docType.requires_expiry && !metaForm.expiry_date) {
            setUploadError("Expiry Date is required for this document type.");
            return;
        }

        const formData = new FormData();
        formData.append('staff_id', staffId.toString());
        formData.append('document_type_id', uploadingTypeId.toString());
        formData.append('file', selectedFile);
        if (metaForm.document_no) formData.append('document_no', metaForm.document_no);
        if (metaForm.issue_date) formData.append('issue_date', metaForm.issue_date);
        if (metaForm.expiry_date) formData.append('expiry_date', metaForm.expiry_date);
        if (metaForm.notes) formData.append('notes', metaForm.notes);

        try {
            setLoading(true);
            await api.post('/hr/staff/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchDocuments();
            setUploadingTypeId(null);
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    if (loading && types.length === 0) {
        return <LoadingState label="Loading documents…" />;
    }

    return (
        <div className="space-y-6">
            {uploadingTypeId !== null && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="card shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-semibold text-slate-900">Upload Document</h3>
                            <button type="button" aria-label="Close" onClick={() => setUploadingTypeId(null)} className="btn-icon">✕</button>
                        </div>
                        {uploadError && <Alert tone="error" className="mb-4">{uploadError}</Alert>}
                        
                        <div className="space-y-4">
                            <div>
                                <label className="label">File *</label>
                                <input 
                                    type="file" 
                                    className="w-full text-sm" 
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            
                            {(() => {
                                const docType = types.find(t => t.id === uploadingTypeId);
                                return (
                                    <>
                                        <div>
                                            <label className="label">Document Number {docType?.requires_document_number ? '*' : ''}</label>
                                            <input type="text" className="input" value={metaForm.document_no} onChange={e => setMetaForm({...metaForm, document_no: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Issue Date</label>
                                                <input type="date" className="input" value={metaForm.issue_date} onChange={e => setMetaForm({...metaForm, issue_date: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="label">Expiry Date {docType?.requires_expiry ? '*' : ''}</label>
                                                <input type="date" className="input" value={metaForm.expiry_date} onChange={e => setMetaForm({...metaForm, expiry_date: e.target.value})} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label">Notes</label>
                                            <input type="text" className="input" value={metaForm.notes} onChange={e => setMetaForm({...metaForm, notes: e.target.value})} />
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setUploadingTypeId(null)} className="btn-secondary">Cancel</button>
                            <button onClick={handleUploadSubmit} disabled={loading} className="btn-primary">
                                {loading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Document Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {types.map(type => {
                            const existingDoc = documents.find(d => d.document_type_id === type.id);
                            return (
                                <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-slate-900">{type.name}</div>
                                        {type.is_required && <span className="badge-danger mt-1">Required</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {existingDoc ? (
                                            <div>
                                                {existingDoc.document_no && <div>No: {existingDoc.document_no}</div>}
                                                {existingDoc.expiry_date && <div>Expires: {existingDoc.expiry_date}</div>}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {existingDoc ? (
                                            <span className="badge-success">
                                                Uploaded
                                            </span>
                                        ) : (
                                            <span className="badge-neutral">
                                                Missing
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {existingDoc && (
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.get(`/hr/staff/download/${existingDoc.id}`, { responseType: 'blob' });
                                                        const blob = new Blob([res.data], { type: res.headers['content-type'] });
                                                        const url = URL.createObjectURL(blob);
                                                        window.open(url, '_blank');
                                                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                                                    } catch (err) {
                                                        console.error("Failed to download document:", err);
                                                        notify("Failed to download document. Please try again.");
                                                    }
                                                }}
                                                className="btn-ghost btn-sm text-brand-600"
                                            >
                                                View
                                            </button>
                                        )}
                                        {mode === 'edit' && (
                                            <button 
                                                onClick={() => handleUploadClick(type.id)}
                                                className="btn-soft btn-sm ml-2"
                                            >
                                                {existingDoc ? 'Update' : 'Upload'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {types.length === 0 && (
                            <tr>
                                <td colSpan={4}>
                                    <EmptyState compact title="No document types configured" description="No document types are configured for this school yet." />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
};
