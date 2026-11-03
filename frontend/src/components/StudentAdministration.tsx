// ---------------- COMPLETE & FIXED StudentAdministration.tsx ----------------

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Page } from '../App';
import { Eye, Pencil, Lock, Printer, Ban, CheckCircle2 } from 'lucide-react';
import { ChevronDownIcon, SearchIcon, UserIcon } from './icons';
import ComingSoon from './ComingSoon';
import ImportStudentData from './ImportStudentData';
import CreateStudent from './CreateStudent';
import PromoteStudents from './PromoteStudents';
import DemoteStudents from './DemoteStudents';
import ClassSummary from './ClassSummary';
import MakeStudentInactive from './MakeStudentInactive';
import SearchStudent from './SearchStudent';
import UpdateStudentDetails from './UpdateStudentDetails';
import ChangeSection from './ChangeSection';
import { Student } from '../types';
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { DataList, Badge } from './ui';
import type { Column } from './ui';
import { StudentAvatar, PhoneLink, classLabel } from './students/common';
import { consumeIntent } from '../utils/intent';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface StudentAdministrationProps {
    navigateTo: (page: Page) => void;
}

// Page view types
type StudentAdminView =
    'students' | 'search' | 'summary' | 'upgrade' /* | 'reports' | 'certificates' */
    | 'import' | 'addStudent' | 'viewStudent' | 'editStudent'
    | 'inactive' | 'inactiveReport' | 'demote' | 'updateDetails' | 'changeSection';

// ---------------------------------------------------------------------------
// Pagination Component
// ---------------------------------------------------------------------------
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
}) => {
    if (totalPages <= 1) return null;

    // Generate page numbers to display (with ellipsis logic)
    const getPages = (): { pages: number[]; showLastPage: boolean } => {
        const pages: number[] = [];
        let showLastPage = false;

        if (totalPages <= 5) {
            // Show all pages if 5 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Show first 3 pages around current
            const start = Math.max(1, currentPage - 1);
            const end = Math.min(totalPages - 1, start + 2);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            // Show ellipsis + last page if there's a gap
            if (end < totalPages - 1) {
                showLastPage = true;
            } else if (end === totalPages - 1) {
                // No ellipsis needed, just show last page
                pages.push(totalPages);
            }
        }

        return { pages, showLastPage };
    };

    const { pages, showLastPage } = getPages();

    return (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} records
            </span>
            <div className="flex items-center gap-1 flex-wrap">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="btn-secondary btn-sm mr-2 disabled:opacity-40"
                >
                    Previous
                </button>

                {pages.map(p => (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`btn btn-sm min-w-[32px] px-2 ${currentPage === p ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' }`}
                    >
                        {p}
                    </button>
                ))}

                {showLastPage && (
                    <>
                        <span className="px-1 text-sm text-slate-400">...</span>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            className={`btn btn-sm min-w-[32px] px-2 ${currentPage === totalPages ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' }`}
                        >
                            {totalPages}
                        </button>
                    </>
                )}

                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="btn-secondary btn-sm ml-2 disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Header Component: the list of student jobs (each permission-gated)
// ---------------------------------------------------------------------------
type StudentJob = { view: StudentAdminView; label: string; allowed: boolean };

