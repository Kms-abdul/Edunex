import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { InfoSection, InfoGrid, InfoItem, plainWord, shortDate } from '../../hr-setup/InfoParts';

interface Props {
    profile: StaffProfileData;
}

export const StaffEmploymentTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="space-y-4">
            <InfoSection title="Job">
                <InfoGrid>
                    <InfoItem label="Department" value={profile.department_name} />
                    <InfoItem label="Job title" value={profile.designation_name} />
                    <InfoItem label="Joining date" value={shortDate(profile.joining_date)} />
                    <InfoItem label="Type of job" value={plainWord(profile.employment_type)} />
                    <InfoItem label="Staff type" value={profile.staff_category_name} />
                    <InfoItem label="Work status" value={profile.staff_status_name || plainWord(profile.employment_status)} />
                </InfoGrid>
            </InfoSection>

            <InfoSection title="Branch and ID numbers">
                <InfoGrid>
                    <InfoItem label="Branch" value={profile.branch_name} />
                    <InfoItem label="Staff code" value={profile.staff_code} mono />
                    <InfoItem label="Employee ID" value={profile.employee_id} mono />
                    <InfoItem label="Attendance machine ID" value={profile.biometric_id} mono />
                </InfoGrid>
            </InfoSection>
        </div>
    );
};
