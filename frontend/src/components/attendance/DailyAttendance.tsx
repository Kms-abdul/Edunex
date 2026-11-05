import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, Lock, CheckCircle2, Users, CalendarDays, Pencil } from 'lucide-react';
import type { Page } from '../../App';
import { Student } from '../../types';
import api from '../../api';
import { notify } from '../ui/feedback';
import { Steps, ActionBar, Alert, Button, EmptyState, Field, LoadingState } from '../ui';
import { getNormalizedBranch, prettyDate, readLastClass, saveLastClass, statusLabel } from './shared';

type DailyStep = 'choose' | 'mark' | 'done';

const STEP_TITLES = ['Choose class and date', 'Mark each student', 'Saved'];

interface SavedSummary {
    className: string;
    section: string;
    date: string;
    total: number;
    present: number;
    absent: number;
    other: number;
    wasUpdate: boolean;
}

/** Counts statuses for the given students, e.g. { Present: 32, Absent: 3, Leave: 1 } */
const countStatuses = (students: Student[], attendance: { [key: number]: string }) => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
        const st = attendance[s.student_id!];
        if (!st) return;
        counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
};

const countsText = (counts: Record<string, number>) => {
    const parts: string[] = [`${counts.Present || 0} present`, `${counts.Absent || 0} absent`];
    Object.entries(counts).forEach(([st, n]) => {
        if (st !== 'Present' && st !== 'Absent' && n > 0) parts.push(`${n} ${statusLabel(st).toLowerCase()}`);
    });
    return parts.join(' · ');
};

/**
 * Daily attendance in three simple steps:
 *   1. Choose class, section and date (remembers the last class on this device)
 *   2. Mark each student Present / Absent
 *   3. Saved – change class or go home
 */
