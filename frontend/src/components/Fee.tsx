import React, { useState } from 'react';
import { ChevronDownIcon, ReceiptIcon } from './icons';
import { Wallet, FileBarChart2, BadgePercent } from 'lucide-react';
import { Page } from '../App';

interface FeeProps {
    navigateTo: (page: Page) => void;
}

const Fee: React.FC<FeeProps> = ({ navigateTo }) => {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const handleDropdown = (name: string) => {
        setOpenDropdown(openDropdown === name ? null : name);
    };

    const handleBlur = () => {
        setTimeout(() => setOpenDropdown(null), 150);
    };

    const handleMenuItemClick = (item: string) => {
        if (item === 'Fee Type') {
            navigateTo('fee-type');
        } else if (item === 'Create Class Fee Structure') {
            navigateTo('class-fee-structure');
        } else if (item === 'Fee Installments') {
            navigateTo('fee-installments');
        } else if (item === 'Assign Special Fee Type') {
            navigateTo('assign-special-fee');
        } else if (item === 'Concession Template') {
            navigateTo('concession-master');
        } else if (item === 'Update Student Fee Structure') {
            navigateTo('update-student-fee-structure');
        } else if (item === 'Update Rebate Date') {
            navigateTo('update-rebate-date');
        } else if (item === 'Delete Fee Receipt') {
            navigateTo('delete-fee-receipt');
        } else if (item === 'Petty-Cash Report') {
            navigateTo('petty-cash-report');
        } else if (item === 'Deleted Receipts') {
            navigateTo('deleted-receipts');
        } else if (item === 'Fee Concession Report') {
            navigateTo('fee-concession-report');
        } else if (item === 'Adjust Fee Report') {
            navigateTo('adjust-fee-report');
        }
        setOpenDropdown(null);
    };

    const buttonStyle = "px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";

    interface DropdownItem {
        name: string;
        action: () => void;
    }

    const dropdownItems: { [key: string]: (string | DropdownItem)[] } = {
        feeMasters: ['Fee Type', 'Fee Installments', 'Assign Special Fee Type', 'Create Class Fee Structure', 'Update Student Fee Structure', 'Update Rebate Date', 'Delete Fee Receipt'/*'Fee Category', 'Fee Type group',  'Special Fee Type',  'Remove Special Fee Type', 'Manage Bank Account', 'Assign Fee Group To Students', 'Transfer Fee Due', 'Fee Setting', 'Update Student Fee Group', 'Import Fee Group'*/],
        /*cheque: ['Manage Cheques', 'Fee PDC', 'Fee All PDC', 'Bounced Cheque Report', 'Cheque Date Report', 'Cheque Clearance Report'],*/
        concession: [
            { name: 'Concession Template', action: () => navigateTo('concession-master') },
            { name: 'Set Student Concession', action: () => navigateTo('student-concession') },
            /*{ name: 'Set Bulk Concession', action: () => console.log('Set Bulk Concession') },
            { name: 'Student Availing Concessions', action: () => console.log('Student Availing Concessions') },*/
            { name: 'Paid Concession Report', action: () => console.log('Paid Concession Report') },
            { name: 'Expected Concession Report', action: () => console.log('Expected Concession Report') },
        ],
        reports: ['Fee Report', 'Fee Summary Report', 'Fee Due Report', 'Fee Concession Report', 'Deleted Receipts', 'Petty-Cash Report', 'Adjust Fee Report', 'Nullify Fee', 'Nullify Fee Report'],
        voucher: ['Create Voucher', 'Voucher List', 'Transport Voucher'],
    };

    const renderDropdown = (name: string, items: (string | DropdownItem)[]) => (
        <div className="relative">
            <button onClick={() => handleDropdown(name)} onBlur={handleBlur} className={`${buttonStyle} flex items-center capitalize`}>
                {name.replace(/([A-Z])/g, ' $1').trim()} <ChevronDownIcon className="w-4 h-4 ml-1" />
            </button>
            {openDropdown === name && (
                <ul className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-30 text-gray-700 border max-h-60 overflow-y-auto">
                    {items.map((item, idx) => {
                        const label = typeof item === 'string' ? item : item.name;
                        const action = typeof item === 'string' ? () => handleMenuItemClick(item) : item.action;

                        return (
                            <li key={idx}>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        action();
                                    }}
                                    className="block px-4 py-2 text-sm hover:bg-gray-100"
                                >
                                    {label}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );

    const user = JSON.parse(localStorage.getItem('user') || '{}');

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
