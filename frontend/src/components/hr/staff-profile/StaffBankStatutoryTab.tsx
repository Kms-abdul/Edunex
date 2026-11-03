import React, { useState, useEffect } from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { LoadingState, EmptyState } from '../../ui';
import { InfoSection, InfoGrid, InfoItem, SectionAction, plainWord, yesNo } from '../../hr-setup/InfoParts';
import api from '../../../api';

interface Props {
    profile: StaffProfileData;
    /** Opens the staff edit form on the Bank tab; button hidden when not provided */
    onEdit?: () => void;
}

export const StaffBankStatutoryTab: React.FC<Props> = ({ profile, onEdit }) => {
    const [account, setAccount] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const res = await api.get(`/hr/staff/${profile.id}/profile/account`);
                if (res.data && Object.keys(res.data).length > 0) {
                    setAccount(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch bank account details", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAccount();
    }, [profile.id]);

    if (loading) return <LoadingState label="Loading bank details…" />;

    return (
        <div className="space-y-4">
            <InfoSection
                title="Bank account"
                action={onEdit && <SectionAction onClick={onEdit}>Change bank details</SectionAction>}
            >
                {account ? (
                    <InfoGrid>
                        <InfoItem label="Name on the account" value={account.account_holder_name} />
                        <InfoItem label="Bank name" value={account.bank_name} />
                        <InfoItem label="Bank branch" value={account.branch_name} />
                        <InfoItem label="Account number" value={account.account_number ? '••••' + account.account_number.slice(-4) : ''} mono />
                        <InfoItem label="IFSC code" value={account.ifsc_code} mono />
                        <InfoItem label="Account type" value={plainWord(account.account_type)} />
                        <InfoItem label="UPI ID" value={account.upi_id} />
                    </InfoGrid>
                ) : (
                    <EmptyState compact title="No bank account added yet" />
                )}
            </InfoSection>

            <InfoSection
                title="Tax and PF details"
                action={onEdit && <SectionAction onClick={onEdit}>Change tax and PF details</SectionAction>}
            >
                <InfoGrid>
                    <InfoItem label="PAN number" value={account?.pan_number} mono />
                    <InfoItem label="Aadhaar number" value={account?.aadhaar_number ? '•••• •••• ' + account.aadhaar_number.slice(-4) : ''} mono />
                    <InfoItem label="UAN number" value={profile.uan_no} mono />
                    <InfoItem label="PF deducted?" value={yesNo(account?.pf_applicable)} />
                    <InfoItem label="ESI number" value={account?.esi_number} mono />
                    <InfoItem label="ESI deducted?" value={yesNo(account?.esi_applicable)} />
                    <InfoItem label="Professional tax deducted?" value={yesNo(account?.pt_applicable)} />
                    <InfoItem label="TDS (income tax) deducted?" value={yesNo(account?.tds_applicable)} />
                </InfoGrid>
            </InfoSection>
        </div>
    );
};