const DailyAttendance: React.FC<{ navigateTo?: (page: Page) => void }> = ({ navigateTo }) => {
    const remembered = useMemo(readLastClass, []);

    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<{ [key: number]: string }>({});
    const [selectedClass, setSelectedClass] = useState(remembered?.className || '');
    const [selectedSection, setSelectedSection] = useState(remembered?.section || '');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [classOptions, setClassOptions] = useState<{ id: number, class_name: string }[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [updateCount, setUpdateCount] = useState<number>(0);
    const [lastModified, setLastModified] = useState<string | null>(null);
    const [dateBlocked, setDateBlocked] = useState<{ blocked: boolean; reason: string }>({ blocked: false, reason: '' });

    const [step, setStep] = useState<DailyStep>('choose');
    const [autoTried, setAutoTried] = useState(false);
    const [saved, setSaved] = useState<SavedSummary | null>(null);

    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(err => console.error("Failed to load classes", err));
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }

        const branch = getNormalizedBranch();
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', {
            params: {
                class: selectedClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(err => {
                console.error("Failed to load sections", err);
                setSectionOptions([]);
            });
    }, [selectedClass]);

    const handleGetStudents = async (opts: { advance?: boolean } = {}) => {
        if (!selectedClass) {
            notify("Choose a class first");
            return;
        }
        setLoading(true);
        setDateBlocked({ blocked: false, reason: '' });
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;

            // Pre-check: Is this date a holiday or weekoff?
            try {
                const checkRes = await api.post('/config/check-date', {
                    date: attendanceDate,
                    branch_name: branchParam,
                    class_name: selectedClass,
                });
                if (checkRes.data?.is_holiday || checkRes.data?.is_weekoff) {
                    setDateBlocked({ blocked: true, reason: checkRes.data.reason || 'Holiday / Weekoff' });
                    setStudents([]);
                    setAttendance({});
                    setLoading(false);
                    if (opts.advance) setStep('choose');
                    return;
                }
            } catch (checkErr) {
                console.error('Date check failed, proceeding:', checkErr);
            }

            const res = await api.get('/attendance', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    date: attendanceDate,
                    branch: branchParam
                }
            });

            const fetchedStudents = res.data.students || [];
            const existingAttendance = res.data.attendance || {};

            setStudents(fetchedStudents);
            setUpdateCount(res.data.class_update_count || 0);
            setLastModified(res.data.last_modified);

            // Build attendance map
            const initialAttendance: { [key: number]: string } = {};
            fetchedStudents.forEach((s: any) => {
                const status = existingAttendance[s.student_id] || 'Present';
                initialAttendance[s.student_id] = status;
            });

            setAttendance(initialAttendance);

            // Detect first-time or update mode
            const hasExisting = Object.keys(existingAttendance).length > 0;
            setIsUpdateMode(hasExisting);

            saveLastClass(selectedClass, selectedSection);
            if (opts.advance) setStep('mark');

        } catch (error) {
            console.error("Error fetching students:", error);
            notify.error("Could not load students. Check the internet and try again.");
        } finally {
            setLoading(false);
        }
    };

    // Open straight into the class this person used last time.
    useEffect(() => {
        if (autoTried || classOptions.length === 0) return;
        setAutoTried(true);
        if (!remembered) return;
        if (classOptions.some(c => c.class_name === remembered.className)) {
            handleGetStudents({ advance: true });
        } else {
            setSelectedClass('');
            setSelectedSection('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classOptions]);

    const handleStatusChange = (studentId: number, status: string) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status: string) => {
        const updated = students.reduce((acc, student) => {
            if (!(student as any).is_locked) {
                acc[student.student_id!] = status;
            } else {
                // keep old status if locked
                acc[student.student_id!] = attendance[student.student_id!];
            }
            return acc;
        }, {} as { [key: number]: string });
        setAttendance(updated);
    };

    const counts = countStatuses(students, attendance);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setLoading(true);
        const summary: SavedSummary = {
            className: selectedClass,
            section: selectedSection,
            date: attendanceDate,
            total: students.length,
            present: counts.Present || 0,
            absent: counts.Absent || 0,
            other: students.length - (counts.Present || 0) - (counts.Absent || 0),
            wasUpdate: isUpdateMode,
        };
        try {
            const payload = {
                date: attendanceDate,
                attendance: Object.entries(attendance).map(([studentId, status]) => ({
                    student_id: parseInt(studentId),
                    date: attendanceDate,
                    status: status
                }))
            };

            await api.post('/attendance', payload);
            notify.success("Attendance saved");
            setSaved(summary);
            setStep('done');
            handleGetStudents();
        } catch (error) {
            console.error("Error saving attendance:", error);
            notify.error("Attendance was not saved. Please try again.");
        } finally {
            setLoading(false);
            setSaving(false);
        }
    };

    const classLabel = (cls: string, sec: string) => `Class ${cls}${sec ? ` · Section ${sec}` : ' · All sections'}`;
    const today = new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */;

    /* ------------------------------------------------------------ Step 1 */
    if (step === 'choose') {
        return (
            <div className="space-y-4">
                <Steps steps={STEP_TITLES} current={0} />
                <div className="card">
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label="Class" htmlFor="att-class">
                                <select
                                    id="att-class"
                                    value={selectedClass}
                                    onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setDateBlocked({ blocked: false, reason: '' }); }}
                                    className="input"
                                >
                                    <option value="">Choose a class</option>
                                    {classOptions.map(c => (
                                        <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Section (optional)" htmlFor="att-section">
                                <select
                                    id="att-section"
                                    value={selectedSection}
                                    onChange={e => setSelectedSection(e.target.value)}
                                    className="input"
                                    disabled={!selectedClass}
                                >
                                    <option value="">All sections</option>
                                    {sectionOptions.map(section => <option key={section} value={section}>{section}</option>)}
                                </select>
                            </Field>
                            <Field label="Date" htmlFor="att-date" hint={attendanceDate === today ? 'Today' : prettyDate(attendanceDate)}>
                                <input
                                    id="att-date"
                                    type="date"
                                    value={attendanceDate}
                                    onChange={(e) => { setAttendanceDate(e.target.value); setDateBlocked({ blocked: false, reason: '' }); }}
                                    max={today}
                                    className="input"
                                />
                            </Field>
                        </div>

                        {dateBlocked.blocked && (
                            <Alert tone="warning" title="No attendance on this day">
                                {dateBlocked.reason}. Choose another date.
                            </Alert>
                        )}
                    </div>
                </div>

                <ActionBar note={!selectedClass ? 'Choose a class first' : undefined}>
                    <Button
                        size="lg"
                        onClick={() => handleGetStudents({ advance: true })}
                        disabled={!selectedClass}
                        loading={loading}
                        icon={<Users className="w-5 h-5" />}
                    >
                        Show students
                    </Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 3 */
    if (step === 'done' && saved) {
        return (
            <div className="space-y-4">
                <Steps steps={STEP_TITLES} current={2} />
                <div className="card">
                    <div className="card-body flex flex-col items-center text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <p className="text-xl font-semibold text-slate-900">
                            {saved.wasUpdate ? 'Attendance updated' : 'Attendance saved'}
                        </p>
                        <p className="mt-1 text-slate-600">{classLabel(saved.className, saved.section)}</p>
                        <p className="text-slate-600">{prettyDate(saved.date)}</p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                            <span className="badge-success">{saved.present} present</span>
                            <span className="badge-danger">{saved.absent} absent</span>
                            {saved.other > 0 && <span className="badge-warning">{saved.other} other</span>}
                        </div>
                        <button type="button" className="btn-ghost btn-sm mt-4" onClick={() => setStep('mark')}>
                            <Pencil className="w-4 h-4" /> Make a change
                        </button>
                    </div>
                </div>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => navigateTo?.('dashboard')}>Back to home</Button>
                    <Button size="lg" onClick={() => { setSaved(null); setStep('choose'); }}>Change class</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2 */
    const allLocked = students.length > 0 && students.every(s => (s as any).is_locked);

    return (
        <div className="space-y-4">
            <Steps steps={STEP_TITLES} current={1} onJump={() => setStep('choose')} />

            {/* What is being marked */}
            <div className="card">
                <div className="card-body flex items-start gap-3">
                    <CalendarDays className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 break-words">{classLabel(selectedClass, selectedSection)}</p>
                        <p className="text-sm text-slate-600">{attendanceDate === today ? `Today, ${prettyDate(attendanceDate)}` : prettyDate(attendanceDate)}</p>
                    </div>
                    <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => setStep('choose')}>
                        Change
                    </button>
                </div>
            </div>

            {isUpdateMode && (
                <Alert tone="info" title="Already saved for this day">
                    You can change it and save again.
                    {lastModified && <> Last saved {new Date(lastModified).toLocaleString()}.</>}
                    {updateCount > 0 && <> Changed {updateCount} {updateCount === 1 ? 'time' : 'times'} so far.</>}
                </Alert>
            )}

            {loading && students.length === 0 ? (
                <LoadingState label="Loading students…" />
            ) : students.length === 0 ? (
                <div className="card">
                    <EmptyState
                        title="No students found"
                        description="There are no active students in this class and section."
                        action={<button type="button" className="btn-primary" onClick={() => setStep('choose')}>Change class</button>}
                    />
                </div>
            ) : (
                <>
                    {/* Quick actions + live counts */}
                    <div className="card">
                        <div className="card-body space-y-3">
                            <p className="text-base font-semibold text-slate-900" aria-live="polite">{countsText(counts)}</p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => markAll('Present')}
                                    disabled={allLocked}
                                    className="btn-success min-h-[44px] flex-1 sm:flex-none"
                                >
                                    <Check className="w-5 h-5" /> Mark everyone present
                                </button>
                                <button
                                    type="button"
                                    onClick={() => markAll('Absent')}
                                    disabled={allLocked}
                                    className="btn-secondary min-h-[44px] flex-1 sm:flex-none"
                                >
                                    Mark everyone absent
                                </button>
                            </div>
                            <p className="text-sm text-slate-500">Everyone starts as present. Tap the green button to change a student to absent. Tap again to change back.</p>
                        </div>
                    </div>

                    {/* One row per student */}
                    {/* One column on phones; 2-3 columns on wide screens so the page is filled */}
                    <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
                        {students.map(student => {
                            const id = student.student_id!;
                            const status = attendance[id];
                            const locked = !!(student as any).is_locked;
                                                        const choose = (val: string) => {
                                if (locked) {
                                    notify("This student is locked for this year (moved to a new class). Their attendance can't be changed here.");
                                } else {
                                    handleStatusChange(id, val);
                                }
                            };
                            const border = status === 'Absent' ? 'border-red-300 bg-red-50/40'
                                : status === 'Present' ? 'border-slate-200 bg-white'
                                    : 'border-amber-300 bg-amber-50/40';
                            return (
                                <li key={id} className={`rounded-xl border ${border} px-3 py-2.5 flex items-center gap-3`}>
                                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center flex-shrink-0 text-sm" title="Roll number">
                                        {student.rollNo || '–'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-900 break-words leading-snug">{student.name}</p>
                                        <p className="text-xs text-slate-500 break-words">
                                            Adm. no. {student.admNo || '–'}
                                            <span className="hidden sm:inline">
                                                {student.father ? ` · Father: ${student.father}` : ''}
                                                {(student.smsNo || student.fatherMobile) ? ` · ${student.smsNo || student.fatherMobile}` : ''}
                                            </span>
                                        </p>
                                        {locked && (
                                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                                                <Lock className="w-3.5 h-3.5" /> Locked – student moved to a new class
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={locked}
                                        onClick={() => choose(status === 'Present' ? 'Absent' : 'Present')}
                                        aria-label={`${student.name}: ${statusLabel(status)}. Tap to change.`}
                                        title={locked ? 'Record locked (Promoted)' : 'Tap to change'}
                                        className={`flex-shrink-0 w-[108px] min-h-[48px] px-2 rounded-xl border-2 text-[15px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors select-none
                                            ${status === 'Present' ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                                                : status === 'Absent' ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                                    : 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'}
                                            ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {locked ? <Lock className="w-4 h-4" /> : status === 'Present' ? <Check className="w-5 h-5" /> : status === 'Absent' ? <X className="w-5 h-5" /> : null}
                                        <span>{status === 'Present' || status === 'Absent' ? status : statusLabel(status)}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            <ActionBar note={students.length > 0 ? countsText(counts) : undefined}>
                <Button variant="secondary" size="lg" onClick={() => setStep('choose')}>Back</Button>
                <Button
                    size="lg"
                    variant={isUpdateMode ? 'primary' : 'success'}
                    onClick={handleSave}
                    disabled={loading || saving || students.length === 0}
                    loading={saving}
                >
                    {isUpdateMode ? 'Update' : 'Save'} attendance ({students.length} {students.length === 1 ? 'student' : 'students'})
                </Button>
            </ActionBar>
        </div>
    );
};

export default DailyAttendance;
