import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Alert, Spinner, Steps, ActionBar, Button, Field } from '../ui';
import { PersonalFields, EmploymentFields, BankFields, SalaryFields, ReviewRow, labelOf } from '../hr-setup/StaffFormSections';

interface CreateStaffWizardProps {
    onClose: () => void;
    onSuccess: (staffId: number) => void;
}

interface SelectOption {
    id: number;
    label: string;
    [key: string]: any;
}

const CreateStaffWizard: React.FC<CreateStaffWizardProps> = ({ onClose, onSuccess }) => {
    const { user, hasPermission } = useAuth();
    
    const allowedBranches = (user?.allowed_branches ?? []).map((b) => ({
        branch_id: b.branch_id,
        branch_name: b.branch_name,
        branch_code: b.branch_code,
    }));
    const isSingleBranch = allowedBranches.length <= 1;

    // Permissions
    const showBankTab = hasPermission('hr.hr.staff-bank-details', 'write') || hasPermission('hr.hr.staff-payroll', 'write');
    const showSalaryTab = hasPermission('hr.hr.staff-payroll', 'write');
    const showLoginTab = hasPermission('hr.hr.staff-login', 'write');

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [form, setForm] = useState({
        branch_id: isSingleBranch && allowedBranches[0] ? String(allowedBranches[0].branch_id) : '',
        first_name: '', middle_name: '', last_name: '',
        gender: 'MALE', date_of_birth: '',
        mobile: '', email: '',
        address: '', city: '', state: '', country: '', pincode: '',
        joining_date: '',
        employment_type: 'PERMANENT',
        staff_category_id: '', staff_status_id: '',
        department_id: '', designation_id: '', default_shift_id: '',
        reporting_manager_id: '', attendance_source: 'MANUAL',
        id_generation_method: 'AUTO',
        staff_code: '', employee_id: '', biometric_id: ''
    });

    const [bankForm, setBankForm] = useState({
        account_holder_name: '', bank_name: '', branch_name: '',
        account_number: '', ifsc_code: '', account_type: 'SAVINGS',
        upi_id: '', pan_number: '', aadhaar_number: '',
        pf_applicable: false, pf_number: '',
        esi_applicable: false, esi_number: '',
        pt_applicable: false, tds_applicable: false
    });

    const [salaryForm, setSalaryForm] = useState({
        salary_type: 'MONTHLY', basic_salary: '', gross_salary: '',
        payment_mode: 'BANK_TRANSFER', effective_from: '',
        payroll_status: 'ACTIVE', gratuity_applicable: false,
        bonus_applicable: false, overtime_applicable: false,
        notice_period_days: '30', payroll_remarks: ''
    });

    const [roleId, setRoleId] = useState<string>('');

    const [departments, setDepartments] = useState<SelectOption[]>([]);
    const [designations, setDesignations] = useState<SelectOption[]>([]);
    const [categories, setCategories] = useState<SelectOption[]>([]);
    const [statuses, setStatuses] = useState<SelectOption[]>([]);
    const [shifts, setShifts] = useState<SelectOption[]>([]);
    const [managers, setManagers] = useState<SelectOption[]>([]);
    const [roles, setRoles] = useState<SelectOption[]>([]);

    useEffect(() => {
        const fetchMasterData = async () => {
            setLoading(true);
            try {
                const params = form.branch_id ? { branch_id: form.branch_id } : {};
                const [deptRes, desigRes, catRes, statusRes, shiftRes, mgrRes, rolesRes] = await Promise.all([
                    api.get('/hr/departments', { params }),
                    api.get('/hr/designations', { params }),
                    api.get('/hr/staff-categories', { params }),
                    api.get('/hr/staff-statuses', { params }),
                    api.get('/hr/shifts', { params }),
                    api.get('/hr/staff/managers', { params }),
                    api.get('/rbac/roles')
                ]);
                setDepartments((deptRes.data || []).map((d: any) => ({ id: d.id, label: d.department_name })));
                setDesignations((desigRes.data || []).map((d: any) => ({ id: d.id, label: d.designation_name, department_id: d.department_id })));
                setCategories((catRes.data || []).map((c: any) => ({ id: c.id, label: c.category_name })));
                setStatuses((statusRes.data || []).map((s: any) => ({ id: s.id, label: s.status_name })));
                setShifts((shiftRes.data || []).map((s: any) => ({ id: s.id, label: s.shift_name })));
                setManagers((mgrRes.data || []).map((m: any) => ({ id: m.id, label: `${m.display_name} (${m.staff_code})` })));
                setRoles((rolesRes.data?.roles || []).map((r: any) => ({ id: r.id, label: r.name || r.role_name })));
            } catch (err) {
                console.error(err);
                setError('Could not load the lists (departments, job titles…). Please check the internet and try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchMasterData();
    }, [form.branch_id]);

    const filteredDesignations = form.department_id
        ? designations.filter((d) => d.department_id === Number(form.department_id))
        : designations;

    const handleSubmit = async () => {
        if (!form.first_name || !form.joining_date || !form.department_id || !form.designation_id || !form.staff_status_id || !form.branch_id) {
            setError('Please fill in first name, branch, joining date, department, job title and work status.');
            setActiveTab('employment');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            // 1. Create Staff
            const payload = {
                ...form,
                role_id: roleId ? Number(roleId) : undefined
            };
            const staffRes = await api.post('/hr/staff', payload);
            if (!staffRes.data.staff_id) {
                throw new Error(staffRes.data.message || 'Failed to create staff');
            }
            
            const staffId = staffRes.data.staff_id;

            // 2. Save Bank Details
            if (showBankTab && Object.keys(bankForm).length > 0) {
                await api.put(`/hr/staff/${staffId}/profile/account`, bankForm);
            }
            
            // 3. Save Salary Details
            if (showSalaryTab && (salaryForm.basic_salary || salaryForm.gross_salary)) {
                await api.put(`/hr/staff/${staffId}/profile/salary`, {
                    ...salaryForm,
                    basic_salary: Number(salaryForm.basic_salary) || null,
                    gross_salary: Number(salaryForm.gross_salary) || null,
                    notice_period_days: Number(salaryForm.notice_period_days) || 0
                });
            }

            onSuccess(staffId);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Error creating staff record');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'personal', label: 'About the person' },
        { id: 'employment', label: 'Job details' },
        ...(showBankTab ? [{ id: 'bank', label: 'Bank and tax' }] : []),
        ...(showSalaryTab ? [{ id: 'salary', label: 'Salary' }] : []),
        ...(showLoginTab ? [{ id: 'login', label: 'Login' }] : []),
        { id: 'review', label: 'Check and save' },
    ];
    const stepIndex = Math.max(0, tabs.findIndex(t => t.id === activeTab));
    const isLast = stepIndex === tabs.length - 1;
    const goTo = (i: number) => {
        setActiveTab(tabs[i].id);
        document.getElementById('create-staff-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const set = (patch: Record<string, any>) => setForm({ ...form, ...patch });
    const setBank = (patch: Record<string, any>) => setBankForm({ ...bankForm, ...patch });
    const setSalary = (patch: Record<string, any>) => setSalaryForm({ ...salaryForm, ...patch });

    // What is still missing on the current step (same rules as handleSubmit)
    const missing: string[] = [];
    if (activeTab === 'personal' && !form.first_name) missing.push('first name');
    if (activeTab === 'employment') {
        if (!form.branch_id) missing.push('branch');
        if (!form.joining_date) missing.push('joining date');
        if (!form.department_id) missing.push('department');
        if (!form.designation_id) missing.push('job title');
        if (!form.staff_status_id) missing.push('work status');
    }
    const canGoNext = missing.length === 0;

    const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ');
    const branchName = allowedBranches.find(b => String(b.branch_id) === String(form.branch_id))?.branch_name || '';
    const typeLabel: Record<string, string> = { PERMANENT: 'Permanent', CONTRACT: 'Contract', PROBATION: 'Probation', INTERN: 'Intern' };

    return (
        <div id="create-staff-top" className="w-full card mb-6 max-w-[1600px] mx-auto scroll-mt-4">
            <div className="card-header">
                <div className="min-w-0 flex-1">
                    <Steps steps={tabs.map(t => t.label)} current={stepIndex} onJump={goTo} />
                </div>
                <button type="button" aria-label="Close" onClick={onClose} className="btn-icon self-start">✕</button>
            </div>

            <div className="card-body">
                {loading && <p className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500"><Spinner size="sm" /> Loading lists…</p>}
                {error && <Alert tone="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

                {activeTab === 'personal' && <PersonalFields form={form} set={set} />}

                {activeTab === 'employment' && (
                    <EmploymentFields
                        form={form}
                        set={set}
                        branches={allowedBranches}
                        departments={departments}
                        designations={filteredDesignations}
                        categories={categories}
                        statuses={statuses}
                        shifts={shifts}
                        managers={managers}
                    />
                )}

                {activeTab === 'bank' && showBankTab && <BankFields bankForm={bankForm} set={setBank} />}

                {activeTab === 'salary' && showSalaryTab && <SalaryFields salaryForm={salaryForm} set={setSalary} />}

                {activeTab === 'login' && showLoginTab && (
                    <div className="space-y-4">
                        <Alert tone="info" title="A login is made automatically">
                            The username and the first password are both the staff code. They must change the password the first time they log in.
                        </Alert>
                        <Field label="What can they do in the app? (role, optional)">
                            <select className="input sm:max-w-md"
                                value={roleId} onChange={e => setRoleId(e.target.value)}>
                                <option value="">Choose a role (optional)</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                        </Field>
                    </div>
                )}

                {activeTab === 'review' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Please check the details. Tap <span className="font-medium">Change</span> to fix anything.
                        </p>
                        <ReviewBlock title="About the person" onEdit={() => setActiveTab('personal')}>
                            <ReviewRow label="Name" value={fullName} />
                            <ReviewRow label="Gender" value={form.gender === 'FEMALE' ? 'Female' : 'Male'} />
                            <ReviewRow label="Date of birth" value={form.date_of_birth} />
                            <ReviewRow label="Mobile" value={form.mobile} />
                            <ReviewRow label="Email" value={form.email} />
                        </ReviewBlock>
                        <ReviewBlock title="Job details" onEdit={() => setActiveTab('employment')}>
                            <ReviewRow label="Branch" value={branchName} />
                            <ReviewRow label="Joining date" value={form.joining_date} />
                            <ReviewRow label="Type of job" value={typeLabel[form.employment_type] || form.employment_type} />
                            <ReviewRow label="Department" value={labelOf(departments, form.department_id)} />
                            <ReviewRow label="Job title" value={labelOf(designations, form.designation_id)} />
                            <ReviewRow label="Staff type" value={labelOf(categories, form.staff_category_id)} />
                            <ReviewRow label="Work status" value={labelOf(statuses, form.staff_status_id)} />
                            <ReviewRow label="Shift" value={labelOf(shifts, form.default_shift_id)} />
                            <ReviewRow label="Reports to" value={labelOf(managers, form.reporting_manager_id)} />
                        </ReviewBlock>
                        {showBankTab && (
                            <ReviewBlock title="Bank and tax" onEdit={() => setActiveTab('bank')}>
                                <ReviewRow label="Account number" value={bankForm.account_number} />
                                <ReviewRow label="IFSC code" value={bankForm.ifsc_code} />
                                <ReviewRow label="Bank name" value={bankForm.bank_name} />
                                <ReviewRow label="PAN" value={bankForm.pan_number} />
                            </ReviewBlock>
                        )}
                        {showSalaryTab && (
                            <ReviewBlock title="Salary" onEdit={() => setActiveTab('salary')}>
                                <ReviewRow label="Basic salary" value={salaryForm.basic_salary ? `₹${salaryForm.basic_salary}` : ''} />
                                <ReviewRow label="Gross salary" value={salaryForm.gross_salary ? `₹${salaryForm.gross_salary}` : ''} />
                                <ReviewRow label="Starts from" value={salaryForm.effective_from} />
                            </ReviewBlock>
                        )}
                        {showLoginTab && (
                            <ReviewBlock title="Login" onEdit={() => setActiveTab('login')}>
                                <ReviewRow label="Role" value={labelOf(roles, roleId) || 'No role chosen'} />
                            </ReviewBlock>
                        )}
                    </div>
                )}

                <ActionBar
                    note={!canGoNext
                        ? `Please fill in: ${missing.join(', ')}.`
                        : isLast ? 'A staff code and login are made when you save.' : undefined}
                >
                    <Button variant="secondary" disabled={saving} onClick={() => (stepIndex === 0 ? onClose() : goTo(stepIndex - 1))}>
                        {stepIndex === 0 ? 'Cancel' : 'Back'}
                    </Button>
                    {isLast ? (
                        <Button onClick={handleSubmit} loading={saving}>
                            {saving ? 'Saving…' : 'Create staff'}
                        </Button>
                    ) : (
                        <Button onClick={() => goTo(stepIndex + 1)} disabled={!canGoNext}>
                            Next
                        </Button>
                    )}
                </ActionBar>
            </div>
        </div>
    );
};

const ReviewBlock: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({ title, onEdit, children }) => (
    <section className="rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <button type="button" onClick={onEdit} className="btn-ghost btn-sm text-brand-700">Change</button>
        </div>
        <dl className="px-4 py-1">{children}</dl>
    </section>
);

export default CreateStaffWizard;
