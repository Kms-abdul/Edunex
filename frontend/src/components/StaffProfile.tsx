import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon } from './icons';
import { StaffOverviewTab } from './hr/staff-profile/StaffOverviewTab';
import { StaffPersonalTab } from './hr/staff-profile/StaffPersonalTab';
import { StaffEmploymentTab } from './hr/staff-profile/StaffEmploymentTab';
import { StaffBankStatutoryTab } from './hr/staff-profile/StaffBankStatutoryTab';
import { StaffSalaryTab } from './hr/staff-profile/StaffSalaryTab';
import { StaffDocumentsTab } from './hr/staff-profile/StaffDocumentsTab';
import { StaffLoginAccessTab } from './hr/staff-profile/StaffLoginAccessTab';
import { UpdateStaffDetails } from './hr/UpdateStaffDetails';
import { Page } from '../App';
import { LoadingState, EmptyState, ErrorState } from './ui';
import { ArrowLeft, Pencil } from 'lucide-react';
import { formatTime, AttendanceStatus } from './staff/attendanceUi';

export interface StaffProfileData {
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
    gender: string;
    date_of_birth: string | null;
    joining_date: string | null;
    blood_group: string;
    nationality: string;
    qualification: string;
    uan_no: string;
    today_attendance?: {
        first_in: string | null;
        last_out: string | null;
        status: string | null;
    } | null;
    school_name: string | null;
    branch_name: string | null;
    role?: string;
    username?: string;
    account_status?: string;
    last_login?: string | null;
}

interface StaffProfileProps {
    staffId?: number;
    onBack?: () => void;
    navigateTo?: (page: Page) => void;
}

