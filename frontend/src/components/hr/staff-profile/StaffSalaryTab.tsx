import React, { useState, useEffect } from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { LoadingState, EmptyState } from '../../ui';
import { InfoSection, InfoGrid, InfoItem, SectionAction, plainWord, shortDate, yesNo } from '../../hr-setup/InfoParts';
import api from '../../../api';

interface Props {
    profile: StaffProfileData;
    /** Opens the staff edit form on the Salary tab; button hidden when not provided */
    onEdit?: () => void;
}

export const StaffSalaryTab: React.FC<Props> = ({ profile, onEdit }) => {
    const [salary, setSalary] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSalary = async () => {
            try {
                const res = await api.get(`/hr/staff/${profile.id}/profile/salary`);
                setSalary(res.data);
            } catch (err) {
                console.error("Failed to fetch salary details", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSalary();
    }, [profile.id]);

    if (loading) return <LoadingState label="Loading salary details…" />;

    return (
        <div className="space-y-4">
            <InfoSection
                title="Salary now"
                action={onEdit && <SectionAction onClick={onEdit}>Change salary</SectionAction>}
            >
                {salary ? (
                    <InfoGrid>
                        <InfoItem label="Basic salary" value={`₹ ${salary.basic_salary?.toLocaleString() || '-'}`} />
                        <InfoItem label="Gross salary (total)" value={`₹ ${salary.gross_salary?.toLocaleString() || '-'}`} />
                        <InfoItem label="Paid" value={plainWord(salary.salary_type)} />
                        <InfoItem label="Paid by" value={plainWord(salary.payment_mode)} />
                        <InfoItem label="From date" value={shortDate(salary.effective_from)} />
                        <InfoItem label="Payroll status" value={plainWord(salary.payroll_status)} />
                    </InfoGrid>
                ) : (
                    <EmptyState compact title="No salary added yet" />
                )}
            </InfoSection>

            <InfoSection title="Other pay settings">
                {salary ? (
                    <InfoGrid>
                        <InfoItem label="Gratuity?" value={yesNo(salary.gratuity_applicable)} />
                        <InfoItem label="Bonus?" value={yesNo(salary.bonus_applicable)} />
                        <InfoItem label="Overtime pay?" value={yesNo(salary.overtime_applicable)} />
                        <InfoItem label="Notice period (days)" value={salary.notice_period_days || ''} />
                        <InfoItem label="Note" value={salary.payroll_remarks} wide />
                    </InfoGrid>
                ) : (
                    <p className="text-sm text-slate-500">—</p>
                )}
            </InfoSection>
        </div>
    );
};
