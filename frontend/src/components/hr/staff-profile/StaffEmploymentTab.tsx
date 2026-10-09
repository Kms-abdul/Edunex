import React from 'react';
import { StaffProfileData } from '../../StaffProfile';

interface Props {
    profile: StaffProfileData;
}

export const StaffEmploymentTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">Organization</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="label">Branch</label>
                        <p className="font-semibold text-slate-800">{profile.branch_name || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Staff Code</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.staff_code}</p>
                    </div>
                    <div>
                        <label className="label">Employee ID</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.employee_id || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Biometric ID</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.biometric_id || '-'}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-4">Job Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="label">Department</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.department_name || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Designation</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.designation_name || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Joining Date</label>
                        <p className="font-semibold text-slate-800">
                            {profile.joining_date ? new Date(profile.joining_date).toLocaleDateString('en-GB') : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="label">Employment Type</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.employment_type || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Staff Category</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.staff_category_name || '-'}</p>
                    </div>
                    <div>
                        <label className="label">Status</label>
                        <p className="font-semibold text-slate-800 uppercase">{profile.staff_status_name || profile.employment_status}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
