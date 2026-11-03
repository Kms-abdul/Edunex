import React from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { StaffDocuments } from '../StaffDocuments';

interface Props {
    profile: StaffProfileData;
}

export const StaffDocumentsTab: React.FC<Props> = ({ profile }) => {
    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600">
                Papers collected from this staff member. Tap <span className="font-medium">View</span> to open one.
            </p>
            <StaffDocuments staffId={profile.id} mode="view" />
        </div>
    );
};
