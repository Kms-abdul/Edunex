import React from 'react';
import {
  HeadphoneIcon, UserIcon, ControlPanelIcon
} from './icons';
import { Menu } from 'lucide-react';
import { Page } from "../App";
import { useAuth } from '../contexts/AuthContext';
import KampusOpsLogo from '../images/kampusops-logo.webp';
import { navCategories, isInSection } from './shell/nav';


interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  navigateTo: (page: Page) => void;
  currentPage: Page;
}



const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, navigateTo: rawNavigate, currentPage }) => {
  // On phones the menu is a drawer: close it after choosing a page
  const navigateTo = (page: Page) => {
    rawNavigate(page);
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) toggleSidebar();
  };
  const { hasPermission } = useAuth();
  const canAccess = (permission: string) => {
    return permission === '*' || permission.split(',').some(p => hasPermission(p.trim(), 'read'));
  };

  const showControlPanel =
    hasPermission('system.users.management', 'read') ||
    hasPermission('system.roles.permissions', 'read') ||
    hasPermission('system.franchise.management', 'read') ||
    hasPermission('system.school.school-management', 'read');

  const NavLink: React.FC<{ title: string; icon: React.ReactNode; active: boolean; onClick: () => void }> = ({ title, icon, active, onClick }) => (
    <a
      href="#"
      title={!isOpen ? title : undefined}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className={`relative flex items-center rounded-lg text-sm font-medium transition-colors group
        ${isOpen ? 'px-3 py-2 gap-3' : 'px-3 py-2 gap-3 md:justify-center md:px-0 md:py-2.5'}
        ${active
          ? 'bg-brand-50 text-brand-800 font-semibold ring-1 ring-inset ring-brand-600/15 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-brand-500'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{icon}</span>
      <span className={`whitespace-nowrap ${!isOpen && 'md:hidden'}`}>{title}</span>
    </a>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[45] bg-slate-900/40 backdrop-blur-[1px] md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out
          ${isOpen ? 'w-[248px]' : 'w-0 overflow-hidden border-r-0'}
          md:relative fixed inset-y-0 left-0 h-full z-50 md:z-auto`}
      >
        {/* Brand: always white with the KampusOps logo, whatever the school's colour */}
        <div className="flex items-center justify-between gap-2 h-[60px] flex-shrink-0 bg-white border-b border-slate-200 px-4">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigateTo('dashboard'); }}
            className="flex items-center min-w-0"
            aria-label="KampusOps home"
          >
            <img src={KampusOpsLogo} alt="KampusOps — School Management Platform" className="h-9 w-auto max-w-[160px] object-contain" />
          </a>
          {/* Menu button: hides the menu (desktop) / closes the drawer (phone) */}
          <button
            onClick={toggleSidebar}
            className="btn-icon h-9 w-9 flex-shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Hide the menu"
            title="Hide the menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 ${isOpen ? 'px-3' : 'px-3 md:px-3'}`}>
          <p className={`px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400 ${!isOpen && 'md:hidden'}`}>Menu</p>
          {navCategories.filter(cat => canAccess(cat.permission)).map((cat) => (
            <NavLink
              key={cat.title}
              title={cat.title}
              icon={cat.icon}
              active={isInSection(currentPage, cat)}
              onClick={() => navigateTo(cat.page)}
            />
          ))}

          <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
            <p className={`px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400 ${!isOpen && 'md:hidden'}`}>More</p>
            {/* Control Panel – Admin & SuperAdmin */}
            {showControlPanel && (
              <NavLink
                title="Users & access"
                icon={<ControlPanelIcon className="w-5 h-5" />}
                active={currentPage === 'control-panel'}
                onClick={() => navigateTo('control-panel')}
              />
            )}
            <NavLink
              title="Help"
              icon={<HeadphoneIcon className="w-5 h-5" />}
              active={currentPage === 'staffsupport'}
              onClick={() => navigateTo('staffsupport')}
            />
            <NavLink
              title="My account"
              icon={<UserIcon className="w-5 h-5" />}
              active={currentPage === 'profile'}
              onClick={() => navigateTo('profile')}
            />
          </div>
        </nav>

      </aside>
    </>
  );
};

export default Sidebar;
