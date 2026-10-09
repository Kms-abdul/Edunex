import React, { useState } from 'react';
import { Page } from '../App';
import { DashboardIcon, FinancialIcon, DocumentIcon, UserIcon, ReceiptIcon, TimeIcon, SchoolIcon, ChartBarIcon, DiscountIcon, TrashIcon, RefreshIcon, DocumentReportIcon, CurrencyRupeeIcon } from './icons';
import PageHeader from './ui/PageHeader';
import ModuleTile from './ui/ModuleTile';
import { useAuth } from '../contexts/AuthContext';

interface FinancialLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    navigateTo: (page: Page) => void;
}

const FinancialLayout: React.FC<FinancialLayoutProps> = ({ children, currentPage, navigateTo }) => {
    const [activeTab, setActiveTab] = useState<string>('Dashboard');
    const { hasPermission } = useAuth();
    const canAccess = (permission?: string) => {
        if (!permission) return true;
        return hasPermission(permission, 'read');
    };

    const menuItems = [
        { name: 'Dashboard', page: 'fee' as Page, icon: <DashboardIcon className="w-5 h-5" />, permission: 'fees.fee.fee-dashboard' },
        {
            name: 'Fee Masters',
            id: 'feeMasters',
            icon: <FinancialIcon className="w-5 h-5" />,
            permission: 'fees.fee.fee-type', // Requires at least some fee master permission, we'll filter subItems
            subItems: [
                { name: 'Fee Type', page: 'fee-type' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.fee-type' },
                { name: 'Fee Installments', page: 'fee-installments' as Page, icon: <TimeIcon className="w-4 h-4" />, permission: 'fees.fee.fee-installments' },
                { name: 'Assign Special Fee Type', page: 'assign-special-fee' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'fees.fee.assign-special-fee' },
                { name: 'Create Class Fee Structure', page: 'class-fee-structure' as Page, icon: <SchoolIcon className="w-4 h-4" />, permission: 'fees.fee.class-fee-structure' },
                { name: 'Update Student Fee Structure', page: 'update-student-fee-structure' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'fees.fee.update-student-fee-structure' },
                { name: 'Update Rebate Date', page: 'update-rebate-date' as Page, icon: <TimeIcon className="w-4 h-4" />, permission: 'fees.fee.update-rebate-date' },
                { name: 'Delete Fee Receipt', page: 'delete-fee-receipt' as Page, icon: <TrashIcon className="w-4 h-4" />, permission: 'fees.fee.delete-fee-receipt' },
            ]
        },
        {
            name: 'Fee Reports',
            id: 'reports',
            icon: <DocumentIcon className="w-5 h-5" />,
            permission: 'fees.fee.fee-reports',
            subItems: [
                { name: 'Standard Reports', page: 'fee-reports' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.fee-report-components' },
                { name: 'Fee Concession Report', page: 'fee-concession-report' as Page, icon: <DiscountIcon className="w-4 h-4" />, permission: 'fees.fee.fee-concession-report' },
                { name: 'Deleted Receipts', page: 'deleted-receipts' as Page, icon: <TrashIcon className="w-4 h-4" />, permission: 'fees.fee.deleted-receipts' },
                { name: 'Adjust Fee Report', page: 'adjust-fee-report' as Page, icon: <RefreshIcon className="w-4 h-4" />, permission: 'fees.fee.adjust-fee-report' },
                { name: 'Petty-Cash Report', page: 'petty-cash-report' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-report' },
            ]
        },
        {
            name: 'Cash Management',
            id: 'cash-management',
            icon: <FinancialIcon className="w-5 h-5" />,
            subItems: [
                { name: 'Petty Cash Entry', page: 'petty-cash' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash' },
                { name: 'Cash Remittance Deposit', page: 'remittance-deposit' as Page, icon: <ReceiptIcon className="w-4 h-4" />, permission: 'fees.fee.remittance-deposit' },
                { name: 'Remittance Approvals', page: 'remittance-approvals' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.remittance-approvals' },
                { name: 'Fund Allocation', page: 'fund-allocation' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-fund-allocation' },
                { name: 'Month Wise Ledger', page: 'month-wise-ledger' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-monthly-expenses' },
                { name: 'Petty Cash Approval', page: 'petty-cash-approval' as Page, icon: <DocumentReportIcon className="w-4 h-4" />, permission: 'fees.fee.petty-cash-approval' },
                { name: 'Reconciliation Dashboard', page: 'reconciliation-dashboard' as Page, icon: <ChartBarIcon className="w-4 h-4" />, permission: 'fees.fee.reconciliation-dashboard' },
            ]
        },
        {
            name: 'Concessions',
            id: 'concessions',
            icon: <UserIcon className="w-5 h-5" />,
            permission: 'fees.fee.concession-master',
            subItems: [
                { name: 'Concession Template', page: 'concession-master' as Page, icon: <DocumentIcon className="w-4 h-4" />, permission: 'fees.fee.concession-master' },
                { name: 'Set Student Concession', page: 'student-concession' as Page, icon: <UserIcon className="w-4 h-4" />, permission: 'administration.student.student-concession' },
            ]
        }
    ];

    const activeMenu = menuItems.find(item => item.name === activeTab);

    // When inside an actual component page, hide the Financial Header completely
    if (currentPage !== 'fee') {
        return (
            <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Financial Header */}
                <div className="bg-white border-b border-slate-200 z-20 relative flex flex-col">
                    <div className="px-4 sm:px-6 pt-5">
                        <PageHeader
                            eyebrow="Financial"
                            title="Financial Administration"
                            subtitle="Fee collection, masters, reports, concessions and petty cash."
                            icon={<CurrencyRupeeIcon className="w-6 h-6" />}
                            className="mb-4"
                            actions={
                                <button className="btn-primary" onClick={() => navigateTo('take-fee')}>
                                    <ReceiptIcon className="w-4 h-4" />
                                    Collect Fee
                                </button>
                            }
                        />
                    </div>

                    {/* Main Navigation Tabs */}
                    <div className="px-4 sm:px-6 flex gap-1 overflow-x-auto">
                        {menuItems.map((item, idx) => {
                            if (!canAccess(item.permission)) {
                                return null;
                            }

                            // Filter subItems to check if the main tab should still be visible
                            const visibleSubItems = item.subItems?.filter(sub => canAccess(sub.permission));
                            if (item.subItems && (!visibleSubItems || visibleSubItems.length === 0)) {
                                return null; // Hide parent if all sub-modules are restricted
                            }

                            const isActive = activeTab === item.name;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (item.subItems && item.subItems.length > 0) {
                                            setActiveTab(item.name);
                                        } else if (item.page) {
                                            navigateTo(item.page as Page);
                                        }
                                    }}
                                    className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${isActive
                                        ? 'border-brand-600 text-brand-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                        }`}
                                >
                                    <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>
                                        {item.icon}
                                    </span>
                                    {item.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-surface-muted p-4 sm:p-6 relative">
                    {activeTab === 'Dashboard' ? (
                        children
                    ) : (
                        <div className="max-w-7xl mx-auto animate-fade-in">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-brand-600">{activeMenu?.icon}</span>
                                <h3 className="text-base font-semibold text-slate-900">{activeTab} Modules</h3>
                                <span className="badge-neutral ml-1">{activeMenu?.subItems?.filter(sub => canAccess(sub.permission)).length || 0}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {activeMenu?.subItems?.filter(sub => canAccess(sub.permission)).map((sub, idx) => (
                                    <ModuleTile
                                        key={idx}
                                        name={sub.name}
                                        icon={sub.icon}
                                        onClick={() => navigateTo(sub.page)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FinancialLayout;
