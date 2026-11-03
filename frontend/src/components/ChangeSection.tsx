import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import api from '../api';
import { notify } from './ui/feedback';
import { Steps, ActionBar, Button, Field, Alert } from './ui';
import { JobPage, JobIntro, ChoiceSummary, DoneCard, StudentPickList, namesPreview, studentsCount } from './student-jobs/common';

interface ChangeSectionProps {
    onBack?: () => void;
}

const STEPS = ['Choose class', 'Choose students', 'Choose new section', 'Done'];

const ChangeSection: React.FC<ChangeSectionProps> = ({ onBack }) => {
    const [step, setStep] = useState(0);

    // -------------------------------------------------------------
    // Source State
    // -------------------------------------------------------------
    const [academicYear] = useState(localStorage.getItem('academicYear') || '');
    const [sourceClass, setSourceClass] = useState('');
    const [sourceSection, setSourceSection] = useState('');
    const [sourceStudents, setSourceStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [sourceSearch, setSourceSearch] = useState('');

    // -------------------------------------------------------------
    // Target State
    // -------------------------------------------------------------
    const [targetSection, setTargetSection] = useState('');

    // -------------------------------------------------------------
    // Common Data
    // -------------------------------------------------------------
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [loadingSource, setLoadingSource] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [lastMove, setLastMove] = useState<{ count: number; names: string[]; from: string; to: string } | null>(null);

    useEffect(() => {
        // Fetch Classes
        api.get('/classes')
            .then(res => setClasses(res.data.classes || []))
            .catch(err => {
                console.error('Failed to fetch classes:', err);
            });
    }, []);

    useEffect(() => {
        if (!sourceClass) {
            setSections([]);
            setSourceSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        api.get('/sections', {
            params: {
                class: sourceClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSections(res.data.sections || []))
            .catch(() => setSections([]));
    }, [sourceClass, academicYear]);

    // Fetch Source Students
    useEffect(() => {
        if (!academicYear || !sourceClass || !sourceSection) {
            setSourceStudents([]);
            return;
        }
        setLoadingSource(true);
        const globalBranch = localStorage.getItem('currentBranch') || 'All';

        api.get('/students', {
            params: {
                class: sourceClass,
                section: sourceSection,
                search: sourceSearch,
                branch: globalBranch,
            },
            headers: {
                'X-Academic-Year': academicYear
            }
        })
            .then(res => setSourceStudents(res.data.students || []))
            .catch(err => {
                console.error(err);
                notify.error("Could not load students: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setLoadingSource(false));
    }, [academicYear, sourceClass, sourceSection, sourceSearch]);

    const selectedStudentsList = sourceStudents.filter(s => s.student_id && selectedStudentIds.includes(s.student_id));
    const fromLabel = `${sourceClass}-${sourceSection}`;

    const handleChangeSection = async () => {
        if (selectedStudentIds.length === 0) return notify.warning("Choose the students to move first");
        if (!targetSection) return notify.warning("Choose the new section first");
        if (sourceSection === targetSection) return notify.warning("The new section must be different from the current one");

        const moved = {
            count: selectedStudentIds.length,
            names: selectedStudentsList.map(s => s.name),
            from: fromLabel,
            to: `${sourceClass}-${targetSection}`,
        };

        setProcessing(true);
        try {
            await api.post('/students/change-section-bulk', {
                student_ids: selectedStudentIds,
                target_class: sourceClass,
                target_section: targetSection
            }, {
                headers: { 'X-Academic-Year': academicYear }
            });
            notify.success(`${studentsCount(moved.count)} moved to ${moved.to}`);

            // Refresh source students
            setSourceStudents(prev =>
                prev.filter(s => s.student_id === undefined || !selectedStudentIds.includes(s.student_id))
            );
            setSelectedStudentIds([]);
            setTargetSection('');
            setLastMove(moved);
            setStep(3);

        } catch (error: any) {
            console.error(error);
            notify.error("Could not change the section: " + (error.response?.data?.error || error.message));
        } finally {
            setProcessing(false);
        }
    };

    const pickItems = sourceStudents
        .filter(s => s.student_id !== undefined)
        .map(s => ({
            id: s.student_id as number,
            title: s.name,
            subtitle: [`Admission number ${s.admNo || s.admission_no || '—'}`, s.father ? `Father: ${s.father}` : ''].filter(Boolean).join(' · '),
        }));

    const backButton = onBack && (
        <Button variant="secondary" size="lg" onClick={onBack}>Back to students</Button>
    );

    /* ------------------------------------------------------------ Step 1 */
    if (step === 0) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={0} />
                <JobIntro>Move students to another section of the same class. Year {academicYear || '—'}.</JobIntro>
                <div className="card">
                    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Class" htmlFor="cs-class">
                            <select
                                id="cs-class"
                                value={sourceClass}
                                onChange={e => { setSourceClass(e.target.value); setSourceSection(''); setSelectedStudentIds([]); setTargetSection(''); }}
                                className="input"
                            >
                                <option value="">Choose a class</option>
                                {classes.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                            </select>
                        </Field>
                        <Field label="Current section" htmlFor="cs-section">
                            <select
                                id="cs-section"
                                value={sourceSection}
                                onChange={e => { setSourceSection(e.target.value); setSelectedStudentIds([]); setTargetSection(''); }}
                                className="input"
                                disabled={!sourceClass}
                            >
                                <option value="">Choose a section</option>
                                {sections.map(section => <option key={section} value={section}>{section}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>
                <ActionBar note={!sourceClass ? 'Choose a class first' : !sourceSection ? 'Choose the current section' : undefined}>
                    {backButton}
                    <Button size="lg" disabled={!sourceClass || !sourceSection} onClick={() => setStep(1)}>
                        Show students
                    </Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 4 */
    if (step === 3 && lastMove) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={3} />
                <DoneCard title="Section changed">
                    <p>{studentsCount(lastMove.count)} moved from {lastMove.from} to {lastMove.to}.</p>
                    {lastMove.names.length > 0 && <p className="text-sm">{namesPreview(lastMove.names)}</p>}
                    {onBack && (
                        <button type="button" className="btn-ghost btn-sm mt-3" onClick={onBack}>Back to students</button>
                    )}
                </DoneCard>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setLastMove(null); setStep(0); }}>Choose another class</Button>
                    <Button size="lg" onClick={() => { setLastMove(null); setStep(1); }}>Move more from {lastMove.from}</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 2 */
    if (step === 1) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={1} onJump={i => setStep(i)} />
                <ChoiceSummary title={`Class ${fromLabel}`} detail={`Year ${academicYear || '—'}`} onChange={() => setStep(0)} />
                <StudentPickList
                    items={pickItems}
                    selected={selectedStudentIds}
                    onChange={setSelectedStudentIds}
                    loading={loadingSource}
                    search={sourceSearch}
                    onSearch={setSourceSearch}
                    emptyTitle={sourceSearch ? 'No student matches your search' : 'No students in this section'}
                />
                <ActionBar note={selectedStudentIds.length === 0 ? 'Tap the students you want to move' : `${studentsCount(selectedStudentIds.length)} chosen`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={selectedStudentIds.length === 0} onClick={() => setStep(2)}>
                        Next
                    </Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 3 */
    const otherSections = sections.filter(s => s !== sourceSection);
    return (
        <JobPage>
            <Steps steps={STEPS} current={2} onJump={i => setStep(i)} />
            <div className="card">
                <div className="card-body space-y-4">
                    <Field label="Move them to section" htmlFor="cs-target">
                        <select
                            id="cs-target"
                            value={targetSection}
                            onChange={e => setTargetSection(e.target.value)}
                            className="input"
                        >
                            <option value="">Choose the new section</option>
                            {otherSections.map(section => <option key={section} value={section}>{section}</option>)}
                        </select>
                    </Field>
                    {otherSections.length === 0 && (
                        <Alert tone="warning">Class {sourceClass} has no other section to move to.</Alert>
                    )}
                </div>
            </div>

            {targetSection && (
                <div className="card">
                    <div className="card-body">
                        <p className="text-sm text-slate-500">Please check</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900 flex flex-wrap items-center gap-2">
                            Move {studentsCount(selectedStudentIds.length)} from {fromLabel}
                            <ArrowRight className="w-5 h-5 text-brand-600" />
                            {sourceClass}-{targetSection}
                        </p>
                        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
                            {selectedStudentsList.map(s => (
                                <li key={s.student_id} className="px-3 py-2 text-sm">
                                    <span className="font-medium text-slate-900">{s.name}</span>
                                    <span className="text-slate-500"> · {s.admNo || s.admission_no}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <ActionBar note={!targetSection ? 'Choose the new section first' : undefined}>
                <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button
                    size="lg"
                    onClick={handleChangeSection}
                    disabled={selectedStudentIds.length === 0 || !targetSection || processing}
                    loading={processing}
                >
                    Move {studentsCount(selectedStudentIds.length)}
                </Button>
            </ActionBar>
        </JobPage>
    );
};

export default ChangeSection;