const StaffProfile: React.FC<StaffProfileProps> = ({ staffId, onBack, navigateTo }) => {
    const { hasPermission } = useAuth();
    const [profile, setProfile] = useState<StaffProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editTab, setEditTab] = useState<string | undefined>(undefined);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const endpoint = staffId ? `/hr/staff/${staffId}/profile` : '/hr/staff/profile';
            const res = await api.get(endpoint);
            setProfile(res.data);
        } catch (err: any) {
            console.error("Failed to load profile", err);
            setError("Failed to load staff profile");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [staffId]);

    if (loading) {
        return (
            <div className="card">
                <LoadingState label="Loading staff details…" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="card">
                {staffId ? (
                    <ErrorState
                        title={error ? "Couldn't load staff details" : 'Staff not found'}
                        message={error ? 'Please check your internet and try again.' : 'This staff record does not exist or has been removed.'}
                        onRetry={() => { setError(null); fetchProfile(); }}
                    />
                ) : (
                    <EmptyState
                        icon={<UserIcon className="w-6 h-6" />}
                        title="Your details are not linked yet"
                        description="Your login is not linked to a staff record yet. Please ask the HR office to link it."
                        action={onBack && <button type="button" className="btn-secondary btn-sm" onClick={onBack}>← Back</button>}
                    />
                )}
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Summary' },
        { id: 'personal', label: 'Personal' },
        { id: 'employment', label: 'Job' },
        ...(hasPermission('hr.hr.staff-bank-details', 'read') || hasPermission('hr.hr.staff-payroll', 'read') ? [{ id: 'bank', label: 'Bank & PF' }] : []),
        ...(hasPermission('hr.hr.staff-payroll', 'read') ? [{ id: 'salary', label: 'Salary' }] : []),
        ...(hasPermission('hr.hr.staff-documents', 'read') ? [{ id: 'documents', label: 'Documents' }] : []),
        ...(hasPermission('hr.hr.staff-login', 'read') ? [{ id: 'login', label: 'Login' }] : []),
    ];

    const canEditProfile = hasPermission('hr.hr.staff-update', 'write') || hasPermission('hr.hr.staff-master', 'write');
    const openEditor = (tab?: string) => { setEditTab(tab); setIsEditing(true); };
    const editHandler = (tab: string, allowed: boolean) => (canEditProfile && allowed ? () => openEditor(tab) : undefined);

    if (isEditing && profile) {
        return (
            <UpdateStaffDetails
                staffId={profile.id}
                initialTab={editTab}
                onClose={() => setIsEditing(false)}
                onSuccess={() => {
                    setIsEditing(false);
                    fetchProfile();
                }}
            />
        );
    }

    const initials = (profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`)
        .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
    const isActive = profile.staff_status_name?.toLowerCase() === 'active' || profile.employment_status?.toLowerCase() === 'active';
    const today = profile.today_attendance;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Summary first: who this is, how to reach them, today's attendance */}
            <div className="card overflow-hidden">
                <div className="p-4 sm:p-6">
                    <div className="flex items-start gap-4">
                        <div
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/10 flex items-center justify-center flex-shrink-0 text-xl sm:text-2xl font-semibold"
                            aria-hidden="true"
                        >
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug break-words">{profile.display_name}</h1>
                            <p className="text-sm text-slate-600 break-words">
                                {profile.designation_name ?? 'No designation'} · {profile.department_name ?? 'No department'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={isActive ? 'badge-success' : 'badge-neutral'}>
                                    {profile.staff_status_name ?? profile.employment_status}
                                </span>
                                <span className="badge-brand">{profile.staff_code}</span>
                                {profile.employee_id && (
                                    <span className="badge-neutral">Employee number {profile.employee_id}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                            <dt className="text-xs text-slate-500">Phone</dt>
                            <dd className="font-medium text-slate-900">
                                {profile.mobile ? <a href={`tel:${profile.mobile}`} className="text-brand-700 hover:underline">{profile.mobile}</a> : '—'}
                            </dd>
                        </div>
                        {profile.branch_name && (
                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                <dt className="text-xs text-slate-500">Branch</dt>
                                <dd className="font-medium text-slate-900 break-words">{profile.branch_name}</dd>
                            </div>
                        )}
                        {today !== undefined && (
                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                <dt className="text-xs text-slate-500">Today</dt>
                                <dd className="font-medium text-slate-900 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    {today ? (
                                        <>
                                            <span>In {formatTime(today.first_in)} · Out {formatTime(today.last_out)}</span>
                                            <AttendanceStatus status={today.status} />
                                        </>
                                    ) : (
                                        <span className="text-slate-600">No in / out time yet</span>
                                    )}
                                </dd>
                            </div>
                        )}
                    </dl>

                    {((hasPermission('hr.hr.staff-update', 'write') || hasPermission('hr.hr.staff-master', 'write')) || onBack) && (
                        <div className="mt-4 grid grid-cols-1 sm:flex gap-2">
                            {(hasPermission('hr.hr.staff-update', 'write') || hasPermission('hr.hr.staff-master', 'write')) && (
                                <button type="button" onClick={() => openEditor()} className="btn-primary min-h-[44px]">
                                    <Pencil className="w-4 h-4" /> Edit details
                                </button>
                            )}
                            {onBack && (
                                <button type="button" onClick={onBack} className="btn-secondary min-h-[44px]">
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs: a strip that scrolls sideways on phones, big enough to tap */}
                <div className="border-t border-slate-200 px-2 sm:px-4 py-2">
                    <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Staff details sections">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0
                                    ${activeTab === tab.id
                                        ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="card p-4 sm:p-6 md:p-8">
                {activeTab === 'overview' && <StaffOverviewTab profile={profile} />}
                {activeTab === 'personal' && <StaffPersonalTab profile={profile} />}
                {activeTab === 'employment' && <StaffEmploymentTab profile={profile} />}
                {activeTab === 'bank' && <StaffBankStatutoryTab profile={profile} onEdit={editHandler('bank', hasPermission('hr.hr.staff-bank-details', 'write') || hasPermission('hr.hr.staff-payroll', 'write'))} />}
                {activeTab === 'salary' && <StaffSalaryTab profile={profile} onEdit={editHandler('salary', hasPermission('hr.hr.staff-payroll', 'write'))} />}
                {activeTab === 'documents' && <StaffDocumentsTab profile={profile} />}
                {activeTab === 'login' && (
                    <StaffLoginAccessTab
                        profile={profile}
                        onChangeRole={editHandler('login', hasPermission('hr.hr.staff-login', 'write'))}
                        onResetPassword={navigateTo && hasPermission('system.users.management', 'write') ? () => navigateTo('user-management') : undefined}
                    />
                )}
            </div>
        </div>
    );
};

export default StaffProfile;
