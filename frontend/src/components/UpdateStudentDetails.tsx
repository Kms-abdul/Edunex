import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { SearchIcon } from './icons';
import { confirmDialog } from './ui/feedback';
import { LoadingState, EmptyState, Spinner, Steps, ActionBar, Button, Field } from './ui';
import { StudentAvatar } from './students/common';

interface UpdateStudentDetailsProps {
    onBack: () => void;
}

interface Student {
    student_id: number;
    id: number;
    name: string;
    admission_no: string;
    admNo: string;
    rollNo: string;
    Roll_Number: number | string;
    class: string;
    section: string;
    photo: string;
    [key: string]: any;
}

interface Category {
    id: string;
    label: string;
    columns: { key: string; label: string }[];
}

const CATEGORIES: Category[] = [
    {
        id: 'personal',
        label: 'Personal',
        columns: [
            { key: 'dob', label: 'Date of birth' },
            { key: 'gender', label: 'Gender' },
            { key: 'BloodGroup', label: 'Blood Group' },
            { key: 'Religion', label: 'Religion' },
            { key: 'Caste', label: 'Caste' },
            { key: 'Category', label: 'Category' },
            { key: 'MotherTongue', label: 'Mother Tongue' },
        ]
    },
    {
        id: 'contact',
        label: 'Phone and email',
        columns: [
            { key: 'phone', label: 'Mobile number' },
            { key: 'email', label: 'Email' },
            { key: 'address', label: 'Address' },
            { key: 'Fatherfirstname', label: "Father's name" },
            { key: 'FatherPhone', label: "Father's mobile" },
        ]
    },
    {
        id: 'academic',
        label: 'School details',
        columns: [
            { key: 'Roll_Number', label: 'Roll Number' },
            { key: 'admission_date', label: 'Admission date' },
            { key: 'AdmissionClass', label: 'Joined in class' },
            { key: 'AdmissionCategory', label: 'Admission category' },
            { key: 'StudentType', label: 'Day scholar or hosteller' },
            { key: 'House', label: 'House' },
        ]
    },
    {
        id: 'address',
        label: 'Address, height, weight',
        columns: [
            { key: 'address', label: 'Address' },
            { key: 'permanentCity', label: 'Home town (permanent)' },
            { key: 'StudentHeight', label: 'Height' },
            { key: 'StudentWeight', label: 'Weight' },
        ]
    },
    {
        id: 'parent_id',
        label: 'Parents and ID numbers',
        columns: [
            { key: 'Fatherfirstname', label: "Father's name" },
            { key: 'Motherfirstname', label: "Mother's name" },
            { key: 'GuardianName', label: "Guardian's name" },
            { key: 'Adharcardno', label: 'Aadhaar number' },
            { key: 'SamagraId', label: 'Samagra ID' },
            { key: 'PEN', label: 'PEN number' },
            { key: 'ApaarId', label: 'APAAR ID' },
        ]
    }
];

const READ_ONLY_FIELDS = [
    'class', 'admission_date', 'AdmissionClass', 'admission_no',
    'admNo', 'Doa', 'section', 'academic_year', 'student_id',
    'id', 'name', 'photo', 'rollNo', 'is_promoted', 'is_locked',
];

const DISPLAY_READONLY_FIELDS = ['admission_date', 'AdmissionClass'];

const STUDENTS_PER_PAGE = 10;

const STEPS = ['Choose class', 'Update details'];

/** Phone keypad for number-only fields */
const INPUT_MODE: Record<string, React.HTMLAttributes<HTMLInputElement>['inputMode']> = {
    phone: 'tel',
    FatherPhone: 'tel',
    email: 'email',
    Roll_Number: 'numeric',
    Adharcardno: 'numeric',
    StudentHeight: 'decimal',
    StudentWeight: 'decimal',
};

