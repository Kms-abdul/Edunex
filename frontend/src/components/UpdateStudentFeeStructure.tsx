import React, { useState, useEffect } from 'react';
import api from '../api';
import { PencilIcon, TrashIcon, RefreshIcon } from './icons';
import { notify, confirmDialog } from './ui/feedback';
import { EmptyState } from './ui';

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
            notify('Fee updated successfully');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to update fee');
        }
    };

    const handleDeleteFee = async (id: number) => {
        if (!await confirmDialog('Are you sure you want to delete this fee?')) return;
        try {
            await api.delete(`/fees/student-fee/${id}`);
            fetchInstallments();
            notify('Fee deleted successfully');
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
            notify('Fee added successfully');
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
            notify('Standard fees assigned successfully');
        } catch (error: any) {
            notify(error.response?.data?.error || 'Failed to assign standard fees');
        }
    };

    const selectedStudent = students.find(s => s.student_id === selectedStudentId);

    return (
        <div className="container-fluid mx-auto p-4 min-h-full">
            {/* Header */}
            <div className="bg-brand-50 border-l-4 border-brand-500 p-4 mb-6 flex flex-wrap gap-3 justify-between items-center rounded-r-lg shadow-sm">
                <div className="flex items-center">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                        <span>📋</span> Update student fee structure
                    </h2>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                    {(() => {
                        const displayBranch = computeGlobalBranch();

                        return (
                            <input
                                type="text"
                                value={displayBranch}
                                readOnly
                                className="input w-32"
                                title="Current Branch"
                            />
                        );
                    })()}
                    <input
                        type="text"
                        placeholder="Search Name/AdmNo/EnrollmentNo"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input w-40"
                    />
                    <select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                        className="input w-24"
                    >
                        <option value="">Class</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={selectedStudentId || ''}
                        onChange={e => setSelectedStudentId(Number(e.target.value) || null)}
                        className="input w-64"
                    >
                        <option value="">Select Student</option>
                        {students.map(s => (
                            <option key={s.student_id} value={s.student_id}>
                                {s.name} ({s.admNo})
                            </option>
                        ))}
                    </select>


                </div>
            </div>

            {/* Content */}
            {selectedStudentId ? (
                <div>
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                        <h3 className="text-base font-semibold text-slate-900">
                            Fee Installments for <span className="text-brand-600 font-bold">{selectedStudent?.name}</span>
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAssignStandardModal(true)}
                                className="btn-success btn-sm"
                            >
                                <RefreshIcon className="w-4 h-4" />
                                Assign Standard Fee
                            </button>
                        </div>
                    </div>

                    {installments.length === 0 ? (
                        <div className="card"><EmptyState title="No installments found for this student." /></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                </div>
            ) : (
                <div className="card">
                    <EmptyState title="Please select a student to view and update fee structure." />
                </div>
            )}

            {/* Edit Modal */}
            {editingFee && (
                <EditFeeModal
                    fee={editingFee}
                    onClose={() => setEditingFee(null)}
                    onSave={handleUpdateFee}
                />
            )}

            {/* Add Modal */}
            {showAddModal && (
                <AddFeeModal
                    feeTypes={feeTypes}
                    onClose={() => setShowAddModal(false)}
                    onSave={handleAddFee}
                />
            )}

            {/* Assign Standard Fee Modal */}
            {showAssignStandardModal && (
                <AssignStandardFeeModal
                    feeTypes={feeTypes}
                    onClose={() => setShowAssignStandardModal(false)}
                    onSave={handleAssignStandardFee}
                />
            )}
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

    // Status Badge Color
    const badgeColor = isPaid
        ? 'badge-success'
        : isPartial
            ? 'badge-warning'
            : 'badge-warning'; // Image shows orange for Unpaid too

    // Card Header Color
    const headerColor = isPaid ? 'bg-emerald-50' : 'bg-amber-50';

    return (
        <div className="card overflow-hidden">
            <div className={`px-4 py-2 flex justify-between items-center ${headerColor}`}>
                <span className="font-semibold text-slate-700 text-sm">{installment.title}</span>
                <span className={badgeColor}>{installment.status}</span>
            </div>
            <div className="p-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-600">Tuition Fee</span>
                    <span className="text-sm font-bold text-slate-800">{installment.payable}</span>
                </div>

                {/* Calculation view matching screenshot: 3500 - 250 = 3250 */}
                <div className="text-xs text-slate-500 text-right mb-2">
                    {installment.payable} - {installment.concession} = {installment.payable - installment.concession}
                </div>

                <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                    <span className="text-xs text-slate-400">Total</span>
                    <span className="font-bold text-slate-800">
                        ₹ {installment.payable - installment.concession}
                    </span>
                </div>

                {/* Actions */}
                {!isPaid && (
                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            onClick={onEdit}
                            className="btn-soft btn-sm"
                            title="Edit"
                        >
                            <PencilIcon className="w-4 h-4" />
                        </button>
                        {installment.paidAmount === 0 && (
                            <button
                                onClick={onDelete}
                                className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100"
                                title="Delete"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>
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
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-center z-50">
            <div className="card shadow-pop p-6 w-full max-w-sm mx-4">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Edit Fee: {fee.title}</h3>

                <div className="mb-4">
                    <label className="label">Total Amount</label>
                    <input
                        type="number"
                        value={total}
                        onChange={e => setTotal(parseFloat(e.target.value) || 0)}
                        className="input"
                        disabled={fee.paidAmount > 0} // Can't edit total if partially paid usually
                    />
                    {fee.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Cannot change total amount for partially paid fees.</p>}
                </div>

                <div className="mb-6">
                    <label className="label">Concession</label>
                    <input
                        type="number"
                        value={concession}
                        onChange={e => setConcession(parseFloat(e.target.value) || 0)}
                        className="input"
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button
                        onClick={() => onSave(fee.student_fee_id, total, concession)}
                        className="btn-primary"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
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
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-center z-50">
            <div className="card shadow-pop p-6 w-full max-w-sm mx-4">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Add Student Fee</h3>

                <div className="mb-4">
                    <label className="label">Fee Type</label>
                    <select
                        value={feeTypeId}
                        onChange={e => setFeeTypeId(Number(e.target.value))}
                        className="input"
                    >
                        <option value="">Select Fee Type</option>
                        {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.fee_type}</option>)}
                    </select>
                </div>

                <div className="mb-4">
                    <label className="label">Month / Label</label>
                    <select
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="input"
                    >
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                <div className="mb-6">
                    <label className="label">Amount</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(parseFloat(e.target.value))}
                        className="input"
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button
                        onClick={() => feeTypeId && amount && onSave(feeTypeId as number, amount as number, month)}
                        className="btn-success"
                        disabled={!feeTypeId || !amount}
                    >
                        Add
                    </button>
                </div>
            </div>
        </div>
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
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex justify-center items-center z-50">
            <div className="card shadow-pop p-6 w-full max-w-sm mx-4">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Assign Standard Fees</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Select standard fees to assign. The amounts will be automatically determined from the class fee structure.
                </p>

                <div className="mb-6 max-h-60 overflow-y-auto">
                    <label className="label">Standard Fee Types</label>
                    {standardFeeTypes.length === 0 ? (
                        <EmptyState compact title="No standard fee types available." />
                    ) : (
                        <div className="space-y-2">
                            {standardFeeTypes.map(ft => (
                                <label key={ft.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={selectedFeeTypeIds.includes(ft.id)}
                                        onChange={e => handleCheckboxChange(ft.id, e.target.checked)}
                                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                                    />
                                    <span className="text-sm text-slate-700">{ft.fee_type}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button
                        onClick={() => selectedFeeTypeIds.length > 0 && onSave(selectedFeeTypeIds)}
                        className="btn-success"
                        disabled={selectedFeeTypeIds.length === 0}
                    >
                        Assign
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateStudentFeeStructure;
