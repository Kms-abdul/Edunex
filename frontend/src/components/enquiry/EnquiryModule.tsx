import React, { useEffect, useState } from 'react';
import { ClipboardList, PlusCircle, List, Gift } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, ErrorState, Field, LoadingState, notify } from '../ui';
import { EnquiryOptions, PrintData, enquiryApi, errorText, yearLabel } from './enquiryApi';
import NewEnquiry, { SlipView } from './NewEnquiry';
import EnquiryList from './EnquiryList';
import SchemesSetup from './SchemesSetup';

type Tab = 'new' | 'list' | 'schemes';
const TAB_KEY = 'kampusops.enquiryTab';
const BRANCH_KEY = 'kampusops.enquiryBranch';

/**
 * Admission enquiry (front office).
 * New enquiry → Save & Print slip for the parent; list to find and reprint; schemes set up by the admin.
 */
const EnquiryModule: React.FC = () => {
  const { hasPermission } = useAuth();
  const canEnquiry = hasPermission('administration.enquiry.enquiry', 'read');
  const canSchemes = hasPermission('administration.enquiry.schemes', 'read');

  const tabs = ([
    canEnquiry && { id: 'new', label: 'New enquiry', short: 'New', icon: <PlusCircle className="w-4 h-4" /> },
    canEnquiry && { id: 'list', label: 'Enquiry list', short: 'List', icon: <List className="w-4 h-4" /> },
    canSchemes && { id: 'schemes', label: 'Schemes', short: 'Schemes', icon: <Gift className="w-4 h-4" /> },
  ].filter(Boolean)) as { id: Tab; label: string; short: string; icon: React.ReactNode }[];

  const [tab, setTab] = useState<Tab>(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(TAB_KEY); } catch { /* ignore */ }
    return (tabs.find(t => t.id === saved)?.id || tabs[0]?.id || 'new') as Tab;
  });
  const [options, setOptions] = useState<EnquiryOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [opened, setOpened] = useState<{ data: PrintData; year: string } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { try { sessionStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ } }, [tab]);

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
      if (e.print) setOpened({ data: e.print, year: e.academic_year });
    } catch (err) {
      notify.error(errorText(err));
    }
  };

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
      <SlipView data={opened.data} yearName={yearLabel(options.academic_years, opened.year)}
        title={`Enquiry ${opened.data.enquiry_no}`} onBack={() => setOpened(null)} />
    );
  } else if (tab === 'new') {
    body = <NewEnquiry key={branchId} options={options} branchId={branchId} onOpenEnquiry={openEnquiry} />;
  } else if (tab === 'list') {
    body = <EnquiryList key={branchId} options={options} branchId={branchId} onOpen={openEnquiry} />;
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
                    <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${active ? 'bg-brand-600' : 'bg-transparent'}`} />
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6">{body}</div>
    </div>
  );
};

export default EnquiryModule;
