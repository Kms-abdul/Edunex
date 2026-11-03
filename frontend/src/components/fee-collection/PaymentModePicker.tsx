import React from 'react';
import { Banknote, CreditCard, Landmark, QrCode, ScrollText } from 'lucide-react';

/** `value` is what is saved (unchanged from the old dropdown); `label` is what people read. */
export const PAYMENT_MODES: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: 'Cash', label: 'Cash', icon: <Banknote className="w-5 h-5" /> },
    { value: 'UPI', label: 'UPI', icon: <QrCode className="w-5 h-5" /> },
    { value: 'CardSwap', label: 'Card', icon: <CreditCard className="w-5 h-5" /> },
    { value: 'Cheque', label: 'Cheque', icon: <ScrollText className="w-5 h-5" /> },
    { value: 'Online', label: 'Bank transfer', icon: <Landmark className="w-5 h-5" /> },
];

export const paymentModeLabel = (value: string) =>
    PAYMENT_MODES.find(m => m.value === value)?.label || value;

/** Big tap-friendly choice of how the money is paid. */
const PaymentModePicker: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
    <div role="radiogroup" aria-label="How is the money paid?" className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {PAYMENT_MODES.map(m => {
            const active = m.value === value;
            return (
                <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(m.value)}
                    className={`min-h-[52px] rounded-xl border-2 px-3 py-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                        active
                            ? 'border-brand-500 bg-brand-50 text-brand-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                >
                    {m.icon}
                    {m.label}
                </button>
            );
        })}
    </div>
);

export default PaymentModePicker;
