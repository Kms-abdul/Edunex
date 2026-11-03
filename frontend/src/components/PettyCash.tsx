import React, { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { hasPermission } from '../utils/permissions';
import { notify } from './ui/feedback';
import { LoadingState, EmptyState, Alert, ActionBar, DataList, Field, Steps, Badge } from './ui';
import type { Column } from './ui';
import StatTiles from './cash/StatTiles';
import SegmentTabs from './cash/SegmentTabs';
import Sheet from './cash/Sheet';
import { rupees, shortDate } from './cash/format';


interface Ledger {
  id: number;
  ledger_name: string;
  ledger_type: string;
}

interface PettyCashItem {
  item_name: string;
  amount: number | string;
}

interface PettyCashTxn {
  id?: number;
  branch_id?: number | string;
  transaction_date: string;
  voucher_name: string;
  voucher_type: string;
  ledger_id: number | string;
  ledger_name?: string;
  ledger_type?: string;
  paid_to: string;
  amount: number | string;
  payment_mode: string;
  academic_year?: string;
  description?: string;
  created_by?: string;
  approved_by?: string;
  approval_status?: string;
  approved_at?: string;
  items?: PettyCashItem[];
}

const STEP_LABELS = ['What is it for?', 'Items and amount', 'Check and save'];

const PettyCash: React.FC = () => {
  const [transactions, setTransactions] = useState<PettyCashTxn[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [newLedger, setNewLedger] = useState({ ledger_name: '', ledger_type: 'Indirect' });

  const [selectedReceipt, setSelectedReceipt] = useState<PettyCashTxn | null>(null);

  // Accordion state - group by month
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState({ total_allocated: 0, total_payment: 0, net_amount: 0 });

  // Screen state: which tab, which step, and what was just saved
  const [view, setView] = useState<'new' | 'history'>('new');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ amount: number; name: string; date: string; type: string } | null>(null);

  let user: any = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    console.warn('Invalid user data in localStorage');
  }
  const isAccountant = hasPermission(user, 'fees.fee.petty-cash', 'write');
  const [formData, setFormData] = useState<PettyCashTxn & { items: PettyCashItem[] }>({
    transaction_date: new Date().toISOString().split('T')[0],
    voucher_name: '',
    voucher_type: 'Payment',
    ledger_id: '',
    paid_to: '',
    amount: '',
    items: [{ item_name: '', amount: '' }],
    payment_mode: 'Cash',
    description: '',
    approved_by: '',
  });

  // Need to track ledger type for the form to filter ledgers
  const [selectedLedgerType, setSelectedLedgerType] = useState('Indirect');

  const fetchLedgers = async () => {
    try {
      const response = await api.get('/petty-cash/ledgers');
      setLedgers(response.data);
    } catch (err: any) {
      console.error('Error fetching ledgers', err);
      setError('Failed to load ledgers. Please refresh the page.');
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/petty-cash');
      setTransactions(response.data);

      const summaryResponse = await api.get('/petty-cash/summary');
      setSummary(summaryResponse.data);

      // Auto-expand current month
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      setExpandedMonths(prev => ({ ...prev, [currentMonth]: true }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
    fetchTransactions();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.post('/petty-cash', formData);
      notify.success('Transaction saved successfully');
      setSaved({ amount: grandTotal, name: formData.voucher_name, date: formData.transaction_date, type: formData.voucher_type });
      // Reset form
      setFormData({
        ...formData,
        voucher_name: '',
        paid_to: '',
        amount: '',
        items: [{ item_name: '', amount: '' }],
        ledger_id: '',
        description: '',
        approved_by: '',
      });
      fetchTransactions();
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/petty-cash/ledgers', newLedger);
      notify('Ledger created successfully');
      setShowLedgerModal(false);
      setNewLedger({ ledger_name: '', ledger_type: 'Indirect' });
      fetchLedgers();
    } catch (err: any) {
      notify(err.response?.data?.message || 'Failed to create ledger');
    }
  };

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthStr]: !prev[monthStr] }));
  };

  // Group transactions by month-year
  const groupedTransactions: Record<string, PettyCashTxn[]> = {};
  transactions.forEach(txn => {
    const dateObj = new Date(txn.transaction_date);
    const monthYear = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groupedTransactions[monthYear]) {
      groupedTransactions[monthYear] = [];
    }
    groupedTransactions[monthYear].push(txn);
  });

  const filteredLedgers = ledgers.filter(l => l.ledger_type === selectedLedgerType);
  const grandTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0);

  /* ------------------------------------------------------------ step checks */
  const today = new Date().toISOString().split('T')[0];
  const isPayment = formData.voucher_type === 'Payment';
  const step1Note =
    !formData.transaction_date ? 'Choose the date.'
      : formData.transaction_date > today ? 'The date cannot be in the future.'
        : !formData.voucher_name.trim() ? 'Write what the money was for.'
          : !formData.ledger_id ? 'Choose the expense head.'
            : '';
  const step2Note = formData.items.some(it => !String(it.item_name).trim())
    ? 'Write a name for every item.'
    : formData.items.some(it => it.amount === '' || isNaN(parseFloat(it.amount as string)) || parseFloat(it.amount as string) < 0)
      ? 'Write the amount for every item.'
      : '';
  const ledgerName = ledgers.find(l => String(l.id) === String(formData.ledger_id))?.ledger_name || '';
  const reviewLine = `${isPayment ? 'Record' : 'Record money received:'} ${rupees(grandTotal)} for ${formData.voucher_name || '…'} on ${shortDate(formData.transaction_date)}`;

  const updateItem = (index: number, patch: Partial<PettyCashItem>) => {
    const newItems = formData.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    setFormData({ ...formData, items: newItems });
  };

  const toggleApprover = (who: string, checked: boolean) => {
    let arr = formData.approved_by ? formData.approved_by.split(',') : [];
    if (checked) arr.push(who);
    else arr = arr.filter(a => a !== who);
    setFormData({ ...formData, approved_by: arr.join(',') });
  };

  const startAnother = () => {
    setSaved(null);
    setStep(0);
  };

  /* ---------------------------------------------------------- render: steps */
  const renderStep1 = () => (
    <div className="space-y-4">
      <Field label="Is money going out or coming in?">
        <SegmentTabs
          value={formData.voucher_type}
          onChange={v => setFormData({ ...formData, voucher_type: v })}
          options={[
            { value: 'Payment', label: 'Money spent' },
            { value: 'Received', label: 'Money received' },
          ]}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="What is it for?" htmlFor="pc-name" required hint="A short name, for example: Stationery">
          <input
            id="pc-name"
            type="text"
            name="voucher_name"
            value={formData.voucher_name}
            onChange={handleInputChange}
            className="input min-h-[44px]"
            placeholder="e.g. Stationery"
          />
        </Field>
        <Field label="Date" htmlFor="pc-date" required>
          <input
            id="pc-date"
            type="date"
            name="transaction_date"
            value={formData.transaction_date}
            onChange={handleInputChange}
            max={today}
            className="input min-h-[44px]"
          />
        </Field>

        <Field label="Type of head" htmlFor="pc-head-type" hint="Direct = for teaching. Indirect = running the school.">
          <select
            id="pc-head-type"
            value={selectedLedgerType}
            onChange={(e) => {
              setSelectedLedgerType(e.target.value);
              setFormData({ ...formData, ledger_id: '' }); // Reset ledger selection
            }}
            className="input min-h-[44px]"
          >
            <option value="Direct">Direct</option>
            <option value="Indirect">Indirect</option>
          </select>
        </Field>

        <div>
          <Field label="Expense head" htmlFor="pc-head" required>
            <select id="pc-head" name="ledger_id" value={formData.ledger_id} onChange={handleInputChange} className="input min-h-[44px]">
              <option value="">Choose a head</option>
              {filteredLedgers.map(l => (
                <option key={l.id} value={l.id}>{l.ledger_name}</option>
              ))}
            </select>
          </Field>
          {isAccountant && (
            <button type="button" onClick={() => setShowLedgerModal(true)} className="btn-ghost btn-sm mt-1 !px-1 text-brand-700">
              <Plus className="w-4 h-4" /> Add a new head
            </button>
          )}
        </div>

        <Field label={isPayment ? 'Paid to (optional)' : 'Received from (optional)'} htmlFor="pc-paid-to" className="sm:col-span-2">
          <input
            id="pc-paid-to"
            type="text"
            name="paid_to"
            value={formData.paid_to}
            onChange={handleInputChange}
            className="input min-h-[44px]"
            placeholder="Shop or person name"
          />
        </Field>
      </div>

      <ActionBar note={step1Note || undefined}>
        <button type="button" className="btn-primary btn-lg" disabled={!!step1Note} onClick={() => setStep(1)}>
          Next: items
        </button>
      </ActionBar>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-800 mb-2">What did you {isPayment ? 'buy or pay for' : 'receive money for'}?</p>
        <ul className="space-y-2.5">
          {formData.items.map((item, index) => (
            <li key={index} className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Item {index + 1}</span>
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })}
                    className="btn-ghost btn-sm text-red-600"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-2">
                <input
                  type="text"
                  value={item.item_name}
                  onChange={(e) => updateItem(index, { item_name: e.target.value })}
                  placeholder="Item name, e.g. Chart paper"
                  aria-label={`Item ${index + 1} name`}
                  className="input min-h-[44px]"
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) => updateItem(index, { amount: e.target.value })}
                    placeholder="Amount"
                    aria-label={`Item ${index + 1} amount`}
                    className="input min-h-[44px] pl-7 text-right"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, items: [...formData.items, { item_name: '', amount: '' }] })}
          className="btn-secondary w-full sm:w-auto mt-2.5"
        >
          <Plus className="w-4 h-4" /> Add another item
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
        <span className="text-sm font-medium text-emerald-900">Total</span>
        <span className="text-2xl font-semibold text-emerald-700 tabular-nums">{rupees(grandTotal)}</span>
      </div>

      <Field label="How was it paid?">
        <SegmentTabs
          value={formData.payment_mode}
          onChange={v => setFormData({ ...formData, payment_mode: v })}
          options={[
            { value: 'Cash', label: 'Cash' },
            { value: 'UPI', label: 'UPI' },
          ]}
        />
      </Field>

      <ActionBar note={step2Note || undefined}>
        <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(0)}>Back</button>
        <button type="button" className="btn-primary btn-lg" disabled={!!step2Note} onClick={() => setStep(2)}>
          Next: check
        </button>
      </ActionBar>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <Alert tone="info" title={reviewLine}>
        {ledgerName && <>{ledgerName} · </>}
        {formData.payment_mode}
        {formData.paid_to ? ` · ${isPayment ? 'Paid to' : 'From'} ${formData.paid_to}` : ''}
      </Alert>

      <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
        {formData.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
            <span className="text-slate-700 break-words min-w-0">{it.item_name}</span>
            <span className="font-medium tabular-nums">{rupees(it.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 px-4 py-2.5 bg-slate-50 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{rupees(grandTotal)}</span>
        </li>
      </ul>

      <Field label="Note (optional)" htmlFor="pc-note">
        <textarea
          id="pc-note"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={2}
          className="input"
          placeholder="Any details to remember"
        />
      </Field>

      <Field label="Who agreed to this? (optional)">
        <div className="flex flex-wrap gap-2">
          {['Principal', 'Director'].map(who => (
            <label key={who} className="flex items-center gap-2.5 min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                value={who}
                checked={formData.approved_by?.includes(who)}
                onChange={(e) => toggleApprover(who, e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-brand-600"
              />
              {who}
            </label>
          ))}
        </div>
      </Field>

      <p className="text-sm text-slate-500">Recorded by <span className="font-medium text-slate-700">{user.username || 'Current User'}</span></p>

      <ActionBar note={reviewLine}>
        <button type="button" className="btn-secondary btn-lg" onClick={() => setStep(1)} disabled={saving}>Back</button>
        <button type="button" className="btn-primary btn-lg" onClick={handleSubmit} disabled={saving || !!step1Note || !!step2Note} aria-busy={saving || undefined}>
          {saving ? 'Saving…' : `Record ${rupees(grandTotal)}`}
        </button>
      </ActionBar>
    </div>
  );

  const renderDone = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
        <p className="mt-3 text-xl font-semibold text-slate-900">{rupees(saved?.amount ?? 0)} recorded</p>
        {saved && (
          <p className="mt-1 text-sm text-slate-700">
            {saved.type === 'Received' ? 'Money received' : 'Spent'} for {saved.name} on {shortDate(saved.date)}. It now waits for approval.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" className="btn-primary btn-lg" onClick={startAnother}>Record another</button>
        <button type="button" className="btn-secondary btn-lg" onClick={() => { startAnother(); setView('history'); }}>See past entries</button>
      </div>
    </div>
  );

  /* ------------------------------------------------------- render: history */
  const historyColumns: Column<PettyCashTxn>[] = [
    { key: 'voucher_name', header: 'For', primary: true },
    { key: 'transaction_date', header: 'Date', secondary: true, render: t => `${shortDate(t.transaction_date)} · ${t.ledger_name || ''}` },
    {
      key: 'voucher_type', header: 'Type',
      render: t => <Badge tone={t.voucher_type === 'Received' ? 'success' : 'danger'}>{t.voucher_type === 'Received' ? 'Received' : 'Spent'}</Badge>,
    },
    { key: 'paid_to', header: 'Paid to', render: t => t.paid_to || '—', hideOnMobile: true },
    { key: 'payment_mode', header: 'Mode', hideOnMobile: true },
    { key: 'amount', header: 'Amount', align: 'right', render: t => <span className="font-semibold">{rupees(t.amount)}</span> },
    { key: 'approval_status', header: 'Status', render: t => <Badge status={t.approval_status || 'Pending'} /> },
  ];

  const renderHistory = () => (
    <div className="card overflow-hidden">
      {loading ? (
        <LoadingState label="Loading entries…" />
      ) : error ? (
        <div className="p-4"><Alert tone="error" onRetry={fetchTransactions}>{error}</Alert></div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <EmptyState compact title="No entries yet" description="Nothing recorded for this branch and academic year." />
      ) : (
        <div className="divide-y divide-slate-200">
          {Object.entries(groupedTransactions).map(([monthYear, txns]) => (
            <div key={monthYear}>
              <button
                type="button"
                onClick={() => toggleMonth(monthYear)}
                aria-expanded={!!expandedMonths[monthYear]}
                className="w-full min-h-[52px] flex items-center justify-between gap-3 px-4 text-left hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-800">{monthYear}</span>
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  {txns.length} {txns.length === 1 ? 'entry' : 'entries'}
                  {expandedMonths[monthYear] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>
              {expandedMonths[monthYear] && (
                <div className="px-3 pb-3 md:px-0 md:pb-0">
                  <DataList
                    columns={historyColumns}
                    rows={txns}
                    rowKey={(t, i) => t.id ?? i}
                    onRowClick={t => setSelectedReceipt(t)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="print:hidden space-y-4">
        <StatTiles
          tiles={[
            { label: 'Cash in hand', value: `₹ ${summary.net_amount?.toFixed(2) ?? '0.00'}`, tone: summary.net_amount < 0 ? 'danger' : 'brand', wide: true },
            { label: 'Money given', value: `₹ ${summary.total_allocated?.toFixed(2) || '0.00'}`, tone: 'success' },
            { label: 'Spent', value: `₹ ${summary.total_payment?.toFixed(2) || '0.00'}`, tone: 'danger' },
          ]}
        />

        <SegmentTabs
          value={view}
          onChange={setView}
          options={[
            { value: 'new', label: 'Record expense' },
            { value: 'history', label: 'Past entries', count: transactions.length },
          ]}
        />

        {view === 'new' ? (
          <div className="card p-4 sm:p-5 max-w-3xl">
            {saved ? (
              renderDone()
            ) : (
              <>
                <Steps steps={STEP_LABELS} current={step} onJump={setStep} className="mb-5" />
                {error && !loading && step === 0 && <Alert tone="error" className="mb-4" onRetry={() => { setError(''); fetchLedgers(); fetchTransactions(); }}>{error}</Alert>}
                {step === 0 && renderStep1()}
                {step === 1 && renderStep2()}
                {step === 2 && renderStep3()}
              </>
            )}
          </div>
        ) : (
          renderHistory()
        )}
      </div>

      {/* Add expense head (ledger) */}
      {showLedgerModal && (
        <Sheet
          title="Add a new expense head"
          onClose={() => setShowLedgerModal(false)}
        >
          <form onSubmit={handleCreateLedger} className="space-y-4">
            <Field label="Head name" htmlFor="new-head-name" required hint="For example: Stationery, Repairs, Travel">
              <input
                id="new-head-name"
                type="text"
                value={newLedger.ledger_name}
                onChange={(e) => setNewLedger({ ...newLedger, ledger_name: e.target.value })}
                className="input min-h-[44px]"
                required
              />
            </Field>
            <Field label="Type of head" htmlFor="new-head-type">
              <select
                id="new-head-type"
                value={newLedger.ledger_type}
                onChange={(e) => setNewLedger({ ...newLedger, ledger_type: e.target.value })}
                className="input min-h-[44px]"
              >
                <option value="Direct">Direct</option>
                <option value="Indirect">Indirect</option>
              </select>
            </Field>
            <div className="flex gap-2 justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
              <button type="button" onClick={() => setShowLedgerModal(false)} className="btn-secondary btn-lg">Cancel</button>
              <button type="submit" className="btn-primary btn-lg">Save head</button>
            </div>
          </form>
        </Sheet>
      )}

      {/* View Details Modal */}
      {selectedReceipt && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex items-center justify-center z-50 p-4 transition-all duration-300 print:absolute print:inset-0 print:bg-white print:p-0 print:z-auto">
          <div className="card shadow-pop w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all print:shadow-none print:max-h-none print:rounded-none">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center text-slate-900 print:bg-none print:bg-white print:text-black print:border-b-2 print:border-gray-800">
              <h3 className="text-base font-semibold">Transaction Overview</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-slate-700 transition-colors text-2xl leading-none print:hidden">&times;</button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto print:overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-blue-600 font-semibold block text-xs uppercase tracking-wider mb-1">Date</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.transaction_date}</span>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-indigo-600 font-semibold block text-xs uppercase tracking-wider mb-1">Voucher Name</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.voucher_name}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Voucher Type</span>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${selectedReceipt.voucher_type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {selectedReceipt.voucher_type}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Ledger</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.ledger_name}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Ledger Type</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.ledger_type || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Paid To / Received From</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.paid_to || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Payment Mode</span>
                  <div>
                    {selectedReceipt.payment_mode === 'Cash' ? <span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full text-xs">CASH</span> : <span className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full text-xs">UPI</span>}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-2">Items</span>
                  {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm text-left">
                        <thead className="border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2">Item Name</th>
                            <th className="px-4 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceipt.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                              <td className="px-4 py-2 text-gray-800">{item.item_name}</td>
                              <td className="px-4 py-2 text-right font-medium text-gray-700">₹{Number(item.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td className="px-4 py-2 font-bold text-gray-800 text-right uppercase text-xs tracking-wider">Total</td>
                            <td className="px-4 py-2 font-bold text-emerald-700 text-right text-base">₹{Number(selectedReceipt.amount).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No items recorded.</span>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Description</span>
                  <span className="font-medium text-gray-700 whitespace-pre-wrap">{selectedReceipt.description || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Created By</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.created_by || '-'}</span>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-amber-700 font-semibold block text-xs uppercase tracking-wider mb-1">Approved By</span>
                  <span className="font-bold text-amber-900 text-base">{selectedReceipt.approved_by || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Academic Year</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.academic_year || '-'}</span>
                </div>
              </div>

              {/* Signatures for Print */}
              <div className="hidden print:flex justify-between items-end mt-24 mb-8 px-8 w-full">
                <div className="text-center">
                  <div className="border-t-2 border-gray-800 w-48 mb-2"></div>
                  <span className="font-semibold text-gray-800">Principal Signature</span>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-gray-800 w-48 mb-2"></div>
                  <span className="font-semibold text-gray-800">Director Signature</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3 print:hidden">
              <button onClick={() => window.print()} className="btn-primary">
                Print Receipt
              </button>
              <button onClick={() => setSelectedReceipt(null)} className="btn-secondary">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PettyCash;
