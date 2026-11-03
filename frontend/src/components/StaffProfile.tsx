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
    const { user, hasPermission } = useAuth();
    const [profile, setProfile] = useState<StaffProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [isEditing, setIsEditing] = useState(false);

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
            <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error || "Profile not found."}
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'personal', label: 'Personal' },
        { id: 'employment', label: 'Employment' },
        ...(hasPermission('hr.hr.staff-bank', 'read') || hasPermission('hr.hr.staff-payroll', 'read') ? [{ id: 'bank', label: 'Bank & Statutory' }] : []),
        ...(hasPermission('hr.hr.staff-payroll', 'read') ? [{ id: 'salary', label: 'Salary & Payroll' }] : []),
        ...(hasPermission('hr.hr.staff-documents', 'read') || true ? [{ id: 'documents', label: 'Documents' }] : []),
        ...(hasPermission('hr.hr.staff-login', 'read') || true ? [{ id: 'login', label: 'Login & Access' }] : []),
    ];

    if (isEditing && profile) {
        return (
            <UpdateStaffDetails
                staffId={profile.id}
                onClose={() => setIsEditing(false)}
                onSuccess={() => {
                    setIsEditing(false);
                    fetchProfile();
                }}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="card overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-brand-600 to-brand-800 relative">
                    <div className="absolute top-4 right-6 flex gap-3">
                        {(hasPermission('hr.hr.staff-update', 'write') || hasPermission('hr.hr.staff-master', 'write')) && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-sm font-semibold text-white bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition"
                            >
                                Edit Profile
                            </button>
                        )}
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="text-sm font-semibold text-white bg-black/20 hover:bg-black/30 px-4 py-1.5 rounded-lg transition"
                            >
                                ← Back
                            </button>
                        )}
                    </div>
                </div>
                <div className="px-6 md:px-8 pb-6 relative">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center flex-shrink-0 shadow-md -mt-12 z-10 relative">
                            <UserIcon className="w-12 h-12 text-slate-400" />
                        </div>

                        <div className="flex-1 pt-2 md:pt-4">
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight uppercase">{profile.display_name}</h1>
                            <p className="text-slate-500 font-medium">
                                {profile.designation_name ?? 'No Designation'} • {profile.department_name ?? 'No Department'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <span className="badge-brand">{profile.staff_code}</span>
                                {profile.employee_id && (
                                    <span className="badge-neutral">ID: {profile.employee_id}</span>
                                )}
                                <span className={
                                    profile.staff_status_name?.toLowerCase() === 'active' || profile.employment_status.toLowerCase() === 'active'
                                        ? 'badge-success'
                                        : 'badge-neutral'
                                }>
                                    {profile.staff_status_name ?? profile.employment_status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-t border-slate-200 px-6 md:px-8">
                    <div className="flex overflow-x-auto hide-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="card p-6 md:p-8">
                {activeTab === 'overview' && <StaffOverviewTab profile={profile} />}
                {activeTab === 'personal' && <StaffPersonalTab profile={profile} />}
                {activeTab === 'employment' && <StaffEmploymentTab profile={profile} />}
                {activeTab === 'bank' && <StaffBankStatutoryTab profile={profile} />}
                {activeTab === 'salary' && <StaffSalaryTab profile={profile} />}
                {activeTab === 'documents' && <StaffDocumentsTab profile={profile} />}
                {activeTab === 'login' && <StaffLoginAccessTab profile={profile} />}
            </div>
        </div>
    );
};

export default StaffProfile;
