import React, { useState, useEffect } from 'react';
import api from '../api';
import { Student } from '../types';
import { ArrowRight } from 'lucide-react';
import { notify } from './ui/feedback';
import { Steps, ActionBar, Button, Field, Alert } from './ui';
import { JobPage, JobIntro, ChoiceSummary, DoneCard, StudentPickList, namesPreview, studentsCount } from './student-jobs/common';

interface PromoteStudentsProps {
    onBack?: () => void;
}

const STEPS = ['Choose class', 'Choose students', 'Choose new class', 'Done'];

const PromoteStudents: React.FC<PromoteStudentsProps> = ({ onBack }) => {
    const [step, setStep] = useState(0);
    const [lastPromotion, setLastPromotion] = useState<{ count: number; names: string[]; from: string; to: string } | null>(null);

    // -------------------------------------------------------------
    // Source State 
    // -------------------------------------------------------------
    const [sourceYear, setSourceYear] = useState(localStorage.getItem('academicYear') || '');
    const [sourceClass, setSourceClass] = useState('');
    const [sourceSection, setSourceSection] = useState('');
    const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [sourceSearch, setSourceSearch] = useState('');

    // -------------------------------------------------------------
    // Target State
    // -------------------------------------------------------------
    const [targetYear, setTargetYear] = useState('');
    const [targetClass, setTargetClass] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [targetStudents, setTargetStudents] = useState<Student[]>([]); // To show who is already there

    // -------------------------------------------------------------
    // Common Data
    // -------------------------------------------------------------
    const [years, setYears] = useState<string[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [sourceSections, setSourceSections] = useState<string[]>([]);
    const [targetSections, setTargetSections] = useState<string[]>([]);
    const [loadingSource, setLoadingSource] = useState(false);
    const [loadingTarget, setLoadingTarget] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // Fetch Metadata
        api.get('/classes').then(res => setClasses(res.data.classes || []));
        api.get('/org/academic-years').then(res => {
            const y = res.data.academic_years?.map((item: any) => item.name) || [];
            setYears(y);
        });
    }, []);

    useEffect(() => {
        if (!sourceClass) {
            setSourceSections([]);
            setSourceSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        api.get('/sections', {
            params: {
                class: sourceClass,
                branch,
                academic_year: sourceYear,
            }
        })
            .then(res => setSourceSections(res.data.sections || []))
            .catch(() => setSourceSections([]));
    }, [sourceClass, sourceYear]);

    useEffect(() => {
        if (!targetClass) {
            setTargetSections([]);
            setTargetSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        api.get('/sections', {
            params: {
                class: targetClass,
                branch,
                academic_year: targetYear,
            }
        })
            .then(res => setTargetSections(res.data.sections || []))
            .catch(() => setTargetSections([]));
    }, [targetClass, targetYear]);

    // Fetch Source Students
    useEffect(() => {
        if (!sourceYear || !sourceClass) return;
        setLoadingSource(true);
        const globalBranch = localStorage.getItem('currentBranch') || 'All';

        // We need a way to fetch students BY ACADEMIC YEAR (History)
        // Check if our /students endpoint supports 'academic_year' explicitly, 
        // or we rely on the Header 'X-Academic-Year' which usually drives global state.
        // But here we might want to override.
        // Assuming we update /students to accept `academic_year` param specifically or we use the Header trick.
        // Let's try passing param first.

        api.get('/students', {
            params: {
                class: sourceClass,
                section: sourceSection,
                search: sourceSearch,
                branch: globalBranch,
                include_fee_due: true,
                // We need to tell backend we want THIS specific year's data
                // If backend relies solely on Header, we might need to swap header or update backend.
                // Assuming we updated backend to look for ANY year if provided (we need to verify this).
            },
            headers: {
                'X-Academic-Year': sourceYear // Override header for this request
            }
        })
            .then(res => setSourceStudents(res.data.students || []))
            .catch(err => {
                console.error(err);
                notify.error("Could not load students: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setLoadingSource(false));
    }, [sourceYear, sourceClass, sourceSection, sourceSearch]);

    // Fetch Target Students (to see availability)
    useEffect(() => {
        if (!targetYear || !targetClass) return;
        setLoadingTarget(true);
        const globalBranch = localStorage.getItem('currentBranch') || 'All';

        api.get('/students', {
            params: {
                class: targetClass,
                section: targetSection,
                branch: globalBranch
            },
            headers: {
                'X-Academic-Year': targetYear
            }
        })
            .then(res => setTargetStudents(res.data.students || []))
            .catch(err => console.error(err))
            .finally(() => setLoadingTarget(false));
    }, [targetYear, targetClass, targetSection]);


    const eligibleStudents = sourceStudents.filter(s => !s.total_due || s.total_due <= 0);

    const sourceLabel = `Class ${sourceClass}${sourceSection ? `-${sourceSection}` : ' (all sections)'} · ${sourceYear}`;
    const targetLabel = `Class ${targetClass}${targetSection ? `-${targetSection}` : ''} · ${targetYear}`;

    const handleUpgrade = async () => {
        if (selectedStudentIds.length === 0) return notify.warning("Choose the students to promote first");
        if (!targetYear || !targetClass) return notify.warning("Choose the new year and class first");
        if (sourceYear === targetYear) return notify.warning("The new year must be different from the current year");

        const promoted = {
            count: selectedStudentIds.length,
            names: sourceStudents
                .filter(s => s.student_id !== undefined && selectedStudentIds.includes(s.student_id))
                .map(s => `${s.first_name || s.name} ${s.last_name || ''}`.trim()),
            from: sourceLabel,
            to: targetLabel,
        };

        setProcessing(true);
        try {
            await api.post('/students/promote-bulk', {
                student_ids: selectedStudentIds,
                target_year: targetYear,
                target_class: targetClass,
                target_section: targetSection
            });
            notify.success(`${studentsCount(promoted.count)} promoted`);
            setLastPromotion(promoted);
            setStep(3);
            // Refresh
            setSourceStudents(prev =>
                prev.filter(s => s.student_id === undefined || !selectedStudentIds.includes(s.student_id))
            ); // Remove locally or refresh
            setSelectedStudentIds([]);

            // Reload target list
            const globalBranch = localStorage.getItem('currentBranch') || 'All';
            const res = await api.get('/students', {
                params: { class: targetClass, section: targetSection, branch: globalBranch },
                headers: { 'X-Academic-Year': targetYear }
            });
            setTargetStudents(res.data.students || []);

        } catch (error) {
            console.error(error);
            notify.error("Could not promote. Some students may already be in the new class for that year. Check and try again.");
        } finally {
            setProcessing(false);
        }
    };

    const pickItems = sourceStudents
        .filter(s => s.student_id !== undefined)
        .map(s => {
            const hasDue = Boolean(s.total_due && s.total_due > 0);
            return {
                id: s.student_id as number,
                title: `${s.first_name || s.name} ${s.last_name || ''}`.trim(),
                subtitle: `Admission number ${s.admNo || '—'} · Class ${s.class} ${s.section || ''}`,
                aside: hasDue
                    ? <span className="font-semibold text-red-600">₹{s.total_due} to pay</span>
                    : <span className="text-emerald-600">No dues</span>,
                blockedReason: hasDue ? 'Collect the fee first to promote' : undefined,
            };
        });
    const blockedCount = sourceStudents.length - eligibleStudents.length;

    const yearOptions = years.map(y => <option key={y} value={y}>{y}</option>);
    const classOptions = classes.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>);

    const backButton = onBack && (
        <Button variant="secondary" size="lg" onClick={onBack}>Back to students</Button>
    );

    /* ------------------------------------------------------------ Step 1: where they are now */
    if (step === 0) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={0} />
                <JobIntro>Move students up to the next class for the new year. Students who still have fees to pay cannot be promoted.</JobIntro>
                <div className="card">
                    <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Current year" htmlFor="pr-src-year">
                            <select id="pr-src-year" value={sourceYear} onChange={e => { setSourceYear(e.target.value); setSelectedStudentIds([]); }} className="input">
                                <option value="">Choose a year</option>
                                {yearOptions}
                            </select>
                        </Field>
                        <Field label="Current class" htmlFor="pr-src-class">
                            <select id="pr-src-class" value={sourceClass} onChange={e => { setSourceClass(e.target.value); setSelectedStudentIds([]); }} className="input">
                                <option value="">Choose a class</option>
                                {classOptions}
                            </select>
                        </Field>
                        <Field label="Section (optional)" htmlFor="pr-src-section">
                            <select id="pr-src-section" value={sourceSection} onChange={e => { setSourceSection(e.target.value); setSelectedStudentIds([]); }} className="input" disabled={!sourceClass}>
                                <option value="">All sections</option>
                                {sourceSections.map(section => <option key={section} value={section}>{section}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>
                <ActionBar note={!sourceYear ? 'Choose the current year first' : !sourceClass ? 'Choose a class first' : undefined}>
                    {backButton}
                    <Button size="lg" disabled={!sourceYear || !sourceClass} onClick={() => setStep(1)}>Show students</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Done */
    if (step === 3 && lastPromotion) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={3} />
                <DoneCard title="Students promoted">
                    <p>{studentsCount(lastPromotion.count)} moved to {lastPromotion.to}.</p>
                    <p className="text-sm">From {lastPromotion.from}</p>
                    {lastPromotion.names.length > 0 && <p className="text-sm">{namesPreview(lastPromotion.names)}</p>}
                    {onBack && (
                        <button type="button" className="btn-ghost btn-sm mt-3" onClick={onBack}>Back to students</button>
                    )}
                </DoneCard>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setLastPromotion(null); setStep(0); }}>Choose another class</Button>
                    <Button size="lg" onClick={() => { setLastPromotion(null); setStep(1); }}>Promote more from this class</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 2: pick students */
    if (step === 1) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={1} onJump={i => setStep(i)} />
                <ChoiceSummary title={sourceLabel} onChange={() => setStep(0)} />
                {blockedCount > 0 && !loadingSource && (
                    <Alert tone="warning">
                        {studentsCount(blockedCount)} still {blockedCount === 1 ? 'has' : 'have'} fees to pay and cannot be promoted until the fee is collected.
                    </Alert>
                )}
                <StudentPickList
                    items={pickItems}
                    selected={selectedStudentIds}
                    onChange={setSelectedStudentIds}
                    loading={loadingSource}
                    search={sourceSearch}
                    onSearch={setSourceSearch}
                    emptyTitle={sourceSearch ? 'No student matches your search' : 'No students in this class'}
                    onBlockedTap={() => notify.warning('This student has fees to pay. Collect the fee first to promote.')}
                />
                <ActionBar note={selectedStudentIds.length === 0 ? 'Tap the students you want to promote' : `${studentsCount(selectedStudentIds.length)} chosen`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={selectedStudentIds.length === 0} onClick={() => setStep(2)}>Next</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 3: new class + check */
    const sameYear = !!targetYear && sourceYear === targetYear;
    const ready = selectedStudentIds.length > 0 && !!targetYear && !!targetClass && !sameYear;
    return (
        <JobPage>
            <Steps steps={STEPS} current={2} onJump={i => setStep(i)} />
            <div className="card">
                <div className="card-body grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="New year" htmlFor="pr-tgt-year" error={sameYear ? 'Choose a different year from the current one' : null}>
                        <select id="pr-tgt-year" value={targetYear} onChange={e => setTargetYear(e.target.value)} className="input">
                            <option value="">Choose a year</option>
                            {yearOptions}
                        </select>
                    </Field>
                    <Field label="New class" htmlFor="pr-tgt-class">
                        <select id="pr-tgt-class" value={targetClass} onChange={e => setTargetClass(e.target.value)} className="input">
                            <option value="">Choose a class</option>
                            {classOptions}
                        </select>
                    </Field>
                    <Field label="Section (optional)" htmlFor="pr-tgt-section">
                        <select id="pr-tgt-section" value={targetSection} onChange={e => setTargetSection(e.target.value)} className="input" disabled={!targetClass}>
                            <option value="">Any section</option>
                            {targetSections.map(section => <option key={section} value={section}>{section}</option>)}
                        </select>
                    </Field>
                </div>
            </div>

            {targetYear && targetClass && !sameYear && (
                <div className="card">
                    <div className="card-body">
                        <p className="text-sm text-slate-500">Please check</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                            Promote {studentsCount(selectedStudentIds.length)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="badge-neutral">{sourceLabel}</span>
                            <ArrowRight className="w-4 h-4 text-brand-600" />
                            <span className="badge-brand">{targetLabel}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            {loadingTarget
                                ? 'Checking the new class…'
                                : targetStudents.length > 0
                                    ? `${studentsCount(targetStudents.length)} already in the new class.`
                                    : 'No students in the new class yet.'}
                        </p>
                        {targetStudents.length > 0 && !loadingTarget && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-sm font-medium text-brand-700 min-h-[44px] flex items-center">See who is already there</summary>
                                <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 max-h-56 overflow-y-auto">
                                    {targetStudents.map(s => (
                                        <li key={s.student_id} className="px-3 py-2 text-sm">
                                            <span className="font-medium text-slate-900">{s.first_name || s.name}</span>
                                            <span className="text-slate-500"> · {s.admNo}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                </div>
            )}

            <ActionBar
                note={!targetYear ? 'Choose the new year first' : sameYear ? 'The new year must be different' : !targetClass ? 'Choose the new class' : undefined}
            >
                <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" onClick={handleUpgrade} disabled={!ready || processing} loading={processing}>
                    Promote {studentsCount(selectedStudentIds.length)}
                </Button>
            </ActionBar>
        </JobPage>
    );
};

export default PromoteStudents;
