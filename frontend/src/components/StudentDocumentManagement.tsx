import React, { useState, useEffect } from 'react';
import {
    SearchIcon,
    UserIcon,
    DocumentReportIcon,
    DownloadIcon,
    RefreshIcon
} from './icons';
import api from '../api';
import { auth } from '../api';
import { Student } from '../types';
import axios from 'axios';
import { notify } from './ui/feedback';
import { Alert, LoadingState, EmptyState } from './ui';

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

const StudentDocumentManagement: React.FC = () => {
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

    const API_URL = import.meta.env.VITE_API_URL || '/api';

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
        setStudents([]); // hide list once selected
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
        if (!uploadDocTypeId) { setUploadError('Please select a document type.'); return; }
        if (!uploadFile) { setUploadError('Please choose a file to upload.'); return; }

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
            setUploadSuccess('Document uploaded successfully.');
            resetUploadForm();
            loadStudentDocuments(sId);
            setTimeout(() => setUploadSuccess(''), 4000);
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'Failed to upload document.');
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
            notify('Failed to download document. It might have been removed.');
        }
    };


    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <div className="min-h-full bg-surface-muted p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-5">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-brand-600/10">
                        <DocumentReportIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Student Document Management</h2>
                        <p className="text-sm text-slate-500">Search student, upload and manage documents</p>
                    </div>
                </div>

                {/* ═══════════════════════════════════════
                    SECTION 1: FILTER + SEARCH PANEL
                ═══════════════════════════════════════ */}
                <div className="card p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                        <div>
                            <label className="label">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="input"
                            >
                                <option value="">▼ Select Class</option>
                                {classOptions.map(c => (
                                    <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Section</label>
                            <select
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                disabled={!selectedClass}
                                className="input"
                            >
                                <option value="">▼ Select Section</option>
                                {sectionOptions.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Admission No /Enrollment No</label>
                            <input
                                type="text"
                                value={admissionNo}
                                onChange={(e) => setAdmissionNo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="e.g. 2026-003"
                                className="input"
                            />
                        </div>

                        <div>
                            <label className="label">Name</label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Student name..."
                                className="input"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4">
                        <button
                            onClick={handleSearch}
                            className="btn-primary"
                        >
                            <SearchIcon className="w-4 h-4" />
                            Search
                        </button>
                        <button
                            onClick={handleReset}
                            className="btn-secondary"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* ═══════════════════════════════════════
                    SECTION 2: STUDENT LIST TABLE
                ═══════════════════════════════════════ */}
                {loadingStudents && (
                    <div className="card">
                        <LoadingState label="Searching students..." />
                    </div>
                )}

                {!loadingStudents && hasSearched && students.length === 0 && !selectedStudent && (
                    <div className="card">
                        <EmptyState
                            icon={<UserIcon className="w-6 h-6" />}
                            title="No students found"
                            description="Try adjusting your filters or search term."
                        />
                    </div>
                )}

                {!loadingStudents && students.length > 0 && !selectedStudent && (
                    <div className="card overflow-hidden">
                        <div className="card-header py-3 bg-slate-50">
                            <h3 className="text-base font-semibold text-slate-900">Search Results</h3>
                            <span className="badge-brand">{students.length} found</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-white">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Admission No</th>
                                        <th className="px-5 py-3 text-left">Student Name</th>
                                        <th className="px-5 py-3 text-left">Class</th>
                                        <th className="px-5 py-3 text-left">Section</th>
                                        <th className="px-5 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {students.map(s => (
                                        <tr key={s.admNo} className="hover:bg-brand-50 transition-colors">
                                            <td className="px-5 py-3 text-sm text-slate-600 font-mono">{s.admNo}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {s.photo
                                                            ? <img className="w-8 h-8 object-cover" src={s.photo} alt="" />
                                                            : <UserIcon className="w-4 h-4 text-slate-400" />
                                                        }
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-900">{s.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-600">{s.class}</td>
                                            <td className="px-5 py-3 text-sm text-slate-600">{s.section}</td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    onClick={() => handleSelectStudent(s)}
                                                    className="btn-primary btn-sm"
                                                >
                                                    Select
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════
                    SECTIONS 3, 4, 5 — Only after student selected
                ═══════════════════════════════════════ */}
                {selectedStudent && (
                    <>
                        {/* SECTION 3: SELECTED STUDENT CARD */}
                        <div className="card border-brand-200 overflow-hidden">
                            <div className="px-5 py-3 bg-brand-600 flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-brand-contrast flex items-center gap-2">
                                    <UserIcon className="w-4 h-4" />
                                    Student Details
                                </h3>
                                <button
                                    onClick={() => { setSelectedStudent(null); setStudentDocuments([]); }}
                                    className="btn btn-sm bg-white/15 text-brand-contrast hover:bg-white/25"
                                >
                                    ✕ Change Student
                                </button>
                            </div>
                            <div className="p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {selectedStudent.photo
                                            ? <img className="w-14 h-14 object-cover" src={selectedStudent.photo} alt={selectedStudent.name} />
                                            : <UserIcon className="w-7 h-7 text-slate-400" />
                                        }
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-2 flex-1 min-w-0">
                                        <div>
                                            <p className="text-xs text-slate-500">Name</p>
                                            <p className="text-sm font-semibold text-slate-900">{selectedStudent.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Admission No</p>
                                            <p className="text-sm font-semibold text-brand-600 font-mono">{selectedStudent.admNo}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Class</p>
                                            <p className="text-sm font-semibold text-slate-900">{selectedStudent.class}-{selectedStudent.section}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Father</p>
                                            <p className="text-sm font-semibold text-slate-900">{selectedStudent.father || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Mobile</p>
                                            <p className="text-sm font-semibold text-slate-900">{selectedStudent.fatherMobile || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTIONS 4 + 5: Side by Side */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                            {/* SECTION 4: ADD DOCUMENT FORM */}
                            <div className="lg:col-span-2">
                                <div className="card">
                                    <div className="card-header py-3 bg-slate-50 rounded-t-xl">
                                        <h3 className="text-base font-semibold text-slate-900">📎 Add Document</h3>
                                    </div>
                                    <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">

                                        {uploadError && (
                                            <Alert tone="error">{uploadError}</Alert>
                                        )}
                                        {uploadSuccess && (
                                            <Alert tone="success">{uploadSuccess}</Alert>
                                        )}

                                        <div>
                                            <label className="label">
                                                Document Type <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                required
                                                value={uploadDocTypeId}
                                                onChange={(e) => setUploadDocTypeId(e.target.value)}
                                                className="input"
                                            >
                                                <option value="">▼ Select from Master</option>
                                                {documentTypes.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="label">Document No.</label>
                                            <input
                                                type="text"
                                                value={uploadDocNo}
                                                onChange={(e) => setUploadDocNo(e.target.value)}
                                                placeholder="e.g. 1234 5678 9012"
                                                className="input"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">Issued By</label>
                                            <input
                                                type="text"
                                                value={uploadIssuedBy}
                                                onChange={(e) => setUploadIssuedBy(e.target.value)}
                                                placeholder="e.g. Govt of India"
                                                className="input"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">📅 Issue Date</label>
                                            <input
                                                type="date"
                                                value={uploadIssueDate}
                                                onChange={(e) => setUploadIssueDate(e.target.value)}
                                                className="input"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">Notes</label>
                                            <input
                                                type="text"
                                                value={uploadNotes}
                                                onChange={(e) => setUploadNotes(e.target.value)}
                                                placeholder="Optional notes"
                                                className="input"
                                            />
                                        </div>

                                        <div>
                                            <label className="label">
                                                Upload File <span className="text-red-500">*</span>
                                            </label>
                                            <div className="mt-1">
                                                <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full px-4 py-5 border-2 border-slate-300 border-dashed rounded-lg bg-slate-50 hover:bg-brand-50 hover:border-brand-400 cursor-pointer transition-colors">
                                                    <UploadIcon className="w-8 h-8 text-slate-400 mb-2" />
                                                    <span className="text-sm text-slate-600">
                                                        {uploadFile
                                                            ? <span className="text-brand-600 font-medium">{uploadFile.name}</span>
                                                            : <><span className="text-brand-600 font-medium">Choose File</span> or drag here</>
                                                        }
                                                    </span>
                                                    <span className="text-xs text-slate-400 mt-1">PDF, PNG, JPG up to 10MB</span>
                                                    <input
                                                        id="file-upload"
                                                        name="file-upload"
                                                        type="file"
                                                        className="sr-only"
                                                        onChange={handleFileChange}
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={uploading || !uploadDocTypeId || !uploadFile}
                                            className="btn-primary w-full"
                                        >
                                            {uploading ? (
                                                <><RefreshIcon className="w-4 h-4 animate-spin" /> Uploading...</>
                                            ) : (
                                                'Save Document'
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* SECTION 5: EXISTING DOCUMENTS TABLE */}
                            <div className="lg:col-span-3">
                                <div className="card h-full">
                                    <div className="card-header py-3 bg-slate-50 rounded-t-xl">
                                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                            <DocumentReportIcon className="w-4 h-4 text-slate-500" />
                                            Existing Documents
                                        </h3>
                                        <span className="badge-brand">
                                            {studentDocuments.length} total
                                        </span>
                                    </div>

                                    {loadingDocs ? (
                                        <LoadingState label="Loading documents..." />
                                    ) : studentDocuments.length === 0 ? (
                                        <EmptyState
                                            icon={<DocumentReportIcon className="w-6 h-6" />}
                                            title="No documents found"
                                            description="Upload the first document using the form on the left."
                                        />
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-white">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Type</th>
                                                        <th className="px-4 py-3 text-left">Doc No</th>
                                                        <th className="px-4 py-3 text-left">Issued By</th>
                                                        <th className="px-4 py-3 text-left">Issue Date</th>
                                                        <th className="px-4 py-3 text-left">Uploaded At</th>
                                                        <th className="px-4 py-3 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-100">
                                                    {studentDocuments.map(doc => (
                                                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <span className="badge-brand">
                                                                    {doc.document_type_code}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                                                                {doc.document_no || <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-slate-600 max-w-[110px] truncate" title={doc.issued_by}>
                                                                {doc.issued_by || <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                                {doc.issue_date ? formatDate(doc.issue_date) : <span className="text-slate-300">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-slate-500">
                                                                <div>{formatDate(doc.uploaded_at)}</div>
                                                                <div className="text-xs text-slate-400">by {doc.upload_by_name}</div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                                <div className="flex justify-center gap-1">
                                                                    <button
                                                                        onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                                                                        className="btn-soft btn-sm"
                                                                        title="View / Download"
                                                                    >
                                                                        <DownloadIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </>
                )}

            </div>
        </div>
    );
};

// Upload Icon
function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
    );
}

export default StudentDocumentManagement;
