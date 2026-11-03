import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { Alert, EmptyState } from './ui';

interface FeeType {
    id: number;
    fee_type: string;
    category: string;
    fee_type_group: string;
    type: string;
    display_name: string; 
    is_refundable: boolean;
}

interface Installment {
    month: string;
    amount: number;
    month_order: number;
}

interface FeeStructureItem {
    id?: number; // Database ID for saved structures
    fee_type_id: number;
    fee_type_name?: string;
    total_amount: number;
    is_new_admission: boolean;
    installments: Installment[];
}

interface ClassFeeStructure {
    id?: number;
    class: string;
    academic_year: string;
    fee_group: string;
    fees: FeeStructureItem[];
}

interface BranchOption {
    id: number | string;
    name: string;
    location_name: string;
}

const ClassFeeStructure: React.FC = () => {
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [classes, setClasses] = useState<string[]>([]);

    const [selectedClass, setSelectedClass] = useState('');
    const [academicYear] = useState(localStorage.getItem('academicYear') || '');
    const [selectedFeeGroup, setSelectedFeeGroup] = useState('Standard');
    // const [selectedBranch, setSelectedBranch] = useState('All'); // Removed state
    const [selectedLocation, setSelectedLocation] = useState('Hyderabad');
    // const [isBranchLocked, setIsBranchLocked] = useState(false); // Removed state

    const [newAdmissionFees, setNewAdmissionFees] = useState<FeeStructureItem[]>([]);
    const [existingStudentFees, setExistingStudentFees] = useState<FeeStructureItem[]>([]);

    const [showNewAdmissionForm, setShowNewAdmissionForm] = useState(false);
    const [showExistingStudentForm, setShowExistingStudentForm] = useState(false);

    // START FIX: Add state to track effective branch
    const [effectiveBranch, setEffectiveBranch] = useState('All');
    const [isAllBranchesMode, setIsAllBranchesMode] = useState(false);
    
    // Add state for updating assigned students
    const [updateAssignedStudents, setUpdateAssignedStudents] = useState(false);

    // Copy Feature State
    const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<string | number>('');
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const copyDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (copyDropdownRef.current && !copyDropdownRef.current.contains(event.target as Node)) {
                setIsCopyDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        if (user.location) {
            setSelectedLocation(user.location);
        }

        // Auto-set location based on current branch
        let globalBranch = localStorage.getItem('currentBranch') || 'All';

        setEffectiveBranch(globalBranch);

        const allMode = globalBranch === 'All' || globalBranch === 'All Branches';
        setIsAllBranchesMode(allMode);

        const storedLocation = localStorage.getItem('currentLocation');

        // Fetch all branches to populate state and resolve source ID
        api.get('/branches').then(res => {
            const branchList = res.data.branches || res.data || [];

            // Map for Dropdown
            const mappedBranches = branchList.map((b: any) => ({
                id: b.id,
                name: b.branch_name,
                location_name: b.location_name || 'Unknown Location'
            }));
            setAllBranches(mappedBranches);

            // Find Source Branch Info
            if (globalBranch && globalBranch !== 'All' && globalBranch !== 'All Branches') {
                const b = branchList.find((br: any) => br.branch_name.toLowerCase() === globalBranch.toLowerCase());
                if (b) {
                    setSourceBranchId(b.id); // Store ID for backend

                    const locMap: { [key: string]: string } = { 'HYD': 'Hyderabad', 'MUM': 'Mumbai' };
                    // Normalize location_code to upper case to handle Hyd/HYD/Mum/MUM
                    const code = (b.location_code || '').toUpperCase();
                    let resolvedLoc = locMap[code] || 'Hyderabad';
                    setSelectedLocation(resolvedLoc);
                }
            } else {
                if (storedLocation && storedLocation !== 'All') {
                    setSelectedLocation(storedLocation);
                } else {
                    setSelectedLocation('All');
                }
            }
        }).catch(err => console.error("Error fetching branch info:", err));

        fetchFeeTypes();
        fetchClasses();
    }, []);

    const fetchFeeTypes = async () => {
        try {
            const response = await api.get('/fee-types');
            setFeeTypes(response.data.fee_types || []);
        } catch (error) {
            console.error('Error fetching fee types:', error);
        }
    };

    useEffect(() => {
        if (selectedClass && academicYear) {
            // If in all branches mode, we might still want to see data or maybe not? 
            // The requirement says "should not allow to create". 
            // Often we still want to view existing ones. 
            // For now, let's allow fetching but block saving.
            fetchExistingFeeStructures();
        }
    }, [selectedClass, academicYear, selectedLocation, effectiveBranch]);

    const fetchExistingFeeStructures = async () => {
        try {
            const globalBranch = effectiveBranch;
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const response = await api.get('/class-fee-structure', {
                params: {
                    class: selectedClass,
                    academic_year: academicYear,
                    branch: branchParam,
                    location: selectedLocation // Use local state
                }
            });

            const structures = response.data.fee_structures;
            if (structures && structures.length > 0) {
                // ... same logic ...
                const newFees: FeeStructureItem[] = [];
                const existingFees: FeeStructureItem[] = [];

                structures.forEach((s: any) => {
                    const feeItem: FeeStructureItem = {
                        id: s.id, // Include database ID
                        fee_type_id: s.fee_type_id,
                        fee_type_name: s.fee_type_name,
                        total_amount: s.total_amount,
                        is_new_admission: s.is_new_admission,
                        installments: s.installments
                    };

                    if (s.is_new_admission) {
                        newFees.push(feeItem);
                    } else {
                        existingFees.push(feeItem);
                    }

                    // Update fee group if found
                    if (s.fee_group) {
                        setSelectedFeeGroup(s.fee_group);
                    }
                });

                setNewAdmissionFees(newFees);
                setExistingStudentFees(existingFees);
            } else {
                // Clear forms if no data found
                setNewAdmissionFees([]);
                setExistingStudentFees([]);
            }
        } catch (error) {
            console.error('Error fetching existing fee structures:', error);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await api.get('/classes');
            const classNames = response.data.classes.map((c: any) => c.class_name);
            setClasses(classNames);
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const addFeeToStructure = async (feeTypeId: number, totalAmount: number, isNewAdmission: boolean) => {
        if (isAllBranchesMode) {
            notify('Please select a specific branch to add fee structures.');
            return;
        }

        const feeType = feeTypes.find(ft => ft.id === feeTypeId);
        if (!feeType) return;

        // Check for duplicates
        const currentFees = isNewAdmission ? newAdmissionFees : existingStudentFees;
        if (currentFees.some(f => f.fee_type_id === feeTypeId)) {
            notify(`Fee type "${feeType.fee_type}" already exists in the list.`);
            return;
        }

        let installments: Installment[] = [];

        // Auto-generate installments for installment-type fees
        if (feeType.type === 'Installment') { // Fixed: type was 'Installment'
            try {
                // Fetch configured installments for this fee type
                const globalBranch = localStorage.getItem('currentBranch') || 'All';
                const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
                const response = await api.get('/installment-schedule', {
                    params: { fee_type_id: feeTypeId, branch: branchParam }
                });
                const configuredInstallments = response.data.installments || [];

                if (configuredInstallments.length > 0) {
                    // Use configured installments
                    const count = configuredInstallments.length;
                    const baseAmount = Math.floor((totalAmount / count) / 10) * 10;
                    const remainder = totalAmount - (baseAmount * count);

                    installments = configuredInstallments.map((inst: any, index: number) => ({
                        month: inst.title, // Use title as month/label
                        amount: index === 0 ? baseAmount + remainder : baseAmount,
                        month_order: inst.installment_no
                    }));
                } else {
                    notify('Installments not created for this fee type. Please configure installments first.');
                    return;
                }
            } catch (error) {
                console.error('Error fetching installments:', error);
                notify('Error fetching installment schedule. Please try again.');
                return;
            }
        }

        const newFee: FeeStructureItem = {
            fee_type_id: feeTypeId,
            fee_type_name: feeType.fee_type,
            total_amount: totalAmount,
            is_new_admission: isNewAdmission,
            installments
        };

        if (isNewAdmission) {
            setNewAdmissionFees([...newAdmissionFees, newFee]);
        } else {
            setExistingStudentFees([...existingStudentFees, newFee]);
        }
    };

    const removeFee = async (index: number, isNewAdmission: boolean) => {
        const fees = isNewAdmission ? newAdmissionFees : existingStudentFees;
        const feeToRemove = fees[index];

        // If the fee has an ID, it's saved in the database - delete it via API
        if (feeToRemove.id) {
            const confirmDelete = await confirmDialog(
                `Are you sure you want to delete this fee structure? This will also remove it from all students in this class.`
            );

            if (!confirmDelete) return;

            try {
                await api.delete(`/class-fee-structure/${feeToRemove.id}`);
                notify('Fee structure deleted successfully from database and student records!');
            } catch (error: any) {
                console.error('Error deleting fee structure:', error);
                notify(`Error: ${error.response?.data?.error || 'Failed to delete fee structure'}`);
                return; // Don't remove from UI if API call failed
            }
        }

        // Remove from UI state
        if (isNewAdmission) {
            setNewAdmissionFees(newAdmissionFees.filter((_, i) => i !== index));
        } else {
            setExistingStudentFees(existingStudentFees.filter((_, i) => i !== index));
        }
    };

    const recalculateInstallments = (index: number, isNewAdmission: boolean) => {
        const fees = isNewAdmission ? [...newAdmissionFees] : [...existingStudentFees];
        const fee = fees[index];

        if (fee.installments.length === 0) return;

        const totalAmount = fee.total_amount;
        const count = fee.installments.length;

        // Logic: Base = floor((Total/Count)/10)*10. First = Total - (Base*Count) + Base.
        const baseMonthly = Math.floor((totalAmount / count) / 10) * 10;
        const remainder = totalAmount - (baseMonthly * count);

        const newInstallments = fee.installments.map((inst, idx) => ({
            ...inst,
            amount: idx === 0 ? baseMonthly + remainder : baseMonthly
        }));

        fee.installments = newInstallments;

        if (isNewAdmission) {
            setNewAdmissionFees(fees);
        } else {
            setExistingStudentFees(fees);
        }
    };

    const updateInstallmentAmount = (feeIndex: number, monthIndex: number, amount: number, isNewAdmission: boolean) => {
        const fees = isNewAdmission ? [...newAdmissionFees] : [...existingStudentFees];
        fees[feeIndex].installments[monthIndex].amount = amount;

        // Update total amount based on sum of installments
        const newTotal = fees[feeIndex].installments.reduce((sum, inst) => sum + inst.amount, 0);
        fees[feeIndex].total_amount = newTotal;

        if (isNewAdmission) {
            setNewAdmissionFees(fees);
        } else {
            setExistingStudentFees(fees);
        }
    };

    const updateTotalAmount = (feeIndex: number, amount: number, isNewAdmission: boolean) => {
        const fees = isNewAdmission ? [...newAdmissionFees] : [...existingStudentFees];
        fees[feeIndex].total_amount = amount;
        
        if (isNewAdmission) {
            setNewAdmissionFees(fees);
        } else {
            setExistingStudentFees(fees);
        }
    };

    const saveFeeStructure = async () => {
        if (isAllBranchesMode) {
            notify(
                'Class Fee Structure cannot be created at All Branches level. Please select a specific branch.'
            );
            return;
        }

        if (!selectedClass || !academicYear) {
            notify('Please select class and academic year');
            return;
        }

        const allFees = [...newAdmissionFees, ...existingStudentFees];
        const globalBranch = effectiveBranch;
        const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;

        const payload = {
            class: selectedClass,
            academic_year: academicYear,
            fee_group: selectedFeeGroup,
            branch: branchParam,
            location: selectedLocation, // Explicit location
            update_assigned_students: updateAssignedStudents,
            fees: allFees.map(fee => {
                // Extract monthly amount from first installment if available
                let monthlyAmount = 0;
                if (fee.installments && fee.installments.length > 0) {
                    monthlyAmount = fee.installments[0].amount;
                }

                return {
                    id: fee.id, // Include ID for updates
                    fee_type_id: fee.fee_type_id,
                    total_amount: fee.total_amount,
                    monthly_amount: monthlyAmount,
                    is_new_admission: fee.is_new_admission,
                    installments: fee.installments,
                    location: selectedLocation // Pass location to individual item just in case (though backend uses top level mostly, but let's be safe)
                };
            })
        };

        try {
            await api.post('/class-fee-structure', payload);
            notify('Fee structure saved successfully!');
            resetForm();
        } catch (error: any) {
            console.error('Error saving fee structure:', error);
            const errorMessage = error.response?.data?.error || 'Failed to save fee structure';
            notify(`Error: ${errorMessage}`);
        }
    };

    const resetForm = () => {
        setNewAdmissionFees([]);
        setExistingStudentFees([]);
        setShowNewAdmissionForm(false);
        setShowExistingStudentForm(false);
    };

    // Copy Feature Logic
    const toggleCopyTarget = (branchId: string) => {
        const newTargets = new Set(copyTargets);
        if (newTargets.has(branchId)) {
            newTargets.delete(branchId);
        } else {
            newTargets.add(branchId);
        }
        setCopyTargets(newTargets);
    };

    const handleCopy = async () => {
        if (copyTargets.size === 0) {
            notify("Please select at least one branch to copy to.");
            return;
        }

        if (!selectedClass) {
            notify("Please select a class first.");
            return;
        }

        if (!await confirmDialog(`Are you sure you want to copy fee structure for ${selectedClass} to ${copyTargets.size} branches?\n(Merge Mode: Only missing fee types will be added)`)) {
            return;
        }

        setCopying(true);
        try {
            await api.post("/fees/copy-class-fee-structure", {
                source_branch_id: sourceBranchId,
                target_branch_ids: Array.from(copyTargets),
                academic_year: academicYear,
                class: selectedClass
            });
            notify("Fee structure copied successfully!");
            setCopyTargets(new Set()); // Reset selections
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy fee structure.");
        } finally {
            setCopying(false);
        }
    };

    // Prepare Grouped Branches for Copy
    const availableBranches = allBranches.filter(b => String(b.id) !== String(sourceBranchId) && b.name !== 'All Branches' && b.name !== 'All');
    const branchesByLocation: { [key: string]: BranchOption[] } = {};
    availableBranches.forEach(b => {
        if (!branchesByLocation[b.location_name]) {
            branchesByLocation[b.location_name] = [];
        }
        branchesByLocation[b.location_name].push(b);
    });

    return (
        <div className="container mx-auto p-6 min-h-full">
            <div className="card p-6 mb-6">
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-6">Create Class Fee Structure</h2>

                {isAllBranchesMode && (
                    <Alert tone="warning" title='Cannot create fee structure in "All Branches" mode.' className="mb-6">
                        Please select a specific branch from the header to create or modify fee structures.
                    </Alert>
                )}

                {/* Class and Academic Year Selection */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div>
                        <label className="label">Class *</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="input"
                        >
                            <option value="">Select Class</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="label">Academic Year *</label>
                        <input
                            type="text"
                            value={academicYear}
                            readOnly
                            disabled
                            className="input"
                        />
                    </div>
                </div>

                {/* Fee Structure for New Admissions */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-semibold text-slate-900">Fee for New Admissions</h3>
                        <button
                            onClick={() => setShowNewAdmissionForm(!showNewAdmissionForm)}
                            className="btn-primary"
                        >
                            {showNewAdmissionForm ? 'Cancel' : '+ Add Fee'}
                        </button>
                    </div>

                    {showNewAdmissionForm && (
                        <AddFeeForm
                            feeTypes={feeTypes}
                            onAdd={(feeTypeId, amount) => {
                                addFeeToStructure(feeTypeId, amount, true);
                                setShowNewAdmissionForm(false);
                            }}
                        />
                    )}

                    <FeeStructureTable
                        fees={newAdmissionFees}
                        onRemove={(index) => removeFee(index, true)}
                        onUpdateTotalAmount={(index, amount) => updateTotalAmount(index, amount, true)}
                        onUpdateInstallment={(feeIndex, monthIndex, amount) =>
                            updateInstallmentAmount(feeIndex, monthIndex, amount, true)
                        }
                        onRecalculate={(index) => recalculateInstallments(index, true)}
                    />
                </div>

                {/* Fee Structure for Existing Students */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-semibold text-slate-900">Fee Structure for Existing Students</h3>
                        <button
                            onClick={() => setShowExistingStudentForm(!showExistingStudentForm)}
                            className="btn-primary"
                        >
                            {showExistingStudentForm ? 'Cancel' : '+ Add Fee'}
                        </button>
                    </div>

                    {showExistingStudentForm && (
                        <AddFeeForm
                            feeTypes={feeTypes}
                            onAdd={(feeTypeId, amount) => {
                                addFeeToStructure(feeTypeId, amount, false);
                                setShowExistingStudentForm(false);
                            }}
                        />
                    )}

                    <FeeStructureTable
                        fees={existingStudentFees}
                        onRemove={(index) => removeFee(index, false)}
                        onUpdateTotalAmount={(index, amount) => updateTotalAmount(index, amount, false)}
                        onUpdateInstallment={(feeIndex, monthIndex, amount) =>
                            updateInstallmentAmount(feeIndex, monthIndex, amount, false)
                        }
                        onRecalculate={(index) => recalculateInstallments(index, false)}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-between items-center gap-4 mt-8 pt-4 border-t border-slate-100">
                    {/* Copy Section */}
                    <div>
                        {!isAllBranchesMode && selectedClass && (
                            <div className="relative" ref={copyDropdownRef}>
                                <button
                                    className="btn-primary"
                                    onClick={() => setIsCopyDropdownOpen(!isCopyDropdownOpen)}
                                >
                                    <span>Copy to Branches</span>
                                    <span className="text-xs">▼</span>
                                </button>
                                {/* Grouped Dropdown */}
                                {isCopyDropdownOpen && (
                                    <div className="card shadow-pop absolute bottom-12 left-0 w-80 z-50 p-2 max-h-96 overflow-y-auto">
                                        <div className="mb-2 text-sm font-semibold text-slate-700 pb-2 border-b border-slate-100">
                                            Select Target Branches
                                        </div>
                                        {Object.keys(branchesByLocation).length === 0 ? (
                                            <EmptyState compact title="No other branches available" />
                                        ) : (
                                            Object.keys(branchesByLocation).map(loc => (
                                                <div key={loc} className="mb-1">
                                                    {/* Header - Clean & Bold */}
                                                    <div className="text-sm font-semibold text-slate-900 px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                        {loc}
                                                    </div>
                                                    {/* Items - Indented */}
                                                    <div className="py-1">
                                                        {branchesByLocation[loc].map(b => (
                                                            <label key={b.id} className="flex items-center gap-3 px-4 py-2 hover:bg-brand-50 cursor-pointer transition-colors pl-6">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={copyTargets.has(String(b.id))}
                                                                    onChange={() => toggleCopyTarget(String(b.id))}
                                                                    className="w-4 h-4 accent-brand-600 rounded border-slate-300"
                                                                />
                                                                <span className="text-sm text-slate-700">{b.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center sticky bottom-0 bg-white">
                                            <span className="text-xs text-slate-500">{copyTargets.size} selected</span>
                                            <button
                                                onClick={handleCopy}
                                                disabled={copying || copyTargets.size === 0}
                                                className="btn-success btn-sm"
                                            >
                                                {copying ? "Copying..." : "Confirm Copy"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        <label className="flex items-center gap-2 mr-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={updateAssignedStudents}
                                onChange={(e) => setUpdateAssignedStudents(e.target.checked)}
                                className="w-4 h-4 accent-brand-600 rounded border-slate-300 cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 font-medium">Update assigned students (unpaid fees)</span>
                        </label>
                        <button
                            onClick={resetForm}
                            className="btn-secondary"
                        >
                            Reset
                        </button>
                        <button
                            onClick={saveFeeStructure}
                            className="btn-primary"
                        >
                            Save Fee Structure
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Add Fee Form Component
const AddFeeForm: React.FC<{
    feeTypes: FeeType[];
    onAdd: (feeTypeId: number, amount: number) => void;
}> = ({ feeTypes, onAdd }) => {
    const [selectedFeeType, setSelectedFeeType] = useState('');
    const [amount, setAmount] = useState('');

    const handleSubmit = () => {
        if (selectedFeeType && amount) {
            onAdd(parseInt(selectedFeeType), parseFloat(amount));
            setSelectedFeeType('');
            setAmount('');
        }
    };

    return (
        <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="label">Fee Type</label>
                    <select
                        value={selectedFeeType}
                        onChange={(e) => setSelectedFeeType(e.target.value)}
                        className="input"
                    >
                        <option value="">Select Fee Type</option>
                        {feeTypes.map(ft => (
                            <option key={ft.id} value={ft.id}>
                                {ft.fee_type} ({ft.type})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Total Amount</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="12000"
                        className="input"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        onClick={handleSubmit}
                        className="btn-success w-full"
                    >
                        Add Fee
                    </button>
                </div>
            </div>
        </div>
    );
};

const FeeStructureTable: React.FC<{
    fees: FeeStructureItem[];
    onRemove: (index: number) => void;
    onUpdateTotalAmount: (index: number, amount: number) => void;
    onUpdateInstallment: (feeIndex: number, monthIndex: number, amount: number) => void;
    onRecalculate: (index: number) => void;
}> = ({ fees, onRemove, onUpdateTotalAmount, onUpdateInstallment, onRecalculate }) => {
    const [editingTotalIndex, setEditingTotalIndex] = useState<number | null>(null);

    if (fees.length === 0) {
        return (
            <EmptyState compact title="No fees added yet" className="bg-slate-50 rounded-lg border border-slate-200" />
        );
    }

    return (
        <div className="space-y-4">
            {fees.map((fee, feeIndex) => (
                <div key={feeIndex} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-brand-50 px-4 py-3 flex flex-wrap gap-2 justify-between items-center">
                        <div>
                            <h4 className="font-semibold text-slate-900">{fee.fee_type_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-slate-600 font-medium">Total: ₹</span>
                                {editingTotalIndex === feeIndex ? (
                                    <>
                                        <input
                                            type="number"
                                            value={fee.total_amount}
                                            onChange={(e) => onUpdateTotalAmount(feeIndex, parseFloat(e.target.value) || 0)}
                                            className="input w-32"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setEditingTotalIndex(null)}
                                            className="btn btn-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        >
                                            Done
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm font-semibold">{fee.total_amount.toLocaleString()}</span>
                                        <button
                                            onClick={() => setEditingTotalIndex(feeIndex)}
                                            className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                                            title="Edit Total Amount"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {fee.installments.length > 0 && (
                                <button
                                    onClick={() => onRecalculate(feeIndex)}
                                    className="btn-warn btn-sm"
                                    title="Recalculate installments based on total amount"
                                >
                                    Recalculate
                                </button>
                            )}
                            <button
                                onClick={() => onRemove(feeIndex)}
                                className="btn-danger btn-sm"
                            >
                                Remove
                            </button>
                        </div>
                    </div>

                    {fee.installments.length > 0 && (
                        <div className="p-4 bg-white">
                            <h5 className="text-sm font-medium text-slate-700 mb-2">Monthly Installments:</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {fee.installments.map((inst, monthIndex) => (
                                    <div key={monthIndex} className="flex flex-col">
                                        <label className="label">{inst.month}</label>
                                        <input
                                            type="number"
                                            value={inst.amount}
                                            onChange={(e) => onUpdateInstallment(feeIndex, monthIndex, parseFloat(e.target.value) || 0)}
                                            className="input w-auto"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ClassFeeStructure;
