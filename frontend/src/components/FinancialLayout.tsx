import React, { useEffect, useState } from 'react';
import { Page } from '../App';
import { ReceiptIcon, CurrencyRupeeIcon, DashboardIcon, FinancialIcon, DocumentIcon, DiscountIcon, TimeIcon, DocumentReportIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { visibleFeeNav, FeeNavItem } from './fee-setup/feeNav';
import ModuleTile from './ui/ModuleTile';
import FeesDashboard from './fee-dashboard/FeesDashboard';
import { setIntent } from '../utils/intent';

interface FinancialLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    navigateTo: (page: Page) => void;
}

type FeesTab = 'dashboard' | 'masters' | 'reports' | 'cash' | 'daily' | 'due' | 'concessions';

interface TabDef {
    id: FeesTab;
    label: string;
    icon: React.ReactNode;
    /** Tile pages come from this Fees menu group (fee-setup/feeNav) */
    group?: string;
    /** Tabs that open a report directly */
    report?: string;
}

const TABS: TabDef[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon className="w-4 h-4" />, group: 'home' },
    { id: 'masters', label: 'Fee Masters', icon: <FinancialIcon className="w-4 h-4" />, group: 'setup' },
    { id: 'reports', label: 'Fee Reports', icon: <DocumentIcon className="w-4 h-4" />, group: 'reports' },
    { id: 'cash', label: 'Cash Management', icon: <FinancialIcon className="w-4 h-4" />, group: 'cash' },
    { id: 'daily', label: 'Daily Report', icon: <TimeIcon className="w-4 h-4" />, group: 'reports', report: 'today' },
    { id: 'due', label: 'Fee Due Reports', icon: <DocumentReportIcon className="w-4 h-4" />, group: 'reports', report: 'due' },
    { id: 'concessions', label: 'Concessions', icon: <DiscountIcon className="w-4 h-4" />, group: 'discounts' },
];

const TAB_KEY = 'kampusops.feesTab';
const readTab = (): FeesTab => {
    try { return (sessionStorage.getItem(TAB_KEY) as FeesTab) || 'dashboard'; } catch { return 'dashboard'; }
};

/** Which tab a sub-page belongs to, so the right tab stays underlined while working inside it. */
const tabForPage = (page: Page, groupOf: (p: Page) => string | undefined): FeesTab | null => {
    if (page === 'fee-reports') return 'reports';
    const g = groupOf(page);
    return (TABS.find(t => t.group === g && !t.report)?.id) || null;
};

const FinancialLayout: React.FC<FinancialLayoutProps> = ({ children, currentPage, navigateTo }) => {
    const { hasPermission } = useAuth();
    const canAccess = (permission?: string) => (!permission ? true : hasPermission(permission, 'read'));

    // Same pages and permission checks as before (see fee-setup/feeNav).
    const groups = visibleFeeNav(canAccess);
    const groupItems = (id?: string): FeeNavItem[] => groups.find(g => g.id === id)?.items || [];
    const groupOf = (p: Page) => groups.find(g => g.items.some(i => i.page === p))?.id;
    const tabs = TABS.filter(t => (t.report ? groupItems(t.group).some(i => i.page === 'fee-reports') : groupItems(t.group).length > 0));

    const [tab, setTab] = useState<FeesTab>(readTab);
    useEffect(() => { try { sessionStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ } }, [tab]);

    const onFeesHome = currentPage === 'fee';
    const activeTab: FeesTab | null = onFeesHome ? (tabs.some(t => t.id === tab) ? tab : tabs[0]?.id ?? null) : tabForPage(currentPage, groupOf);

    const openTab = (t: TabDef) => {
        if (t.report) {
            // Daily / due tabs open that report straight away
            if (currentPage === 'fee-reports') {
                window.dispatchEvent(new CustomEvent('kampusops:open-fee-report', { detail: t.report }));
                return;
            }
            setIntent('fee-reports', t.report);
            navigateTo('fee-reports');
            return;
        }
        setTab(t.id);
        if (!onFeesHome) navigateTo('fee');
    };

    const current = TABS.find(t => t.id === activeTab);
    const tiles = current && current.id !== 'dashboard' ? groupItems(current.group) : [];

    return (
        <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
            {/* Header + tabs */}
            <div className="bg-white border-b border-slate-200 z-20">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
                    <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
                        <CurrencyRupeeIcon className="w-6 h-6 text-brand-600" />
                        Financial Administration
                    </h1>
                    {currentPage !== 'take-fee' && (
                        <button className="btn-primary" onClick={() => navigateTo('take-fee')}>
                            <ReceiptIcon className="w-4 h-4" />
                            Collect Fee
                        </button>
                    )}
                </div>

                {tabs.length > 0 && (
                    <nav aria-label="Fees sections" className="px-2 sm:px-4 flex gap-1 overflow-x-auto">
                        {tabs.map(t => {
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => openTab(t)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`relative min-h-[44px] px-3 inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors
                                        ${active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    <span className={active ? 'text-brand-600' : 'text-slate-400'}>{t.icon}</span>
                                    {t.label}
                                    <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${active ? 'bg-brand-600' : 'bg-transparent'}`} />
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-surface-muted p-4 sm:p-6 relative">
                {!onFeesHome ? children : current?.id === 'dashboard' ? (
                    <FeesDashboard />
                ) : current ? (
                    <div className="w-full max-w-[1600px] mx-auto">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                            <span className="text-brand-600">{current.icon}</span>
                            {current.label} Modules
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {tiles.map(item => (
                                <ModuleTile
                                    key={item.page}
                                    name={item.name}
                                    description={item.hint}
                                    icon={item.icon}
                                    onClick={() => navigateTo(item.page)}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">You don't have access to any Fees pages yet.</p>
                )}
            </div>
        </div>
    );
};

export default FinancialLayout;
