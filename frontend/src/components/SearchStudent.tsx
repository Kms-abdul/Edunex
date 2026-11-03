import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { Search, SlidersHorizontal, ArrowLeft, Eye, Pencil, Lock } from 'lucide-react';
import { UserIcon } from './icons';
import { LoadingState, EmptyState, Badge, DataList, notify } from './ui';
import type { Column } from './ui';
import { StudentAvatar, PhoneLink, classLabel } from './students/common';

interface ClassItem {
    id: number;
    class_name: string;
}

interface StudentRecord {
    student_id: number;
    name: string;
    first_name?: string;
    last_name?: string;
    admNo?: string;
    admission_no?: string;
    enrollment_no?: string;
    rollNo?: number | string;
    class?: string;
    section?: string;
    status?: string;
    branch?: string;
    father?: string;
    fatherMobile?: string;
    photo?: string;
    gender?: string;
    dob?: string;
    admission_date?: string;
    BloodGroup?: string;
    Fatherfirstname?: string;
    FatherPhone?: string;
    FatherEmail?: string;
    Motherfirstname?: string;
    SecondaryPhone?: string;
    SecondaryEmail?: string;
    address?: string;
    Category?: string;
    phone?: string;
    is_locked?: boolean;
}

interface FeeInstallmentRow {
    sr: number;
    title: string;
    payable: number;
    paidAmount: number;
    dueAmount: number;
    concession: number;
    status: string;
    month?: string;
}

interface MonthlySummaryRow {
    key: string;
    label: string;
    sortValue: number;
    feePayable: number;
    feePaid: number;
    feeDue: number;
    feeConcession: number;
    installmentCount: number;
    attendanceTotal: number;
    attendancePresent: number;
    attendanceAbsent: number;
    attendanceOther: number;
}

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const MONTH_LOOKUP = MONTHS.reduce<Record<string, number>>((acc, month, index) => {
    acc[month.toLowerCase()] = index;
    acc[month.slice(0, 3).toLowerCase()] = index;
    return acc;
}, {});

const SEARCH_FIELD_OPTIONS = [
    { value: 'any', label: 'Name, admission number or phone' },
    { value: 'name', label: 'Student name only' },
    { value: 'admission', label: 'Admission number only' },
    { value: 'enrollment', label: 'Enrollment number only' },
    { value: 'father', label: 'Father name only' },
];

const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value || 0);

const extractMonthInfo = (installment: FeeInstallmentRow) => {
    const rawMonth = (installment.month || '').trim();
    if (rawMonth && rawMonth.toLowerCase() !== 'one-time') {
        const monthIndex = MONTH_LOOKUP[rawMonth.toLowerCase()];
        if (monthIndex !== undefined) {
            return {
                key: MONTHS[monthIndex],
                label: MONTHS[monthIndex],
                sortValue: monthIndex,
            };
        }
    }

    const title = installment.title || '';
    const matchedMonth = MONTHS.find((month) =>
        title.toLowerCase().includes(month.toLowerCase())
    );
    if (matchedMonth) {
        return {
            key: matchedMonth,
            label: matchedMonth,
            sortValue: MONTH_LOOKUP[matchedMonth.toLowerCase()],
        };
    }

    return {
        key: 'one-time',
        label: 'One-Time / Other',
        sortValue: 99,
    };
};

interface SearchStudentProps {
    /** Open the full student record (read only). Hidden when not given. */
    onView?: (student: any) => void;
    /** Open the student record for editing. Hidden when not given (e.g. no permission). */
    onEdit?: (student: any) => void;
}

