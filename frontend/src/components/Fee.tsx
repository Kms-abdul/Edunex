import React from 'react';
import { ReceiptIcon } from './icons';
import { Wallet, FileBarChart2, BadgePercent } from 'lucide-react';
import { Page } from '../App';

interface FeeProps {
    navigateTo: (page: Page) => void;
}

const Fee: React.FC<FeeProps> = ({ navigateTo }) => {
    return (
        <div className="w-full h-full flex flex-col">
            <div className="card p-8 sm:p-14 text-center w-full flex-1 flex flex-col justify-center items-center relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-50/70 to-transparent pointer-events-none" />
                <div className="relative">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center ring-1 ring-inset ring-brand-600/10 mb-6">
                        <Wallet className="w-9 h-9" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">Financial Dashboard</h3>
                    <p className="text-slate-500 mb-8 text-base max-w-xl mx-auto">
                        Manage fees, view reports, and handle petty cash all in one place.
                    </p>
                    <button
                        onClick={() => navigateTo('take-fee')}
                        className="btn-primary btn-lg shadow-md shadow-brand-600/20"
                    >
                        <ReceiptIcon className="w-5 h-5" />
                        Collect Fees Now
                    </button>

                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <ReceiptIcon className="w-5 h-5 text-brand-600 flex-shrink-0" />
                            <span className="text-sm text-slate-700">Fee masters & receipts</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <FileBarChart2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                            <span className="text-sm text-slate-700">Standard & custom reports</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <BadgePercent className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <span className="text-sm text-slate-700">Concessions & petty cash</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fee;
