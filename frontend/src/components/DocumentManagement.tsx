import React, { useState, useEffect } from 'react';
import DocumentAdministration from './DocumentAdministration';
import StudentDocumentManagement from './StudentDocumentManagement';
import { DocumentReportIcon, SetupIcon, SearchIcon, DownloadIcon, TrashIcon, UserIcon } from './icons';
import api from '../api';
import { auth } from '../api';
import axios from 'axios';
import { ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { notify, confirmDialog } from './ui/feedback';
import { PageHeader, LoadingState, EmptyState, Spinner, Field, Button } from './ui';
import { StudentAvatar, classLabel } from './students/common';
import { API_URL } from '../config'; // shared API address (works with or without VITE_API_URL)

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
            notify.error('Could not open the document. Try again.');
        }
    };

    const handleDelete = async (docId: number, studentId: number) => {
        if (!await confirmDialog('Delete this document? This cannot be undone.', { confirmText: 'Delete', tone: 'danger' })) return;
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
            notify.error('Could not delete the document. Try again.');
        }
    };

    const formatDate = (d: string) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
            <p className="text-sm text-slate-600">See the documents uploaded for each student. Tap a student to open their list.</p>

            {/* Filter */}
            <div className="card">
                <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Field label="Class" htmlFor="dv-class">
                        <select id="dv-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input">
                            <option value="">All classes</option>
                            {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                        </select>
                    </Field>
                    <Field label="Section" htmlFor="dv-section">
                        <select id="dv-section" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass} className="input">
                            <option value="">All sections</option>
                            {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </Field>
                    <Field label="Name or admission number" htmlFor="dv-search">
                        <input id="dv-search" type="text" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Type to search"
                            className="input" />
                    </Field>
                    <div className="flex items-end">
                        <Button onClick={handleSearch} loading={loading} icon={<SearchIcon className="w-4 h-4" />} className="w-full min-h-[44px]">
                            Show students
                        </Button>
                    </div>
                </div>
            </div>

            {loading && <div className="card"><LoadingState label="Loading students…" /></div>}

            {!loading && hasSearched && students.length === 0 && (
                <div className="card">
                    <EmptyState icon={<UserIcon className="w-6 h-6" />} title="No students found" description="Try another class or search." />
                </div>
            )}

            {!loading && students.length > 0 && (
                <>
                    <p className="text-sm text-slate-600">{students.length} found</p>
                    <ul className="space-y-2.5">
                        {students.map(s => {
                            const sid = s.student_id;
                            const isExpanded = expandedStudent === sid;
                            const docs = docMap[sid] || [];
                            const isLoadingThis = loadingDocs === sid;

                            return (
                                <li key={sid} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                    <button
                                        type="button"
                                        aria-expanded={isExpanded}
                                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleStudent(s)}
                                    >
                                        <StudentAvatar src={s.photo} name={s.name} size="sm" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-semibold text-slate-900 break-words">{s.name}</span>
                                            <span className="block text-sm text-slate-500">{s.admNo} · Class {classLabel(s.class, s.section)}</span>
                                        </span>
                                        {docMap[sid] !== undefined && (
                                            <span className={docs.length > 0 ? 'badge-success' : 'badge-danger'}>
                                                {docs.length} document{docs.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                                            {isLoadingThis ? (
                                                <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                                                    <Spinner size="sm" /> Loading documents…
                                                </div>
                                            ) : docs.length === 0 ? (
                                                <EmptyState
                                                    compact
                                                    icon={<DocumentReportIcon className="w-6 h-6" />}
                                                    title="No documents yet"
                                                    description="Use “Upload for a student” to add them."
                                                />
                                            ) : (
                                                <ul className="space-y-2">
                                                    {docs.map(doc => (
                                                        <li key={doc.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-slate-900 break-words">{doc.document_type_name || doc.document_type_code}</p>
                                                                    <p className="text-sm text-slate-500">
                                                                        {doc.document_no && <span className="font-mono">{doc.document_no} · </span>}
                                                                        Added {formatDate(doc.uploaded_at)}{doc.upload_by_name ? ` by ${doc.upload_by_name}` : ''}
                                                                    </p>
                                                                    {(doc.issued_by || doc.issue_date) && (
                                                                        <p className="text-xs text-slate-500">
                                                                            Given by {doc.issued_by || '—'}{doc.issue_date ? ` on ${formatDate(doc.issue_date)}` : ''}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 flex gap-2">
                                                                <button type="button" onClick={() => handleDownload(doc.id, doc.file_name)} className="btn-soft btn-sm min-h-[40px]">
                                                                    <DownloadIcon className="w-4 h-4" /> Open
                                                                </button>
                                                                <button type="button" onClick={() => handleDelete(doc.id, sid)} className="btn-ghost btn-sm min-h-[40px] text-red-600">
                                                                    <TrashIcon className="w-4 h-4" /> Delete
                                                                </button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// MAIN HUB
// ─────────────────────────────────────────────

const TABS: { id: DocTab; label: string }[] = [
    { id: 'dashboard', label: 'Home' },
    { id: 'upload-documents', label: 'Upload for a student' },
    { id: 'student-doc-view', label: 'See all documents' },
    { id: 'add-category', label: 'Document types' },
];

const DocumentManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<DocTab>('dashboard');

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 pb-3">
                    <PageHeader
                        eyebrow="Administration"
                        title="Documents"
                        subtitle="Keep each student's papers in one place"
                        icon={<DocumentReportIcon className="w-6 h-6" />}
                        className="!mb-3"
                    />
                    <nav aria-label="Document jobs" className="-mx-4 px-4 overflow-x-auto">
                        <div className="segmented">
                            {TABS.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    aria-current={activeTab === t.id ? 'page' : undefined}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`segmented-item whitespace-nowrap min-h-[40px] ${activeTab === t.id ? 'segmented-item-active' : ''}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </nav>
                </div>
            </div>

            {activeTab === 'dashboard' && <DocumentDashboard onNavigate={setActiveTab} />}
            {activeTab === 'add-category' && <DocumentAdministration />}
            {activeTab === 'upload-documents' && <StudentDocumentManagement />}
            {activeTab === 'student-doc-view' && <StudentDocumentView />}
        </div>
    );
};

// ─────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────

type DashboardNavFn = (tab: DocTab) => void;

const DocumentDashboard: React.FC<{ onNavigate: DashboardNavFn }> = ({ onNavigate }) => (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-600">What do you want to do?</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DashCard
                icon={<Upload className="w-6 h-6" />}
                title="Upload for a student"
                desc="Find a student, see what is missing and upload it"
                onClick={() => onNavigate('upload-documents')}
            />
            <DashCard
                icon={<DocumentReportIcon className="w-6 h-6" />}
                title="See all documents"
                desc="Look through documents class by class"
                onClick={() => onNavigate('student-doc-view')}
            />
            <DashCard
                icon={<SetupIcon className="w-6 h-6" />}
                title="Document types"
                desc="The list of documents the school asks for, like Aadhaar or TC"
                onClick={() => onNavigate('add-category')}
            />
        </div>
    </div>
);

const DashCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({ icon, title, desc, onClick }) => (
    <button type="button" onClick={onClick} className="tile flex items-center gap-4 text-left cursor-pointer group">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
    </button>
);

export default DocumentManagement;
