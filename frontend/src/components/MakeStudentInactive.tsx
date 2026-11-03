import React, { useState, useEffect } from 'react';
import api from '../api';
import { confirmDialog, notify } from './ui/feedback';
import { Alert, LoadingState, EmptyState, Steps, ActionBar, Button, Field } from './ui';
import { JobPage, JobIntro, ChoiceSummary, DoneCard } from './student-jobs/common';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ClassItem {
    id: number;
    class_name: string;
}

interface StudentOption {
    student_id: number;
    name: string;
    admNo: string;
    rollNo: string | number;
    class: string;
    section: string;
    father: string;
    fatherMobile: string;
    Motherfirstname?: string;
    SecondaryPhone?: string;
    status?: string;
}

interface FeeInstallment {
    id: number;
    title: string;
    totalFee: number;
    paidAmount: number;
    dueAmount: number;
    concession: number;
    status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ['Find the student', 'Check fees', 'Date and reason', 'Done'];
type FindMode = 'adm' | 'name' | 'class';

const MakeStudentInactive: React.FC = () => {
    const [step, setStep] = useState(0);
    const [findMode, setFindMode] = useState<FindMode>('adm');
    const [finding, setFinding] = useState(false);
    const [doneName, setDoneName] = useState('');
    // ── Search state ──────────────────────────────────────────────────────────
    const [admSearch, setAdmSearch] = useState('');
    const [nameSearch, setNameSearch] = useState('');
    const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

    // ── Loaded student data ────────────────────────────────────────────────────
    const [student, setStudent] = useState<StudentOption | null>(null);
    const [fees, setFees] = useState<FeeInstallment[]>([]);

    // ── Form ──────────────────────────────────────────────────────────────────
    const [inactivationDate, setInactivationDate] = useState('');
    const [reason, setReason] = useState('');

    // ── UI state ──────────────────────────────────────────────────────────────
    const [loadingFees, setLoadingFees] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [nullifying, setNullifying] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Load classes on mount ─────────────────────────────────────────────────
    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(() => { });
    }, []);

    // ── When class changes, load students for that class ──────────────────────
    useEffect(() => {
        setStudentOptions([]);
        setSelectedStudentId(null);
        if (!selectedClass) return;

        const branch = localStorage.getItem('currentBranch') || 'All';
        api.get('/students', {
            params: { class: selectedClass, branch: branch === 'All Branches' ? 'All' : branch }
        })
            .then(res => setStudentOptions(res.data.students || []))
            .catch(() => setStudentOptions([]));
    }, [selectedClass]);

    // ── Go: load the selected student's details + fee structure ───────────────
    const handleGo = async (): Promise<boolean> => {
        // Resolve student id – by admission number search or dropdown
        let targetId = selectedStudentId;

        if (!targetId && admSearch.trim()) {
            // Search by admission number
            try {
                const res = await api.get('/students', { params: { search: admSearch.trim() } });
                const found: StudentOption[] = res.data.students || [];
                const match = found.find(s => s.admNo?.toLowerCase() === admSearch.trim().toLowerCase());
                if (match) {
                    targetId = match.student_id;
                    setStudent(match);
                } else {
                    setMessage({ type: 'error', text: 'No student has that admission number. Check the number and try again.' });
                    return false;
                }
            } catch {
                setMessage({ type: 'error', text: 'Could not search for the student. Try again.' });
                return false;
            }
        } else if (!targetId && nameSearch.trim()) {
            try {
                const res = await api.get('/students', { params: { search: nameSearch.trim() } });
                const found: StudentOption[] = res.data.students || [];
                if (found.length > 0) {
                    targetId = found[0].student_id;
                    setStudent(found[0]);
                } else {
                    setMessage({ type: 'error', text: 'No student has that name. Check the spelling and try again.' });
                    return false;
                }
            } catch {
                setMessage({ type: 'error', text: 'Could not search for the student. Try again.' });
                return false;
            }
        } else if (targetId) {
            const s = studentOptions.find(s => s.student_id === targetId);
            if (s) setStudent(s);
        }

        if (!targetId) {
            setMessage({ type: 'error', text: 'Find a student first.' });
            return false;
        }

        setMessage(null);
        setLoadingFees(true);
        try {
            const res = await api.get(`/fees/student-details/${targetId}`);
            const installments: FeeInstallment[] = (res.data.installments || []).map((i: any) => ({
                id: i.id,
                title: i.title,
                totalFee: parseFloat(i.totalFee ?? i.total_fee ?? 0),
                paidAmount: parseFloat(i.paidAmount ?? i.paid_amount ?? 0),
                dueAmount: parseFloat(i.dueAmount ?? i.due_amount ?? 0),
                concession: parseFloat(i.concession ?? 0),
                status: i.status ?? 'Pending',
            }));
            setFees(installments);
        } catch {
            setMessage({ type: 'error', text: 'Could not load the fees of this student.' });
        } finally {
            setLoadingFees(false);
        }
        return true;
    };

    // ── Make Inactive ──────────────────────────────────────────────────────────
    const handleMakeInactive = async () => {
        if (!student) return;

        const hasDueFees = fees.some(fee => fee.dueAmount > 0);
        if (hasDueFees) {
            setMessage({ type: 'error', text: 'This student still has fees to pay. Collect the fee or clear unpaid fees first.' });
            return;
        }

        if (!inactivationDate) {
            setMessage({ type: 'error', text: 'Choose the date the student left.' });
            return;
        }
        if (!await confirmDialog(`Make ${student.name} inactive? They will no longer appear in class lists.`, { title: 'Make student inactive?', confirmText: 'Make inactive', tone: 'danger' })) return;

        setSubmitting(true);
        setMessage(null);
        try {
            await api.put(`/students/${student.student_id}`, {
                status: 'Inactive',
                inactivation_date: inactivationDate,
                inactivation_reason: reason,
            });
            setMessage(null);
            notify.success(`${student.name} is now inactive`);
            setDoneName(student.name);
            setStep(3);
            // Reset
            setStudent(null);
            setFees([]);
            setSelectedClass('');
            setSelectedStudentId(null);
            setAdmSearch('');
            setNameSearch('');
            setInactivationDate('');
            setReason('');
        } catch (err: any) {
            const errMsg = err?.response?.data?.error || 'Could not make the student inactive.';
            setMessage({ type: 'error', text: errMsg });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Nullify Fee Structure ──────────────────────────────────────────────────
    const handleNullify = async () => {
        if (!student) return;
        if (!await confirmDialog('All unpaid fees of this student will be set to ₹0. Fees already paid stay as they are. Continue?', { title: 'Clear unpaid fees?', confirmText: 'Clear unpaid fees', tone: 'danger' })) return;

        setNullifying(true);
        setMessage(null);
        try {
            const res = await api.post(`/fees/nullify/${student.student_id}`);
            setMessage({ type: 'success', text: res.data.message || 'Unpaid fees cleared.' });
            // Reload fees
            const feeRes = await api.get(`/fees/student-details/${student.student_id}`);
            const installments: FeeInstallment[] = (feeRes.data.installments || []).map((i: any) => ({
                id: i.id,
                title: i.title,
                totalFee: parseFloat(i.totalFee ?? i.total_fee ?? 0),
                paidAmount: parseFloat(i.paidAmount ?? i.paid_amount ?? 0),
                dueAmount: parseFloat(i.dueAmount ?? i.due_amount ?? 0),
                concession: parseFloat(i.concession ?? 0),
                status: i.status ?? 'Pending',
            }));
            setFees(installments);
        } catch (err: any) {
            setMessage({ type: 'error', text: err?.response?.data?.error || 'Could not clear unpaid fees.' });
        } finally {
            setNullifying(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    const totalDue = fees.reduce((sum, f) => sum + (f.dueAmount > 0 ? f.dueAmount : 0), 0);
    const hasDue = fees.some(fee => fee.dueAmount > 0);
    const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    const chooseMode = (mode: FindMode) => {
        // Only one way of finding is used at a time, so clear the others
        setFindMode(mode);
        setMessage(null);
        if (mode !== 'adm') setAdmSearch('');
        if (mode !== 'name') setNameSearch('');
        if (mode !== 'class') { setSelectedClass(''); setSelectedStudentId(null); }
    };

    const canFind = findMode === 'adm' ? !!admSearch.trim() : findMode === 'name' ? !!nameSearch.trim() : !!selectedStudentId;

    const find = async () => {
        setFinding(true);
        try {
            if (await handleGo()) setStep(1);
        } finally {
            setFinding(false);
        }
    };

    const studentDetail = student && (
        <ChoiceSummary
            title={student.name}
            detail={
                <>
                    Admission number {student.admNo || '—'} · Class {student.class} {student.section}
                    {student.rollNo ? ` · Roll ${student.rollNo}` : ''}
                    <br />
                    Father: {student.father || '—'}{student.fatherMobile ? ` (${student.fatherMobile})` : ''}
                    {student.Motherfirstname ? <> · Mother: {student.Motherfirstname}{student.SecondaryPhone ? ` (${student.SecondaryPhone})` : ''}</> : null}
                </>
            }
            changeLabel="Change student"
            onChange={() => { setMessage(null); setStep(0); }}
        />
    );

    const messageBanner = message && (
        <Alert tone={message.type === 'success' ? 'success' : 'error'} onClose={() => setMessage(null)}>
            {message.text}
        </Alert>
    );

    /* ------------------------------------------------------------ Step 1: find */
    if (step === 0) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={0} />
                <JobIntro>Use this when a student has left the school. Inactive students no longer appear in class lists.</JobIntro>
                <div className="card">
                    <div className="card-body space-y-4">
                        <div>
                            <p className="label">Find the student by</p>
                            <div className="segmented w-full sm:w-auto flex" role="tablist">
                                {([['adm', 'Admission number'], ['name', 'Name'], ['class', 'Class list']] as [FindMode, string][]).map(([m, label]) => (
                                    <button
                                        key={m}
                                        type="button"
                                        role="tab"
                                        aria-selected={findMode === m}
                                        onClick={() => chooseMode(m)}
                                        className={`segmented-item flex-1 min-h-[40px] ${findMode === m ? 'segmented-item-active' : ''}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {findMode === 'adm' && (
                            <Field label="Admission number" htmlFor="inact-adm">
                                <input
                                    id="inact-adm"
                                    type="text"
                                    placeholder="e.g. 2026-003"
                                    value={admSearch}
                                    onChange={e => setAdmSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && canFind) find(); }}
                                    className="input"
                                    autoFocus
                                />
                            </Field>
                        )}
                        {findMode === 'name' && (
                            <Field label="Student name" htmlFor="inact-name" hint="The first student that matches will be opened">
                                <input
                                    id="inact-name"
                                    type="text"
                                    placeholder="Type the name"
                                    value={nameSearch}
                                    onChange={e => setNameSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && canFind) find(); }}
                                    className="input"
                                    autoFocus
                                />
                            </Field>
                        )}
                        {findMode === 'class' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Class" htmlFor="inact-class">
                                    <select id="inact-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input">
                                        <option value="">Choose a class</option>
                                        {classOptions.map(c => (
                                            <option key={c.id} value={c.class_name}>{c.class_name}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Student" htmlFor="inact-student">
                                    <select
                                        id="inact-student"
                                        value={selectedStudentId ?? ''}
                                        onChange={e => setSelectedStudentId(Number(e.target.value) || null)}
                                        disabled={!selectedClass}
                                        className="input"
                                    >
                                        <option value="">Choose a student</option>
                                        {studentOptions.map(s => (
                                            <option key={s.student_id} value={s.student_id}>
                                                {s.rollNo ? `${s.rollNo} ${s.name}` : s.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                        )}
                    </div>
                </div>
                {messageBanner}
                <ActionBar note={!canFind ? (findMode === 'class' ? 'Choose a class and a student' : findMode === 'adm' ? 'Type the admission number' : 'Type the name') : undefined}>
                    <Button size="lg" onClick={find} disabled={!canFind} loading={finding}>Find student</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Done */
    if (step === 3) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={3} />
                <DoneCard title="Student made inactive">
                    <p>{doneName} is now inactive.</p>
                </DoneCard>
                <ActionBar>
                    <Button size="lg" onClick={() => { setDoneName(''); setStep(0); }}>Make another student inactive</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 2: fees */
    if (step === 1) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={1} onJump={i => setStep(i)} />
                {studentDetail}
                {messageBanner}
                <div className="card overflow-hidden">
                    <div className="card-header py-2.5">
                        <span className="text-base font-semibold text-slate-900">Fees</span>
                        {student && fees.length > 0 && (
                            <Button variant="secondary" size="sm" onClick={handleNullify} loading={nullifying}>
                                Clear unpaid fees
                            </Button>
                        )}
                    </div>
                    {loadingFees ? (
                        <LoadingState label="Loading fees…" />
                    ) : fees.length === 0 ? (
                        <EmptyState compact title="No fees found for this student" />
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {fees.map(fee => {
                                const isPaid = fee.paidAmount > 0;
                                return (
                                    <li key={fee.id} className={`px-4 py-3 flex items-start justify-between gap-3 ${fee.dueAmount > 0 ? '' : 'bg-emerald-50/50'}`}>
                                        <div className="min-w-0">
                                            <p className="font-medium text-slate-900 break-words">{fee.title}</p>
                                            <p className="text-sm text-slate-500">
                                                Fee {money(fee.totalFee)}
                                                {isPaid && <> · Paid {money(fee.paidAmount)}</>}
                                            </p>
                                        </div>
                                        <span className={`text-sm font-semibold flex-shrink-0 ${fee.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {fee.dueAmount > 0 ? `${money(fee.dueAmount)} to pay` : 'Nothing to pay'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                {!loadingFees && hasDue && (
                    <Alert tone="warning" title={`${money(totalDue)} still to pay`}>
                        Collect the fee first, or tap “Clear unpaid fees” if the school will not collect it.
                    </Alert>
                )}
                <ActionBar note={hasDue ? 'This student still has fees to pay' : undefined}>
                    <Button variant="secondary" size="lg" onClick={() => { setMessage(null); setStep(0); }}>Back</Button>
                    <Button size="lg" disabled={!student || loadingFees || hasDue} onClick={() => { setMessage(null); setStep(2); }}>Next</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 3: date + reason */
    return (
        <JobPage>
            <Steps steps={STEPS} current={2} onJump={i => setStep(i)} />
            {studentDetail}
            <div className="card">
                <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Date the student left" htmlFor="inact-date" required>
                        <input
                            id="inact-date"
                            type="date"
                            value={inactivationDate}
                            onChange={e => setInactivationDate(e.target.value)}
                            className="input"
                        />
                    </Field>
                    <Field label="Reason (optional)" htmlFor="inact-reason">
                        <input
                            id="inact-reason"
                            type="text"
                            placeholder="e.g. Moved to another city"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="input"
                        />
                    </Field>
                </div>
            </div>
            {messageBanner}
            <ActionBar note={!inactivationDate ? 'Choose the date the student left' : undefined}>
                <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button variant="danger" size="lg" onClick={handleMakeInactive} disabled={!student || !inactivationDate} loading={submitting}>
                    Make {student?.name?.split(' ')[0] || 'student'} inactive
                </Button>
            </ActionBar>
        </JobPage>
    );
};

export default MakeStudentInactive;
