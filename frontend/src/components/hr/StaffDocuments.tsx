import React, { useState, useEffect } from 'react';
import api from '../../api';
import { notify } from '../ui/feedback';
import { Eye, Upload } from 'lucide-react';
import { Alert, LoadingState, Badge, Button, DataList, Field } from '../ui';
import type { Column } from '../ui';

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

    const viewDocument = async (existingDoc: StaffDocument) => {
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
    };

    const docFor = (type: DocumentType) => documents.find(d => d.document_type_id === type.id);
    const uploadType = types.find(t => t.id === uploadingTypeId);
    const uploadedCount = types.filter(t => docFor(t)).length;

    const rowActions = (type: DocumentType) => {
        const existingDoc = docFor(type);
        return (
            <>
                {existingDoc && (
                    <Button variant="secondary" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={(e) => { e.stopPropagation(); viewDocument(existingDoc); }}>
                        View
                    </Button>
                )}
                {mode === 'edit' && (
                    <Button variant="soft" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={(e) => { e.stopPropagation(); handleUploadClick(type.id); }}>
                        {existingDoc ? 'Replace' : 'Upload'}
                    </Button>
                )}
            </>
        );
    };

    const columns: Column<DocumentType>[] = [
        {
            key: 'name', header: 'Document', primary: true, render: type => (
                <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{type.name}</span>
                    {type.is_required && <Badge tone="danger">Must upload</Badge>}
                </span>
            ),
        },
        {
            key: 'status', header: 'Status', secondary: true, render: type => docFor(type)
                ? <Badge tone="success">Uploaded</Badge>
                : <Badge tone="neutral">Not uploaded</Badge>,
        },
        {
            key: 'details', header: 'Details', render: type => {
                const existingDoc = docFor(type);
                if (!existingDoc || (!existingDoc.document_no && !existingDoc.expiry_date)) return <span className="text-slate-400">—</span>;
                return (
                    <div>
                        {existingDoc.document_no && <div>No. {existingDoc.document_no}</div>}
                        {existingDoc.expiry_date && <div>Expires {existingDoc.expiry_date}</div>}
                    </div>
                );
            },
        },
        { key: 'actions', header: '', align: 'right', hideOnMobile: true, render: type => <div className="flex justify-end gap-2">{rowActions(type)}</div> },
    ];

    return (
        <div className="space-y-4">
            {uploadingTypeId !== null && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
                    <div className="card shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="card-header">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-slate-900">Upload {uploadType?.name || 'document'}</h3>
                                {uploadType && (
                                    <p className="text-xs text-slate-500">
                                        File types: {uploadType.allowed_extensions} · Up to {Math.round(uploadType.max_file_size / 1048576)} MB
                                    </p>
                                )}
                            </div>
                            <button type="button" aria-label="Close" onClick={() => setUploadingTypeId(null)} className="btn-icon">✕</button>
                        </div>
                        <div className="card-body space-y-4">
                            {uploadError && <Alert tone="error">{uploadError}</Alert>}

                            <Field label="Choose the file" required>
                                <input
                                    type="file"
                                    className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-brand-700"
                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                />
                            </Field>
                            <Field label={uploadType?.requires_document_number ? 'Document number' : 'Document number (optional)'} required={!!uploadType?.requires_document_number}>
                                <input type="text" className="input" value={metaForm.document_no} onChange={e => setMetaForm({...metaForm, document_no: e.target.value})} />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Issue date (optional)">
                                    <input type="date" className="input" value={metaForm.issue_date} onChange={e => setMetaForm({...metaForm, issue_date: e.target.value})} />
                                </Field>
                                <Field label={uploadType?.requires_expiry ? 'Expiry date' : 'Expiry date (optional)'} required={!!uploadType?.requires_expiry}>
                                    <input type="date" className="input" value={metaForm.expiry_date} onChange={e => setMetaForm({...metaForm, expiry_date: e.target.value})} />
                                </Field>
                            </div>
                            <Field label="Note (optional)">
                                <input type="text" className="input" value={metaForm.notes} onChange={e => setMetaForm({...metaForm, notes: e.target.value})} />
                            </Field>
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
                            <Button variant="secondary" onClick={() => setUploadingTypeId(null)}>Cancel</Button>
                            <Button onClick={handleUploadSubmit} loading={loading} disabled={!selectedFile}>
                                {loading ? 'Uploading…' : 'Upload file'}
                            </Button>
                        </div>
                        {!selectedFile && <p className="px-5 pb-4 -mt-2 text-xs text-slate-500 sm:text-right">Choose a file first.</p>}
                    </div>
                </div>
            )}

            {types.length > 0 && (
                <p className="text-sm text-slate-600">
                    {uploadedCount} of {types.length} documents uploaded.
                </p>
            )}

            <DataList
                columns={columns}
                rows={types}
                rowKey={type => type.id}
                emptyTitle="No document types set up"
                emptyHint="No document types are set up for this school yet."
                mobileActions={type => (docFor(type) || mode === 'edit') ? rowActions(type) : null}
            />
        </div>
    );
};
