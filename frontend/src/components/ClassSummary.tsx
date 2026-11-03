import * as XLSX from 'xlsx';
import React, { useState, useEffect } from 'react';
import api from '../api';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { LoadingState, EmptyState, Badge, Field } from './ui';
import { PhoneLink } from './students/common';
import CreateStudent from './CreateStudent';

// ---------------------------------------------------------------------------
// Types
// -------------------------------------- -----      --------------------------------
interface SectionStats {
    name: string;
    count: number;
}

interface ClassStats {
    name: string;
    count: number;
    sections: SectionStats[];
}

interface SummaryStats {
    total: number;
    by_status: { [key: string]: number };
}

interface SummaryResponse {
    stats: SummaryStats;
    structure: ClassStats[];
}

interface StudentMinimal {
    name: string;
    admNo: string;
    rollNo: number;
    class: string;
    section: string;
    father: string; // FatherName
    fatherMobile: string;
    status: string;
    id: number;
    student_id: number;
    gender?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ClassSummary: React.FC<{ onBack: () => void }> = () => {

    // State
    const [summary, setSummary] = useState<SummaryResponse | null>(null);
    const [, setLoading] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('All'); // All, Active, Inactive, TC
    const [selectedClass, setSelectedClass] = useState<string | null>(null); // Class Name
    const [selectedSection, setSelectedSection] = useState<string | null>(null); // Section Name

    // Students List
    const [students, setStudents] = useState<StudentMinimal[]>([]);
    const [studentLoading, setStudentLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Additional UI State
    const [viewMode, setViewMode] = useState<'summary' | 'create'>('summary');

    // Calculate Gender Stats
    const totalMales = students.filter(s => s.gender === 'Male').length;
    const totalFemales = students.filter(s => s.gender === 'Female').length;

    const exportToExcel = () => {
        const dataToExport = students.map((s, index) => ({
            "S.No": index + 1,
            "Roll No": s.rollNo,
            "Admission No": s.admNo,
            "Name": s.name,
            "Gender": s.gender,
            "Class": s.class,
            "Section": s.section,
            "Father Name": s.father,
            "Phone Number": s.fatherMobile,
            "Status": s.status
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Class Summary");
        XLSX.writeFile(wb, `ClassSummary_${selectedClass || 'All'}_${selectedSection || 'All'}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    // Initial Load
    useEffect(() => {
        fetchSummary();
    }, []);

    // Fetch Students when filters change
    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        } else {
            setStudents([]);
        }
    }, [selectedClass, selectedSection, statusFilter, search]);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const globalBranch = localStorage.getItem('currentBranch');
            const res = await api.get('/students/summary', {
                headers: { 'X-Branch': globalBranch || 'All' }
            });
            setSummary(res.data);

            // Auto-select first class if available
            if (res.data.structure && res.data.structure.length > 0) {
                // setSelectedClass(res.data.structure[0].name); 
                // Dont auto select, let user choose? 
                // The UI screenshot shows "All" selected in left dropdown, and a class "6 HK 2" selected.
            }
        } catch (e) {
            console.error("Failed to fetch summary", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            setStudentLoading(true);
            const globalBranch = localStorage.getItem('currentBranch');
            const res = await api.get('/students', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    search: search,
                    include_inactive: 'true', // We filter on frontend or backend? Using backend filter.
                    // But wait, our backend /students endpoint filters by status=Active unless include_inactive=true.
                    // If we want specific status (like "Inactive"), we need to handle that.
                    // The backend currently supports include_inactive=true (shows all) or false (Active only).
                    // It does NOT support status="Inactive".
                    // I might need to filter client side or update backend. 
                    // For now, I'll fetch 'include_inactive=true' and filter client side if status is not 'All' or 'Active'.
                },
                headers: { 'X-Branch': globalBranch || 'All' }
            });

            let data = res.data.students || [];

            // Client-side filtering for strict status (since backend is loose)
            if (statusFilter !== 'All') {
                data = data.filter((s: any) => s.status === statusFilter);
            }

            setStudents(data);

        } catch (e) {
            console.error("Failed to fetch students", e);
        } finally {
            setStudentLoading(false);
        }
    };

    // Helper to get selected class object
    const selectedClassObject = summary?.structure.find(c => c.name === selectedClass);

    // Helper to get total count for displayed section or class
    // If section selected -> section count
    // Else if class selected -> class count
    // Else -> total count
    const recordCount = students.length;

    const STATUS_FILTERS = ['All', 'Active', 'Inactive', 'TC'];
    const statusCount = (f: string) => (!summary ? 0 : f === 'All' ? summary.stats.total : (summary.stats.by_status[f] || 0));
    const statusName = (f: string) => (f === 'All' ? 'All students' : f === 'TC' ? 'Left (TC)' : f);

    const statusBadge = (status: string) => (
        <Badge tone={status === 'Active' ? 'success' : status === 'Inactive' ? 'danger' : 'warning'}>
            {status === 'TC' ? 'Left (TC)' : status}
        </Badge>
    );

    /** Phones and tablets: one simple filter card */
    const renderMobileFilters = () => {
        if (!summary) return <div className="card lg:hidden mb-4"><LoadingState label="Loading classes…" /></div>;
        return (
            <div className="card p-4 mb-4 space-y-4 lg:hidden print:hidden">
                <div>
                    <p className="label">Show</p>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f}
                                type="button"
                                aria-pressed={statusFilter === f}
                                onClick={() => setStatusFilter(f)}
                                className={`min-h-[40px] px-3 rounded-full border text-sm font-medium ${statusFilter === f ? 'bg-brand-600 text-brand-contrast border-brand-600' : 'bg-white text-slate-700 border-slate-300'}`}
                            >
                                {statusName(f)} · {statusCount(f)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Class" htmlFor="cs-class">
                        <select
                            id="cs-class"
                            className="input"
                            value={selectedClass || ''}
                            onChange={(e) => { setSelectedClass(e.target.value || null); setSelectedSection(null); }}
                        >
                            <option value="">Choose class</option>
                            {summary.structure.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                        </select>
                    </Field>
                    <Field label="Section" htmlFor="cs-section">
                        <select
                            id="cs-section"
                            className="input"
                            value={selectedSection || ''}
                            disabled={!selectedClassObject}
                            onChange={(e) => setSelectedSection(e.target.value || null)}
                        >
                            <option value="">{selectedClassObject ? `All sections (${selectedClassObject.count})` : 'Choose a class first'}</option>
                            {selectedClassObject?.sections.map(sec => <option key={sec.name} value={sec.name}>{sec.name} ({sec.count})</option>)}
                        </select>
                    </Field>
                </div>
            </div>
        );
    };

    const renderLeftSidebar = () => {
        if (!summary) return <div className="card h-full"><LoadingState label="Loading classes…" /></div>;

        return (
            <div className="card h-full flex flex-col overflow-hidden print:hidden">
                <div className="p-2 border-b border-slate-100 space-y-1">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setStatusFilter(f)}
                            className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm ${statusFilter === f ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <span>{statusName(f)}</span>
                            <span className="font-semibold">{statusCount(f)}</span>
                        </button>
                    ))}
                </div>

                <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex justify-between text-xs font-semibold text-slate-500">
                    <span>Class</span>
                    <span>Students</span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <ul className="divide-y divide-slate-100 text-sm">
                        {summary.structure.map(c => (
                            <li key={c.name}>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedClass(c.name); setSelectedSection(null); }}
                                    className={`w-full flex justify-between px-3 py-2.5 text-left transition-colors ${selectedClass === c.name ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <span className="font-medium">{c.name}</span>
                                    <span className="font-semibold">{c.count}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    const renderMiddleSidebar = () => {
        if (!selectedClass || !selectedClassObject) return (
            <div className="card h-full flex items-center justify-center print:hidden">
                <EmptyState compact title="Choose a class" />
            </div>
        );

        return (
            <div className="card h-full flex flex-col overflow-hidden print:hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex justify-between text-xs font-semibold text-slate-500">
                    <span>Section</span>
                    <span>Students</span>
                </div>
                <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 text-sm">
                    <li>
                        <button
                            type="button"
                            onClick={() => setSelectedSection(null)}
                            className={`w-full flex justify-between px-3 py-2.5 text-left ${selectedSection === null ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <span>All sections</span>
                            <span>{selectedClassObject.count}</span>
                        </button>
                    </li>
                    {selectedClassObject.sections.map(sec => (
                        <li key={sec.name}>
                            <button
                                type="button"
                                onClick={() => setSelectedSection(sec.name)}
                                className={`w-full flex justify-between px-3 py-2.5 text-left ${selectedSection === sec.name ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span>{sec.name}</span>
                                <span className="font-semibold">{sec.count}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderStudentList = () => {
        if (viewMode === 'create') {
            return (
                <div className="card h-full p-4 overflow-y-auto">
                    <button onClick={() => setViewMode('summary')} className="mb-4 btn-ghost btn-sm">← Back to list</button>
                    <CreateStudent mode="create" onSave={() => { setViewMode('summary'); fetchStudents(); fetchSummary(); }} onCancel={() => setViewMode('summary')} />
                </div>
            )
        }

        if (!selectedClass) {
            return (
                <div className="card h-full flex items-center justify-center print:hidden">
                    <EmptyState title="Choose a class to see its students." description="Pick a class from the list. You can then pick a section, search, or download the list." />
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col gap-4 print:h-auto print:block">
                <div className="card flex-1 flex flex-col overflow-hidden print:shadow-none print:h-auto">
                    {/* Title, counts and tools */}
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-3 print:bg-white print:border-none">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-base font-semibold text-slate-900">
                                    Class {selectedClass} {selectedSection || ""}
                                </div>
                                <div className="text-sm text-slate-600">
                                    {recordCount} student{recordCount === 1 ? '' : 's'} · {totalMales} boys · {totalFemales} girls
                                </div>
                            </div>
                            <div className="flex items-center gap-2 print:hidden">
                                <button type="button" onClick={exportToExcel} className="btn-secondary btn-sm">
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
                                </button>
                                <button type="button" onClick={handlePrint} className="btn-secondary btn-sm">
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                            </div>
                        </div>
                        <input
                            type="search"
                            className="input sm:max-w-xs print:hidden"
                            placeholder="Search students"
                            aria-label="Search students"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Phones: cards */}
                    <div className="md:hidden print:hidden p-3">
                        {studentLoading ? (
                            <LoadingState label="Loading students…" />
                        ) : students.length === 0 ? (
                            <EmptyState compact title="No students found" description="Try another section or clear the search." />
                        ) : (
                            <ul className="space-y-2.5">
                                {students.map(st => (
                                    <li key={st.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-[15px] font-semibold text-slate-900 break-words">{st.name}</div>
                                                <div className="text-sm text-slate-500">Class {st.class} {st.section} · Roll No. {st.rollNo || '—'}</div>
                                            </div>
                                            {statusBadge(st.status)}
                                        </div>
                                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                            <div><dt className="text-xs text-slate-500">Admission number</dt><dd className="text-slate-800 break-words">{st.admNo || '—'}</dd></div>
                                            <div><dt className="text-xs text-slate-500">Father's name</dt><dd className="text-slate-800 break-words">{st.father || '—'}</dd></div>
                                            <div className="col-span-2"><dt className="text-xs text-slate-500">Phone</dt><dd><PhoneLink phone={st.fatherMobile} /></dd></div>
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Wide screens and print: table */}
                    <div className="hidden md:block print:block flex-1 overflow-auto print:overflow-visible">
                        <table className="min-w-full text-sm divide-y divide-gray-200">
                            <thead className="bg-slate-50 text-slate-600 print:bg-white print:border-b-2 print:border-black">
                                <tr>
                                    <th className="px-4 py-3 text-left w-12">No.</th>
                                    <th className="px-4 py-3 text-left">Roll No.</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Class</th>
                                    <th className="px-4 py-3 text-left">Admission No.</th>
                                    <th className="px-4 py-3 text-left">Father's name</th>
                                    <th className="px-4 py-3 text-left">Phone</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {studentLoading ? (
                                    <tr><td colSpan={8}><LoadingState label="Loading students…" /></td></tr>
                                ) : students.length === 0 ? (
                                    <tr><td colSpan={8}>
                                        <EmptyState compact title="No students found" description="Try another section or clear the search." />
                                    </td></tr>
                                ) : (
                                    students.map((st, index) => (
                                        <tr key={st.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-3 text-gray-600 font-medium">{st.rollNo || '-'}</td>
                                            <td className="px-4 py-3">{statusBadge(st.status)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{st.name}</td>
                                            <td className="px-4 py-3 text-gray-700 font-semibold">{st.class} {st.section}</td>
                                            <td className="px-4 py-3 text-gray-600">{st.admNo}</td>
                                            <td className="px-4 py-3 text-gray-700">{st.father}</td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">{st.fatherMobile}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 bg-surface-muted lg:h-full lg:flex lg:flex-col lg:overflow-hidden print:block print:bg-white print:p-0 print:h-auto print:overflow-visible">
            {renderMobileFilters()}
            <div className="lg:flex lg:flex-1 lg:min-h-0 gap-4 print:block print:h-auto">
                {/* Desktop: status + class list */}
                <div className="hidden lg:block w-1/5 min-w-[200px] flex-shrink-0 print:hidden">
                    {renderLeftSidebar()}
                </div>

                {/* Desktop: sections */}
                <div className="hidden lg:block w-[15%] min-w-[150px] flex-shrink-0 print:hidden">
                    {renderMiddleSidebar()}
                </div>

                {/* Students */}
                <div className="flex-1 min-w-0 print:w-full">
                    {renderStudentList()}
                </div>
            </div>
        </div>
    );
};

export default ClassSummary;
