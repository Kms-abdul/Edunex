import React, { useEffect, useState } from 'react';
import { Page } from '../App';
import { ReceiptIcon, CurrencyRupeeIcon } from './icons';
import PageHeader from './ui/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { visibleFeeNav } from './fee-setup/feeNav';

interface FinancialLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    navigateTo: (page: Page) => void;
}

/** Big, tap-friendly pill used for both rows of Fees navigation. */
const NavPill: React.FC<{ active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode; current?: boolean }> = ({ active, onClick, icon, children, current }) => (
    <button
        type="button"
        onClick={onClick}
        aria-current={current ? 'page' : undefined}
        className={`min-h-[44px] px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0 inline-flex items-center gap-2 transition-colors
            ${active ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
        {icon && <span className={active ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>}
        <span>{children}</span>
    </button>
);

const FinancialLayout: React.FC<FinancialLayoutProps> = ({ children, currentPage, navigateTo }) => {
    const { hasPermission } = useAuth();
    const canAccess = (permission?: string) => {
        if (!permission) return true;
        return hasPermission(permission, 'read');
    };

    // Same pages and permission checks as before (see fee-setup/feeNav).
    const groups = visibleFeeNav(canAccess);
    const activeGroup = groups.find(g => g.items.some(i => i.page === currentPage));

    // A section tapped in the top row shows its pages underneath, without leaving the current page.
    const [openGroupId, setOpenGroupId] = useState<string | null>(null);
    useEffect(() => { setOpenGroupId(null); }, [currentPage]);
    const shownGroup = groups.find(g => g.id === openGroupId) || activeGroup;

    const onGroupTap = (groupId: string) => {
        const g = groups.find(x => x.id === groupId);
        if (!g) return;
        if (g.items.length === 1) {
            navigateTo(g.items[0].page);
            return;
        }
        setOpenGroupId(prev => (prev === groupId && activeGroup?.id !== groupId ? null : groupId));
    };

    const collectButton = currentPage !== 'take-fee' && (
        <button className="btn-primary" onClick={() => navigateTo('take-fee')}>
            <ReceiptIcon className="w-4 h-4" />
            Collect fee
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-surface-muted overflow-hidden">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Fees header + section tabs */}
                <div className="bg-white border-b border-slate-200 z-20 relative flex flex-col">
                    {/* Phones: a slim title so the page itself gets the room */}
                    <div className="sm:hidden px-4 pt-3 pb-1 flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-slate-900">Fees</p>
                        {collectButton}
                    </div>
                    <div className="hidden sm:block px-6 pt-5">
                        <PageHeader
                            eyebrow="Fees"
                            title="Fees & money"
                            subtitle="Collect fees, set up fees, see reports, petty cash and discounts."
                            icon={<CurrencyRupeeIcon className="w-6 h-6" />}
                            className="mb-3"
                            actions={collectButton || undefined}
                        />
                    </div>

                    {groups.length > 0 && (
                        <nav aria-label="Fees sections" className="px-2 sm:px-4 pb-2 flex gap-1 overflow-x-auto">
                            {groups.map(g => (
                                <NavPill
                                    key={g.id}
                                    active={shownGroup?.id === g.id}
                                    current={activeGroup?.id === g.id}
                                    icon={g.icon}
                                    onClick={() => onGroupTap(g.id)}
                                >
                                    {g.name}
                                </NavPill>
                            ))}
                        </nav>
                    )}
                </div>

                {/* Pages inside the chosen section */}
                {shownGroup && shownGroup.items.length > 1 && (
                    <nav aria-label={`${shownGroup.name} pages`} className="bg-white/80 backdrop-blur border-b border-slate-200 px-2 sm:px-4 py-1.5 flex gap-1 overflow-x-auto z-10">
                        {shownGroup.items.map(item => (
                            <NavPill
                                key={item.page}
                                active={currentPage === item.page}
                                current={currentPage === item.page}
                                icon={item.icon}
                                onClick={() => navigateTo(item.page)}
                            >
                                {item.name}
                            </NavPill>
                        ))}
                    </nav>
                )}

                <div className="flex-1 overflow-y-auto bg-surface-muted p-4 sm:p-6 relative">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default FinancialLayout;