const StudentAdminHeader: React.FC<{ activeView: StudentAdminView; setActiveView: (view: StudentAdminView) => void }> =
    ({ activeView, setActiveView }) => {
        const { hasPermission } = useAuth();
        const [moreOpen, setMoreOpen] = useState(false);
        const [phoneJobsOpen, setPhoneJobsOpen] = useState(false);

        const canInactive = hasPermission('administration.student.make-student-inactive', 'write');

        const mainJobs: StudentJob[] = [
            { view: 'students', label: 'All students', allowed: hasPermission('administration.student.student-administration', 'read') },
            { view: 'search', label: 'Find a student', allowed: hasPermission('administration.student.search-student', 'read') },
            { view: 'addStudent', label: 'Add a new student', allowed: hasPermission('administration.student.create-student', 'write') },
            { view: 'updateDetails', label: 'Update details', allowed: hasPermission('administration.student.update-student-details', 'write') },
            { view: 'changeSection', label: 'Change section', allowed: hasPermission('administration.student.change-section', 'write') },
            { view: 'upgrade', label: 'Promote', allowed: hasPermission('administration.student.promote-students', 'write') },
        ].filter(j => j.allowed) as StudentJob[];

        const moreJobs: StudentJob[] = [
            { view: 'summary', label: 'Class summary', allowed: hasPermission('setup.school-setup.class-summary', 'read') || hasPermission('administration.student.student-administration', 'read') },
            { view: 'inactive', label: 'Make a student inactive', allowed: canInactive },
            { view: 'inactiveReport', label: 'Inactive students report', allowed: canInactive },
            { view: 'demote', label: 'Move back a class (de-promote)', allowed: hasPermission('administration.student.demote-students', 'write') },
        ].filter(j => j.allowed) as StudentJob[];

        // Viewing / editing one student belongs to "All students"
        const highlighted: StudentAdminView =
            activeView === 'viewStudent' || activeView === 'editStudent' ? 'students' : activeView;
        const current = [...mainJobs, ...moreJobs].find(j => j.view === highlighted);
        const activeIsMore = moreJobs.some(j => j.view === highlighted);

        const choose = (view: StudentAdminView) => {
            setActiveView(view);
            setMoreOpen(false);
            setPhoneJobsOpen(false);
        };

        const pill = (active: boolean) =>
            `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition-colors ${active
                ? 'border-brand-600 bg-brand-600 text-brand-contrast shadow-sm'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`;

        // On phones the job list folds away once you are inside a job, so the work gets the screen
        const jobsVisibleOnPhone = phoneJobsOpen || highlighted === 'students';

        return (
            <div className="bg-white px-4 sm:px-6 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-slate-900">Students</h1>
                            {current && <p className="text-sm text-slate-500 truncate sm:hidden">{current.label}</p>}
                        </div>
                    </div>
                    {!jobsVisibleOnPhone && (
                        <button className="btn-secondary sm:hidden" onClick={() => setPhoneJobsOpen(true)} aria-expanded={false}>
                            Other jobs <ChevronDownIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <nav
                    aria-label="Student jobs"
                    className={`${jobsVisibleOnPhone ? 'grid' : 'hidden'} mt-3 grid-cols-2 gap-2 sm:flex sm:flex-wrap`}
                >
                    {mainJobs.map(job => (
                        <button
                            key={job.view}
                            className={pill(highlighted === job.view)}
                            aria-current={highlighted === job.view ? 'page' : undefined}
                            onClick={() => choose(job.view)}
                        >
                            {job.label}
                        </button>
                    ))}
                    {moreJobs.length > 0 && (
                        <button
                            className={pill(activeIsMore && !moreOpen)}
                            aria-expanded={moreOpen}
                            onClick={() => setMoreOpen(o => !o)}
                        >
                            More
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </nav>

                {moreOpen && (
                    <div className={`${jobsVisibleOnPhone ? 'grid' : 'hidden sm:grid'} mt-2 grid-cols-1 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-4`}>
                        {moreJobs.map(job => (
                            <button
                                key={job.view}
                                className={`${pill(highlighted === job.view)} justify-start text-left`}
                                aria-current={highlighted === job.view ? 'page' : undefined}
                                onClick={() => choose(job.view)}
                            >
                                {job.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

// ---------------------------------------------------------------------------
// Student List Component
// ---------------------------------------------------------------------------

interface ClassItem {
    id: number;
    class_name: string;
}

const StudentList: React.FC<{ onView: any; onEdit: any }> =
    ({ onView, onEdit }) => {
        const { hasPermission } = useAuth();

        const [students, setStudents] = useState<Student[]>([]);
        const [loading, setLoading] = useState(false);
        const [showInactive, setShowInactive] = useState(false);

        const [selectedClass, setSelectedClass] = useState('');
        const [selectedSection, setSelectedSection] = useState('');
        const [searchTerm, setSearchTerm] = useState('');
        const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
        const [sectionOptions, setSectionOptions] = useState<string[]>([]);

        const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

        // Pagination State
        const [currentPage, setCurrentPage] = useState(1);
        const [itemsPerPage, setItemsPerPage] = useState(15);

        // Delete State
        const [passwordModalOpen, setPasswordModalOpen] = useState(false);
        const [password, setPassword] = useState('');
        const [studentToDelete, setStudentToDelete] = useState<any>(null);

        // Load classes and students
        useEffect(() => {
            api.get('/classes')
                .then(res => setClassOptions(res.data.classes || []))
                .catch(() => console.log("Failed loading classes"));

            loadStudents();
        }, []);

        // Trigger reload when filter changes 
        useEffect(() => {
            loadStudents();
        }, [selectedClass, selectedSection, searchTerm, showInactive]);

        // Reset to page 1 when filters change
        useEffect(() => {
            setCurrentPage(1);
        }, [selectedClass, selectedSection, searchTerm, showInactive, itemsPerPage]);

        useEffect(() => {
            if (!selectedClass) {
                setSectionOptions([]);
                setSelectedSection('');
                return;
            }

            const branch = localStorage.getItem('currentBranch') || 'All';
            const academicYear = localStorage.getItem('academicYear') || '';

            api.get('/sections', {
                params: {
                    class: selectedClass,
                    branch,
                    academic_year: academicYear
                }
            })
                .then(res => setSectionOptions(res.data.sections || []))
                .catch(() => setSectionOptions([]));
        }, [selectedClass]);

        const loadStudents = () => {
            setLoading(true);
            const globalBranch = localStorage.getItem('currentBranch') || '';

            api.get('/students', {
                params: {
                    class: selectedClass || '',
                    section: selectedSection || '',
                    search: searchTerm || '',
                    include_inactive: showInactive ? "true" : "false",
                    branch: globalBranch === "All" || globalBranch === "All Branches" ? "All" : globalBranch
                }
            })
                .then(res => setStudents(res.data.students || []))
                .catch(() => setStudents([]))
                .finally(() => setLoading(false));
        };

        // Calculate pagination data
        const paginationData = useMemo(() => {
            let sortedStudents = [...students];
            if (sortConfig) {
                sortedStudents.sort((a, b) => {
                    let aVal = '';
                    let bVal = '';
                    if (sortConfig.key === 'name') {
                        aVal = (a.name || '').toLowerCase();
                        bVal = (b.name || '').toLowerCase();
                    } else if (sortConfig.key === 'class') {
                        aVal = ((a.class || '') + ' ' + (a.section || '')).toLowerCase();
                        bVal = ((b.class || '') + ' ' + (b.section || '')).toLowerCase();
                    }
                    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            const totalItems = sortedStudents.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentStudents = sortedStudents.slice(startIndex, endIndex);

            return {
                totalItems,
                totalPages,
                currentStudents
            };
        }, [students, currentPage, itemsPerPage, sortConfig]);

        // Handle page change
        const handlePageChange = (page: number) => {
            if (page >= 1 && page <= paginationData.totalPages) {
                setCurrentPage(page);
                // Scroll to top of table on page change
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        // Handle Delete Click
        const handleDeleteClick = (s: any) => {
            setStudentToDelete(s);
            setPassword('');
            setPasswordModalOpen(true);
        };

        const handleActivate = async (s: any) => {
            if (await confirmDialog(`Are you sure you want to Activate ${s.name}?`)) {
                try {
                    await api.put(`/students/${s.student_id || s.id}`, { status: 'Active' });
                    notify("Student Activated successfully");
                    loadStudents();
                } catch (e) {
                    console.error(e);
                    notify("Failed to activate student");
                }
            }
        };

        // Confirm Delete
        const confirmDelete = async () => {
            if (!password) return notify("Please enter password");

            try {
                const verifyRes = await api.post('/verify-current-password', { password });
                if (verifyRes.data.success) {
                    const id = studentToDelete.student_id || studentToDelete.id;
                    await api.delete(`/students/${id}`);
                    notify("Student marked as Inactive successfully");
                    setPasswordModalOpen(false);
                    loadStudents();
                } else {
                    notify("Invalid Password");
                }
            } catch (error: any) {
                console.error(error);
                if (error.response && error.response.data && error.response.data.error) {
                    notify(error.response.data.error);
                } else {
                    notify("Error deleting student");
                }
            }
        };

        // Print Report
        const handlePrint = (s: any) => {
            const printWindow = window.open('', '', 'width=900,height=800');
            if (printWindow) {
                printWindow.document.write(`
                     <html>
                         <head>
                            <title>Student Report - ${s.name}</title>
                            <style>
                                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                                h1 { text-align: center; color: #4c1d95; margin-bottom: 10px; }
                                h2 { border-bottom: 2px solid #4c1d95; padding-bottom: 5px; margin-top: 30px; color: #5b21b6; font-size: 18px; }
                                .header { text-align: center; margin-bottom: 40px; }
                                .photo-box { width: 120px; height: 120px; border: 1px solid #ddd; margin: 0 auto 10px; object-fit: cover; display: block; }
                                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                                .field { margin-bottom: 8px; }
                                .label { font-weight: bold; color: #555; width: 140px; display: inline-block; }
                                .value { color: #000; }
                                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
                                th { bg-color: #f3f4f6; }
                            </style>
                         </head>
                         <body>
                             <div class="header">
                                <img src="https://www.mshifzacademy.com/assets/images/ms-logo.jpg" style="max-width: 300px; height: auto; margin-bottom: 10px;" />
                                <p>Student Profile Report</p>
                             </div>

                             <img src="${s.photo || ''}" class="photo-box" onerror="this.style.display='none';" />
                             <h2 style="text-align:center; border:none;">${s.name}</h2>
                             <p style="text-align:center;">${s.admNo} | Class: ${s.class} - ${s.section}</p>

                             <h2>Academic Details</h2>
                             <div class="grid">
                                <div>
                                    <div class="field"><span class="label">Admission No:</span> <span class="value">${s.admNo || '-'}</span></div>
                                    <div class="field"><span class="label">Roll No:</span> <span class="value">${s.rollNo || '-'}</span></div>
                                    <div class="field"><span class="label">Class:</span> <span class="value">${s.class || '-'}</span></div>
                                    <div class="field"><span class="label">Section:</span> <span class="value">${s.section || '-'}</span></div>
                                </div>
                                <div>
                                    <div class="field"><span class="label">Admission Date:</span> <span class="value">${s.admission_date || '-'}</span></div>
                                    <div class="field"><span class="label">Status:</span> <span class="value">${s.status || '-'}</span></div>
                                    <div class="field"><span class="label">Category:</span> <span class="value">${s.Category || '-'}</span></div>
                                </div>
                             </div>

                             <h2>Personal Details</h2>
                             <div class="grid">
                                <div>
                                    <div class="field"><span class="label">First Name:</span> <span class="value">${s.first_name || '-'}</span></div>
                                    <div class="field"><span class="label">Last Name:</span> <span class="value">${s.last_name || '-'}</span></div>
                                    <div class="field"><span class="label">Gender:</span> <span class="value">${s.gender || '-'}</span></div>
                                    <div class="field"><span class="label">DOB:</span> <span class="value">${s.dob || '-'}</span></div>
                                    <div class="field"><span class="label">Blood Group:</span> <span class="value">${s.BloodGroup || '-'}</span></div>
                                </div>
                                <div>
                                    <div class="field"><span class="label">Aadhar No:</span> <span class="value">${s.Adharcardno || '-'}</span></div>
                                    <div class="field"><span class="label">Religion:</span> <span class="value">${s.Religion || '-'}</span></div>
                                    <div class="field"><span class="label">Caste:</span> <span class="value">${s.Caste || '-'}</span></div>
                                    <div class="field"><span class="label">Mother Tongue:</span> <span class="value">${s.MotherTongue || '-'}</span></div>
                                </div>
                             </div>

                             <h2>Contact Info</h2>
                             <div class="field"><span class="label">Mobile:</span> <span class="value">${s.phone || '-'}</span></div>
                             <div class="field"><span class="label">Email:</span> <span class="value">${s.email || '-'}</span></div>
                             <div class="field"><span class="label">Address:</span> <span class="value">${s.address || '-'}</span></div>

                             <h2>Parent / Guardian Details</h2>
                             <div class="grid">
                                <div>
                                    <h3>Father</h3>
                                    <div class="field"><span class="label">Name:</span> <span class="value">${s.Fatherfirstname || '-'}</span></div>
                                    <div class="field"><span class="label">Phone:</span> <span class="value">${s.FatherPhone || '-'}</span></div>
                                    <div class="field"><span class="label">Occupation:</span> <span class="value">${s.FatherOccuption || '-'}</span></div>
                                </div>
                                <div>
                                    <h3>Mother</h3>
                                    <div class="field"><span class="label">Name:</span> <span class="value">${s.Motherfirstname || '-'}</span></div>
                                    <div class="field"><span class="label">Phone:</span> <span class="value">${s.SecondaryPhone || '-'}</span></div>
                                    <div class="field"><span class="label">Occupation:</span> <span class="value">${s.SecondaryOccupation || '-'}</span></div>
                                </div>
                             </div>

                             <h2>Previous School Details</h2>
                             <div class="grid">
                                <div class="field"><span class="label">School Name:</span> <span class="value">${s.SchoolName || '-'}</span></div>
                                <div class="field"><span class="label">Admission No:</span> <span class="value">${s.AdmissionNumber || '-'}</span></div>
                                <div class="field"><span class="label">TC No:</span> <span class="value">${s.TCNumber || '-'}</span></div>
                                <div class="field"><span class="label">Previous School Class:</span> <span class="value">${s.PreviousSchoolClass || '-'}</span></div>
                             </div>

                             <script>window.print();</script>
                         </body>
                     </html>
                 `);
                printWindow.document.close();
            }
        };

        const canEdit = hasPermission('administration.student.update-student-details', 'write');
        const canInactive = hasPermission('administration.student.make-student-inactive', 'write');

        const editRow = (s: any) => {
            if (s.is_locked) {
                notify("This student record is locked for this academic year and cannot be edited.");
            } else {
                onEdit(s);
            }
        };

        const inactivateRow = (s: any) => {
            if (s.is_locked) {
                notify("This student record is locked for this academic year and cannot be deactivated.");
            } else {
                handleDeleteClick(s);
            }
        };

        // Row tools: same actions on the desktop table and on phone cards
        const rowActions = (s: any) => (
            <>
                <button onClick={(e) => { e.stopPropagation(); onView(s); }} className="btn-soft btn-sm" title="See all details">
                    <Eye className="h-4 w-4" /> Details
                </button>
                {canEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); editRow(s); }}
                        className={`btn btn-sm ${s.is_locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'}`}
                        title={s.is_locked ? "Record locked (Promoted)" : "Edit"}
                    >
                        {s.is_locked ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />} Edit
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handlePrint(s); }} className="btn btn-sm bg-orange-100 text-orange-700 hover:bg-orange-200" title="Print">
                    <Printer className="h-4 w-4" /> Print
                </button>
                {canInactive && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); inactivateRow(s); }}
                            className={`btn btn-sm ${s.is_locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            title={s.is_locked ? "Record locked (Promoted)" : "Make inactive"}
                        >
                            {s.is_locked ? <Lock className="h-4 w-4" /> : <Ban className="h-4 w-4" />} Make inactive
                        </button>
                        {s.status === 'Inactive' && (
                            <button onClick={(e) => { e.stopPropagation(); handleActivate(s); }} className="btn btn-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200" title="Make active again">
                                <CheckCircle2 className="h-4 w-4" /> Make active
                            </button>
                        )}
                    </>
                )}
            </>
        );

        const columns: Column<Student>[] = [
            {
                key: 'name',
                header: 'Student',
                primary: true,
                render: (s) => (
                    <span className="flex items-center gap-2.5">
                        <StudentAvatar src={s.photo} name={s.name} size="sm" />
                        <span className="min-w-0 break-words font-medium text-brand-700">{s.name}</span>
                    </span>
                ),
            },
            { key: 'class', header: 'Class', secondary: true, render: (s) => classLabel(s.class, s.section) },
            { key: 'admNo', header: 'Admission number', render: (s) => s.admNo || '—' },
            { key: 'rollNo', header: 'Roll number', render: (s) => s.rollNo ?? '—' },
            { key: 'branch', header: 'Branch', hideOnMobile: true, render: (s) => s.branch || '—' },
            { key: 'father', header: 'Father / guardian', render: (s) => s.father || '—' },
            { key: 'fatherMobile', header: "Father's phone", render: (s) => <PhoneLink phone={s.fatherMobile} /> },
            ...(showInactive ? [{ key: 'status', header: 'Status', render: (s: Student) => <Badge status={s.status || 'Unknown'} /> }] : []),
            {
                key: 'tools',
                header: 'Tools',
                hideOnMobile: true,
                render: (s) => <div className="flex items-center gap-1">{rowActions(s)}</div>,
            },
        ];

        const sortValue = sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : '';

        return (
            <div className="p-4 sm:p-6 space-y-4">

                {/* Filters */}
                <div className="card p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <SearchIcon className="pointer-events-none h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                enterKeyHint="search"
                                className="input h-12 pl-10 text-base"
                                placeholder="Search by name, admission number or phone"
                                aria-label="Search students"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') loadStudents(); }}
                            />
                        </div>
                        <button onClick={loadStudents} className="btn-primary btn-lg">
                            Search
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div>
                            <label className="label">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="input"
                            >
                                <option value="">All classes</option>
                                {Array.isArray(classOptions) && classOptions.map(c => (
                                    <option key={c.id} value={c.class_name}>
                                        {c.class_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Section</label>
                            <select
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                className="input"
                                disabled={!selectedClass}
                            >
                                <option value="">{selectedClass ? 'All sections' : 'Choose a class first'}</option>
                                {sectionOptions.map(section => (
                                    <option key={section} value={section}>{section}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Sort by</label>
                            <select
                                value={sortValue}
                                onChange={(e) => {
                                    const [key, direction] = e.target.value.split('-');
                                    setSortConfig(key ? { key, direction: direction as 'asc' | 'desc' } : null);
                                }}
                                className="input"
                            >
                                <option value="">As saved</option>
                                <option value="name-asc">Name (A to Z)</option>
                                <option value="name-desc">Name (Z to A)</option>
                                <option value="class-asc">Class (A to Z)</option>
                                <option value="class-desc">Class (Z to A)</option>
                            </select>
                        </div>

                        <label className="col-span-2 lg:col-span-1 flex min-h-[44px] cursor-pointer items-center gap-3 self-end rounded-lg px-1">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={e => setShowInactive(e.target.checked)}
                                className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                            />
                            <span className="text-sm text-slate-700">Also show inactive students</span>
                        </label>
                    </div>
                </div>

                {/* Count + items per page */}
                {!loading && students.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <span className="text-sm text-slate-600">
                            {students.length === 1 ? '1 student' : `${students.length} students`} · tap a student to see details
                        </span>
                        <div className="flex items-center gap-2">
                            <label htmlFor="students-per-page" className="text-sm text-slate-500">Show</label>
                            <select
                                id="students-per-page"
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="input w-auto"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-slate-500">per page</span>
                        </div>
                    </div>
                )}

                <DataList
                    columns={columns}
                    rows={paginationData.currentStudents}
                    rowKey={(s, i) => s.student_id ?? s.admNo ?? i}
                    onRowClick={(s) => onView(s)}
                    loading={loading}
                    emptyTitle="No students found"
                    emptyHint="Try another class or section, or change the search words."
                    mobileActions={rowActions}
                />

                {!loading && students.length > 0 && (
                    <div className="card overflow-hidden">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={paginationData.totalPages}
                            onPageChange={handlePageChange}
                            totalItems={paginationData.totalItems}
                            itemsPerPage={itemsPerPage}
                        />
                    </div>
                )}

                {/* Password Modal */}
                {passwordModalOpen && (
                    <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex items-center justify-center z-50 p-4">
                        <div className="card shadow-pop p-6 w-96 max-w-[calc(100vw-2rem)]">
                            <h3 className="text-base font-semibold text-slate-900 mb-2">Make this student inactive?</h3>
                            <p className="mb-4 text-sm text-slate-600">Type your password to mark <b>{studentToDelete?.name}</b> as inactive.</p>
                            <label htmlFor="inactive-password" className="label">Your password</label>
                            <input
                                id="inactive-password"
                                type="password"
                                className="input mb-4"
                                placeholder="Password"
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') confirmDelete(); }}
                            />
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    onClick={() => setPasswordModalOpen(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="btn-danger"
                                >
                                    Make inactive
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    };

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const StudentAdministration: React.FC<StudentAdministrationProps> = () => {
    const { hasPermission } = useAuth();

    const defaultView = useMemo<StudentAdminView>(() => {
        if (hasPermission('administration.student.student-administration', 'read')) return 'students';
        if (hasPermission('administration.student.search-student', 'read')) return 'search';
        if (hasPermission('administration.student.create-student', 'write')) return 'addStudent';
        if (hasPermission('administration.student.update-student-details', 'write')) return 'updateDetails';
        if (hasPermission('setup.school-setup.class-summary', 'read')) return 'summary';
        if (hasPermission('administration.student.change-section', 'write')) return 'changeSection';
        if (hasPermission('administration.student.promote-students', 'write')) return 'upgrade';
        if (hasPermission('administration.student.demote-students', 'write')) return 'demote';
        if (hasPermission('administration.student.make-student-inactive', 'write')) return 'inactive';
        return 'students';
    }, [hasPermission]);

    // A shortcut (e.g. Home → "Add a new student") may ask for a specific view
    const [intentView] = useState(() => consumeIntent('student-administration') as StudentAdminView | null);
    const [activeView, setActiveView] = useState<StudentAdminView>(intentView || 'students');

    useEffect(() => {
        if (!intentView) setActiveView(defaultView);
    }, [defaultView, intentView]);

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    // Where "Back" from a student's details goes: the list or "Find a student"
    const [returnTo, setReturnTo] = useState<StudentAdminView>('students');

    const openStudent = (s: Student, view: 'viewStudent' | 'editStudent', from: StudentAdminView) => {
        setSelectedStudent(s);
        setReturnTo(from);
        setActiveView(view);
    };
    const goBack = () => setActiveView(returnTo);

    const render = () => {
        switch (activeView) {

            case 'students':
                return <StudentList
                    onView={(s: Student) => openStudent(s, 'viewStudent', 'students')}
                    onEdit={(s: Student) => openStudent(s, 'editStudent', 'students')}
                />;

            case 'addStudent':
                return <CreateStudent mode="create" onSave={() => setActiveView('students')} onCancel={() => setActiveView('students')} />;

            case 'viewStudent':
                return <CreateStudent mode="view" studentData={selectedStudent!} onCancel={goBack} onEdit={() => setActiveView('editStudent')} />;

            case 'editStudent':
                return <CreateStudent mode="edit" studentData={selectedStudent!} onSave={goBack} onCancel={goBack} />;

            case 'import':
                return <ImportStudentData onImportSuccess={() => setActiveView('students')} />;

            case 'upgrade':
                return <PromoteStudents onBack={() => setActiveView('students')} />;

            case 'demote':
                return <DemoteStudents onBack={() => setActiveView('students')} />;

            case 'summary':
                return <ClassSummary onBack={() => setActiveView('students')} />;

            case 'search':
                return <SearchStudent
                    onView={(s: Student) => openStudent(s, 'viewStudent', 'search')}
                    onEdit={hasPermission('administration.student.update-student-details', 'write')
                        ? (s: Student) => openStudent(s, 'editStudent', 'search')
                        : undefined}
                />;

            case 'inactive':
                return <MakeStudentInactive />;

            case 'inactiveReport':
                return <ComingSoon pageTitle="Inactive Student Report" />;

            case 'updateDetails':
                return <UpdateStudentDetails onBack={() => setActiveView('students')} />;

            case 'changeSection':
                return <ChangeSection onBack={() => setActiveView('students')} />;

            default:
                return <ComingSoon pageTitle="Coming Soon" />;
        }
    };

    return (
        <div className="h-full bg-surface-muted overflow-y-auto">
            <StudentAdminHeader
                activeView={activeView === 'viewStudent' || activeView === 'editStudent' ? returnTo : activeView}
                setActiveView={setActiveView}
            />
            {render()}
        </div>
    );
};

export default StudentAdministration;