const SearchStudent: React.FC<SearchStudentProps> = ({ onView, onEdit }) => {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
    const [feeInstallments, setFeeInstallments] = useState<FeeInstallmentRow[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('Active');
    // 'any' = no extra filtering on top of the server search (which already
    // matches name, admission / enrollment number, father name and phone).
    const [searchField, setSearchField] = useState('any');
    const [showOptions, setShowOptions] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    useEffect(() => {
        api.get('/classes')
            .then((res) => setClasses(res.data.classes || []))
            .catch(() => setClasses([]));
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSections([]);
            setSelectedSection('');
            return;
        }

        const branch = localStorage.getItem('currentBranch') || 'All';
        const academicYear = localStorage.getItem('academicYear') || '';

        api.get('/sections', {
            params: {
                class: selectedClass,
                branch: branch === 'All Branches' ? 'All' : branch,
                academic_year: academicYear,
            },
        })
            .then((res) => setSections(res.data.sections || []))
            .catch(() => setSections([]));
    }, [selectedClass]);

    const loadStudentDetails = async (student: StudentRecord) => {
        setSelectedStudent(student);
        setLoadingDetails(true);

        try {
            const [feeRes, attendanceRes] = await Promise.all([
                api.get(`/fees/student-details/${student.student_id}`),
                api.get('/attendance', {
                    params: { student_id: student.student_id },
                }),
            ]);

            const installments = (feeRes.data.installments || []).map((item: any) => ({
                sr: Number(item.sr || 0),
                title: item.title || '-',
                payable: Number(item.payable || 0),
                paidAmount: Number(item.paidAmount || 0),
                dueAmount: Number(item.dueAmount || 0),
                concession: Number(item.concession || 0),
                status: item.status || 'Pending',
                month: item.month || '',
            }));

            const rawAttendance = attendanceRes.data.attendance || {};
            const studentAttendance = rawAttendance[String(student.student_id)] || rawAttendance[student.student_id] || {};

            setFeeInstallments(installments);
            setAttendanceMap(studentAttendance);
        } catch (error) {
            console.error('Failed to load student detail', error);
            setFeeInstallments([]);
            setAttendanceMap({});
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleSearch = async () => {
        setLoadingStudents(true);
        setHasSearched(true);
        setSelectedStudent(null);
        setFeeInstallments([]);
        setAttendanceMap({});

        const params: Record<string, string> = {
            include_inactive: 'true',
        };

        if (selectedClass) params.class = selectedClass;
        if (selectedSection) params.section = selectedSection;
        if (searchValue.trim()) params.search = searchValue.trim();

        try {
            const res = await api.get('/students', { params });
            let result: StudentRecord[] = res.data.students || [];

            if (selectedStatus !== 'All') {
                result = result.filter((student) => (student.status || '').toLowerCase() === selectedStatus.toLowerCase());
            }

            if (searchValue.trim() && searchField !== 'any') {
                const needle = searchValue.trim().toLowerCase();
                result = result.filter((student) => {
                    if (searchField === 'admission') {
                        return `${student.admNo || student.admission_no || ''}`.toLowerCase().includes(needle);
                    }
                    if (searchField === 'enrollment') {
                        return `${student.enrollment_no || ''}`.toLowerCase().includes(needle);
                    }
                    if (searchField === 'father') {
                        return `${student.father || student.Fatherfirstname || ''}`.toLowerCase().includes(needle);
                    }
                    return `${student.name || ''}`.toLowerCase().includes(needle);
                });
            }

            setStudents(result);

            // Only one match: open it straight away
            if (result.length === 1) {
                await loadStudentDetails(result[0]);
            }
        } catch (error) {
            console.error('Failed to search students', error);
            setStudents([]);
        } finally {
            setLoadingStudents(false);
        }
    };

    const monthlySummary = useMemo<MonthlySummaryRow[]>(() => {
        const rows = new Map<string, MonthlySummaryRow>();

        feeInstallments.forEach((installment) => {
            const monthInfo = extractMonthInfo(installment);
            const existing = rows.get(monthInfo.key) || {
                key: monthInfo.key,
                label: monthInfo.label,
                sortValue: monthInfo.sortValue,
                feePayable: 0,
                feePaid: 0,
                feeDue: 0,
                feeConcession: 0,
                installmentCount: 0,
                attendanceTotal: 0,
                attendancePresent: 0,
                attendanceAbsent: 0,
                attendanceOther: 0,
            };

            existing.feePayable += installment.payable || 0;
            existing.feePaid += installment.paidAmount || 0;
            existing.feeDue += installment.dueAmount || 0;
            existing.feeConcession += installment.concession || 0;
            existing.installmentCount += 1;

            rows.set(monthInfo.key, existing);
        });

        Object.entries(attendanceMap).forEach(([dateString, status]) => {
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return;

            const monthIndex = date.getMonth();
            const key = MONTHS[monthIndex];
            const existing = rows.get(key) || {
                key,
                label: key,
                sortValue: monthIndex,
                feePayable: 0,
                feePaid: 0,
                feeDue: 0,
                feeConcession: 0,
                installmentCount: 0,
                attendanceTotal: 0,
                attendancePresent: 0,
                attendanceAbsent: 0,
                attendanceOther: 0,
            };

            const normalizedStatus = (status || '').toLowerCase();
            existing.attendanceTotal += 1;
            if (['present', 'p'].includes(normalizedStatus)) {
                existing.attendancePresent += 1;
            } else if (['absent', 'a'].includes(normalizedStatus)) {
                existing.attendanceAbsent += 1;
            } else {
                existing.attendanceOther += 1;
            }

            rows.set(key, existing);
        });

        return Array.from(rows.values()).sort((a, b) => a.sortValue - b.sortValue || a.label.localeCompare(b.label));
    }, [attendanceMap, feeInstallments]);

    const feeTotals = useMemo(() => {
        return feeInstallments.reduce(
            (acc, row) => {
                acc.payable += row.payable || 0;
                acc.paid += row.paidAmount || 0;
                acc.due += row.dueAmount || 0;
                acc.concession += row.concession || 0;
                return acc;
            },
            { payable: 0, paid: 0, due: 0, concession: 0 }
        );
    }, [feeInstallments]);

    const attendanceTotals = useMemo(() => {
        return monthlySummary.reduce(
            (acc, row) => {
                acc.total += row.attendanceTotal;
                acc.present += row.attendancePresent;
                acc.absent += row.attendanceAbsent;
                acc.other += row.attendanceOther;
                return acc;
            },
            { total: 0, present: 0, absent: 0, other: 0 }
        );
    }, [monthlySummary]);

    const rupees = (value: number) => `₹${formatCurrency(value)}`;

    const filterNote = [
        selectedClass ? `Class ${selectedClass}` : 'All classes',
        selectedSection ? `Section ${selectedSection}` : '',
        selectedStatus === 'All' ? 'all students' : selectedStatus === 'TC' ? 'TC students only' : `${selectedStatus.toLowerCase()} students only`,
    ].filter(Boolean).join(' · ');

    const resultColumns: Column<StudentRecord>[] = [
        {
            key: 'name',
            header: 'Student',
            primary: true,
            render: (s) => (
                <span className="flex items-center gap-3">
                    <StudentAvatar src={s.photo} name={s.name} size="sm" />
                    <span className="min-w-0 break-words">{s.name}</span>
                </span>
            ),
        },
        { key: 'class', header: 'Class', secondary: true, render: (s) => classLabel(s.class, s.section) },
        { key: 'admNo', header: 'Admission number', render: (s) => s.admNo || s.admission_no || '—' },
        { key: 'father', header: 'Father', render: (s) => s.father || s.Fatherfirstname || '—' },
        { key: 'phone', header: 'Phone', render: (s) => <PhoneLink phone={s.fatherMobile || s.FatherPhone || s.phone} /> },
        { key: 'status', header: 'Status', render: (s) => <Badge status={s.status || 'Unknown'} /> },
    ];

    const monthColumns: Column<MonthlySummaryRow>[] = [
        { key: 'label', header: 'Month', primary: true },
        { key: 'feePayable', header: 'Fee', render: (r) => rupees(r.feePayable) },
        { key: 'feePaid', header: 'Paid', render: (r) => <span className="text-emerald-700">{rupees(r.feePaid)}</span> },
        { key: 'feeDue', header: 'Still due', render: (r) => <span className="text-rose-700">{rupees(r.feeDue)}</span> },
        { key: 'feeConcession', header: 'Concession', render: (r) => rupees(r.feeConcession) },
        { key: 'installmentCount', header: 'Instalments', hideOnMobile: true },
        { key: 'attendanceTotal', header: 'Days marked' },
        { key: 'attendancePresent', header: 'Present' },
        { key: 'attendanceAbsent', header: 'Absent' },
        { key: 'attendanceOther', header: 'Other' },
    ];

    const handleEdit = (student: StudentRecord) => {
        if (!onEdit) return;
        if (student.is_locked) {
            notify('This student record is locked for this academic year and cannot be edited.');
            return;
        }
        onEdit(student);
    };

    const renderSummary = (student: StudentRecord) => (
        <div className="space-y-4">
            {students.length > 1 && (
                <button className="btn-ghost -ml-2" onClick={() => setSelectedStudent(null)}>
                    <ArrowLeft className="h-5 w-5" /> Back to results ({students.length})
                </button>
            )}

            <div className="card p-4 sm:p-6">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
                    <StudentAvatar src={student.photo} name={student.name} size="lg" />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-semibold text-slate-900 break-words">{student.name}</h3>
                        <p className="mt-1 text-base text-slate-600">Class {classLabel(student.class, student.section)}</p>
                        <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                            <Badge status={student.status || 'Unknown'} />
                            {student.is_locked && <Badge tone="neutral">Locked for this year</Badge>}
                        </div>
                    </div>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                    <Fact label="Admission number" value={student.admNo || student.admission_no} />
                    <Fact label="Roll number" value={student.rollNo} />
                    <Fact label="Father" value={student.Fatherfirstname || student.father} />
                    <Fact label="Father's phone" value={<PhoneLink phone={student.FatherPhone || student.fatherMobile} />} />
                    <Fact label="Mother" value={student.Motherfirstname} />
                    <Fact label="Mother's phone" value={<PhoneLink phone={student.SecondaryPhone} />} />
                </dl>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <MiniStat label="Fee still due" value={loadingDetails ? '…' : rupees(feeTotals.due)} tone="rose" />
                    <MiniStat
                        label="Days present"
                        value={loadingDetails ? '…' : `${attendanceTotals.present} of ${attendanceTotals.total || 0}`}
                        tone="emerald"
                    />
                </div>

                {(onView || onEdit) && (
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        {onView && (
                            <button className="btn-primary btn-lg" onClick={() => onView(student)}>
                                <Eye className="h-5 w-5" /> View full details
                            </button>
                        )}
                        {onEdit && (
                            <button
                                className={`btn-secondary btn-lg ${student.is_locked ? 'opacity-60' : ''}`}
                                onClick={() => handleEdit(student)}
                            >
                                {student.is_locked ? <Lock className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
                                {student.is_locked ? 'Locked — cannot edit' : 'Edit details'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <details className="card group">
                <summary className="flex min-h-[44px] cursor-pointer items-center px-4 py-3 font-medium text-slate-800 sm:px-6">
                    More details
                </summary>
                <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                    <Fact label="Gender" value={student.gender} />
                    <Fact label="Date of birth" value={formatDate(student.dob)} />
                    <Fact label="Admission date" value={formatDate(student.admission_date)} />
                    <Fact label="Enrollment number" value={student.enrollment_no} />
                    <Fact label="Category" value={student.Category} />
                    <Fact label="Blood group" value={student.BloodGroup} />
                    <Fact label="Father's email" value={student.FatherEmail} />
                    <Fact label="Mother's email" value={student.SecondaryEmail} />
                    <Fact label="Branch" value={student.branch} />
                    <Fact label="Address" value={student.address} />
                </dl>
            </details>

            <div className="card">
                <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                    <h4 className="text-base font-semibold text-slate-900">Fees and attendance by month</h4>
                </div>
                <div className="p-3 sm:p-4">
                    {loadingDetails ? (
                        <LoadingState label="Loading fees and attendance…" />
                    ) : (
                        <>
                            <DataList
                                columns={monthColumns}
                                rows={monthlySummary}
                                rowKey={(r) => r.key}
                                emptyTitle="No records yet"
                                emptyHint="There are no fee or attendance records for this student."
                            />
                            {monthlySummary.length > 0 && (
                                <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                                    <div className="mb-2 text-sm font-semibold text-slate-800">Total</div>
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
                                        <Fact label="Fee" value={rupees(feeTotals.payable)} />
                                        <Fact label="Paid" value={rupees(feeTotals.paid)} />
                                        <Fact label="Still due" value={rupees(feeTotals.due)} />
                                        <Fact label="Concession" value={rupees(feeTotals.concession)} />
                                        <Fact label="Instalments" value={feeInstallments.length} />
                                        <Fact label="Days marked" value={attendanceTotals.total} />
                                        <Fact label="Present" value={attendanceTotals.present} />
                                        <Fact label="Absent / other" value={`${attendanceTotals.absent} / ${attendanceTotals.other}`} />
                                    </dl>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div className="card p-4 sm:p-6">
                <label htmlFor="find-student" className="mb-2 block text-base font-semibold text-slate-900">
                    Find a student
                </label>
                <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                >
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            id="find-student"
                            type="search"
                            enterKeyHint="search"
                            autoComplete="off"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search by name, admission number or phone"
                            className="input h-12 pl-10 text-base"
                        />
                    </div>
                    <button type="submit" className="btn-primary btn-lg" disabled={loadingStudents}>
                        {loadingStudents ? 'Searching…' : 'Search'}
                    </button>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-slate-500">Looking in: {filterNote}</span>
                    <button
                        type="button"
                        className="btn-ghost btn-sm"
                        aria-expanded={showOptions}
                        onClick={() => setShowOptions((v) => !v)}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {showOptions ? 'Hide options' : 'More options'}
                    </button>
                </div>

                {showOptions && (
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="label">Class</label>
                            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                                <option value="">All classes</option>
                                {classes.map((item) => (
                                    <option key={item.id} value={item.class_name}>{item.class_name}</option>
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
                                {sections.map((section) => (
                                    <option key={section} value={section}>{section}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Which students</label>
                            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="input">
                                <option value="Active">Active only</option>
                                <option value="Inactive">Inactive only</option>
                                <option value="TC">TC only</option>
                                <option value="All">All students</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Search in</label>
                            <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="input">
                                {SEARCH_FIELD_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {selectedStudent ? (
                renderSummary(selectedStudent)
            ) : loadingStudents ? (
                <div className="card"><LoadingState label="Searching…" /></div>
            ) : !hasSearched ? (
                <div className="card">
                    <EmptyState
                        icon={<UserIcon className="h-6 w-6" />}
                        title="Search for a student"
                        description="Type a name, admission number or phone number, then tap Search. Leave it empty to see everyone in the chosen class."
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    {students.length > 0 && (
                        <p className="px-1 text-sm text-slate-600">
                            {students.length === 1 ? '1 student found' : `${students.length} students found`} · tap a student to open
                        </p>
                    )}
                    <DataList
                        columns={resultColumns}
                        rows={students}
                        rowKey={(s) => s.student_id}
                        onRowClick={loadStudentDetails}
                        emptyTitle="No students found"
                        emptyHint="Check the spelling, or open More options and choose “All students”."
                    />
                </div>
            )}
        </div>
    );
};

const Fact: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-[15px] font-medium text-slate-800 break-words">
            {value === undefined || value === null || value === '' ? '—' : value}
        </dd>
    </div>
);

const MiniStat: React.FC<{ label: string; value: string; tone: 'rose' | 'emerald' }> = ({ label, value, tone }) => {
    const toneMap = {
        rose: 'bg-rose-50 text-rose-700',
        emerald: 'bg-emerald-50 text-emerald-700',
    };

    return (
        <div className={`rounded-xl px-4 py-3 ${toneMap[tone]}`}>
            <div className="text-sm">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
        </div>
    );
};

export default SearchStudent;
