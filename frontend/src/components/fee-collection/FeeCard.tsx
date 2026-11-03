import React from 'react';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

export interface FeeCardInstallment {
    sr: number;
    title: string;
    payable: number;
    paid: boolean;
    paidAmount?: number;
    dueAmount?: number;
    concession?: number;
    due_date?: string;
}

export const rupees = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

export const formatDay = (d?: string) => {
    if (!d) return '';
    const date = new Date(`${d}T00:00:00`);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * One fee / installment as a big tappable card.
 * Same numbers as the old table row: Payable, Concession, Paid, Due.
 * `children` is shown under the card when it is chosen (e.g. the "Paying now" box).
 */
const FeeCard: React.FC<{
    installment: FeeCardInstallment;
    isSelected: boolean;
    isDisabled: boolean;
    onSelect: (sr: number) => void;
    children?: React.ReactNode;
}> = ({ installment, isSelected, isDisabled, onSelect, children }) => {
    const { sr, title, payable, paid, paidAmount, dueAmount, concession, due_date } = installment;
    const due = dueAmount !== undefined ? dueAmount : payable - (paidAmount || 0);
    const isPartial = !paid && (paidAmount || 0) > 0;
    const isFullyPaid = paid || due <= 0;

    if (isFullyPaid) {
        return (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 break-words">{title}</p>
                    <p className="text-sm text-emerald-800">
                        Paid {rupees(paidAmount || payable - (concession || 0))}
                        {concession ? ` · Concession ${rupees(concession)}` : ''}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`rounded-xl border-2 transition-colors ${
                isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'
            } ${isDisabled ? 'opacity-60' : ''}`}
        >
            <button
                type="button"
                onClick={() => !isDisabled && onSelect(sr)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={`w-full text-left px-4 py-3 min-h-[56px] flex items-center gap-3 ${
                    isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
            >
                {isDisabled ? (
                    <Lock className="w-6 h-6 text-slate-400 flex-shrink-0" />
                ) : isSelected ? (
                    <CheckCircle2 className="w-6 h-6 text-brand-600 flex-shrink-0" />
                ) : (
                    <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 break-words">{title}</p>
                    <p className="text-sm text-slate-500">
                        {due_date ? `Due by ${formatDay(due_date)}` : 'No due date'}
                        {isPartial ? ` · Part paid ${rupees(paidAmount || 0)}` : ''}
                        {concession ? ` · Concession ${rupees(concession)}` : ''}
                    </p>
                    {isDisabled && <p className="text-sm text-slate-500">Choose the earlier fee first</p>}
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="text-base font-semibold text-slate-900">{rupees(due)}</p>
                    {payable !== due && <p className="text-xs text-slate-500">of {rupees(payable)}</p>}
                </div>
            </button>
            {isSelected && children && <div className="border-t border-brand-200 px-4 py-3">{children}</div>}
        </div>
    );
};

export default FeeCard;
