import React, { useState, useEffect } from 'react';
import api from '../api';
import { Page } from '../App';
import { Plus, Search } from 'lucide-react';
import { notify } from './ui/feedback';
import { ActionBar, Button, EmptyState, ErrorState, Field, LoadingState, Steps } from './ui';
import { CheckRow, SuccessPanel, SummaryRow, rupees } from './fee-setup/shared';

const STEP_TITLES = ['Choose class', 'Choose students', 'Choose fees', 'Check and give'];

interface Student {
    student_id: number;
    admission_no: string;
    enrollment_no: string;
    name: string;
    class: string;
    section: string;
    fatherMobile: string;
}

interface FeeType {
    id: number;
    fee_type: string;
    category: string;
    fee_type_group: string;
    type: string;
    display_name: string;
}

interface SelectedFee {
    fee_type_id: number;
    amount: number;
}

interface AssignSpecialFeeProps {
    navigateTo?: (page: Page) => void;
}

const AssignSpecialFee: React.FC<AssignSpecialFeeProps> = ({ navigateTo }) => {
    const [classes, setClasses] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sections, setSections] = useState<string[]>([]);
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [academicYear] = useState(localStorage.getItem('academicYear') || '');

    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [selectedFees, setSelectedFees] = useState<SelectedFee[]>([]);

    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restrictedFeeTypeIds, setRestrictedFeeTypeIds] = useState<Set<number>>(new Set());

    // Screen state (presentation only)
    const [step, setStep] = useState(0);
    const [done, setDone] = useState<{ assigned: number; skipped: number; students: number } | null>(null);

    useEffect(() => {
        const globalBranch = localStorage.getItem('currentBranch');

        if (globalBranch && globalBranch !== 'All Locations') {
            setSelectedBranch(globalBranch);
        }

        fetchClasses();
    }, []);

    useEffect(() => {
        fetchFeeTypes();
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass) {
            fetchSections(selectedClass);
        } else {
            setSections([]);
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass && selectedSection) {
            fetchStudents();
        } else {
            setStudents([]);
        }
    }, [selectedClass, selectedSection, selectedBranch]); // Re-fetch when branch changes

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            if (response.data && Array.isArray(response.data.classes)) {
                const classNames: string[] = response.data.classes.map((c: any) => String(c.class_name));
                setClasses([...new Set(classNames)]);
            } else {
                setClasses([]);
            }
        } catch (error) {
            console.error('Error fetching classes:', error);
            setError('Failed to load classes.');
        }
    };

    const fetchSections = async (className: string) => {
        try {
            const response = await api.get('/sections', {
                params: {
                    class: className,
                    branch: selectedBranch,
                    academic_year: academicYear,
                }
            });
            if (response.data && Array.isArray(response.data.sections)) {
                setSections(response.data.sections);
            } else {
                setSections([]);
            }
        } catch (error) {
            console.error('Error fetching sections:', error);
            setSections([]);
        }
    };

    const fetchFeeTypes = async () => {
        try {
            const feeTypesResponse = await api.get('/fee-types');
            let availableFeeTypes = feeTypesResponse.data.fee_types || [];

            if (selectedClass) {
                try {
                    const structureResponse = await api.get('/class-fee-structure', {
                        params: { class: selectedClass, academic_year: academicYear }
                    });

                    const existingStructures = structureResponse.data.fee_structures || [];
                    const assignedIds = new Set<number>();

                    existingStructures.forEach((s: any) => {
                        assignedIds.add(s.fee_type_id);
                    });

                    setRestrictedFeeTypeIds(assignedIds);
                } catch (err) {
                    console.error('Error fetching class fee structure for filtering:', err);
                    setRestrictedFeeTypeIds(new Set());
                }
            } else {
                setRestrictedFeeTypeIds(new Set());
            }

            setFeeTypes(availableFeeTypes.filter((ft: FeeType) => ft.fee_type_group?.toLowerCase() === 'special'));

        } catch (error) {
            console.error('Error fetching fee types:', error);
            setError('Failed to load fee types.');
        }
    };

    const fetchStudents = async () => {
        if (!selectedClass || !selectedSection) return;

        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/students', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    branch: selectedBranch // Pass selected branch
                }
            });
            if (response.data && Array.isArray(response.data.students)) {
                setStudents(response.data.students);
            } else {
                setStudents([]);
            }
            setSelectedStudentIds([]);
        } catch (error) {
            console.error('Error fetching students:', error);
            setError('Failed to load students.');
        } finally {
            setLoading(false);
        }
    };

    // ... (handlers remain same)
    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.admission_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.enrollment_no.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectAllStudents = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filteredIds = filteredStudents.map(s => s.student_id);
        if (e.target.checked) {
            setSelectedStudentIds(prev => [...new Set([...prev, ...filteredIds])]);
        } else {
            setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
        }
    };

    const handleSelectStudent = (id: number) => {
        if (selectedStudentIds.includes(id)) {
            setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
        } else {
            setSelectedStudentIds([...selectedStudentIds, id]);
        }
    };

    const handleFeeSelection = (feeTypeId: number, checked: boolean) => {
        if (checked) {
            setSelectedFees([...selectedFees, { fee_type_id: feeTypeId, amount: 0 }]);
        } else {
            setSelectedFees(selectedFees.filter(f => f.fee_type_id !== feeTypeId));
        }
    };

    const handleFeeAmountChange = (feeTypeId: number, amount: string) => {
        const newAmount = parseFloat(amount) || 0;
        setSelectedFees(selectedFees.map(f =>
            f.fee_type_id === feeTypeId ? { ...f, amount: newAmount } : f
        ));
    };

    const handleAssignFees = async () => {
        if (selectedStudentIds.length === 0) {
            notify.warning('Choose at least one student.');
            return;
        }
        if (selectedFees.length === 0) {
            notify.warning('Choose at least one fee.');
            return;
        }

        const restrictedFees = selectedFees.filter(f => restrictedFeeTypeIds.has(f.fee_type_id));
        if (restrictedFees.length > 0) {
            const feeNames = restrictedFees.map(f => {
                const ft = feeTypes.find(t => t.id === f.fee_type_id);
                return ft ? ft.fee_type : 'Unknown Fee';
            }).join(', ');
            notify.warning(`These fees are already part of the class fees, so they cannot be given again: ${feeNames}`);
            return;
        }

        const invalidFees = selectedFees.filter(f => f.amount <= 0);
        if (invalidFees.length > 0) {
            notify.warning('Type an amount for every fee you chose.');
            return;
        }

        // The "Check and give" step is the confirmation.
        setAssigning(true);
        try {
            const payload = {
                student_ids: selectedStudentIds,
                fee_assignments: selectedFees.map(f => ({
                    fee_type_id: f.fee_type_id,
                    amount: f.amount,
                    academic_year: academicYear
                }))
            };

            const response = await api.post('/fees/assign-special', payload);
            notify.success(`${response.data.assigned_count} fees given. ${response.data.skipped_count} skipped (already had them).`);
            setDone({ assigned: response.data.assigned_count, skipped: response.data.skipped_count, students: selectedStudentIds.length });

            setSelectedFees([]);
            setSelectedStudentIds([]);

        } catch (error: any) {
            console.error('Error assigning fees:', error);
            notify.error(`Could not give the fees: ${error.response?.data?.error || 'Failed to assign fees'}`);
        } finally {
            setAssigning(false);
        }
    };

    if (error) {
        return (
            <div className="card">
                <ErrorState title="Something went wrong" message={error} onRetry={() => window.location.reload()} />
            </div>
        );
    }

    const feeName = (id: number) => {
        const ft = feeTypes.find(t => t.id === id);
        return ft ? (ft.display_name || ft.fee_type) : 'Fee';
    };
    const feeTotal = selectedFees.reduce((s, f) => s + (f.amount || 0), 0);
    const missingAmount = selectedFees.some(f => f.amount <= 0);
    const classText = selectedClass ? `Class ${selectedClass}${selectedSection ? ` - ${selectedSection}` : ''}` : '';

    /* ------------------------------------------------------------ Done */
    if (done) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <SuccessPanel title="Fees given">
                    {done.assigned} fee{done.assigned === 1 ? '' : 's'} added for {done.students} student{done.students === 1 ? '' : 's'} of {classText}.
                    {done.skipped > 0 && <> {done.skipped} skipped because the student already had it.</>}
                </SuccessPanel>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setDone(null); setStep(1); }}>Give to more students</Button>
                    <Button size="lg" onClick={() => { setDone(null); setSelectedClass(''); setSelectedSection(''); setStep(0); }}>Choose another class</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 1: class */
    if (step === 0) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={0} />
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">Give an extra fee (like Bus fee or Hostel fee) to some students. First choose their class.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Class" htmlFor="asf-class" required>
                                <select id="asf-class" className="input" value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                                    <option value="">Choose a class</option>
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </Field>
                            <Field label="Section" htmlFor="asf-section" required>
                                <select id="asf-section" className="input" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass}>
                                    <option value="">Choose a section</option>
                                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </Field>
                        </div>
                    </div>
                </div>
                <ActionBar note={!selectedClass ? 'Choose a class first' : !selectedSection ? 'Choose a section' : undefined}>
                    <Button size="lg" disabled={!selectedClass || !selectedSection} onClick={() => setStep(1)}>Show students</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2: students */
    if (step === 1) {
        const allShownSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.student_id));
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={1} onJump={setStep} />
                <p className="text-sm text-slate-600">{classText} · Tick the students who should pay the extra fee.</p>

                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search by name or admission number"
                        aria-label="Search students"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-9"
                    />
                </div>

                {loading ? (
                    <LoadingState label="Loading students…" />
                ) : filteredStudents.length === 0 ? (
                    <div className="card"><EmptyState compact title={students.length === 0 ? 'No students in this section' : 'No students match your search'} /></div>
                ) : (
                    <div className="space-y-2">
                        <CheckRow
                            checked={allShownSelected}
                            onChange={(checked) => handleSelectAllStudents({ target: { checked } } as React.ChangeEvent<HTMLInputElement>)}
                            className="bg-slate-50"
                        >
                            <span className="font-semibold">Select all {filteredStudents.length} shown</span>
                        </CheckRow>
                        {filteredStudents.map(student => (
                            <CheckRow
                                key={student.student_id}
                                checked={selectedStudentIds.includes(student.student_id)}
                                onChange={() => handleSelectStudent(student.student_id)}
                                hint={`Admission number ${student.admission_no}${student.fatherMobile ? ` · Father ${student.fatherMobile}` : ''}`}
                            >
                                <span className="font-medium">{student.name}</span>
                            </CheckRow>
                        ))}
                    </div>
                )}

                <ActionBar note={selectedStudentIds.length === 0 ? 'Choose at least one student' : `${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'} chosen`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={selectedStudentIds.length === 0} onClick={() => setStep(2)}>Next</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 3: fees */
    if (step === 2) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={2} onJump={setStep} />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-slate-600">Tick each fee and type how much each student pays.</p>
                    {navigateTo && (
                        <button type="button" onClick={() => navigateTo('fee-type')} className="btn-ghost btn-sm text-brand-700 self-start">
                            <Plus className="w-4 h-4" /> Add a new special fee type
                        </button>
                    )}
                </div>

                {feeTypes.length === 0 ? (
                    <div className="card"><EmptyState compact title="No special fees yet" description='Add a fee type with "Only some students (special)" first.' /></div>
                ) : (
                    <div className="space-y-2">
                        {feeTypes.map(ft => {
                            const isSelected = selectedFees.some(f => f.fee_type_id === ft.id);
                            const selectedFee = selectedFees.find(f => f.fee_type_id === ft.id);
                            const inClassFees = restrictedFeeTypeIds.has(ft.id);
                            return (
                                <div key={ft.id} className="space-y-2">
                                    <CheckRow
                                        checked={isSelected}
                                        onChange={(checked) => handleFeeSelection(ft.id, checked)}
                                        hint={inClassFees ? 'Already part of this class’s fees, so it cannot be given again' : undefined}
                                    >
                                        {ft.display_name || ft.fee_type}
                                    </CheckRow>
                                    {isSelected && (
                                        <div className="pl-11 pr-1">
                                            <Field label="Amount each student pays (₹)" htmlFor={`asf-amt-${ft.id}`}>
                                                <input
                                                    id={`asf-amt-${ft.id}`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    className="input sm:max-w-[12rem]"
                                                    placeholder="0"
                                                    value={selectedFee?.amount || ''}
                                                    onChange={(e) => handleFeeAmountChange(ft.id, e.target.value)}
                                                />
                                            </Field>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <ActionBar note={selectedFees.length === 0 ? 'Choose at least one fee' : missingAmount ? 'Type an amount for every fee you chose' : `Each student pays ${rupees(feeTotal)} more`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                    <Button size="lg" disabled={selectedFees.length === 0 || missingAmount} onClick={() => setStep(3)}>Next</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 4: review */
    return (
        <div className="max-w-3xl mx-auto space-y-4">
            <Steps steps={STEP_TITLES} current={3} onJump={setStep} />
            <div className="card">
                <div className="card-body">
                    <p className="text-base text-slate-900">
                        You are adding <strong>{rupees(feeTotal)}</strong> in fees to <strong>{selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'}</strong> of {classText} for {academicYear}.
                    </p>
                    <div className="mt-3">
                        {selectedFees.map(f => (
                            <SummaryRow key={f.fee_type_id} label={feeName(f.fee_type_id)}>{rupees(f.amount)} each</SummaryRow>
                        ))}
                        <SummaryRow label="Students" strong>{selectedStudentIds.length}</SummaryRow>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">Students who already have one of these fees are skipped for that fee.</p>
                </div>
            </div>
            <ActionBar>
                <Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button>
                <Button
                    size="lg"
                    onClick={handleAssignFees}
                    loading={assigning}
                    disabled={selectedStudentIds.length === 0 || selectedFees.length === 0}
                >
                    Give fees to {selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'}
                </Button>
            </ActionBar>
        </div>
    );
};

export default AssignSpecialFee;
