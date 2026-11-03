import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import StaffProfile from './StaffProfile';
import { Eye } from 'lucide-react';
import { Alert, Button } from './ui';
import StaffListView from './hr-setup/StaffListView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Staff {
    id: number;
    staff_code: string;
    employee_id: string | null;
    biometric_id: string | null;
    first_name: string;
    last_name: string;
    display_name: string;
    department_name: string | null;
    designation_name: string | null;
    staff_category_name: string | null;
    staff_status_name: string | null;
    employment_type: string;
    employment_status: string;
    mobile: string | null;
    email: string | null;
    joining_date: string | null;
    branch_id: number | null;
    branch_name: string | null;
    school_name: string | null;
}

interface SelectOption {
    id: number;
    label: string;
    [key: string]: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffDirectory() {
    const { user } = useAuth();

    // ── Available branches for scoping
    // SuperAdmin/Admin see all from allowed_branches; branch-level user sees only their branch
    const currentSchoolId = localStorage.getItem('currentSchoolId') || String(user?.school_id || '');
    const allowedBranches: Array<{ branch_id: number; branch_name: string; branch_code: string }> =
        (user?.allowed_branches ?? [])
            .filter((b: any) => {
                if (currentSchoolId && currentSchoolId !== 'All' && currentSchoolId !== 'null') {
                    return String(b.school_id) === currentSchoolId;
                }
                return true;
            })
            .map((b: any) => ({
                branch_id: b.branch_id,
                branch_name: b.branch_name,
                branch_code: b.branch_code,
            }));

    const isSingleBranch = allowedBranches.length <= 1;

    // ── State ─────────────────────────────────────────────────────────────────
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [departments, setDepartments] = useState<SelectOption[]>([]);
    // Options/flags below belong to the (unfinished) inline add/edit form; only the setters are used for now.
    const [, setDesignations] = useState<SelectOption[]>([]);
    const [, setShifts] = useState<SelectOption[]>([]);
    const [, setRoles] = useState<SelectOption[]>([]);
    const [, setCategories] = useState<SelectOption[]>([]);
    const [, setStatuses] = useState<SelectOption[]>([]);
    const [, setManagers] = useState<SelectOption[]>([]);  // reporting manager dropdown
    const [loading, setLoading] = useState(false);
    const [, setSaving] = useState(false);
    const [, setShowForm] = useState(false);
    const [viewingStaffId, setViewingStaffId] = useState<number | null>(null);

    // ── Advanced Search State
    const [searchBranchId, setSearchBranchId] = useState<string>('');
    const [searchDeptId, setSearchDeptId] = useState<string>('');
    const [searchStatus, setSearchStatus] = useState<string>('');
    const [searchBy, setSearchBy] = useState<string>('staff_code');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [result, setResult] = useState<{
        success: boolean;
        staff_code?: string;
        employee_id?: string;
        biometric_id?: string;
        message: string;
    } | null>(null);

    // ── Form state ────────────────────────────────────────────────────────────
    const blankForm: any = {
        id: null,
        // Branch
        branch_id: isSingleBranch && allowedBranches[0] ? String(allowedBranches[0].branch_id) : '',
        // Personal
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'MALE',
        date_of_birth: '',
        // Contact
        mobile: '',
        email: '',
        address: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        // Employment
        joining_date: '',
        confirmation_date: '',
        employment_type: 'PERMANENT',
        staff_category_id: '',
        staff_status_id: '',
        department_id: '',
        designation_id: '',
        default_shift_id: '',
        attendance_source: 'MANUAL',
        // System access
        role_id: '',
        // Identifiers
        staff_code: '',
        employee_id: '',
        biometric_id: '',
        reporting_manager_id: '',
    };

    const [form, setForm] = useState(blankForm);

    // ── Data fetching ─────────────────────────────────────────────────────────
    const fetchMasterData = useCallback(async (branchId?: string) => {
        try {
            const params = branchId ? { branch_id: branchId } : {};
            const [deptRes, desigRes, shiftRes, catRes, statusRes, mgrRes] = await Promise.all([
                api.get('/hr/departments', { params }),
                api.get('/hr/designations', { params }),
                api.get('/hr/shifts', { params }),
                api.get('/hr/staff-categories', { params }),
                api.get('/hr/staff-statuses', { params }),
                api.get('/hr/staff/managers', { params }),
            ]);

            setDepartments(
                (deptRes.data || []).map((d: any) => ({
                    id: d.id,
                    // Show numeric code in label so HR knows what code to set in dept master
                    label: d.department_numeric_code
                        ? `${d.department_name} (${d.department_numeric_code})`
                        : d.department_name,
                    numeric_code: d.department_numeric_code,
                }))
            );
            setDesignations(
                (desigRes.data || []).map((d: any) => ({
                    id: d.id,
                    label: d.designation_name,
                    department_id: d.department_id,
                }))
            );
            setShifts(
                (shiftRes.data || []).map((s: any) => ({
                    id: s.id,
                    label: `${s.shift_name} (${s.start_time}–${s.end_time})`,
                }))
            );
            setCategories(
                (catRes.data || []).map((c: any) => ({ id: c.id, label: c.category_name }))
            );
            setStatuses(
                (statusRes.data || []).map((s: any) => ({ id: s.id, label: s.status_name }))
            );
            setManagers(
                (mgrRes.data || []).map((m: any) => ({
                    id: m.id,
                    label: m.display_name,
                    // Extra context for the dropdown option
                    sublabel: [m.designation_name, m.staff_code].filter(Boolean).join(' · '),
                    department_id: m.department_id
                }))
            );
        } catch (e) {
            console.error('Failed to load HR master data', e);
        }
    }, []);


    const fetchData = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (searchBranchId) params.branch_id = searchBranchId;
            if (searchDeptId) params.department_id = searchDeptId;
            if (searchStatus) params.status = searchStatus;
            if (searchQuery) {
                params.search_by = searchBy;
                params.search_query = searchQuery;
            }

            const staffRes = await api.get('/hr/staff', { params });
            setStaffList(staffRes.data || []);

            try {
                const roleRes = await api.get('/rbac/roles');
                setRoles((roleRes.data?.roles || []).map((r: any) => ({ id: r.id, label: r.name || r.role_name })));
            } catch (roleErr) {
                console.warn('Failed to load roles, ignoring.', roleErr);
            }
        } catch (e) {
            console.error('Failed to load HR data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchMasterData(form.branch_id);
    }, [form.branch_id, fetchMasterData]);

