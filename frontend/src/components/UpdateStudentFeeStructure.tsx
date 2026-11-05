import React, { useState, useEffect } from 'react';
import api from '../api';
import { ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { notify, confirmDialog } from './ui/feedback';
import { ActionBar, Button, EmptyState, Field, Steps } from './ui';
import { CheckRow, Sheet, rupees } from './fee-setup/shared';

const STEP_TITLES = ['Find student', 'Change fees'];

interface FeeInstallment {
    sr: number;
    student_fee_id: number;
    title: string;
    payable: number;
    paid: boolean;
    paidAmount: number;
    dueAmount: number;
    concession: number;
    month: string;
    status: string;
    fee_type_id: number;
}

interface Student {
    student_id: number;
    name: string;
    admNo: string;
    enrollment_no: string;
    class: string;
    section: string;
    branch: string;
}

interface FeeType {
    id: number;
    fee_type: string;
    type: string;
    fee_type_group?: string;
}

const UpdateStudentFeeStructure: React.FC = () => {
    // State
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState('');

    // const [selectedBranch, setSelectedBranch] = useState('All'); // Removed
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

    // Data
    const [students, setStudents] = useState<Student[]>([]);
    const [installments, setInstallments] = useState<FeeInstallment[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFee, setEditingFee] = useState<FeeInstallment | null>(null);


    const [showAssignStandardModal, setShowAssignStandardModal] = useState(false);
    const [pickedStudent, setPickedStudent] = useState<Student | null>(null);

    // No need to set branch state, we read from localStorage

    useEffect(() => {
        fetchClasses();
        fetchFeeTypes();
    }, []);

    const computeGlobalBranch = (): string => {
        const storedBranch = localStorage.getItem('currentBranch') || 'All';
        return storedBranch;
    };

    // Fetch Students on filter change
    useEffect(() => {
        if (selectedClass || searchTerm) {
            fetchStudents();
        }
    }, [selectedClass, searchTerm]); // Removed selectedBranch dependency

    // Fetch Installments when student selected
    useEffect(() => {
        if (selectedStudentId) {
            fetchInstallments();
        } else {
            setInstallments([]);
        }
    }, [selectedStudentId]);

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            const classNames = response.data.classes.map((c: any) => c.class_name);
            setClasses(classNames);
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const fetchFeeTypes = async () => {
        try {
            const response = await api.get('/fee-types');
            setFeeTypes(response.data.fee_types || []);
        } catch (error) {
            console.error('Error fetching fee types:', error);
        }
    };

    const fetchStudents = async () => {
        try {
            const params = new URLSearchParams();
            if (selectedClass) params.append('class', selectedClass);
            if (searchTerm) params.append('search', searchTerm);

            const globalBranch = computeGlobalBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            params.append('branch', branchParam);

            const response = await api.get(`/fees/students?${params.toString()}`);
            setStudents(Array.isArray(response.data) ? response.data : response.data.students || []);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    const fetchInstallments = async () => {
        if (!selectedStudentId) return;
        try {
            const response = await api.get(`/fees/student-details/${selectedStudentId}`);
            setInstallments(response.data.installments || []);
        } catch (error) {
            console.error('Error fetching installments:', error);
        }
    };

    const handleUpdateFee = async (id: number, totalFee: number, concession: number) => {
        try {
            await api.put(`/fees/student-fee/${id}`, {
                total_fee: totalFee,
                concession: concession
            });
            fetchInstallments();
            setEditingFee(null);
            notify.success('Fee changed.');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to update fee');
        }
    };

    const handleDeleteFee = async (id: number) => {
        if (!await confirmDialog('Remove this fee from the student? This cannot be undone.', { tone: 'danger', confirmText: 'Remove' })) return;
        try {
            await api.delete(`/fees/student-fee/${id}`);
            fetchInstallments();
            notify.success('Fee removed.');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to delete fee');
        }
    };

    const handleAddFee = async (feeTypeId: number, amount: number, month: string) => {
        if (!selectedStudentId) return;
        try {
            await api.post('/fees/student-fee/add', {
                student_id: selectedStudentId,
                fee_type_id: feeTypeId,
                amount: amount,
                month: month
            });
            fetchInstallments();
            setShowAddModal(false);
            notify.success('Fee added.');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to add fee');
        }
    };

    const handleAssignStandardFee = async (feeTypeIds: number[]) => {
        if (!selectedStudentId || feeTypeIds.length === 0) return;
        try {
            await Promise.all(feeTypeIds.map(feeTypeId =>
                api.post('/fees/assign-fee-type', {
                    student_id: selectedStudentId,
                    fee_type_id: feeTypeId
                })
            ));
            fetchInstallments();
            setShowAssignStandardModal(false);
            notify.success('Class fees added for this student.');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to assign standard fees');
        }
    };

    const selectedStudent = pickedStudent || students.find(s => s.student_id === selectedStudentId);
    const branchLabel = computeGlobalBranch();

    const modals = (
        <>
            {/* Edit */}
            {editingFee && (
                <EditFeeModal
                    fee={editingFee}
                    onClose={() => setEditingFee(null)}
                    onSave={handleUpdateFee}
                />
            )}

            {/* Add (kept as before) */}
            {showAddModal && (
                <AddFeeModal
                    feeTypes={feeTypes}
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAddFee}
                />
            )}

            {/* Assign standard fees */}
            {showAssignStandardModal && (
                <AssignStandardFeeModal
                    feeTypes={feeTypes}
                    onClose={() => setShowAssignStandardModal(false)}
                    onSave={handleAssignStandardFee}
                />
            )}
        </>
    );

    /* ------------------------------------------------------------ Step 1: find student */
    if (!selectedStudentId) {
        return (
            <div className="w-full max-w-[1600px] mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={0} />
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">
                            Change, remove or add fees for one student. Branch: <strong>{branchLabel === 'All' || branchLabel === 'All Branches' ? 'All branches' : branchLabel}</strong>
                        </p>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                placeholder="Name, admission number or enrolment number"
                                aria-label="Search student"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input pl-9"
                                autoFocus
                            />
                        </div>
                        <Field label="Class (optional)" htmlFor="usfs-class" className="sm:max-w-xs">
                            <select id="usfs-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input">
                                <option value="">All classes</option>
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>

                {!selectedClass && !searchTerm ? (
                    <div className="card"><EmptyState compact title="Search for a student" description="Type a name or number, or choose a class." /></div>
                ) : students.length === 0 ? (
                    <div className="card"><EmptyState compact title="No students found" description="Try another name or class." /></div>
                ) : (
                    <ul className="space-y-2">
                        {students.map(s => (
                            <li key={s.student_id}>
                                <button
                                    type="button"
                                    onClick={() => { setPickedStudent(s); setSelectedStudentId(s.student_id); }}
                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 min-h-[56px] text-left hover:bg-slate-50 transition-colors"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-semibold text-slate-900 break-words">{s.name}</span>
                                        <span className="block text-sm text-slate-500">
                                            Admission number {s.admNo}{s.class ? ` · Class ${s.class}${s.section ? ` - ${s.section}` : ''}` : ''}
                                        </span>
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {modals}
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 2: change fees */
    const totals = installments.reduce(
        (t, i) => ({ fee: t.fee + (Number(i.payable) || 0), disc: t.disc + (Number(i.concession) || 0), paid: t.paid + (Number(i.paidAmount) || 0) }),
        { fee: 0, disc: 0, paid: 0 },
    );

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-4">
            <Steps steps={STEP_TITLES} current={1} onJump={() => { setSelectedStudentId(null); setPickedStudent(null); }} />

            <div className="card">
                <div className="card-body flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-lg font-semibold text-slate-900 break-words">{selectedStudent?.name || 'Student'}</p>
                        {selectedStudent && (
                            <p className="text-sm text-slate-500">
                                Admission number {selectedStudent.admNo}{selectedStudent.class ? ` · Class ${selectedStudent.class}${selectedStudent.section ? ` - ${selectedStudent.section}` : ''}` : ''}
                            </p>
                        )}
                        {installments.length > 0 && (
                            <p className="mt-1 text-sm text-slate-700">
                                Fees {rupees(totals.fee)} · Discount {rupees(totals.disc)} · Paid {rupees(totals.paid)}
                            </p>
                        )}
                    </div>
                    <button onClick={() => setShowAssignStandardModal(true)} className="btn-soft min-h-[44px]">
                        <Plus className="w-4 h-4" />
                        Add class fees
                    </button>
                </div>
            </div>

            {installments.length === 0 ? (
                <div className="card"><EmptyState title="This student has no fees yet" description='Tap "Add class fees" to give the standard fees of the class.' /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {installments.map((inst) => (
                        <InstallmentCard
                            key={inst.sr}
                            installment={inst}
                            onEdit={() => setEditingFee(inst)}
                            onDelete={() => handleDeleteFee(inst.student_fee_id)}
                        />
                    ))}
                </div>
            )}

            <ActionBar>
                <Button variant="secondary" size="lg" onClick={() => { setSelectedStudentId(null); setPickedStudent(null); }}>
                    Choose another student
                </Button>
            </ActionBar>

            {modals}
        </div>
    );
};

// Sub-components

const InstallmentCard: React.FC<{
    installment: FeeInstallment;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ installment, onEdit, onDelete }) => {
    const isPaid = installment.status === 'Paid';
    const isPartial = installment.status === 'Partial';
    const badge = isPaid ? 'badge-success' : isPartial ? 'badge-warning' : 'badge-danger';
    const statusText = isPaid ? 'Paid' : isPartial ? 'Partly paid' : installment.status === 'Unpaid' || !installment.status ? 'Not paid' : installment.status;

    return (
        <div className="card overflow-hidden">
            <div className="px-4 py-2.5 flex justify-between items-center gap-2 border-b border-slate-100 bg-slate-50">
                <span className="font-semibold text-slate-900 text-[15px] break-words min-w-0">{installment.title}</span>
                <span className={badge}>{statusText}</span>
            </div>
            <div className="px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-600">Fee</span><span className="text-slate-900">{rupees(installment.payable)}</span></div>
                {installment.concession > 0 && (
                    <div className="flex justify-between"><span className="text-slate-600">Discount</span><span className="text-emerald-700">−{rupees(installment.concession)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                    <span className="font-medium text-slate-700">To pay</span>
                    <span className="font-semibold text-slate-900">{rupees(installment.payable - installment.concession)}</span>
                </div>
                {installment.paidAmount > 0 && (
                    <div className="flex justify-between"><span className="text-slate-600">Paid</span><span className="text-slate-900">{rupees(installment.paidAmount)}</span></div>
                )}
            </div>

            {!isPaid && (
                <div className="px-4 pb-3 flex gap-2">
                    <button onClick={onEdit} className="btn-soft btn-sm flex-1 sm:flex-none">
                        <Pencil className="w-4 h-4" /> Change
                    </button>
                    {installment.paidAmount === 0 && (
                        <button onClick={onDelete} className="btn-ghost btn-sm text-red-600 hover:bg-red-50 flex-1 sm:flex-none">
                            <Trash2 className="w-4 h-4" /> Remove
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const EditFeeModal: React.FC<{
    fee: FeeInstallment;
    onClose: () => void;
    onSave: (id: number, total: number, concession: number) => void;
}> = ({ fee, onClose, onSave }) => {
    const [total, setTotal] = useState(fee.payable);
    const [concession, setConcession] = useState(fee.concession);

    return (
        <Sheet
            title={`Change ${fee.title}`}
            onClose={onClose}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary btn-lg">Cancel</button>
                    <button onClick={() => onSave(fee.student_fee_id, total, concession)} className="btn-primary btn-lg">Save changes</button>
                </>
            }
        >
            <Field
                label="Fee amount (₹)"
                htmlFor="usfs-edit-total"
                hint={fee.paidAmount > 0 ? 'Part of this fee is paid, so the amount cannot be changed.' : undefined}
            >
                <input
                    id="usfs-edit-total"
                    type="number"
                    inputMode="decimal"
                    value={total}
                    onChange={e => setTotal(parseFloat(e.target.value) || 0)}
                    className="input"
                    disabled={fee.paidAmount > 0} // Can't edit total if partially paid usually
                />
            </Field>
            <Field label="Discount (₹)" htmlFor="usfs-edit-disc">
                <input
                    id="usfs-edit-disc"
                    type="number"
                    inputMode="decimal"
                    value={concession}
                    onChange={e => setConcession(parseFloat(e.target.value) || 0)}
                    className="input"
                />
            </Field>
            <p className="text-sm text-slate-600">To pay after this change: <strong>{rupees(total - concession)}</strong></p>
        </Sheet>
    );
};


const AddFeeModal: React.FC<{
    feeTypes: FeeType[];
    onClose: () => void;
    onSave: (feeTypeId: number, amount: number, month: string) => void;
}> = ({ feeTypes, onClose, onSave }) => {
    const [feeTypeId, setFeeTypeId] = useState<number | ''>('');
    const [amount, setAmount] = useState<number | ''>('');
    const [month, setMonth] = useState('One-Time');

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "One-Time"];

    return (
        <Sheet
            title="Add a fee"
            onClose={onClose}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary btn-lg">Cancel</button>
                    <button
                        onClick={() => feeTypeId && amount && onSave(feeTypeId as number, amount as number, month)}
                        className="btn-primary btn-lg"
                        disabled={!feeTypeId || !amount}
                    >
                        Add fee
                    </button>
                </>
            }
        >
            <Field label="Fee" htmlFor="usfs-add-type">
                <select id="usfs-add-type" value={feeTypeId} onChange={e => setFeeTypeId(Number(e.target.value))} className="input">
                    <option value="">Choose a fee</option>
                    {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.fee_type}</option>)}
                </select>
            </Field>
            <Field label="Month" htmlFor="usfs-add-month">
                <select id="usfs-add-month" value={month} onChange={e => setMonth(e.target.value)} className="input">
                    {months.map(m => <option key={m} value={m}>{m === 'One-Time' ? 'One time' : m}</option>)}
                </select>
            </Field>
            <Field label="Amount (₹)" htmlFor="usfs-add-amt">
                <input id="usfs-add-amt" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="input" />
            </Field>
        </Sheet>
    );
};

const AssignStandardFeeModal: React.FC<{
    feeTypes: FeeType[];
    onClose: () => void;
    onSave: (feeTypeIds: number[]) => void;
}> = ({ feeTypes, onClose, onSave }) => {
    const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<number[]>([]);
    const standardFeeTypes = feeTypes.filter(ft => ft.fee_type_group === 'Standard');

    const handleCheckboxChange = (id: number, isChecked: boolean) => {
        if (isChecked) {
            setSelectedFeeTypeIds(prev => [...prev, id]);
        } else {
            setSelectedFeeTypeIds(prev => prev.filter(fId => fId !== id));
        }
    };

    return (
        <Sheet
            title="Add class fees"
            onClose={onClose}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary btn-lg">Cancel</button>
                    <button
                        onClick={() => selectedFeeTypeIds.length > 0 && onSave(selectedFeeTypeIds)}
                        className="btn-primary btn-lg"
                        disabled={selectedFeeTypeIds.length === 0}
                    >
                        Add {selectedFeeTypeIds.length || ''} fee{selectedFeeTypeIds.length === 1 ? '' : 's'}
                    </button>
                </>
            }
        >
            <p className="text-sm text-slate-600">
                Tick the fees to give this student. The amounts come from the class fees.
            </p>
            {standardFeeTypes.length === 0 ? (
                <EmptyState compact title="No standard fees set up" />
            ) : (
                <div className="space-y-2">
                    {standardFeeTypes.map(ft => (
                        <CheckRow key={ft.id} checked={selectedFeeTypeIds.includes(ft.id)} onChange={checked => handleCheckboxChange(ft.id, checked)}>
                            {ft.fee_type}
                        </CheckRow>
                    ))}
                </div>
            )}
        </Sheet>
    );
};

export default UpdateStudentFeeStructure;
