import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { InfoSection, InfoGrid, InfoItem, plainWord, shortDate } from '../../hr-setup/InfoParts';

interface Props {
    profile: StaffProfileData;
}

export const StaffOverviewTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoSection title="About the person">
                <InfoGrid>
                    <InfoItem label="Full name" value={profile.display_name} wide />
                    <InfoItem label="Gender" value={plainWord(profile.gender)} />
                    <InfoItem label="Date of birth" value={shortDate(profile.date_of_birth)} />
                    <InfoItem
                        label="Mobile number"
                        value={profile.mobile ? <a href={`tel:${String(profile.mobile).replace(/[^\d+]/g, '')}`} className="text-brand-700 hover:underline">{profile.mobile}</a> : ''}
                    />
                    <InfoItem label="Email" value={profile.email} />
                </InfoGrid>
            </InfoSection>

            <InfoSection title="Job">
                <InfoGrid>
                    <InfoItem label="Staff code" value={profile.staff_code} mono />
                    <InfoItem label="Employee ID" value={profile.employee_id} mono />
                    <InfoItem label="Department" value={profile.department_name} />
                    <InfoItem label="Job title" value={profile.designation_name} />
                    <InfoItem label="Work status" value={profile.staff_status_name || plainWord(profile.employment_status)} />
                </InfoGrid>
            </InfoSection>

            <InfoSection title="Bank and PF (summary)">
                <InfoGrid>
                    <InfoItem label="Bank" value="See the Bank tab" />
                    <InfoItem label="UAN number" value={profile.uan_no} mono />
                </InfoGrid>
            </InfoSection>

            <InfoSection title="Documents (summary)">
                <p className="text-sm text-slate-600">Open the Documents tab to see uploaded papers.</p>
            </InfoSection>
        </div>
    );
};
