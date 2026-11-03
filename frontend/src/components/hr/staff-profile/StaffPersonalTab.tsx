import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { InfoSection, InfoGrid, InfoItem, plainWord, shortDate } from '../../hr-setup/InfoParts';

interface Props {
    profile: StaffProfileData;
}

export const StaffPersonalTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="space-y-4">
            <InfoSection title="About the person">
                <InfoGrid>
                    <InfoItem label="First name" value={profile.first_name} />
                    <InfoItem label="Last name" value={profile.last_name} />
                    <InfoItem label="Gender" value={plainWord(profile.gender)} />
                    <InfoItem label="Date of birth" value={shortDate(profile.date_of_birth)} />
                    <InfoItem label="Blood group" value={profile.blood_group} />
                    <InfoItem label="Nationality" value={profile.nationality} />
                </InfoGrid>
            </InfoSection>

            <InfoSection title="Contact">
                <InfoGrid>
                    <InfoItem
                        label="Mobile number"
                        value={profile.mobile ? <a href={`tel:${String(profile.mobile).replace(/[^\d+]/g, '')}`} className="text-brand-700 hover:underline">{profile.mobile}</a> : ''}
                    />
                    <InfoItem label="Email" value={profile.email} />
                </InfoGrid>
            </InfoSection>
        </div>
    );
};
