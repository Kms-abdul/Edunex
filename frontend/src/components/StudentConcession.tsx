import React, { useState, useEffect } from 'react';
import api from '../api';
import { ChevronRight, Search } from 'lucide-react';
import { notify } from './ui/feedback';
import { ActionBar, Alert, Button, EmptyState, Field, Steps } from './ui';
import { CheckRow, SuccessPanel, SummaryRow, rupees } from './fee-setup/shared';

const STEP_TITLES = ['Find student', 'Choose discount', 'Choose fees', 'Check and give'];
const MAX_STUDENTS_SHOWN = 50;

interface ConcessionItem {
    fee_type_id: number;
    fee_type_name: string;
    percentage: number;
}

interface Concession {
    title: string;
    description: string;
    academic_year: string;
    is_percentage: boolean;
    items: ConcessionItem[];
}

interface Student {
    student_id: number;
    name: string;
    admNo: string;
    class: string;
    section: string;
}

interface FeeInstallment {
    sr: number;
    title: string;
    payable: number;
    paid: boolean;
    paidAmount?: number;
    dueAmount?: number;
    concession?: number;
    fee_type_id?: number;
    student_fee_id?: number;
    month?: string;
}

const StudentConcession: React.FC = () => {
    // Dropdown Data
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [concessions, setConcessions] = useState<Concession[]>([]);

    // Selections
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [selectedConcessionTitle, setSelectedConcessionTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Data for Display
    const [installments, setInstallments] = useState<FeeInstallment[]>([]);
    const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<number[]>([]);
    const [previewData, setPreviewData] = useState<Record<number, number>>({}); // student_fee_id -> new concession amount

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Screen state (presentation only)
    const [step, setStep] = useState(0);
    const [done, setDone] = useState<{ count: number; total: number } | null>(null);
    const [pickedStudent, setPickedStudent] = useState<Student | null>(null);

    // Fetch Initial Data
    useEffect(() => {
        fetchClasses();
        fetchConcessions();

        const userStr = localStorage.getItem('user');
        if (userStr) {
            // const u = JSON.parse(userStr);
        }
    }, []);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            const classNames: string[] = response.data.classes.map((c: any) => String(c.class_name));
            setClasses([...new Set(classNames)]);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchConcessions = async () => {
        try {
            const response = await api.get('/concessions');
            const globalYear = localStorage.getItem('academicYear') || '';
            const filteredConcessions = response.data.concessions.filter((c: Concession) => c.academic_year === globalYear);
            setConcessions(filteredConcessions);
        } catch (error) {
            console.error("Error fetching concessions:", error);
        }
    };

    // Fetch Sections
    useEffect(() => {
        if (!selectedClass) {
            setSections([]);
            return;
        }
        const fetchSections = async () => {
            try {
                // Pass branch to get correct sections
                const params = new URLSearchParams();
                params.append('class', selectedClass);
                const globalBranch = localStorage.getItem('currentBranch') || 'All';
                const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
                params.append('branch', branchParam);

                //console.log("Fetching sections with params:", params.toString());

                const response = await api.get(`/students?${params}`);
                //console.log("Students API Response for Sections:", response.data);

                const data = response.data;
                const allStudents: Student[] = Array.isArray(data) ? data : (data.students || []);

                //console.log("Student count:", allStudents.length);
                const rawSections = allStudents.map(s => s.section);
                //console.log("Raw Sections extracted:", rawSections);

                const sec = [...new Set(rawSections.filter(Boolean))].sort();
                //console.log("Final Unique Sections:", sec);
                setSections(sec);
            } catch (error) {
                console.error("Error fetching sections:", error);
            }
        };
        fetchSections();
    }, [selectedClass]);

    // Fetch Students
    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const params = new URLSearchParams();
                if (selectedClass) params.append('class', selectedClass);
                if (selectedSection) params.append('section', selectedSection);
                if (searchTerm) params.append('search', searchTerm);

                // Add Branch param
                const globalBranch = localStorage.getItem('currentBranch') || 'All';
                const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
                params.append('branch', branchParam);

                const response = await api.get(`/students?${params}`);
                const data = response.data;
                setStudents(Array.isArray(data) ? data : (data.students || []));
            } catch (error) {
                console.error("Error fetching students:", error);
            }
        };
        fetchStudents();
    }, [selectedClass, selectedSection, searchTerm]); // Removed selectedBranch dependency

    // Fetch Installments when Student Selected
    useEffect(() => {
        if (!selectedStudentId) {
            setInstallments([]);
            return;
        }
        const fetchInstallments = async () => {
            try {
                const response = await api.get(`/fees/student-details/${selectedStudentId}`);
                setInstallments(response.data.installments || []);
                setSelectedInstallmentIds([]); // Reset selection
                setPreviewData({});
            } catch (error) {
                console.error("Error fetching installments:", error);
            }
        };
        fetchInstallments();
    }, [selectedStudentId]);

    // Calculate Preview when Concession Selected
    useEffect(() => {
        if (!selectedConcessionTitle || installments.length === 0) {
            setPreviewData({});
            return;
        }

        const concession = concessions.find(c => c.title === selectedConcessionTitle);
        if (!concession) return;

        const newPreview: Record<number, number> = {};

        installments.forEach(inst => {
            if (!inst.student_fee_id) return;

            const rule = concession.items.find(i => i.fee_type_id === inst.fee_type_id);
            if (rule) {
                const payable = inst.payable;
                let discount = 0;
                if (concession.is_percentage) {
                    discount = payable * (rule.percentage / 100);
                } else {
                    discount = Math.min(payable, rule.percentage);
                }
                newPreview[inst.student_fee_id] = Math.round(discount);
            }
        });
        setPreviewData(newPreview);

    }, [selectedConcessionTitle, installments]);


    const handleToggleInstallment = (id: number) => {
        setSelectedInstallmentIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            // Select all that have a valid concession preview AND are not disabled
            const validIds = installments
                .filter(i => {
                    const hasPreview = i.student_fee_id && previewData[i.student_fee_id] !== undefined;
                    const isPaidOrPartial = (i.paidAmount || 0) > 0;
                    const hasExistingConcession = (i.concession || 0) > 0;
                    return hasPreview && !isPaidOrPartial && !hasExistingConcession;
                })
                .map(i => i.student_fee_id!);
            setSelectedInstallmentIds(validIds);
        } else {
            setSelectedInstallmentIds([]);
        }
    };

    const handleAssign = async () => {
        if (!selectedStudentId || !selectedConcessionTitle || selectedInstallmentIds.length === 0) {
            notify.warning("Choose a student, a discount and at least one fee.");
            return;
        }

        // The "Check and give" step is the confirmation.
        const givenCount = selectedInstallmentIds.length;
        const givenTotal = selectedInstallmentIds.reduce((s, id) => s + (previewData[id] || 0), 0);

        setLoading(true);
        try {
            const concession = concessions.find(c => c.title === selectedConcessionTitle);

            await api.post('/fees/assign-concession', {
                student_id: selectedStudentId,
                concession_title: selectedConcessionTitle,
                academic_year: concession?.academic_year || localStorage.getItem('academicYear') || '',
                installments: selectedInstallmentIds
            });

            setMessage("Discount given.");
            setDone({ count: givenCount, total: givenTotal });

            // Refresh installments
            const response = await api.get(`/fees/student-details/${selectedStudentId}`);
            setInstallments(response.data.installments || []);
            setSelectedInstallmentIds([]);

        } catch (error: any) {
            console.error("Error assigning concession:", error);
            setMessage(`Error: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const selectedConcession = concessions.find(c => c.title === selectedConcessionTitle);
    const selectedStudent = pickedStudent || students.find(s => s.student_id === selectedStudentId);
    const studentText = selectedStudent ? `${selectedStudent.name} (Class ${selectedStudent.class}${selectedStudent.section ? ` - ${selectedStudent.section}` : ''})` : 'this student';
    const ruleText = (value: number) => (selectedConcession?.is_percentage ? `${value}%` : rupees(value));

    // Same rule as before: a fee can get the discount only if it has a new discount amount, nothing paid, and no discount yet.
    const blockReason = (inst: FeeInstallment) => {
        if ((inst.paidAmount || 0) > 0) return 'Already paid (fully or partly)';
        if ((inst.concession || 0) > 0) return 'Already has a discount';
        if (!(inst.student_fee_id && previewData[inst.student_fee_id] !== undefined)) return 'This discount does not cover this fee';
        return '';
    };
    const selectableCount = installments.filter(i => !blockReason(i)).length;
    const selectedTotal = selectedInstallmentIds.reduce((s, id) => s + (previewData[id] || 0), 0);

    /* ------------------------------------------------------------ Done */
    if (done) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <SuccessPanel title="Discount given">
                    {selectedConcessionTitle}: {rupees(done.total)} off on {done.count} fee{done.count === 1 ? '' : 's'} for {studentText}.
                </SuccessPanel>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setDone(null); setMessage(''); setStep(2); }}>See this student's fees</Button>
                    <Button size="lg" onClick={() => { setDone(null); setMessage(''); setSelectedStudentId(null); setPickedStudent(null); setSelectedConcessionTitle(''); setStep(0); }}>
                        Another student
                    </Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 1: find student */
    if (step === 0) {
        const shownStudents = students.slice(0, MAX_STUDENTS_SHOWN);
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={0} />
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">Give a discount to one student. Find the student.</p>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                placeholder="Admission number or name"
                                aria-label="Search student"
                                className="input pl-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Class (optional)" htmlFor="sc-class">
                                <select id="sc-class" className="input" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                                    <option value="">All classes</option>
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </Field>
                            <Field label="Section (optional)" htmlFor="sc-section">
                                <select id="sc-section" className="input" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass}>
                                    <option value="">All sections</option>
                                    {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </Field>
                        </div>
                    </div>
                </div>

                {students.length === 0 ? (
                    <div className="card"><EmptyState compact title="No students found" description="Try another name or class." /></div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-slate-500">
                            {students.length > MAX_STUDENTS_SHOWN
                                ? `Showing ${MAX_STUDENTS_SHOWN} of ${students.length}. Search or choose a class to find the student faster.`
                                : `Tap a student (${students.length} found).`}
                        </p>
                        <ul className="space-y-2">
                            {shownStudents.map(s => (
                                <li key={s.student_id}>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedStudentId(s.student_id); setPickedStudent(s); setMessage(''); setStep(1); }}
                                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 min-h-[56px] text-left transition-colors
                                            ${selectedStudentId === s.student_id ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[15px] font-semibold text-slate-900 break-words">{s.name}</span>
                                            <span className="block text-sm text-slate-500">
                                                Admission number {s.admNo} · Class {s.class}{s.section ? ` - ${s.section}` : ''}
                                            </span>
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2: choose discount */
    if (step === 1) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={1} onJump={setStep} />
                <p className="text-sm text-slate-600">For <strong>{studentText}</strong>. Which discount?</p>

                {concessions.length === 0 ? (
                    <div className="card"><EmptyState compact title="No discount types for this year" description="Add one first under Discounts → Discount types." /></div>
                ) : (
                    <div className="space-y-2" role="radiogroup" aria-label="Discount">
                        {concessions.map((c, idx) => {
                            const active = c.title === selectedConcessionTitle;
                            return (
                                <label
                                    key={idx}
                                    className={`flex items-start gap-3 min-h-[52px] rounded-xl border px-4 py-3 cursor-pointer transition-colors
                                        ${active ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                >
                                    <input
                                        type="radio"
                                        name="sc-concession"
                                        checked={active}
                                        onChange={() => setSelectedConcessionTitle(c.title)}
                                        className="w-5 h-5 mt-0.5 accent-brand-600 flex-shrink-0"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-semibold text-slate-900">{c.title}</span>
                                        {c.description && <span className="block text-sm text-slate-500">{c.description}</span>}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}

                {selectedConcession && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-sm font-semibold text-slate-900">What “{selectedConcession.title}” takes off</h3>
                        </div>
                        <div className="px-5 py-1">
                            {selectedConcession.items.length === 0 ? (
                                <p className="py-3 text-sm text-slate-500">No fees in this discount.</p>
                            ) : selectedConcession.items.map((item, idx) => (
                                <SummaryRow key={idx} label={item.fee_type_name}>{ruleText(item.percentage)}</SummaryRow>
                            ))}
                        </div>
                    </div>
                )}

                <ActionBar note={!selectedConcessionTitle ? 'Choose a discount' : undefined}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={!selectedConcessionTitle} onClick={() => setStep(2)}>Next</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 3: choose fees */
    if (step === 2) {
        const allSelected = selectableCount > 0 && selectedInstallmentIds.length === selectableCount;
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={2} onJump={setStep} />
                <p className="text-sm text-slate-600">
                    {studentText} · <strong>{selectedConcessionTitle}</strong>. Tick the fees that get the discount.
                </p>

                {message && (
                    <Alert tone={message.includes('Error') ? 'error' : 'success'} onClose={() => setMessage('')}>
                        {message.replace(/^Error:\s*/, 'Could not give the discount: ')}
                    </Alert>
                )}

                {installments.length === 0 ? (
                    <div className="card"><EmptyState compact title="This student has no fees yet" /></div>
                ) : (
                    <div className="space-y-2">
                        {selectableCount > 0 && (
                            <CheckRow
                                checked={allSelected}
                                onChange={(checked) => handleSelectAll({ target: { checked } } as React.ChangeEvent<HTMLInputElement>)}
                                className="bg-slate-50"
                            >
                                <span className="font-semibold">Select all {selectableCount} that can get it</span>
                            </CheckRow>
                        )}
                        {installments.map(inst => {
                            const reason = blockReason(inst);
                            const newConc = inst.student_fee_id ? previewData[inst.student_fee_id] : undefined;
                            const status = inst.paid ? 'Paid' : (inst.paidAmount || 0) > 0 ? 'Partly paid' : 'Not paid';
                            return (
                                <CheckRow
                                    key={inst.sr}
                                    checked={inst.student_fee_id ? selectedInstallmentIds.includes(inst.student_fee_id) : false}
                                    onChange={() => inst.student_fee_id && !reason && handleToggleInstallment(inst.student_fee_id)}
                                    disabled={!!reason}
                                    hint={reason
                                        ? `${status} · ${reason}`
                                        : `Fee ${rupees(inst.payable)} · ${status}`}
                                    right={!reason && newConc !== undefined ? (
                                        <span className="text-sm font-semibold text-brand-700 whitespace-nowrap">−{rupees(newConc)}</span>
                                    ) : (inst.concession || 0) > 0 ? (
                                        <span className="text-xs text-slate-500 whitespace-nowrap">Now −{rupees(inst.concession)}</span>
                                    ) : undefined}
                                >
                                    {inst.title}
                                </CheckRow>
                            );
                        })}
                    </div>
                )}

                <ActionBar note={selectedInstallmentIds.length === 0 ? 'Choose at least one fee' : `${selectedInstallmentIds.length} fee${selectedInstallmentIds.length === 1 ? '' : 's'} · ${rupees(selectedTotal)} off`}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                    <Button size="lg" disabled={selectedInstallmentIds.length === 0} onClick={() => setStep(3)}>Next</Button>
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
                        You are giving <strong>{selectedConcessionTitle}</strong> to <strong>{studentText}</strong>:{' '}
                        <strong>{rupees(selectedTotal)}</strong> off on {selectedInstallmentIds.length} fee{selectedInstallmentIds.length === 1 ? '' : 's'}.
                    </p>
                    <div className="mt-3">
                        {installments
                            .filter(i => i.student_fee_id && selectedInstallmentIds.includes(i.student_fee_id))
                            .map(i => (
                                <SummaryRow key={i.sr} label={`${i.title} (${rupees(i.payable)})`}>−{rupees(previewData[i.student_fee_id!] || 0)}</SummaryRow>
                            ))}
                        <SummaryRow label="Total discount" strong>{rupees(selectedTotal)}</SummaryRow>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">The student's fees change when you tap the button below.</p>
                </div>
            </div>
            {message && message.includes('Error') && (
                <Alert tone="error" onClose={() => setMessage('')}>{message.replace(/^Error:\s*/, 'Could not give the discount: ')}</Alert>
            )}
            <ActionBar>
                <Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button>
                <Button size="lg" onClick={handleAssign} loading={loading} disabled={selectedInstallmentIds.length === 0}>
                    Give {rupees(selectedTotal)} discount
                </Button>
            </ActionBar>
        </div>
    );
};

export default StudentConcession;
