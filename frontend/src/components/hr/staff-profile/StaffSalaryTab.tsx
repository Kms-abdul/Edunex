import React, { useState, useEffect } from 'react';
import { StaffProfileData } from '../../StaffProfile';
import { LoadingState, EmptyState } from '../../ui';
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
        <div className="space-y-8">
            <div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                    <h3 className="text-base font-semibold text-slate-900">Current Salary</h3>
                    {onEdit && <button type="button" onClick={onEdit} className="btn-ghost btn-sm text-brand-600">Edit Salary Details</button>}
                </div>
                {salary ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label">Salary Type</label>
                            <p className="font-semibold text-slate-800 uppercase">{salary.salary_type}</p>
                        </div>
                        <div>
                            <label className="label">Basic Salary</label>
                            <p className="font-semibold text-slate-800">₹ {salary.basic_salary?.toLocaleString() || '-'}</p>
                        </div>
                        <div>
                            <label className="label">Gross Salary</label>
                            <p className="font-semibold text-slate-800">₹ {salary.gross_salary?.toLocaleString() || '-'}</p>
                        </div>
                        <div>
                            <label className="label">Payment Mode</label>
                            <p className="font-semibold text-slate-800 uppercase">{salary.payment_mode}</p>
                        </div>
                        <div>
                            <label className="label">Effective From</label>
                            <p className="font-semibold text-slate-800">
                                {salary.effective_from ? new Date(salary.effective_from).toLocaleDateString('en-GB') : '-'}
                            </p>
                        </div>
                        <div>
                            <label className="label">Payroll Status</label>
                            <p className="font-semibold text-slate-800 uppercase">{salary.payroll_status}</p>
                        </div>
                    </div>
                ) : (
                    <EmptyState compact title="No salary details configured" />
                )}
            </div>

            <div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                    <h3 className="text-base font-semibold text-slate-900">Payroll Configuration</h3>
                </div>
                {salary ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label">Gratuity Applicable</label>
                            <p className="font-semibold text-slate-800">{salary.gratuity_applicable ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <label className="label">Bonus Applicable</label>
                            <p className="font-semibold text-slate-800">{salary.bonus_applicable ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <label className="label">Overtime Applicable</label>
                            <p className="font-semibold text-slate-800">{salary.overtime_applicable ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <label className="label">Notice Period (Days)</label>
                            <p className="font-semibold text-slate-800">{salary.notice_period_days || '-'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="label">Remarks</label>
                            <p className="font-semibold text-slate-800">{salary.payroll_remarks || '-'}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 py-4">-</p>
                )}
            </div>
        </div>
    );
};
