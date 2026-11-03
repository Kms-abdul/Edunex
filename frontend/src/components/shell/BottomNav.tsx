import React from 'react';
import { Menu } from 'lucide-react';
import type { Page } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import { navCategories, isInSection } from './nav';

/**
 * Phone-only tab bar (like a mobile app). Shows the user's first four sections
 * plus "Menu", which opens the full side menu.
 */
const BottomNav: React.FC<{ currentPage: Page; navigateTo: (p: Page) => void; openMenu: () => void }> = ({ currentPage, navigateTo, openMenu }) => {
  const { hasPermission } = useAuth();
  const tabs = navCategories
    .filter(c => c.permission === '*' || c.permission.split(',').some(p => hasPermission(p.trim(), 'read')))
    .slice(0, 4);

  const item = 'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 h-full text-[11px] font-medium';

  return (
    <nav
      aria-label="Main"
      className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-16">
        {tabs.map(tab => {
          const active = isInSection(currentPage, tab);
          return (
            <button
              key={tab.page}
              type="button"
              onClick={() => navigateTo(tab.page)}
              aria-current={active ? 'page' : undefined}
              className={`${item} ${active ? 'text-brand-700' : 'text-slate-500'}`}
            >
              <span className={`flex items-center justify-center h-7 w-12 rounded-full transition-colors ${active ? 'bg-brand-100' : ''}`}>
                {tab.icon}
              </span>
              <span className="truncate max-w-full px-1">{tab.short}</span>
            </button>
          );
        })}
        <button type="button" onClick={openMenu} className={`${item} text-slate-500`}>
          <span className="flex items-center justify-center h-7 w-12"><Menu className="w-5 h-5" /></span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
