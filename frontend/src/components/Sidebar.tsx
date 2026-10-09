import React from 'react';
import {
  DashboardIcon, AcademicIcon, FinancialIcon, AdministrationIcon, SetupIcon, HeadphoneIcon, UserIcon, ControlPanelIcon
} from './icons';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Page } from "../App";
import { useAuth } from '../contexts/AuthContext';
import Learnspacelogo from '../images/Learnspacelogo.png';


interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  navigateTo: (page: Page) => void;
  currentPage: Page;
}

const navCategories: { title: string; icon: React.ReactNode; page: Page; permission: string }[] = [
  { title: 'Dashboard', icon: <DashboardIcon className="w-5 h-5" />, page: 'dashboard', permission: 'home.dashboard.main' },
  { title: 'Academic', icon: <AcademicIcon className="w-5 h-5" />, page: 'academic', permission: 'academics.academic.management'},
  { title: 'Financial', icon: <FinancialIcon className="w-5 h-5" />, page: 'fee', permission: 'fees.collections.receipt-entry' },
  { title: 'Administration', icon: <AdministrationIcon className="w-5 h-5" />, page: 'administration', permission: 'administration.students.management' },
  { title: 'HR & Staff', icon: <UserIcon className="w-5 h-5" />, page: 'hr-management', permission: 'hr.hr.hr-management,hr.hr.staff-profile' },
  { title: 'Setup Your School', icon: <SetupIcon className="w-5 h-5" />, page: 'setup', permission: 'setup.school.setup' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, navigateTo, currentPage }) => {
  const { hasPermission } = useAuth();
  const canAccess = (permission: string) => {
    return permission.split(',').some(p => hasPermission(p.trim(), 'read'));
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
          ? 'bg-brand-600 text-brand-contrast shadow-sm shadow-brand-600/30'
          : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-brand-contrast' : 'text-slate-400 group-hover:text-brand-600'}`}>{icon}</span>
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
          ${isOpen ? 'w-[248px]' : 'w-0 overflow-hidden md:w-[72px]'}
          md:relative fixed inset-y-0 left-0 h-full z-50 md:z-auto`}
      >
        {/* Brand */}
        <div className={`relative flex items-center h-[60px] flex-shrink-0 bg-gradient-to-br from-brand-700 to-brand-600 text-brand-contrast ${isOpen ? 'px-4 justify-between' : 'px-4 justify-between md:justify-center md:px-0'}`}>
          <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigateTo('dashboard'); }}
            className="flex items-center gap-2.5 min-w-0"
          >
            <img
              src={Learnspacelogo}
              alt="LearnSpace Logo"
              className="h-9 w-9 object-contain flex-shrink-0 rounded-lg bg-white p-0.5 shadow-sm"
            />
            <div className={`leading-tight min-w-0 ${!isOpen && 'md:hidden'}`}>
              <p className="text-sm font-bold text-brand-contrast tracking-tight truncate">LearnSpace</p>
              <p className="text-2xs font-medium text-brand-contrast/70 uppercase tracking-wider">School ERP</p>
            </div>
          </a>
          <button
            onClick={toggleSidebar}
            className={`btn-icon h-8 w-8 md:hidden text-brand-contrast/80 hover:bg-white/15 hover:text-brand-contrast`}
            aria-label="Close menu"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 ${isOpen ? 'px-3' : 'px-3 md:px-3'}`}>
          <p className={`px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400 ${!isOpen && 'md:hidden'}`}>Modules</p>
          {navCategories.filter(cat => canAccess(cat.permission)).map((cat) => (
            <NavLink
              key={cat.title}
              title={cat.title}
              icon={cat.icon}
              active={cat.page === currentPage}
              onClick={() => navigateTo(cat.page)}
            />
          ))}

          <div className="pt-4 mt-4 border-t border-slate-100 space-y-1">
            <p className={`px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400 ${!isOpen && 'md:hidden'}`}>System</p>
            {/* Control Panel – Admin & SuperAdmin */}
            {showControlPanel && (
              <NavLink
                title="Control Panel"
                icon={<ControlPanelIcon className="w-5 h-5" />}
                active={currentPage === 'control-panel'}
                onClick={() => navigateTo('control-panel')}
              />
            )}
            <NavLink
              title="StaffSupport"
              icon={<HeadphoneIcon className="w-5 h-5" />}
              active={currentPage === 'staffsupport'}
              onClick={() => navigateTo('staffsupport')}
            />
            <NavLink
              title="My Details"
              icon={<UserIcon className="w-5 h-5" />}
              active={currentPage === 'profile'}
              onClick={() => navigateTo('profile')}
            />
          </div>
        </nav>

        {/* Collapse control (desktop) */}
        <div className="hidden md:flex items-center border-t border-slate-100 p-3 flex-shrink-0">
          <button
            onClick={toggleSidebar}
            title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className={`btn-ghost h-9 w-full ${isOpen ? 'justify-start px-3' : 'justify-center px-0'}`}
          >
            {isOpen ? <PanelLeftClose className="w-4 h-4 text-slate-400" /> : <PanelLeftOpen className="w-4 h-4 text-slate-400" />}
            <span className={`text-xs ${!isOpen && 'md:hidden'}`}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
