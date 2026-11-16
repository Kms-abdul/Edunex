import React, { useEffect, useState } from 'react';
import { ClipboardList, PlusCircle, List, Gift, Phone, BarChart3, FileCheck2 } from 'lucide-react';
import type { Page } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, ErrorState, Field, LoadingState, notify } from '../ui';
import { EnquiryOptions, PrintData, enquiryApi, errorText, followupApi, yearLabel } from './enquiryApi';
import NewEnquiry, { SlipView } from './NewEnquiry';
import EnquiryList from './EnquiryList';
import SchemesSetup from './SchemesSetup';
import CallsList from './CallsList';
import EnquiryDashboard from './EnquiryDashboard';
import EnquiryHistory from './EnquiryHistory';
import ApplicationsList from './ApplicationsList';

type Tab = 'new' | 'calls' | 'list' | 'applications' | 'dashboard' | 'schemes';
const BRANCH_KEY = 'kampusops.enquiryBranch';

/**
 * Admission enquiry (front office).
 * New enquiry → Save & Print slip for the parent; list to find and reprint; schemes set up by the admin.
 */
const EnquiryModule: React.FC<{ navigateTo?: (page: Page) => void }> = ({ navigateTo }) => {
  const { hasPermission } = useAuth();
  const canEnquiry = hasPermission('administration.enquiry.enquiry', 'read');
  const canSchemes = hasPermission('administration.enquiry.schemes', 'read');
  const canCalls = hasPermission('administration.enquiry.followup', 'read');
  const canCallWrite = hasPermission('administration.enquiry.followup', 'write');
  const canDashboard = hasPermission('administration.enquiry.dashboard', 'read');

  // Dashboard first: the module opens on it
  const tabs = ([
    canDashboard && { id: 'dashboard', label: 'Dashboard', short: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    canEnquiry && { id: 'new', label: 'New enquiry', short: 'New', icon: <PlusCircle className="w-4 h-4" /> },
    canCalls && { id: 'calls', label: 'Calls', short: 'Calls', icon: <Phone className="w-4 h-4" /> },
    canEnquiry && { id: 'list', label: 'Enquiry list', short: 'List', icon: <List className="w-4 h-4" /> },
    (canEnquiry || canCalls) && { id: 'applications', label: 'Admission forms', short: 'Forms', icon: <FileCheck2 className="w-4 h-4" /> },
    canSchemes && { id: 'schemes', label: 'Schemes & settings', short: 'Schemes', icon: <Gift className="w-4 h-4" /> },
  ].filter(Boolean)) as { id: Tab; label: string; short: string; icon: React.ReactNode }[];

  // Always open on the first tab (the Dashboard for those who can see it)
  const [tab, setTab] = useState<Tab>((tabs[0]?.id || 'new') as Tab);
  const [options, setOptions] = useState<EnquiryOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [opened, setOpened] = useState<{ id: number; data: PrintData; year: string; printedAt: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [callsDue, setCallsDue] = useState(0);


  useEffect(() => {
    setError(null);
    enquiryApi.options().then(o => {
      setOptions(o);
      let saved: number | null = null;
      try { saved = Number(sessionStorage.getItem(BRANCH_KEY)) || null; } catch { /* ignore */ }
      const pick = o.current_branch_id || (saved && o.branches.some(b => b.id === saved) ? saved : null)
        || (o.branches.length === 1 ? o.branches[0].id : null);
      setBranchId(pick);
    }).catch(err => setError(errorText(err)));
  }, [reload]);

  const chooseBranch = (id: number | null) => {
    setBranchId(id);
    try { if (id) sessionStorage.setItem(BRANCH_KEY, String(id)); } catch { /* ignore */ }
  };

  const openEnquiry = async (id: number) => {
    try {
      const e = await enquiryApi.get(id);
      if (e.print) setOpened({ id: e.id, data: e.print, year: e.academic_year, printedAt: e.printed_at || null });
    } catch (err) {
      notify.error(errorText(err));
    }
  };

  // Badge on the Calls tab: calls due now (late + today)
  useEffect(() => {
    if (!branchId || !canCalls) return;
    followupApi.calls(branchId, 'due', false).then(d => setCallsDue(d.counts.overdue + d.counts.today)).catch(() => { /* badge only */ });
  }, [branchId, canCalls, tab, opened]);

  const headerBranchChosen = !!options?.current_branch_id;

  let body: React.ReactNode;
  if (!tabs.length) {
    body = <div className="card"><EmptyState title="No access" description="You do not have access to enquiries. Ask your school admin." /></div>;
  } else if (error) {
    body = <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />;
  } else if (!options) {
    body = <LoadingState />;
  } else if (!options.academic_years.length) {
    body = <div className="card"><EmptyState title="No academic year set up" description="Ask the admin to add the academic year first." /></div>;
  } else if (!branchId) {
    body = <div className="card"><EmptyState title="Choose a branch" description="Choose the branch above to start." /></div>;
  } else if (opened) {
    body = (
      <div className="space-y-4">
        {canCalls && <EnquiryHistory key={`h-${opened.id}`} enquiryId={opened.id} branchId={branchId} />}
        <SlipView key={opened.id} enquiryId={opened.id} data={opened.data} yearName={yearLabel(options.academic_years, opened.year)}
          title={`Enquiry ${opened.data.enquiry_no}`} printedAt={opened.printedAt} onBack={() => setOpened(null)} />
      </div>
    );
  } else if (tab === 'new') {
    body = <NewEnquiry key={branchId} options={options} branchId={branchId} onOpenEnquiry={openEnquiry} />;
  } else if (tab === 'calls') {
    body = <CallsList key={`calls-${branchId}`} branchId={branchId} canCall={canCallWrite} onOpen={openEnquiry} onCountChange={setCallsDue} />;
  } else if (tab === 'dashboard') {
    body = <EnquiryDashboard key={`dash-${branchId}`} branchId={branchId} onGoToCalls={canCalls ? () => setTab('calls') : undefined} />;
  } else if (tab === 'applications') {
    body = <ApplicationsList key={`apps-${branchId}`} branchId={branchId} navigateTo={navigateTo} />;
  } else if (tab === 'list') {
    body = <EnquiryList key={`list-${branchId}`} options={options} branchId={branchId} onOpen={openEnquiry} />;
  } else {
    body = <SchemesSetup key={branchId} options={options} branchId={branchId} />;
  }

  return (
    <div className="min-h-full bg-surface-muted flex flex-col">
      <div className="no-print bg-white border-b border-slate-200">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              <ClipboardList className="w-6 h-6 text-brand-600" />
              Admission Enquiry
            </h1>
            {options && !headerBranchChosen && options.branches.length > 1 && (
              <Field label="Branch" htmlFor="enq-branch" className="w-full sm:w-64">
                <select id="enq-branch" className="input" value={branchId ?? ''} onChange={e => chooseBranch(Number(e.target.value) || null)}>
                  <option value="">Choose branch</option>
                  {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          {tabs.length > 0 && (
            <nav aria-label="Enquiry sections" className="mt-2 -mx-1 flex gap-1 overflow-x-auto">
              {tabs.map(t => {
                const active = tab === t.id && !opened;
                return (
                  <button key={t.id} type="button" aria-current={active ? 'page' : undefined}
                    onClick={() => { setOpened(null); setTab(t.id); }}
                    className={`relative min-h-[44px] px-3 inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors
                      ${active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-900'}`}>
                    <span className={active ? 'text-brand-600' : 'text-slate-400'}>{t.icon}</span>
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                    {t.id === 'calls' && callsDue > 0 && (
                      <span className="rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700 tabular-nums">{callsDue}</span>
                    )}
                    <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${active ? 'bg-brand-600' : 'bg-transparent'}`} />
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
      {/* Extra room at the bottom on phones so the last item is not hidden behind the bottom tab bar */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 pb-28 md:pb-6">{body}</div>
    </div>
  );
};

export default EnquiryModule;
