import React, { useState, useEffect } from 'react';
import { Check, Download, Search, Upload, X } from 'lucide-react';
import api from '../api';
import { auth } from '../api';
import { Student } from '../types';
import axios from 'axios';
import { notify } from './ui/feedback';
import { Alert, LoadingState, EmptyState, Steps, ActionBar, Button, Field, DataList } from './ui';
import type { Column } from './ui';
import { StudentAvatar, classLabel } from './students/common';
import { API_URL } from '../config'; // shared API address (works with or without VITE_API_URL)

interface DocumentType {
    id: number;
    code: string;
    name: string;
}

interface StudentDocument {
    id: number;
    document_type_id: number;
    document_type_code: string;
    document_type_name: string;
    document_no: string;
    issued_by: string;
    issue_date: string;
    notes: string;
    file_name: string;
    uploaded_at: string;
    is_verified: boolean;
    upload_by_name: string;
}

interface ClassItem {
    id: number;
    class_name: string;
}

const STEPS = ['Find the student', 'Documents'];

const StudentDocumentManagement: React.FC = () => {
    const [formOpen, setFormOpen] = useState(false);
    // 1. FILTER + SEARCH STATE
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [admissionNo, setAdmissionNo] = useState('');
    const [studentName, setStudentName] = useState('');
    const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);

    // 2. STUDENT LIST STATE
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // 3. SELECTED STUDENT & DOCUMENTS STATE
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [studentDocuments, setStudentDocuments] = useState<StudentDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);

    // 4. UPLOAD DOCUMENT STATE
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [uploadDocTypeId, setUploadDocTypeId] = useState('');
    const [uploadDocNo, setUploadDocNo] = useState('');
    const [uploadIssuedBy, setUploadIssuedBy] = useState('');
    const [uploadIssueDate, setUploadIssueDate] = useState('');
    const [uploadNotes, setUploadNotes] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');


    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(() => console.error("Failed loading classes"));

        loadDocumentTypes();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', { params: { class: selectedClass, branch, academic_year: academicYear } })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(() => setSectionOptions([]));
    }, [selectedClass]);

    const loadDocumentTypes = async () => {
        try {
            const token = auth.getToken();
            const response = await axios.get(`${API_URL}/documents/types`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocumentTypes(response.data.filter((t: any) => t.is_active));
        } catch (error) {
            console.error("Failed to load document types:", error);
        }
    };

    const handleSearch = () => {
        setLoadingStudents(true);
        setSelectedStudent(null);
        setStudentDocuments([]);
        setHasSearched(true);

        const globalBranch = localStorage.getItem('currentBranch') || '';
        const searchQuery = admissionNo || studentName || '';

        api.get('/students', {
            params: {
                class: selectedClass || '',
                section: selectedSection || '',
                search: searchQuery,
                include_inactive: "false",
                branch: globalBranch === "All" || globalBranch === "All Branches" ? "All" : globalBranch
            }
        })
            .then(res => setStudents(res.data.students || []))
            .catch(() => setStudents([]))
            .finally(() => setLoadingStudents(false));
    };

    const handleReset = () => {
        setSelectedClass('');
        setSelectedSection('');
        setAdmissionNo('');
        setStudentName('');
        setStudents([]);
        setSelectedStudent(null);
        setStudentDocuments([]);
        setHasSearched(false);
    };

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        // keep the search results so "Change student" goes straight back to them
        loadStudentDocuments(student.student_id || 0);
        resetUploadForm();
    };

    const loadStudentDocuments = async (studentId: any) => {
        setLoadingDocs(true);
        try {
            const token = auth.getToken();
            const res = await axios.get(`${API_URL}/documents/student/${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudentDocuments(res.data || []);
        } catch (error) {
            setStudentDocuments([]);
        } finally {
            setLoadingDocs(false);
        }
    };

    const resetUploadForm = () => {
        setUploadDocTypeId('');
        setUploadDocNo('');
        setUploadIssuedBy('');
        setUploadIssueDate('');
        setUploadNotes('');
        setUploadFile(null);
        setUploadError('');
        setUploadSuccess('');
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        if (!uploadDocTypeId) { setUploadError('Choose which document this is.'); return; }
        if (!uploadFile) { setUploadError('Choose a file first.'); return; }

        setUploading(true);
        setUploadError('');
        setUploadSuccess('');

        const formData = new FormData();
        const sId = selectedStudent.student_id || 0;
        formData.append('student_id', sId.toString());
        formData.append('document_type_id', uploadDocTypeId);
        formData.append('file', uploadFile);
        if (uploadDocNo) formData.append('document_no', uploadDocNo);
        if (uploadIssuedBy) formData.append('issued_by', uploadIssuedBy);
        if (uploadIssueDate) formData.append('issue_date', uploadIssueDate);
        if (uploadNotes) formData.append('notes', uploadNotes);

        try {
            const token = auth.getToken();
            await axios.post(`${API_URL}/documents/upload`, formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
            setUploadSuccess('Document saved.');
            setFormOpen(false);
            notify.success('Document saved');
            resetUploadForm();
            loadStudentDocuments(sId);
            setTimeout(() => setUploadSuccess(''), 4000);
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'Could not upload the document. Try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadDocument = async (docId: number, fileName: string) => {
        try {
            const token = auth.getToken();
            const response = await axios.get(`${API_URL}/documents/download/${docId}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch {
            notify.error('Could not open the document. It may have been removed.');
        }
    };


    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // ── What is uploaded and what is missing, per document type ──
    const docsForType = (typeId: number) => studentDocuments.filter(d => d.document_type_id === typeId);
    const activeTypeIds = new Set(documentTypes.map(t => t.id));
    const otherDocuments = studentDocuments.filter(d => !activeTypeIds.has(d.document_type_id));
    const missingCount = documentTypes.filter(t => docsForType(t.id).length === 0).length;

    const openUpload = (typeId?: number) => {
        resetUploadForm();
        if (typeId) setUploadDocTypeId(String(typeId));
        setFormOpen(true);
    };

    const docLine = (doc: StudentDocument) => (
        <div key={doc.id} className="flex items-center justify-between gap-3 py-1.5">
            <div className="min-w-0 text-sm text-slate-600">
                {doc.document_no && <span className="font-mono text-slate-800">{doc.document_no} · </span>}
                Added {formatDate(doc.uploaded_at)}{doc.upload_by_name ? ` by ${doc.upload_by_name}` : ''}
                {doc.issued_by && <span className="block text-xs text-slate-500">Given by {doc.issued_by}{doc.issue_date ? ` on ${formatDate(doc.issue_date)}` : ''}</span>}
            </div>
            <button
                type="button"
                onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                className="btn-soft btn-sm min-h-[40px] flex-shrink-0"
            >
                <Download className="w-4 h-4" /> Open
            </button>
        </div>
    );

    const studentColumns: Column<Student>[] = [
        {
            key: 'name', header: 'Student', primary: true,
            render: s => (
                <span className="inline-flex items-center gap-2.5">
                    <StudentAvatar src={s.photo} name={s.name} size="sm" />
                    {s.name}
                </span>
            ),
        },
        { key: 'admNo', header: 'Admission number', secondary: true, render: s => s.admNo || '—' },
        { key: 'class', header: 'Class', render: s => classLabel(s.class, s.section) },
    ];

    /* ------------------------------------------------------------ Step 1: find the student */
    if (!selectedStudent) {
        return (
            <div className="min-h-full bg-surface-muted p-4 sm:p-6">
                <div className="w-full max-w-[1600px] mx-auto space-y-4">
                    <Steps steps={STEPS} current={0} />
                    <p className="text-sm text-slate-600">Find the student, then see which documents are uploaded and which are missing.</p>
                    <div className="card">
                        <div className="card-body space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Field label="Class" htmlFor="sdm-class">
                                    <select id="sdm-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                                        <option value="">All classes</option>
                                        {classOptions.map(c => (
                                            <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Section" htmlFor="sdm-section">
                                    <select id="sdm-section" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass} className="input">
                                        <option value="">All sections</option>
                                        {sectionOptions.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Admission number" htmlFor="sdm-adm">
                                    <input
                                        id="sdm-adm"
                                        type="text"
                                        value={admissionNo}
                                        onChange={(e) => setAdmissionNo(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="e.g. 2026-003"
                                        className="input"
                                    />
                                </Field>
                                <Field label="Name" htmlFor="sdm-name">
                                    <input
                                        id="sdm-name"
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="Student name"
                                        className="input"
                                    />
                                </Field>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={handleSearch} loading={loadingStudents} icon={<Search className="w-4 h-4" />} className="flex-1 sm:flex-none min-h-[44px]">
                                    Find students
                                </Button>
                                {hasSearched && (
                                    <Button variant="ghost" onClick={handleReset} className="min-h-[44px]">Clear</Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {hasSearched && (
                        <>
                            {!loadingStudents && students.length > 0 && (
                                <p className="text-sm text-slate-600">{students.length} found · tap a student to see their documents</p>
                            )}
                            <DataList
                                columns={studentColumns}
                                rows={students}
                                rowKey={(s, i) => s.student_id ?? s.admNo ?? i}
                                onRowClick={handleSelectStudent}
                                loading={loadingStudents}
                                emptyTitle="No students found"
                                emptyHint="Try another class, name or admission number."
                            />
                        </>
                    )}
                </div>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2: this student's documents */
    return (
        <div className="min-h-full bg-surface-muted p-4 sm:p-6">
            <div className="w-full max-w-[1600px] mx-auto space-y-4">
                <Steps steps={STEPS} current={1} onJump={() => { setSelectedStudent(null); setStudentDocuments([]); setFormOpen(false); }} />

                {/* Who */}
                <div className="card">
                    <div className="card-body flex items-start gap-3">
                        <StudentAvatar src={selectedStudent.photo} name={selectedStudent.name} />
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 break-words">{selectedStudent.name}</p>
                            <p className="text-sm text-slate-600">
                                Admission number {selectedStudent.admNo} · Class {classLabel(selectedStudent.class, selectedStudent.section)}
                            </p>
                            <p className="text-sm text-slate-600">
                                Father: {selectedStudent.father || '—'}{selectedStudent.fatherMobile ? ` · ${selectedStudent.fatherMobile}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setSelectedStudent(null); setStudentDocuments([]); setFormOpen(false); }}
                            className="btn-secondary btn-sm flex-shrink-0"
                        >
                            Change student
                        </button>
                    </div>
                </div>

                {uploadSuccess && <Alert tone="success">{uploadSuccess}</Alert>}

                {/* Upload form */}
                {formOpen && (
                    <form onSubmit={handleUploadSubmit} className="card">
                        <div className="card-header py-3">
                            <h3 className="text-base font-semibold text-slate-900">
                                Upload {documentTypes.find(t => String(t.id) === uploadDocTypeId)?.name || 'a document'}
                            </h3>
                        </div>
                        <div className="card-body space-y-4">
                            {uploadError && <Alert tone="error">{uploadError}</Alert>}

                            <Field label="Which document" htmlFor="sdm-type" required>
                                <select
                                    id="sdm-type"
                                    required
                                    value={uploadDocTypeId}
                                    onChange={(e) => setUploadDocTypeId(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Choose the document</option>
                                    {documentTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="File" htmlFor="file-upload" required hint="PDF or photo (PNG, JPG), up to 10 MB">
                                <label
                                    htmlFor="file-upload"
                                    className="flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-slate-300 border-dashed rounded-xl bg-slate-50 hover:bg-brand-50 hover:border-brand-400 cursor-pointer transition-colors text-center"
                                >
                                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                    {uploadFile
                                        ? <span className="text-sm font-medium text-brand-700 break-all">{uploadFile.name}</span>
                                        : <span className="text-sm font-medium text-brand-700">Choose a file or take a photo</span>}
                                    <input
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        className="sr-only"
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                </label>
                            </Field>

                            <details className="rounded-lg border border-slate-200">
                                <summary className="cursor-pointer px-3 min-h-[44px] flex items-center text-sm font-medium text-slate-700">
                                    More details (optional)
                                </summary>
                                <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Document number" htmlFor="sdm-no">
                                        <input id="sdm-no" type="text" value={uploadDocNo} onChange={(e) => setUploadDocNo(e.target.value)} placeholder="e.g. 1234 5678 9012" className="input" />
                                    </Field>
                                    <Field label="Given by" htmlFor="sdm-by">
                                        <input id="sdm-by" type="text" value={uploadIssuedBy} onChange={(e) => setUploadIssuedBy(e.target.value)} placeholder="e.g. Govt of India" className="input" />
                                    </Field>
                                    <Field label="Date given" htmlFor="sdm-date">
                                        <input id="sdm-date" type="date" value={uploadIssueDate} onChange={(e) => setUploadIssueDate(e.target.value)} className="input" />
                                    </Field>
                                    <Field label="Note" htmlFor="sdm-note">
                                        <input id="sdm-note" type="text" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Anything to remember" className="input" />
                                    </Field>
                                </div>
                            </details>
                        </div>
                        <div className="px-4 sm:px-5 pb-4">
                            <ActionBar note={!uploadDocTypeId ? 'Choose which document first' : !uploadFile ? 'Choose a file first' : undefined} className="!mt-0">
                                <Button variant="secondary" size="lg" onClick={() => { resetUploadForm(); setFormOpen(false); }}>Cancel</Button>
                                <Button type="submit" size="lg" disabled={!uploadDocTypeId || !uploadFile} loading={uploading}>
                                    Save document
                                </Button>
                            </ActionBar>
                        </div>
                    </form>
                )}

                {/* Checklist */}
                {!formOpen && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-slate-600">
                                {loadingDocs ? 'Checking documents…' : documentTypes.length === 0
                                    ? 'No document list is set up yet.'
                                    : missingCount === 0
                                        ? 'All documents are uploaded.'
                                        : `${missingCount} of ${documentTypes.length} documents missing`}
                            </p>
                        </div>
                        {loadingDocs ? (
                            <div className="card"><LoadingState label="Loading documents…" /></div>
                        ) : documentTypes.length === 0 && studentDocuments.length === 0 ? (
                            <div className="card">
                                <EmptyState title="No documents yet" description="Ask an admin to add document types under “Document types”, or upload a document now." />
                            </div>
                        ) : (
                            <ul className="space-y-2.5">
                                {documentTypes.map(t => {
                                    const docs = docsForType(t.id);
                                    const has = docs.length > 0;
                                    return (
                                        <li key={t.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${has ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                    {has ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-slate-900 break-words">{t.name}</p>
                                                    <p className={`text-sm ${has ? 'text-emerald-700' : 'text-red-600'}`}>{has ? `Uploaded${docs.length > 1 ? ` (${docs.length})` : ''}` : 'Missing'}</p>
                                                </div>
                                                <Button
                                                    variant={has ? 'secondary' : 'primary'}
                                                    size="sm"
                                                    className="min-h-[40px] flex-shrink-0"
                                                    onClick={() => openUpload(t.id)}
                                                    icon={<Upload className="w-4 h-4" />}
                                                >
                                                    {has ? 'Add again' : 'Upload'}
                                                </Button>
                                            </div>
                                            {has && <div className="mt-2 border-t border-slate-100 pt-1 divide-y divide-slate-100">{docs.map(docLine)}</div>}
                                        </li>
                                    );
                                })}
                                {otherDocuments.length > 0 && (
                                    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <p className="font-semibold text-slate-900">Other documents</p>
                                        <div className="mt-1 divide-y divide-slate-100">
                                            {otherDocuments.map(doc => (
                                                <div key={doc.id}>
                                                    <p className="pt-1.5 text-sm font-medium text-slate-800">{doc.document_type_name || doc.document_type_code}</p>
                                                    {docLine(doc)}
                                                </div>
                                            ))}
                                        </div>
                                    </li>
                                )}
                            </ul>
                        )}
                        <ActionBar>
                            <Button variant="secondary" size="lg" onClick={() => { setSelectedStudent(null); setStudentDocuments([]); }}>Another student</Button>
                            <Button size="lg" onClick={() => openUpload()} icon={<Upload className="w-5 h-5" />}>Upload a document</Button>
                        </ActionBar>
                    </>
                )}
            </div>
        </div>
    );
};

export default StudentDocumentManagement;
