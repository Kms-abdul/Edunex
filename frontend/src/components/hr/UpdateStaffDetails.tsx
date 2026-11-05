import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { StaffDocuments } from './StaffDocuments';
import { Alert, LoadingState, ActionBar, Button, Field } from '../ui';
import { PersonalFields, EmploymentFields, BankFields, SalaryFields } from '../hr-setup/StaffFormSections';

interface SelectOption {
    id: number;
    label: string;
    [key: string]: any;
}

interface Props {
    staffId: number;
    onClose: () => void;
    onSuccess: () => void;
    /** Tab to open first, e.g. 'bank', 'salary' or 'login' */
    initialTab?: string;
}

export const UpdateStaffDetails: React.FC<Props> = ({ staffId, onClose, onSuccess, initialTab }) => {
    const { user, hasPermission } = useAuth();

    const allowedBranches = (user?.allowed_branches ?? []).map((b) => ({
        branch_id: b.branch_id,
        branch_name: b.branch_name,
        branch_code: b.branch_code,
    }));

    // Permissions
    const showBankTab = hasPermission('hr.hr.staff-bank-details', 'write') || hasPermission('hr.hr.staff-payroll', 'write');
    const showSalaryTab = hasPermission('hr.hr.staff-payroll', 'write');
    const showDocumentsTab = hasPermission('hr.hr.staff-documents', 'write');
    const showLoginTab = hasPermission('hr.hr.staff-login', 'write');

    const [activeTab, setActiveTab] = useState(initialTab || 'personal');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [departments, setDepartments] = useState<SelectOption[]>([]);
    const [designations, setDesignations] = useState<SelectOption[]>([]);
    const [shifts, setShifts] = useState<SelectOption[]>([]);
    const [categories, setCategories] = useState<SelectOption[]>([]);
    const [statuses, setStatuses] = useState<SelectOption[]>([]);
    const [managers, setManagers] = useState<SelectOption[]>([]);
    const [roles, setRoles] = useState<SelectOption[]>([]);

    const [form, setForm] = useState<any>({
        branch_id: '',
        first_name: '', middle_name: '', last_name: '',
        gender: 'MALE', date_of_birth: '',
        mobile: '', email: '',
        address: '', city: '', state: '', country: '', pincode: '',
        joining_date: '', confirmation_date: '',
        employment_type: 'PERMANENT',
        staff_category_id: '', staff_status_id: '',
        department_id: '', designation_id: '', default_shift_id: '',
        reporting_manager_id: '',
        attendance_source: 'MANUAL',
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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch staff details
                const res = await api.get(`/hr/staff/${staffId}`);
                const data = res.data;

                setForm({
                    branch_id: data.branch_id ? String(data.branch_id) : '',
                    first_name: data.first_name || '',
                    middle_name: data.middle_name || '',
                    last_name: data.last_name || '',
                    gender: data.gender || 'MALE',
                    date_of_birth: data.date_of_birth || '',
                    mobile: data.mobile || '',
                    email: data.email || '',
                    address: data.address || '',
                    city: data.city || '',
                    state: data.state || '',
                    country: data.country || '',
                    pincode: data.pincode || '',
                    joining_date: data.joining_date || '',
                    confirmation_date: data.confirmation_date || '',
                    employment_type: data.employment_type || 'PERMANENT',
                    staff_category_id: data.staff_category_id ? String(data.staff_category_id) : '',
                    staff_status_id: data.staff_status_id ? String(data.staff_status_id) : '',
                    department_id: data.department_id ? String(data.department_id) : '',
                    designation_id: data.designation_id ? String(data.designation_id) : '',
                    default_shift_id: data.default_shift_id ? String(data.default_shift_id) : '',
                    reporting_manager_id: data.reporting_manager_id ? String(data.reporting_manager_id) : '',
                    attendance_source: data.attendance_source || 'MANUAL',
                });

                if (showBankTab || showSalaryTab) {
                    try {
                        const [bankRes, salaryRes] = await Promise.all([
                            api.get(`/hr/staff/${staffId}/profile/account`),
                            api.get(`/hr/staff/${staffId}/profile/salary`)
                        ]);

                        if (bankRes.data && Object.keys(bankRes.data).length > 0) {
                            setBankForm(prev => ({ ...prev, ...bankRes.data }));
                        }
                        if (salaryRes.data && Object.keys(salaryRes.data).length > 0) {
                            setSalaryForm(prev => ({ ...prev, ...salaryRes.data }));
                        }
                    } catch (e) {
                        console.error("Failed to load payroll data", e);
                    }
                }

                // Fetch masters
                const params = data.branch_id ? { branch_id: data.branch_id } : {};
                const [deptRes, desigRes, shiftRes, catRes, statusRes, mgrRes, rolesRes] = await Promise.all([
                    api.get('/hr/departments', { params }),
                    api.get('/hr/designations', { params }),
                    api.get('/hr/shifts', { params }),
                    api.get('/hr/staff-categories', { params }),
                    api.get('/hr/staff-statuses', { params }),
                    api.get('/hr/staff/managers', { params }),
                    api.get('/rbac/roles')
                ]);

                setDepartments((deptRes.data || []).map((d: any) => ({ id: d.id, label: d.department_name })));
                setDesignations((desigRes.data || []).map((d: any) => ({ id: d.id, label: d.designation_name, department_id: d.department_id })));
                setShifts((shiftRes.data || []).map((s: any) => ({ id: s.id, label: s.shift_name })));
                setCategories((catRes.data || []).map((c: any) => ({ id: c.id, label: c.category_name })));
                setStatuses((statusRes.data || []).map((s: any) => ({ id: s.id, label: s.status_name })));
                setManagers((mgrRes.data || []).map((m: any) => ({ id: m.id, label: `${m.display_name} (${m.staff_code})` })));
                setRoles((rolesRes.data?.roles || []).map((r: any) => ({ id: r.id, label: r.name || r.role_name })));

            } catch (e: any) {
                console.error(e);
                setError("Could not load this staff member. Please go back and try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [staffId, showBankTab, showSalaryTab, showDocumentsTab]);

    const filteredDesignations = form.department_id
        ? designations.filter((d) => d.department_id === Number(form.department_id))
        : designations;

    // file inputs handled by StaffDocuments now

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!form.first_name || !form.joining_date || !form.department_id || !form.designation_id || !form.staff_status_id || !form.branch_id) {
            setError('Please fill in first name, branch, joining date, department, job title and work status.');
            setActiveTab('employment');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                branch_id: form.branch_id ? Number(form.branch_id) : null,
                department_id: form.department_id ? Number(form.department_id) : null,
                designation_id: form.designation_id ? Number(form.designation_id) : null,
                default_shift_id: form.default_shift_id ? Number(form.default_shift_id) : null,
                staff_category_id: form.staff_category_id ? Number(form.staff_category_id) : null,
                staff_status_id: form.staff_status_id ? Number(form.staff_status_id) : null,
                reporting_manager_id: form.reporting_manager_id ? Number(form.reporting_manager_id) : null,
                role_id: roleId ? Number(roleId) : undefined
            };

            await api.put(`/hr/staff/${staffId}`, payload);

            if (showBankTab && (bankForm.account_number || bankForm.pan_number || bankForm.aadhaar_number)) {
                await api.put(`/hr/staff/${staffId}/profile/account`, bankForm);
            }
            if (showSalaryTab && (salaryForm.basic_salary || salaryForm.gross_salary)) {
                await api.put(`/hr/staff/${staffId}/profile/salary`, {
                    ...salaryForm,
                    basic_salary: Number(salaryForm.basic_salary) || null,
                    gross_salary: Number(salaryForm.gross_salary) || null,
                    notice_period_days: Number(salaryForm.notice_period_days) || 0
                });
            }

            // Documents upload handled by StaffDocuments component

            onSuccess();
        } catch (e: any) {
            setError(e.response?.data?.error || 'Failed to update staff details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full card max-w-[1600px] mx-auto">
                <LoadingState label="Loading staff details…" />
            </div>
        );
    }

    const tabs = [
        { id: 'personal', label: 'About the person' },
        { id: 'employment', label: 'Job details' },
        ...(showBankTab ? [{ id: 'bank', label: 'Bank and tax' }] : []),
        ...(showSalaryTab ? [{ id: 'salary', label: 'Salary' }] : []),
        ...(showDocumentsTab ? [{ id: 'documents', label: 'Documents' }] : []),
        ...(showLoginTab ? [{ id: 'login', label: 'Login and role' }] : []),
    ];

    const set = (patch: Record<string, any>) => setForm({ ...form, ...patch });
    const setBank = (patch: Record<string, any>) => setBankForm({ ...bankForm, ...patch });
    const setSalary = (patch: Record<string, any>) => setSalaryForm({ ...salaryForm, ...patch });
    const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ');

    return (
        <div className="w-full card mb-6 max-w-[1600px] mx-auto">
            <div className="card-header">
                <div className="min-w-0">
                    <p className="text-sm text-slate-500">Change details of</p>
                    <h2 className="text-base font-semibold text-slate-900 break-words">{fullName || 'Staff member'}</h2>
                </div>
                <button type="button" aria-label="Close" onClick={onClose} className="btn-icon self-start">✕</button>
            </div>

            <div className="border-b border-slate-200 px-4 py-3 sm:px-5" role="tablist" aria-label="Sections">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {tabs.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.id)}
                                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium text-center transition-colors ${active
                                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="card-body">
                {error && <Alert tone="error" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

                {activeTab === 'personal' && <PersonalFields form={form} set={set} />}

                {activeTab === 'employment' && (
                    <EmploymentFields
                        form={form}
                        set={set}
                        branches={allowedBranches}
                        branchLocked
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

                {activeTab === 'documents' && showDocumentsTab && (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">Each file is saved as soon as you upload it.</p>
                        <StaffDocuments staffId={staffId} mode="edit" />
                    </div>
                )}

                {activeTab === 'login' && showLoginTab && (
                    <Field label="Change their role" hint="Leave as it is to keep the current role.">
                        <select className="input sm:max-w-md"
                            value={roleId} onChange={e => setRoleId(e.target.value)}>
                            <option value="">Keep current role</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                    </Field>
                )}

                <ActionBar note={activeTab === 'documents' ? 'Save changes saves the other sections. Documents are already saved.' : undefined}>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={() => handleSubmit()} loading={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </ActionBar>
            </div>
        </div>
    );
};
