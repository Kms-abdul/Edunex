import React, { useState, useEffect } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { ActionBar, Alert, Button, EmptyState, Field, LoadingState, Steps } from './ui';
import { CopyToBranches, MoreOptions, SuccessPanel, SummaryRow, groupBranches, rupees } from './fee-setup/shared';

const STEP_TITLES = ['Choose class', 'Fees for new students', 'Fees for old students', 'Check and save'];

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

import type { BranchOption } from './fee-setup/shared';

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

    const [, setShowNewAdmissionForm] = useState(false);
    const [, setShowExistingStudentForm] = useState(false);

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

    // Screen state (presentation only)
    const [step, setStep] = useState(0);
    const [loadingStructure, setLoadingStructure] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState<{ className: string; newCount: number; oldCount: number } | null>(null);

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
        setLoadingStructure(true);
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
        } finally {
            setLoadingStructure(false);
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
            notify.warning('Choose one branch at the top of the screen first.');
            return;
        }

        const feeType = feeTypes.find(ft => ft.id === feeTypeId);
        if (!feeType) return;

        // Check for duplicates
        const currentFees = isNewAdmission ? newAdmissionFees : existingStudentFees;
        if (currentFees.some(f => f.fee_type_id === feeTypeId)) {
            notify.warning(`"${feeType.fee_type}" is already in this list.`);
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
                    notify.warning('This fee has no installments yet. Create them first under Fee setup → Installments.');
                    return;
                }
            } catch (error) {
                console.error('Error fetching installments:', error);
                notify.error('Could not load the installments for this fee. Please try again.');
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
                `Remove this fee from the class? It will also be removed from every student in this class.`
            );

            if (!confirmDelete) return;

            try {
                await api.delete(`/class-fee-structure/${feeToRemove.id}`);
                notify.success('Fee removed from this class and its students.');
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
            notify.warning('Choose a class first.');
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

        setSaving(true);
        try {
            await api.post('/class-fee-structure', payload);
            notify.success('Class fees saved.');
            setSaved({ className: selectedClass, newCount: newAdmissionFees.length, oldCount: existingStudentFees.length });
            resetForm();
        } catch (error: any) {
            console.error('Error saving fee structure:', error);
            const errorMessage = error.response?.data?.error || 'Failed to save fee structure';
            notify.error(`Could not save: ${errorMessage}`);
        } finally {
            setSaving(false);
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
            notify.warning("Choose at least one branch to copy to.");
            return;
        }

        if (!selectedClass) {
            notify.warning("Choose a class first.");
            return;
        }

        if (!await confirmDialog(`Copy Class ${selectedClass} fees to ${copyTargets.size} branch${copyTargets.size === 1 ? '' : 'es'}?\nOnly fees that are missing there will be added.`)) {
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
            notify.success("Class fees copied.");
            setCopyTargets(new Set()); // Reset selections
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy fee structure.");
        } finally {
            setCopying(false);
        }
    };

    const branchesByLocation = groupBranches(allBranches, sourceBranchId);

    const sumOf = (fees: FeeStructureItem[]) => fees.reduce((s, f) => s + (Number(f.total_amount) || 0), 0);
    const goTo = (i: number) => { setStep(i); window.scrollTo?.({ top: 0 }); };

    /* ------------------------------------------------------------ Saved */
    if (saved) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <SuccessPanel title={`Fees saved for Class ${saved.className}`}>
                    {saved.newCount} fee{saved.newCount === 1 ? '' : 's'} for new students · {saved.oldCount} fee{saved.oldCount === 1 ? '' : 's'} for old students
                </SuccessPanel>
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setSaved(null); fetchExistingFeeStructures(); goTo(1); }}>
                        Open Class {saved.className} again
                    </Button>
                    <Button size="lg" onClick={() => { setSaved(null); setSelectedClass(''); goTo(0); }}>
                        Set fees for another class
                    </Button>
                </ActionBar>
            </div>
        );
    }

    const branchWarning = isAllBranchesMode && (
        <Alert tone="warning" title="Choose a branch first">
            You are looking at all branches. Choose one branch at the top of the screen to add or change class fees.
        </Alert>
    );

    /* ------------------------------------------------------------ Step 1: class */
    if (step === 0) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={0} />
                {branchWarning}
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">Set how much each student of a class pays. Choose the class.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Class" htmlFor="cfs-class" required>
                                <select id="cfs-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                                    <option value="">Choose a class</option>
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </Field>
                            <Field label="School year">
                                <input type="text" value={academicYear} readOnly disabled className="input" />
                            </Field>
                        </div>
                        {selectedClass && (
                            loadingStructure ? <LoadingState label="Loading this class's fees…" className="py-6" /> : (
                                <p className="text-sm text-slate-600">
                                    {newAdmissionFees.length + existingStudentFees.length === 0
                                        ? `Class ${selectedClass} has no fees yet.`
                                        : `Class ${selectedClass} already has ${newAdmissionFees.length} fee(s) for new students and ${existingStudentFees.length} for old students. You can change them in the next steps.`}
                                </p>
                            )
                        )}
                    </div>
                </div>

                {!isAllBranchesMode && selectedClass && (
                    <CopyToBranches
                        what={`Class ${selectedClass} fees`}
                        note="Only fees that are missing in the other branch are added."
                        branchesByLocation={branchesByLocation}
                        selected={copyTargets}
                        onToggle={toggleCopyTarget}
                        onCopy={handleCopy}
                        copying={copying}
                        open={isCopyDropdownOpen}
                        onOpenChange={setIsCopyDropdownOpen}
                    />
                )}

                <ActionBar note={!selectedClass ? 'Choose a class first' : undefined}>
                    <Button size="lg" disabled={!selectedClass || loadingStructure} onClick={() => goTo(1)}>Next</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Steps 2 & 3: fee lists */
    if (step === 1 || step === 2) {
        const isNew = step === 1;
        const fees = isNew ? newAdmissionFees : existingStudentFees;
        return (
            <div className="max-w-4xl mx-auto space-y-4">
                <Steps steps={STEP_TITLES} current={step} onJump={goTo} />
                {branchWarning}
                <p className="text-sm text-slate-600">
                    Class <strong>{selectedClass}</strong> ·{' '}
                    {isNew ? 'Fees for students who are joining the school this year.' : 'Fees for students who were already in the school last year.'}
                </p>

                {!isAllBranchesMode && (
                    <AddFeeForm
                        key={step}
                        feeTypes={feeTypes}
                        onAdd={(feeTypeId, amount) => addFeeToStructure(feeTypeId, amount, isNew)}
                    />
                )}

                <FeeStructureTable
                    fees={fees}
                    onRemove={(index) => removeFee(index, isNew)}
                    onUpdateTotalAmount={(index, amount) => updateTotalAmount(index, amount, isNew)}
                    onUpdateInstallment={(feeIndex, monthIndex, amount) => updateInstallmentAmount(feeIndex, monthIndex, amount, isNew)}
                    onRecalculate={(index) => recalculateInstallments(index, isNew)}
                />

                <ActionBar note={fees.length > 0 ? `${fees.length} fee${fees.length === 1 ? '' : 's'} · Total ${rupees(sumOf(fees))}` : 'No fees in this list yet'}>
                    <Button variant="secondary" size="lg" onClick={() => goTo(step - 1)}>Back</Button>
                    <Button size="lg" onClick={() => goTo(step + 1)}>Next</Button>
                </ActionBar>
            </div>
        );
    }

    /* ------------------------------------------------------------ Step 4: review */
    const reviewList = (title: string, fees: FeeStructureItem[]) => (
        <div className="card">
            <div className="card-header">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <span className="text-sm font-semibold text-slate-900">{rupees(sumOf(fees))}</span>
            </div>
            <div className="px-5 py-1">
                {fees.length === 0 ? (
                    <p className="py-3 text-sm text-slate-500">No fees</p>
                ) : fees.map((f, i) => (
                    <SummaryRow key={i} label={`${f.fee_type_name || 'Fee'}${f.installments.length ? ` · ${f.installments.length} installments` : ' · one time'}`}>
                        {rupees(f.total_amount)}
                    </SummaryRow>
                ))}
            </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            <Steps steps={STEP_TITLES} current={3} onJump={goTo} />
            {branchWarning}
            <p className="text-sm text-slate-600">Check the fees for Class <strong>{selectedClass}</strong> ({academicYear}) and save.</p>

            {reviewList('New students', newAdmissionFees)}
            {reviewList('Old students', existingStudentFees)}

            <label className="flex items-start gap-3 min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white cursor-pointer">
                <input
                    type="checkbox"
                    checked={updateAssignedStudents}
                    onChange={(e) => setUpdateAssignedStudents(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-brand-600 rounded border-slate-300 cursor-pointer flex-shrink-0"
                />
                <span>
                    <span className="block text-[15px] text-slate-900">Also change fees for students already in this class</span>
                    <span className="block text-sm text-slate-500">Only fees they have not paid yet are changed.</span>
                </span>
            </label>

            <MoreOptions>
                <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={async () => {
                    if (await confirmDialog('Clear both lists on this screen? Nothing is deleted until you save.')) { resetForm(); goTo(1); }
                }}>
                    <RotateCcw className="w-4 h-4" /> Clear both lists and start again
                </button>
            </MoreOptions>

            <ActionBar note={isAllBranchesMode ? 'Choose one branch at the top of the screen to save' : undefined}>
                <Button variant="secondary" size="lg" onClick={() => goTo(2)}>Back</Button>
                <Button size="lg" onClick={saveFeeStructure} loading={saving} disabled={isAllBranchesMode}>
                    Save fees for Class {selectedClass}
                </Button>
            </ActionBar>
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
        <div className="card">
            <div className="card-body">
                <p className="text-sm font-semibold text-slate-900 mb-3">Add a fee to this list</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem_auto] gap-3 sm:items-end">
                    <Field label="Fee" htmlFor="cfs-add-type">
                        <select id="cfs-add-type" value={selectedFeeType} onChange={(e) => setSelectedFeeType(e.target.value)} className="input">
                            <option value="">Choose a fee</option>
                            {feeTypes.map(ft => (
                                <option key={ft.id} value={ft.id}>
                                    {ft.fee_type} ({ft.type === 'One-Time' ? 'one time' : 'installments'})
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Total for the year (₹)" htmlFor="cfs-add-amt">
                        <input
                            id="cfs-add-amt"
                            type="number"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                            placeholder="12000"
                            className="input"
                        />
                    </Field>
                    <button type="button" onClick={handleSubmit} disabled={!selectedFeeType || !amount} className="btn-soft min-h-[44px]">
                        <Plus className="w-4 h-4" /> Add fee
                    </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Installment fees are split equally into the months set up under Installments.</p>
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
            <div className="card">
                <EmptyState compact title="No fees in this list yet" description="Add a fee above, or go to the next step." />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {fees.map((fee, feeIndex) => (
                <div key={feeIndex} className="card overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h4 className="font-semibold text-slate-900 break-words">{fee.fee_type_name}</h4>
                                <p className="text-xs text-slate-500">
                                    {fee.installments.length > 0 ? `${fee.installments.length} installments` : 'One time'}
                                    {fee.id ? ' · saved' : ' · not saved yet'}
                                </p>
                            </div>
                            {editingTotalIndex !== feeIndex && (
                                <button
                                    type="button"
                                    onClick={() => setEditingTotalIndex(feeIndex)}
                                    className="inline-flex items-center gap-1.5 min-h-[44px] px-2 rounded-lg text-base font-semibold text-slate-900 hover:bg-white"
                                    title="Change total"
                                >
                                    {rupees(fee.total_amount)}
                                    <Pencil className="w-4 h-4 text-slate-400" />
                                </button>
                            )}
                        </div>
                        {editingTotalIndex === feeIndex && (
                            <div className="mt-2 flex items-end gap-2">
                                <Field label="Total (₹)" htmlFor={`cfs-total-${feeIndex}`} className="flex-1">
                                    <input
                                        id={`cfs-total-${feeIndex}`}
                                        type="number"
                                        inputMode="decimal"
                                        value={fee.total_amount}
                                        onChange={(e) => onUpdateTotalAmount(feeIndex, parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingTotalIndex(null); }}
                                        className="input"
                                        autoFocus
                                    />
                                </Field>
                                <button type="button" onClick={() => setEditingTotalIndex(null)} className="btn-success min-h-[44px]">Done</button>
                            </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                            {fee.installments.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onRecalculate(feeIndex)}
                                    className="btn-secondary btn-sm"
                                    title="Split the total equally into the installments again"
                                >
                                    <RotateCcw className="w-4 h-4" /> Split total equally
                                </button>
                            )}
                            <button type="button" onClick={() => onRemove(feeIndex)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" /> Remove
                            </button>
                        </div>
                    </div>

                    {fee.installments.length > 0 && (
                        <div className="p-4">
                            <p className="text-sm font-medium text-slate-700 mb-2">Amount for each installment (₹)</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {fee.installments.map((inst, monthIndex) => (
                                    <div key={monthIndex} className="min-w-0">
                                        <label htmlFor={`cfs-${feeIndex}-${monthIndex}`} className="block text-xs text-slate-600 mb-1 truncate">{inst.month}</label>
                                        <input
                                            id={`cfs-${feeIndex}-${monthIndex}`}
                                            type="number"
                                            inputMode="decimal"
                                            value={inst.amount}
                                            onChange={(e) => onUpdateInstallment(feeIndex, monthIndex, parseFloat(e.target.value) || 0)}
                                            className="input"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Changing an installment changes the total.</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ClassFeeStructure;
