import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { Badge } from '../../ui';
import { InfoSection, InfoGrid, InfoItem, SectionAction } from '../../hr-setup/InfoParts';

interface Props {
    profile: StaffProfileData;
    /** Opens User Management, where admins set a new password; hidden when not provided */
    onResetPassword?: () => void;
    /** Opens the staff edit form on the Login & Access tab; hidden when not provided */
    onChangeRole?: () => void;
}

export const StaffLoginAccessTab: React.FC<Props> = ({ profile, onResetPassword, onChangeRole }) => {
    return (
        <div className="space-y-4">
            <InfoSection
                title="Login account"
                action={onResetPassword && <SectionAction onClick={onResetPassword}>Set a new password</SectionAction>}
            >
                <InfoGrid>
                    <InfoItem
                        label="Username"
                        value={profile.username || (profile.email ? profile.email.split('@')[0] : (profile.first_name + '.' + (profile.last_name || '')).toLowerCase())}
                    />
                    <InfoItem label="Email" value={profile.email} />
                    <InfoItem
                        label="Can log in?"
                        value={
                            <Badge tone={profile.account_status === 'Active' ? 'success' : 'danger'} dot>
                                {profile.account_status || 'Unknown'}
                            </Badge>
                        }
                    />
                    <InfoItem label="Last logged in" value={profile.last_login || 'Not available'} />
                </InfoGrid>
            </InfoSection>

            <InfoSection
                title="What they can do (role)"
                action={onChangeRole && <SectionAction onClick={onChangeRole}>Change role</SectionAction>}
            >
                <InfoGrid>
                    <InfoItem label="Current role" value={profile.role || 'Staff / Employee'} />
                </InfoGrid>
                <p className="mt-3 text-xs text-slate-500">You can only give roles allowed for your own level.</p>
            </InfoSection>
        </div>
    );
};