const UpdateStudentDetails: React.FC<UpdateStudentDetailsProps> = ({ onBack }) => {
    const [step, setStep] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].id);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [classOptions, setClassOptions] = useState<any[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [modifiedStudents, setModifiedStudents] = useState<Record<number, Partial<Student>>>({});
    const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
    const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});
    const [saveSuccess, setSaveSuccess] = useState<Set<number>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    const successTimeoutsRef = React.useRef<Record<number, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        return () => {
            Object.values(successTimeoutsRef.current).forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        api.get('/classes')
            .then(res => {
                const list = res.data.classes || [];
                list.sort((a: any, b: any) => a.id - b.id);
                setClassOptions(list);
            })
            .catch(err => console.error("Failed to load classes", err));
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', {
            params: { class: selectedClass, branch, academic_year: academicYear }
        })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(() => setSectionOptions([]));
    }, [selectedClass]);

    const loadStudents = useCallback(() => {
        if (!selectedClass || !selectedSection) return;
        setLoading(true);
        setModifiedStudents({});
        setSaveErrors({});
        setSaveSuccess(new Set());

        const globalBranch = localStorage.getItem('currentBranch') || '';
        const academicYear = localStorage.getItem('academicYear') || '';

        api.get('/students', {
            params: {
                class: selectedClass,
                section: selectedSection,
                branch: globalBranch === "All" || globalBranch === "All Branches" ? "All" : globalBranch,
                academic_year: academicYear
            },
            headers: { 'X-Academic-Year': academicYear }
        })
            .then(res => setStudents(res.data.students || []))
            .catch(() => setStudents([]))
            .finally(() => setLoading(false));
    }, [selectedClass, selectedSection]);

    useEffect(() => {
        loadStudents();
    }, [selectedClass, selectedSection, loadStudents]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm, selectedClass, selectedSection]);

    const handleFieldChange = (studentId: number, field: string, value: any) => {
        if (READ_ONLY_FIELDS.includes(field)) return;

        setSaveErrors(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });
        setSaveSuccess(prev => {
            const next = new Set(prev);
            next.delete(studentId);
            return next;
        });

        setModifiedStudents(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [field]: value
            }
        }));
    };

    const saveStudentChanges = async (studentId: number) => {
        const changes = modifiedStudents[studentId];
        if (!changes || Object.keys(changes).length === 0) return;

        const cleanChanges: Record<string, any> = {};
        for (const [key, value] of Object.entries(changes)) {
            if (!READ_ONLY_FIELDS.includes(key)) {
                cleanChanges[key] = value;
            }
        }

        if (Object.keys(cleanChanges).length === 0) return;

        setSavingIds(prev => new Set(prev).add(studentId));
        setSaveErrors(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });

        try {
            const academicYear = localStorage.getItem('academicYear') || '';
            const payload: Record<string, any> = {
                ...cleanChanges,
                academic_year: academicYear,
            };

            if (cleanChanges.Roll_Number !== undefined) {
                payload.class = selectedClass;
                payload.section = selectedSection;
            }

            await api.put(`/students/${studentId}`, payload);

            setStudents(prev => prev.map(s => {
                const sid = s.student_id || s.id;
                if (sid === studentId) return { ...s, ...cleanChanges };
                return s;
            }));

            setModifiedStudents(prev => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });

            setSaveSuccess(prev => new Set(prev).add(studentId));

            if (successTimeoutsRef.current[studentId]) {
                clearTimeout(successTimeoutsRef.current[studentId]);
            }

            successTimeoutsRef.current[studentId] = setTimeout(() => {
                setSaveSuccess(prev => {
                    const next = new Set(prev);
                    next.delete(studentId);
                    return next;
                });
                delete successTimeoutsRef.current[studentId];
            }, 3000);

        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.message || "Could not save. Try again.";
            setSaveErrors(prev => ({ ...prev, [studentId]: errorMsg }));
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
        }
    };

    const filteredStudents = students.filter(s => {
        const name = (s.name || '').toLowerCase();
        const admNo = (s.admission_no || s.admNo || '').toLowerCase();
        const enrollNo = (s.enrollment_no || '').toLowerCase();
        const rollNo = s.Roll_Number ? s.Roll_Number.toString().toLowerCase() : '';
        const term = searchTerm.toLowerCase();
        return name.includes(term) || admNo.includes(term) || enrollNo.includes(term) || rollNo.includes(term);
    });

    const totalStudents = filteredStudents.length;
    const totalPages = Math.ceil(totalStudents / STUDENTS_PER_PAGE);
    const indexOfFirstStudent = (currentPage - 1) * STUDENTS_PER_PAGE;
    const indexOfLastStudent = Math.min(indexOfFirstStudent + STUDENTS_PER_PAGE, totalStudents);
    const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);

    const activeCat = CATEGORIES.find(c => c.id === selectedCategory)!;

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    const changedIds = Object.keys(modifiedStudents)
        .map(Number)
        .filter(id => Object.keys(modifiedStudents[id] || {}).length > 0);
    const savingAny = savingIds.size > 0;

    const saveAllChanged = async () => {
        for (const id of changedIds) {
            // Same save as the per-student button, one after another
            await saveStudentChanges(id);
        }
    };

    const leaveToClassChoice = async () => {
        if (changedIds.length > 0 && !await confirmDialog(
            `${changedIds.length} student${changedIds.length === 1 ? ' has' : 's have'} changes that are not saved. Discard them?`,
            { confirmText: 'Discard changes', tone: 'danger' }
        )) return;
        setStep(0);
    };

    const fieldInput = (student: Student, sid: number, col: { key: string; label: string }, isSaving: boolean, mobile: boolean) => {
        const isDisplayReadOnly = DISPLAY_READONLY_FIELDS.includes(col.key);
        const currentVal = modifiedStudents[sid]?.[col.key] ?? student[col.key] ?? '';
        const displayVal = currentVal !== null && currentVal !== undefined ? String(currentVal) : '';
        const changed = modifiedStudents[sid]?.[col.key] !== undefined;

        if (isDisplayReadOnly) {
            return <span className="text-slate-500 text-sm px-1">{displayVal || '—'}</span>;
        }
        return (
            <input
                type="text"
                inputMode={INPUT_MODE[col.key]}
                aria-label={`${col.label} of ${student.name}`}
                value={displayVal}
                onChange={(e) => handleFieldChange(sid, col.key, e.target.value)}
                disabled={isSaving}
                className={`input ${mobile ? '' : 'min-w-[110px]'} ${isSaving
                    ? 'opacity-50 cursor-not-allowed'
                    : changed
                        ? 'border-amber-400 bg-amber-50 focus:bg-white'
                        : mobile ? '' : 'border-transparent hover:border-slate-300 focus:bg-white bg-transparent'
                    }`}
            />
        );
    };

    const rowStatus = (sid: number, isModified: boolean, isSaving: boolean) => (
        <>
            {saveErrors[sid] && (
                <span role="alert" className="text-xs text-red-600 leading-tight break-words">{saveErrors[sid]}</span>
            )}
            {saveSuccess.has(sid) && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
            {isSaving && (
                <span className="flex items-center gap-1 text-xs text-brand-600"><Spinner size="sm" /> Saving…</span>
            )}
            {isModified && !isSaving && (
                <button type="button" onClick={() => saveStudentChanges(sid)} className="btn-success btn-sm min-h-[40px]">
                    Save
                </button>
            )}
        </>
    );

    /* ------------------------------------------------------------ Step 1: class */
    if (step === 0) {
        return (
            <div className="p-4 sm:p-6 bg-surface-muted min-h-full">
                <div className="max-w-3xl mx-auto space-y-4">
                    <Steps steps={STEPS} current={0} />
                    <p className="text-sm text-slate-600">Correct details like date of birth, phone or Aadhaar for a whole class at once.</p>
                    <div className="card">
                        <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Class" htmlFor="usd-class">
                                <select
                                    id="usd-class"
                                    value={selectedClass}
                                    onChange={(e) => {
                                        setSelectedClass(e.target.value);
                                        setSelectedSection('');
                                    }}
                                    className="input"
                                >
                                    <option value="">Choose a class</option>
                                    {classOptions.map(c => (
                                        <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Section" htmlFor="usd-section">
                                <select
                                    id="usd-section"
                                    value={selectedSection}
                                    onChange={(e) => setSelectedSection(e.target.value)}
                                    className="input"
                                    disabled={!selectedClass}
                                >
                                    <option value="">Choose a section</option>
                                    {sectionOptions.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </div>
                    <ActionBar note={!selectedClass ? 'Choose a class first' : !selectedSection ? 'Choose a section' : undefined}>
                        <Button variant="secondary" size="lg" onClick={onBack}>Back to students</Button>
                        <Button size="lg" disabled={!selectedClass || !selectedSection} onClick={() => setStep(1)}>Show students</Button>
                    </ActionBar>
                </div>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2: edit */
    return (
        <div className="p-4 sm:p-6 bg-surface-muted min-h-full">
            <div className="max-w-7xl mx-auto space-y-4">
                <Steps steps={STEPS} current={1} onJump={() => leaveToClassChoice()} />

                <div className="card">
                    <div className="card-body space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900">Class {selectedClass}-{selectedSection}</p>
                                <p className="text-sm text-slate-600">Change a box, then tap Save. Changed boxes turn yellow.</p>
                            </div>
                            <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={leaveToClassChoice}>Change class</button>
                        </div>

                        <div>
                            <p className="label">What do you want to update?</p>
                            <div className="-mx-4 px-4 overflow-x-auto">
                                <div className="segmented" role="tablist">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={selectedCategory === cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`segmented-item whitespace-nowrap min-h-[40px] ${selectedCategory === cat.id ? 'segmented-item-active' : ''}`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="search"
                                placeholder="Search by name, admission or roll number"
                                aria-label="Search students"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input pl-9"
                            />
                            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="card"><LoadingState label="Loading students…" /></div>
                ) : currentStudents.length === 0 ? (
                    <div className="card">
                        <EmptyState
                            compact
                            title={searchTerm ? 'No student matches your search' : 'No students in this class'}
                        />
                    </div>
                ) : (
                    <>
                        {/* Phones: one card per student */}
                        <ul className="md:hidden space-y-3">
                            {currentStudents.map(student => {
                                const sid = student.student_id || student.id;
                                const isModified = !!modifiedStudents[sid] && Object.keys(modifiedStudents[sid]).length > 0;
                                const isSaving = savingIds.has(sid);
                                return (
                                    <li key={sid} className={`rounded-xl border bg-white ${saveErrors[sid] ? 'border-red-300' : isModified ? 'border-amber-300' : 'border-slate-200'}`}>
                                        <div className="flex items-center gap-3 px-4 pt-3">
                                            <StudentAvatar src={student.photo} name={student.name} size="sm" />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-slate-900 break-words">{student.name}</p>
                                                <p className="text-sm text-slate-500">Admission number {student.admission_no || student.admNo}</p>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 space-y-3">
                                            {activeCat.columns.map(col => (
                                                <div key={col.key}>
                                                    <p className="text-xs font-medium text-slate-600 mb-1">{col.label}</p>
                                                    {fieldInput(student, sid, col, isSaving, true)}
                                                </div>
                                            ))}
                                        </div>
                                        {(isModified || isSaving || saveErrors[sid] || saveSuccess.has(sid)) && (
                                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
                                                {rowStatus(sid, isModified, isSaving)}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Wide screens: one row per student */}
                        <div className="hidden md:block card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-2.5 text-left whitespace-nowrap">No.</th>
                                            <th className="px-4 py-2.5 text-left whitespace-nowrap">Student</th>
                                            {activeCat.columns.map(col => (
                                                <th key={col.key} className="px-4 py-2.5 text-left whitespace-nowrap">{col.label}</th>
                                            ))}
                                            <th className="px-4 py-2.5 text-left w-28 whitespace-nowrap"><span className="sr-only">Save</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentStudents.map((student, idx) => {
                                            const sid = student.student_id || student.id;
                                            const isModified = !!modifiedStudents[sid] && Object.keys(modifiedStudents[sid]).length > 0;
                                            const isSaving = savingIds.has(sid);
                                            return (
                                                <tr
                                                    key={sid}
                                                    className={saveErrors[sid] ? 'bg-red-50' : saveSuccess.has(sid) ? 'bg-emerald-50' : isModified ? 'bg-amber-50/60' : ''}
                                                >
                                                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{indexOfFirstStudent + idx + 1}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <StudentAvatar src={student.photo} name={student.name} size="sm" />
                                                            <div>
                                                                <p className="font-semibold text-slate-900">{student.name}</p>
                                                                <p className="text-xs text-slate-500 font-mono">{student.admission_no || student.admNo}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {activeCat.columns.map(col => (
                                                        <td key={col.key} className="px-2 py-2">{fieldInput(student, sid, col, isSaving, false)}</td>
                                                    ))}
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col gap-1 items-stretch max-w-[140px]">
                                                            {rowStatus(sid, isModified, isSaving)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Pages */}
                {totalStudents > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-slate-500">
                            Showing {indexOfFirstStudent + 1}–{indexOfLastStudent} of {totalStudents}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="btn-secondary btn-sm min-h-[40px]"
                                >
                                    Previous
                                </button>
                                <span className="sm:hidden px-2 text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                                <span className="hidden sm:flex items-center gap-1">
                                    {getPageNumbers().map((page, index) => (
                                        <React.Fragment key={index}>
                                            {page === '...' ? (
                                                <span className="px-2 text-sm text-slate-400">…</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentPage(page as number)}
                                                    aria-current={currentPage === page ? 'page' : undefined}
                                                    className={`btn btn-sm min-w-[36px] border ${currentPage === page ? 'bg-brand-600 text-brand-contrast border-brand-600 font-semibold' : 'text-slate-600 border-slate-300 hover:bg-slate-100 bg-white'}`}
                                                >
                                                    {page}
                                                </button>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="btn-secondary btn-sm min-h-[40px]"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <ActionBar note={changedIds.length > 0 ? `${changedIds.length} student${changedIds.length === 1 ? '' : 's'} changed, not saved yet` : 'No changes yet'}>
                    <Button variant="secondary" size="lg" onClick={onBack}>Done</Button>
                    <Button variant="success" size="lg" disabled={changedIds.length === 0} loading={savingAny} onClick={saveAllChanged}>
                        Save {changedIds.length > 0 ? `${changedIds.length} ` : ''}changed
                    </Button>
                </ActionBar>
            </div>
        </div>
    );
};

export default UpdateStudentDetails;
