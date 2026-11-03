import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import StaffProfile from './StaffProfile';
import { Eye, Pencil, UserPlus } from 'lucide-react';
import CreateStaffWizard from './hr/CreateStaffWizard';
import { UpdateStaffDetails } from './hr/UpdateStaffDetails';
import { Alert, Button, notify } from './ui';
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
}

interface SelectOption {
    id: number;
    label: string;
    [key: string]: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StaffMaster: React.FC<{ mode?: 'master' | 'profile' | 'update' }> = ({ mode = 'master' }) => {
    const { user, hasPermission } = useAuth();

    const canWrite = mode === 'update' ? hasPermission('hr.hr.staff-update', 'write') : hasPermission('hr.hr.staff-master', 'write');

    // ── Available branches for scoping
    // SuperAdmin/Admin see all from allowed_branches; branch-level user sees only their branch
    const allowedBranches: Array<{ branch_id: number; branch_name: string; branch_code: string }> =
        (user?.allowed_branches ?? []).map((b) => ({
            branch_id: b.branch_id,
            branch_name: b.branch_name,
            branch_code: b.branch_code,
        }));

    const isSingleBranch = allowedBranches.length <= 1;

    // ── State ─────────────────────────────────────────────────────────────────
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [departments, setDepartments] = useState<SelectOption[]>([]);
    // Options below feed the (unfinished) inline staff form; only the setters are used for now.
    const [, setDesignations] = useState<SelectOption[]>([]);
    const [, setShifts] = useState<SelectOption[]>([]);
    const [, setRoles] = useState<SelectOption[]>([]);
    const [, setCategories] = useState<SelectOption[]>([]);
    const [, setStatuses] = useState<SelectOption[]>([]);
    const [, setManagers] = useState<SelectOption[]>([]);  // reporting manager dropdown
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [viewingStaffId, setViewingStaffId] = useState<number | null>(null);
    const [editingStaffId, setEditingStaffId] = useState<number | null>(null);

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
        isUpdate?: boolean;
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
        id_generation_method: 'AUTO',
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


    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const staffRes = await api.get('/hr/staff');
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
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchMasterData(form.branch_id);
    }, [form.branch_id, fetchMasterData]);

    // ── JSX ───────────────────────────────────────────────────────────────────
    if (viewingStaffId) {
        return <StaffProfile staffId={viewingStaffId} onBack={() => setViewingStaffId(null)} />;
    }

    if (editingStaffId) {
        return (
            <UpdateStaffDetails
                staffId={editingStaffId}
                onClose={() => setEditingStaffId(null)}
                onSuccess={() => { setEditingStaffId(null); fetchData(); notify.success('Staff details saved'); }}
            />
        );
    }

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filteredStaff = staffList;

    const canView = mode !== 'update';
    const canEditRow = mode !== 'profile' && canWrite;
    const intro = mode === 'profile'
        ? 'Find a staff member and tap them to see their full profile.'
        : mode === 'update'
            ? 'Find a staff member and tap them to change their details.'
            : 'All staff of this school. Add new staff, or tap a person to see their profile.';

    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {!showForm && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm text-slate-600">{intro}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {staffList.length} staff member{staffList.length !== 1 ? 's' : ''} saved
                        </p>
                    </div>
                    {canWrite && mode === 'master' && (
                        <Button
                            id="btn-add-staff"
                            icon={<UserPlus className="w-4 h-4" />}
                            onClick={() => { setShowForm(true); setForm(blankForm); setResult(null); }}
                            className="w-full sm:w-auto"
                        >
                            Add staff
                        </Button>
                    )}
                </div>
            )}

            {/* ── Result banner ─────────────────────────────────────────────── */}
            {result && (
                <Alert tone={result.success ? 'success' : 'error'} title={result.success ? result.message : undefined} onClose={() => setResult(null)}>
                    {result.success ? (
                        <div className="mt-1 space-y-0.5">
                            {result.staff_code && <p>Staff code: <span className="font-mono font-semibold">{result.staff_code}</span></p>}
                            {result.employee_id && <p>Employee ID: <span className="font-mono font-semibold">{result.employee_id}</span></p>}
                            {result.staff_code && !result.isUpdate && <p>First password is the staff code. They must change it at first login.</p>}
                        </div>
                    ) : result.message}
                </Alert>
            )}

            {/* ── Add Staff Wizard ─────────────────────────────────────────── */}
            {showForm && canWrite && (
                <CreateStaffWizard
                    onClose={() => setShowForm(false)}
                    onSuccess={(staffId) => {
                        setShowForm(false);
                        setViewingStaffId(staffId);
                        fetchData();
                        notify.success('Staff member added. Their profile is open now.');
                    }}
                />
            )}

            {/* ── Search and list (hidden while adding) ───────────────────── */}
            {!showForm && (
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
                    onRowClick={canView ? st => setViewingStaffId(st.id) : canEditRow ? st => setEditingStaffId(st.id) : undefined}
                    actions={(canView || canEditRow) ? st => (
                        <>
                            {canView && (
                                <Button variant="secondary" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => setViewingStaffId(st.id)}>
                                    Profile
                                </Button>
                            )}
                            {canEditRow && (
                                <Button variant="soft" size="sm" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditingStaffId(st.id)}>
                                    Change details
                                </Button>
                            )}
                        </>
                    ) : undefined}
                    emptyHint={canWrite && mode === 'master' ? 'Tap \u201cAdd staff\u201d to add your first staff member.' : 'Try a different name or change the filters.'}
                />
            )}
        </div>
    );
};

export default StaffMaster;
