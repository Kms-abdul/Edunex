import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ReceiptIcon } from './icons';
import { Page } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { visibleFeeNav } from './fee-setup/feeNav';

interface FeeProps {
    navigateTo: (page: Page) => void;
}

/** Fees home: one big "Collect fee" button, then every Fees page this person may open, in plain words. */
const Fee: React.FC<FeeProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();
    const canAccess = (permission?: string) => (!permission ? true : hasPermission(permission, 'read'));
    const groups = visibleFeeNav(canAccess).filter(g => g.id !== 'home' && g.id !== 'collect');

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
            {/* Main job first */}
            <div className="card">
                <div className="card-body flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-inset ring-brand-600/10 flex-shrink-0">
                        <ReceiptIcon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold text-slate-900">Collect a fee</p>
                        <p className="text-sm text-slate-600">Find the student, choose the fees and print the receipt.</p>
                    </div>
                    <button onClick={() => navigateTo('take-fee')} className="btn-primary btn-lg w-full sm:w-auto">
                        <ReceiptIcon className="w-5 h-5" />
                        Collect fee
                    </button>
                </div>
            </div>

            {/* Everything else, grouped */}
            {groups.map(g => (
                <section key={g.id} aria-labelledby={`fee-home-${g.id}`}>
                    <h2 id={`fee-home-${g.id}`} className="flex items-center gap-2 text-base font-semibold text-slate-900 mb-2.5">
                        <span className="text-brand-600">{g.icon}</span>
                        {g.name}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {g.items.map(item => (
                            <button
                                key={item.page}
                                type="button"
                                onClick={() => navigateTo(item.page)}
                                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 min-h-[60px] text-left shadow-card hover:border-brand-300 active:bg-slate-50 transition-colors"
                            >
                                <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                                    {item.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] font-semibold text-slate-900">{item.name}</span>
                                    <span className="block text-sm text-slate-500">{item.hint}</span>
                                </span>
                                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default Fee;