    // NOTE: handleEdit / handleSubmit belong to an unfinished inline add/edit staff form that is
    // not rendered yet. They are intentionally kept (see `void` reference below).
    const handleEdit = async (staffId: number) => {
        setResult(null);
        try {
            const res = await api.get(`/hr/staff/${staffId}`);
            const data = res.data;
            setForm({
                id: data.id,
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
                attendance_source: data.attendance_source || 'MANUAL',
                role_id: '', // Exclude role_id when editing
                staff_code: data.staff_code || '',
                employee_id: data.employee_id || '',
                biometric_id: data.biometric_id || '',
                reporting_manager_id: data.reporting_manager_id ? String(data.reporting_manager_id) : '',
            });
            setShowForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            console.error("Failed to load staff details", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setResult(null);
        try {
            const payload = {
                ...form,
                branch_id: form.branch_id ? Number(form.branch_id) : null,
                department_id: form.department_id ? Number(form.department_id) : null,
                designation_id: form.designation_id ? Number(form.designation_id) : null,
                default_shift_id: form.default_shift_id ? Number(form.default_shift_id) : null,
                staff_category_id: form.staff_category_id ? Number(form.staff_category_id) : null,
                staff_status_id: form.staff_status_id ? Number(form.staff_status_id) : null,
                role_id: form.role_id ? Number(form.role_id) : null,
                reporting_manager_id: form.reporting_manager_id ? Number(form.reporting_manager_id) : null,
            };

            let res;
            if (form.id) {
                res = await api.put(`/hr/staff/${form.id}`, payload);
            } else {
                res = await api.post('/hr/staff', payload);
            }

            setResult({
                success: true,
                staff_code: res.data.staff_code,
                employee_id: res.data.employee_id,
                biometric_id: res.data.biometric_id,
                message: res.data.message,
            });
            setForm(blankForm);
            setShowForm(false);
            fetchData();
        } catch (e: any) {
            setResult({
                success: false,
                message: e.response?.data?.error || 'Failed to save staff. Please try again.',
            });
        } finally {
            setSaving(false);
        }
    };

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filteredStaff = staffList;

    void handleEdit;
    void handleSubmit;

    // ── JSX ───────────────────────────────────────────────────────────────────
    if (viewingStaffId) {
        return <StaffProfile staffId={viewingStaffId} onBack={() => setViewingStaffId(null)} />;
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">
                Find a staff member by name, code or mobile number. Tap a person to open their profile.
            </p>

            {/* ── Result banner (from the unfinished inline form) ───────────── */}
            {result && (
                <Alert tone={result.success ? 'success' : 'error'} title={result.success ? result.message : undefined} onClose={() => setResult(null)}>
                    {result.success ? (
                        <div className="mt-1 space-y-0.5">
                            {result.staff_code && <p>Staff code: <span className="font-mono font-semibold">{result.staff_code}</span></p>}
                            {result.employee_id && <p>Employee ID: <span className="font-mono font-semibold">{result.employee_id}</span></p>}
                            {result.staff_code && <p>First password is the staff code. They must change it at first login.</p>}
                        </div>
                    ) : result.message}
                </Alert>
            )}

            <StaffListView
                rows={filteredStaff}
                loading={loading}
                onSearch={fetchData}
                filters={{
                    branchId: searchBranchId, setBranchId: setSearchBranchId,
                    deptId: searchDeptId, setDeptId: setSearchDeptId,
                    status: searchStatus, setStatus: setSearchStatus,
                    searchBy, setSearchBy,
                    query: searchQuery, setQuery: setSearchQuery,
                }}
                departments={departments}
                branches={allowedBranches}
                showBranchFilter={!isSingleBranch}
                showSchool
                onRowClick={st => setViewingStaffId(st.id)}
                actions={st => (
                    <Button variant="soft" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewingStaffId(st.id)}>
                        Open profile
                    </Button>
                )}
                emptyHint="Try a different name or change the filters."
            />
        </div>
    );
};
