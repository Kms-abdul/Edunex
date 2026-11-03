import React, { useState, useEffect } from 'react';
import api from '../api';
import { Student } from '../types';
import { ArrowRight } from 'lucide-react';
import { notify, confirmDialog } from './ui/feedback';
import { Steps, ActionBar, Button, Field, Alert } from './ui';
import { JobPage, JobIntro, ChoiceSummary, DoneCard, StudentPickList, studentsCount } from './student-jobs/common';

interface DemoteStudentsProps {
    onBack?: () => void;
}

const STEPS = ['Choose years', 'Choose students', 'Check and move back', 'Done'];

const DemoteStudents: React.FC<DemoteStudentsProps> = ({ onBack }) => {
    const [step, setStep] = useState(0);
    const [result, setResult] = useState<{ count: number; from: string; to: string; errors: string[] } | null>(null);
    const [sourceYear, setSourceYear] = useState('');
    const [restoreYear, setRestoreYear] = useState('');
    const [years, setYears] = useState<string[]>([]);

    const [promotedStudents, setPromotedStudents] = useState<Student[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [search, setSearch] = useState('');

    const getStartYear = (yearStr: string): number => {
        const match = yearStr.match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const sortedYears = [...years].sort((a, b) => getStartYear(b) - getStartYear(a));

    const getPreviousYears = (): string[] => {
        if (!sourceYear) return [];
        const sourceStart = getStartYear(sourceYear);
        return sortedYears.filter(y => getStartYear(y) < sourceStart);
    };

    useEffect(() => {
        api.get('/org/academic-years').then(res => {
            const y = res.data.academic_years?.map((item: any) => item.name) || [];
            setYears(y);
        });
    }, []);

    // ── KEY FIX: Fetch students whose Student.academic_year == sourceYear ──
    // These are students currently POINTING to sourceYear (promoted INTO it)
    useEffect(() => {
        if (!sourceYear) { setPromotedStudents([]); return; }
        setLoading(true);
        setSelectedIds([]);
        const branch = localStorage.getItem('currentBranch') || 'All';

        // Fetch students currently in sourceYear
        // Using X-Academic-Year header so backend returns students
        // whose academic_year matches OR have academic record in that year
        api.get('/students', {
            params: { branch, include_inactive: 'false' },
            headers: { 'X-Academic-Year': sourceYear }
        })
            .then(res => {
                const all: Student[] = res.data.students || [];
                // Filter: students whose CURRENT academic_year is sourceYear
                // AND who have a record showing they were promoted INTO this year
                // (i.e., they have an academic record in a PREVIOUS year with is_promoted=true)
                //
                // Since the backend returns is_promoted from the sourceYear record:
                // - is_promoted=false in sourceYear means student is CURRENTLY here
                //   (they haven't been promoted OUT yet)
                // - is_promoted=true in sourceYear means student LEFT this year
                //
                // We want students who are CURRENTLY in sourceYear (is_promoted=false or undefined)
                // AND whose academic_year on the Student record == sourceYear
                const currentStudents = all.filter(s => {
                    // Student is currently in this year
                    const isCurrentlyHere = s.academic_year === sourceYear;
                    // Student was NOT promoted OUT of this year
                    // (is_promoted in the response refers to the sourceYear record)
                    const notPromotedOut = s.is_promoted !== true;
                    return isCurrentlyHere && notPromotedOut;
                });
                setPromotedStudents(currentStudents);
            })
            .catch(err => {
                console.error(err);
                notify.error('Could not load students: ' + (err.response?.data?.error || err.message));
            })
            .finally(() => setLoading(false));
    }, [sourceYear]);

    // Auto-select immediate previous year
    useEffect(() => {
        if (!sourceYear) { setRestoreYear(''); return; }
        const prevYears = getPreviousYears();
        if (prevYears.length > 0) {
            setRestoreYear(prevYears[0]);
        } else {
            setRestoreYear('');
        }
    }, [sourceYear, years]);

    const filtered = promotedStudents.filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            (s.admNo || '').toLowerCase().includes(q) ||
            (s.enrollment_no || '').toLowerCase().includes(q) ||
            (s.first_name || s.name || '').toLowerCase().includes(q) ||
            (s.last_name || '').toLowerCase().includes(q)
        );
    });

    const handleDemote = async () => {
        if (!sourceYear) return notify.warning('Choose the year to move students out of.');
        if (!restoreYear) return notify.warning('Choose the year to move students back to.');
        if (sourceYear === restoreYear) return notify.warning('The two years must be different.');
        if (selectedIds.length === 0) return notify.warning('Choose at least one student.');

        // Validate direction: sourceYear must be AFTER restoreYear
        if (getStartYear(sourceYear) <= getStartYear(restoreYear)) {
            return notify.warning(
                `"Move out of" (${sourceYear}) must be a later year than "Move back to" (${restoreYear}). ` +
                `Example: move out of 2027-2028, back to 2026-2027.`
            );
        }

        const confirmed = await confirmDialog(
            `Move ${studentsCount(selectedIds.length)} from ${sourceYear} back to ${restoreYear}?\n\n` +
            `Their fees for ${sourceYear} will be turned off. Payments already collected, attendance and marks are kept.`,
            { title: 'Undo promotion?', confirmText: `Move back ${studentsCount(selectedIds.length)}`, tone: 'danger' }
        );
        if (!confirmed) return;

        setProcessing(true);
        try {
            const res = await api.post('/students/demote-bulk', {
                student_ids: selectedIds,
                source_year: sourceYear,    // e.g., 2027-2028 (remove from here)
                restore_year: restoreYear,  // e.g., 2026-2027 (put back here)
            });

            const { success_count, errors } = res.data;
            notify.success(`${studentsCount(success_count ?? 0)} moved back to ${restoreYear}`);
            setResult({ count: success_count ?? 0, from: sourceYear, to: restoreYear, errors: errors || [] });
            setStep(3);
            setSelectedIds([]);
            setPromotedStudents(prev => prev.filter(s => !selectedIds.includes(s.student_id!)));
        } catch (err: any) {
            const msg = err.response?.data?.error || err.message;
            notify.error('Could not move students back: ' + msg);
        } finally {
            setProcessing(false);
        }
    };

    const previousYears = getPreviousYears();

    const selectedStudents = promotedStudents.filter(s => selectedIds.includes(s.student_id!));
    const pickItems = filtered
        .filter(s => s.student_id)
        .map(s => ({
            id: s.student_id as number,
            title: `${s.first_name || s.name} ${s.last_name || ''}`.trim(),
            subtitle: [`Admission number ${s.admNo || '—'}`, `Class ${s.class}${s.section ? `-${s.section}` : ''}`, s.branch].filter(Boolean).join(' · '),
        }));

    const backButton = onBack && (
        <Button variant="secondary" size="lg" onClick={onBack}>Back to students</Button>
    );

    /* ------------------------------------------------------------ Step 1: years */
    if (step === 0) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={0} />
                <JobIntro>
                    Use this only to undo a promotion made by mistake. Students go back to the earlier year.
                    Payments already collected, attendance and marks are kept.
                </JobIntro>
                <div className="card">
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            label="Move students out of year"
                            htmlFor="dm-from"
                            hint="The year they were promoted into by mistake"
                        >
                            <select
                                id="dm-from"
                                value={sourceYear}
                                onChange={e => { setSourceYear(e.target.value); setRestoreYear(''); }}
                                className="input"
                            >
                                <option value="">Choose a year</option>
                                {sortedYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </Field>
                        <Field
                            label="Move them back to year"
                            htmlFor="dm-to"
                            hint={sourceYear ? `Only years before ${sourceYear} are shown` : 'Choose the first year before this'}
                            error={sourceYear && previousYears.length === 0 ? `There is no year before ${sourceYear}` : null}
                        >
                            <select
                                id="dm-to"
                                value={restoreYear}
                                onChange={e => setRestoreYear(e.target.value)}
                                className="input"
                                disabled={!sourceYear}
                            >
                                <option value="">Choose a year</option>
                                {previousYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </Field>
                    </div>
                    {sourceYear && restoreYear && (
                        <div className="card-body pt-0">
                            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700 flex flex-wrap items-center gap-2">
                                <span className="badge-danger">{sourceYear}</span>
                                <ArrowRight className="w-4 h-4 text-slate-500" />
                                <span className="badge-success">{restoreYear}</span>
                                <span>Students will go back to {restoreYear}</span>
                            </div>
                        </div>
                    )}
                </div>
                <ActionBar note={!sourceYear ? 'Choose the year to move out of first' : !restoreYear ? 'Choose the year to move back to' : undefined}>
                    {backButton}
                    <Button size="lg" disabled={!sourceYear || !restoreYear} onClick={() => setStep(1)}>Show students</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Done */
    if (step === 3 && result) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={3} />
                <DoneCard title="Promotion undone">
                    <p>{studentsCount(result.count)} moved from {result.from} back to {result.to}.</p>
                </DoneCard>
                {result.errors.length > 0 && (
                    <Alert tone="warning" title={`${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}`}>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </Alert>
                )}
                <ActionBar>
                    {backButton}
                    <Button size="lg" onClick={() => { setResult(null); setStep(1); }}>Move back more students</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 2: students */
    if (step === 1) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={1} onJump={i => setStep(i)} />
                <ChoiceSummary title={`From ${sourceYear} back to ${restoreYear || '—'}`} detail="Students now in the later year" onChange={() => setStep(0)} />
                <StudentPickList
                    items={pickItems}
                    selected={selectedIds}
                    onChange={setSelectedIds}
                    loading={loading}
                    search={search}
                    onSearch={setSearch}
                    emptyTitle={promotedStudents.length === 0 ? `No students are in ${sourceYear}` : 'No student matches your search'}
                />
                <ActionBar note={selectedIds.length === 0 ? 'Tap the students to move back' : `${studentsCount(selectedIds.length)} chosen`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={selectedIds.length === 0} onClick={() => setStep(2)}>Next</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 3: check */
    return (
        <JobPage>
            <Steps steps={STEPS} current={2} onJump={i => setStep(i)} />
            <div className="card">
                <div className="card-body">
                    <p className="text-sm text-slate-500">Please check</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 flex flex-wrap items-center gap-2">
                        Move {studentsCount(selectedIds.length)} from {sourceYear}
                        <ArrowRight className="w-5 h-5 text-brand-600" />
                        {restoreYear}
                    </p>
                    <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
                        {selectedStudents.map(s => (
                            <li key={s.student_id} className="px-3 py-2 text-sm">
                                <span className="font-medium text-slate-900">{s.first_name || s.name} {s.last_name || ''}</span>
                                <span className="text-slate-500"> · {s.admNo} · Class {s.class}{s.section ? `-${s.section}` : ''}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <Alert tone="warning" title="What will happen">
                <ul className="list-disc pl-4 space-y-0.5">
                    <li>Students go back to {restoreYear}.</li>
                    <li>Their fees for {sourceYear} are turned off.</li>
                    <li>Payments already collected are kept.</li>
                    <li>Attendance and marks are kept.</li>
                </ul>
            </Alert>
            <ActionBar note={!restoreYear ? 'Choose the year to move back to first' : undefined}>
                <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button
                    variant="danger"
                    size="lg"
                    onClick={handleDemote}
                    disabled={selectedIds.length === 0 || !restoreYear || processing}
                    loading={processing}
                >
                    Move back {studentsCount(selectedIds.length)}
                </Button>
            </ActionBar>
        </JobPage>
    );
};

export default DemoteStudents;
