import React, { useState, useEffect } from 'react';
import DocumentAdministration from './DocumentAdministration';
import StudentDocumentManagement from './StudentDocumentManagement';
import { DocumentReportIcon, SetupIcon, SearchIcon, DownloadIcon, TrashIcon, UserIcon } from './icons';
import api from '../api';
import { auth } from '../api';
import axios from 'axios';
import { notify, confirmDialog } from './ui/feedback';
import { PageHeader, LoadingState, EmptyState, Spinner } from './ui';

type DocTab = 'dashboard' | 'add-category' | 'upload-documents' | 'student-doc-view';

// ─────────────────────────────────────────────
// STUDENT DOC VIEW — Report: all students with docs
// ─────────────────────────────────────────────

interface ClassItem { id: number; class_name: string; }
interface StudentRow {
    student_id: number;
    admNo: string;
    name: string;
    class: string;
    section: string;
    father?: string;
    photo?: string;
}
interface StudentDocument {
    id: number;
    document_type_code: string;
    document_type_name: string;
    document_no: string;
    issued_by: string;
    issue_date: string;
    file_name: string;
    uploaded_at: string;
    upload_by_name: string;
}

const StudentDocumentView: React.FC = () => {
    const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
    const [docMap, setDocMap] = useState<Record<number, StudentDocument[]>>({});
    const [loadingDocs, setLoadingDocs] = useState<number | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || '/api';

    useEffect(() => {
        api.get('/classes').then(res => setClassOptions(res.data.classes || []));
    }, []);

    useEffect(() => {
        if (!selectedClass) { setSectionOptions([]); setSelectedSection(''); return; }
        const branch = localStorage.getItem('currentBranch') || 'All';
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', { params: { class: selectedClass, branch, academic_year: academicYear } })
            .then(res => setSectionOptions(res.data.sections || []));
    }, [selectedClass]);

    const handleSearch = () => {
        setLoading(true);
        setHasSearched(true);
        setExpandedStudent(null);
        const branch = localStorage.getItem('currentBranch') || '';
        api.get('/students', {
            params: {
                class: selectedClass || '',
                section: selectedSection || '',
                search: searchTerm,
                include_inactive: 'false',
                branch: branch === 'All' || branch === 'All Branches' ? 'All' : branch
            }
        })
            .then(res => setStudents(res.data.students || []))
            .catch(() => setStudents([]))
            .finally(() => setLoading(false));
    };

    const toggleStudent = async (student: StudentRow) => {
        const sid = student.student_id;
        if (expandedStudent === sid) {
            setExpandedStudent(null);
            return;
        }
        setExpandedStudent(sid);
        if (!docMap[sid]) {
            setLoadingDocs(sid);
            try {
                const token = auth.getToken();
                const res = await axios.get(`${API_URL}/documents/student/${sid}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDocMap(prev => ({ ...prev, [sid]: res.data || [] }));
            } catch {
                setDocMap(prev => ({ ...prev, [sid]: [] }));
            } finally {
                setLoadingDocs(null);
            }
        }
    };

    const handleDownload = async (docId: number, fileName: string) => {
        try {
            const token = auth.getToken();
            const res = await axios.get(`${API_URL}/documents/download/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }, responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch {
            notify('Download failed.');
        }
    };

    const handleDelete = async (docId: number, studentId: number) => {
        if (!await confirmDialog('Delete this document?')) return;
        try {
            const token = auth.getToken();
            await axios.delete(`${API_URL}/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocMap(prev => ({
                ...prev,
                [studentId]: (prev[studentId] || []).filter(d => d.id !== docId)
            }));
        } catch {
            notify('Delete failed.');
        }
    };

    const formatDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
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
                        <h2 className="text-base font-semibold text-slate-900">Student Documents — View</h2>
                        <p className="text-sm text-slate-500">See documents uploaded for each student</p>
                    </div>
                </div>

                {/* Filter */}
                <div className="card p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label">Class</label>
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                                className="input">
                                <option value="">▼ All Classes</option>
                                {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Section</label>
                            <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                                disabled={!selectedClass}
                                className="input">
                                <option value="">▼ All Sections</option>
                                {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Search</label>
                            <input type="text" value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Admission No or Name..."
                                className="input" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={handleSearch}
                                className="btn-primary w-full">
                                <SearchIcon className="w-4 h-4" /> Search
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="card">
                        <LoadingState label="Loading students..." />
                    </div>
                )}

                {/* No results */}
                {!loading && hasSearched && students.length === 0 && (
                    <div className="card">
                        <EmptyState
                            icon={<UserIcon className="w-6 h-6" />}
                            title="No students found"
                            description="No students found. Try adjusting your filters."
                        />
                    </div>
                )}

                {/* Student Rows with expandable document list */}
                {!loading && students.length > 0 && (
                    <div className="card overflow-hidden">
                        <div className="card-header py-3 bg-slate-50">
                            <h3 className="text-base font-semibold text-slate-900">Students</h3>
                            <span className="badge-brand">{students.length} found</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {students.map(s => {
                                const sid = s.student_id;
                                const isExpanded = expandedStudent === sid;
                                const docs = docMap[sid] || [];
                                const isLoadingThis = loadingDocs === sid;

                                return (
                                    <div key={sid}>
                                        {/* Student Row */}
                                        <div
                                            className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                                            onClick={() => toggleStudent(s)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {s.photo
                                                        ? <img className="w-9 h-9 object-cover" src={s.photo} alt="" />
                                                        : <UserIcon className="w-4 h-4 text-slate-400" />
                                                    }
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{s.admNo} &nbsp;·&nbsp; {s.class}-{s.section}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {docMap[sid] !== undefined && (
                                                    <span className={docs.length > 0 ? 'badge-success' : 'badge-danger'}>
                                                        {docs.length} doc{docs.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                <span className="text-slate-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                                            </div>
                                        </div>

                                        {/* Expanded: Documents for this student */}
                                        {isExpanded && (
                                            <div className="bg-slate-50 border-t border-slate-100 px-5 py-4">
                                                {isLoadingThis ? (
                                                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                                                        <Spinner size="sm" /> Loading documents...
                                                    </div>
                                                ) : docs.length === 0 ? (
                                                    <EmptyState
                                                        compact
                                                        icon={<DocumentReportIcon className="w-6 h-6" />}
                                                        title="No documents"
                                                        description="No documents uploaded for this student yet."
                                                    />
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                    <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                                                        <thead className="">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left">Type</th>
                                                                <th className="px-4 py-2 text-left">Doc No</th>
                                                                <th className="px-4 py-2 text-left">Issued By</th>
                                                                <th className="px-4 py-2 text-left">Issue Date</th>
                                                                <th className="px-4 py-2 text-left">Uploaded At</th>
                                                                <th className="px-4 py-2 text-center">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-slate-100">
                                                            {docs.map(doc => (
                                                                <tr key={doc.id} className="hover:bg-brand-50 transition-colors">
                                                                    <td className="px-4 py-2.5">
                                                                        <span className="badge-brand">
                                                                            {doc.document_type_code}
                                                                        </span>
                                                                        <span className="ml-2 text-xs text-slate-600">{doc.document_type_name}</span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{doc.document_no || '—'}</td>
                                                                    <td className="px-4 py-2.5 text-xs text-slate-600">{doc.issued_by || '—'}</td>
                                                                    <td className="px-4 py-2.5 text-xs text-slate-600">{formatDate(doc.issue_date)}</td>
                                                                    <td className="px-4 py-2.5 text-xs text-slate-500">
                                                                        <div>{formatDate(doc.uploaded_at)}</div>
                                                                        <div className="text-slate-400">by {doc.upload_by_name}</div>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        <div className="flex justify-center gap-1">
                                                                            <button onClick={() => handleDownload(doc.id, doc.file_name)}
                                                                                className="btn-soft btn-sm" title="Download">
                                                                                <DownloadIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button onClick={() => handleDelete(doc.id, sid)}
                                                                                className="btn btn-sm text-red-600 bg-red-50 hover:bg-red-100" title="Delete">
                                                                                <TrashIcon className="w-3.5 h-3.5" />
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// MAIN HUB
// ─────────────────────────────────────────────

const DocumentManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DocTab>('dashboard');
    const [masterOpen, setMasterOpen] = useState(false);
    const [studentDocOpen, setStudentDocOpen] = useState(false);

    const closeDropdowns = () => { setMasterOpen(false); setStudentDocOpen(false); };

    const navBtn = (tab: DocTab, label: string) => (
        <button
            onClick={() => { setActiveTab(tab); closeDropdowns(); }}
            className={activeTab === tab ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-full bg-surface-muted">

            {/* ─── Top Nav Bar ─── */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <PageHeader
                        eyebrow="Administration"
                        title="Document Management"
                        subtitle="Manage student and institution documents"
                        icon={<DocumentReportIcon className="w-6 h-6" />}
                        className="!mb-0 !items-center"
                        actions={<>

                            {navBtn('dashboard', 'Dashboard')}

                            {/* Master ▾ */}
                            <div className="relative">
                                <button
                                    onClick={() => { setMasterOpen(v => !v); setStudentDocOpen(false); }}
                                    className={activeTab === 'add-category' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                                >
                                    Master ▾
                                </button>
                                {masterOpen && (
                                    <div className="menu left-0 w-40 z-50">
                                        <button
                                            onClick={() => { setActiveTab('add-category'); closeDropdowns(); }}
                                            className="menu-item"
                                        >
                                            Add Category
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Upload Documents — goes to upload form */}
                            {navBtn('upload-documents', 'Upload Documents')}

                            {/* Student Documents ▾ — report view */}
                            <div className="relative">
                                <button
                                    onClick={() => { setStudentDocOpen(v => !v); setMasterOpen(false); }}
                                    className={activeTab === 'student-doc-view' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                                >
                                    Student Documents ▾
                                </button>
                                {studentDocOpen && (
                                    <div className="menu right-0 w-52 z-50">
                                        <button
                                            onClick={() => { setActiveTab('student-doc-view'); closeDropdowns(); }}
                                            className="menu-item"
                                        >
                                            View Uploaded Documents
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>}
                    />
                </div>
            </div>

            {/* Click outside → close dropdowns */}
            {(masterOpen || studentDocOpen) && (
                <div className="fixed inset-0 z-40" onClick={closeDropdowns} />
            )}

            {/* ─── Page Content ─── */}
            {activeTab === 'dashboard' && <DocumentDashboard onNavigate={setActiveTab} />}
            {activeTab === 'add-category' && <DocumentAdministration />}
            {activeTab === 'upload-documents' && <StudentDocumentManagement />}
            {activeTab === 'student-doc-view' && <StudentDocumentView />}
        </div>
    );
};

// ─────────────────────────────────────────────
// DASHBOARD HOME
// ─────────────────────────────────────────────

type DashboardNavFn = (tab: DocTab) => void;

const DocumentDashboard: React.FC<{ onNavigate: DashboardNavFn }> = ({ onNavigate }) => (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <DashCard
                icon={<SetupIcon className="w-7 h-7 text-brand-700" />}
                iconBg="bg-brand-100"
                title="Document Categories (Master)"
                desc="Add and manage allowed document types"
                badge="Master → Add Category"
                badgeColor="badge-brand"
                onClick={() => onNavigate('add-category')}
            />
            <DashCard
                icon={<UploadIcon className="w-7 h-7 text-brand-700" />}
                iconBg="bg-brand-100"
                title="Upload Documents"
                desc="Search a student and upload their documents"
                badge="Upload Documents"
                badgeColor="badge-brand"
                onClick={() => onNavigate('upload-documents')}
            />
            <DashCard
                icon={<DocumentReportIcon className="w-7 h-7 text-teal-700" />}
                iconBg="bg-teal-100"
                title="View Student Documents"
                desc="See all documents uploaded per student"
                badge="Student Documents → View"
                badgeColor="badge bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20"
                onClick={() => onNavigate('student-doc-view')}
            />
        </div>

        <div className="card overflow-hidden">
            <div className="card-header py-3 bg-slate-50">
                <h3 className="text-base font-semibold text-slate-900">📊 Student Documents Count</h3>
            </div>
            <EmptyState compact title="No summary yet" description="Summary data will appear here once documents are uploaded." />
        </div>
    </div>
);

const DashCard: React.FC<{
    icon: React.ReactNode; iconBg: string;
    title: string; desc: string; badge: string; badgeColor: string; onClick: () => void;
}> = ({ icon, iconBg, title, desc, badge, badgeColor, onClick }) => (
    <div
        onClick={onClick}
        className="tile flex items-center gap-4 cursor-pointer group"
    >
        <div className={`p-3 ${iconBg} rounded-xl group-hover:opacity-80 transition-opacity flex-shrink-0`}>{icon}</div>
        <div>
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
            <span className={`${badgeColor} mt-2`}>{badge}</span>
        </div>
    </div>
);

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
    );
}

export default DocumentManagement;
