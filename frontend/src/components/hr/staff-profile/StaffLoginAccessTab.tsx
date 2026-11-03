import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { Badge } from '../../ui';

interface Props {
    profile: StaffProfileData;
}

export const StaffLoginAccessTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <div className="flex flex-wrap gap-2 justify-between items-center border-b border-slate-200 pb-2 mb-4">
                    <h3 className="text-base font-semibold text-slate-900">Login Account</h3>
                    <button type="button" className="btn-ghost btn-sm text-brand-600">Reset Password</button>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                            <label className="label">Username</label>
                            <p className="font-semibold text-slate-800">
                                {profile.username || (profile.email ? profile.email.split('@')[0] : (profile.first_name + '.' + (profile.last_name || '')).toLowerCase())}
                            </p>
                        </div>
                        <div>
                            <label className="label">Email</label>
                            <p className="font-semibold text-slate-800">{profile.email || '-'}</p>
                        </div>
                        <div>
                            <label className="label">Account Status</label>
                            <Badge tone={profile.account_status === 'Active' ? 'success' : 'danger'} dot>
                                {profile.account_status || 'Unknown'}
                            </Badge>
                        </div>
                        <div>
                            <label className="label">Last Login</label>
                            <p className="font-semibold text-slate-800">{profile.last_login || 'Not available'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="flex flex-wrap gap-2 justify-between items-center border-b border-slate-200 pb-2 mb-4">
                    <h3 className="text-base font-semibold text-slate-900">System Role</h3>
                    <button type="button" className="btn-ghost btn-sm text-brand-600">Change Role</button>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-5">
                    <div className="mb-4">
                        <label className="label">Current Role</label>
                        <div className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800">
                            {profile.role || 'Staff / Employee'}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Role changes are restricted based on your organizational hierarchy.</p>
                </div>
            </div>
        </div>
    );
};
