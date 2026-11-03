import React, { useState, useEffect, useRef } from 'react';
import api, { remittanceApi } from '../api';
import { Building2, CheckCircle2, Landmark, Paperclip, Printer, RefreshCw, Upload } from 'lucide-react';
import { notify } from './ui/feedback';
import { ActionBar, Alert, Badge, DataList, Field, Steps } from './ui';
import type { Column } from './ui';
import StatTiles from './cash/StatTiles';
import SegmentTabs from './cash/SegmentTabs';
import { shortDate } from './cash/format';

interface DenominationRow {
  denomination: number;
  quantity: string;
  amount: number;
}

const DEFAULT_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
const STEP_LABELS = ['How much cash?', 'Count the notes', 'Where is it going?', 'Check and save'];

const RemittanceDeposit: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const selectedBranchRef = useRef<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Read-only system calculated cash position
  const [cashPosition, setCashPosition] = useState<{
    cash_in_hand: number;
    opening_balance: number;
    today_collection: number;
    today_remitted: number;
    total_cash_collected: number;
    total_remitted: number;
    unremitted_receipts: any[];
    branch_name: string;
  }>({
    cash_in_hand: 0,
    opening_balance: 0,
    today_collection: 0,
    today_remitted: 0,
    total_cash_collected: 0,
    total_remitted: 0,
    unremitted_receipts: [],
    branch_name: ''
  });

  // Form State
  const [businessDate, setBusinessDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [depositType, setDepositType] = useState<'Corporate Office' | 'Bank'>('Corporate Office');
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [printModalData, setPrintModalData] = useState<any | null>(null);

  const [denominations, setDenominations] = useState<DenominationRow[]>(
    DEFAULT_DENOMINATIONS.map(d => ({ denomination: d, quantity: '', amount: 0 }))
  );

  // Recent Submissions
  const [recentRemittances, setRecentRemittances] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'deposit' | 'history'>('deposit');

  // Step flow for a new deposit, and the deposit just saved (for the success screen)
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<any | null>(null);
  const denomRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
    if (selectedBranch) {
      const controller = new AbortController();
      fetchCashPosition(selectedBranch, controller.signal);
      fetchRecentRemittances(selectedBranch, controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [selectedBranch]);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      const branchList = res.data?.branches || [];
      setBranches(branchList);

      const storedBranch = localStorage.getItem('currentBranch') || '';
      if (storedBranch && storedBranch !== 'All') {
        const found = branchList.find((b: any) => b.branch_name === storedBranch || b.id.toString() === storedBranch);
        if (found) {
          setSelectedBranch(found.id.toString());
          return;
        }
      }
      if (branchList.length > 0) {
        setSelectedBranch(branchList[0].id.toString());
      }
    } catch (e: any) {
      console.error('Error fetching branches:', e);
      setMessage({
        text: e.response?.data?.error || e.message || 'Failed to fetch branches. Please verify your connection and login status.',
        type: 'error'
      });
    }
  };

  const fetchCashPosition = async (branchToFetch = selectedBranch, signal?: AbortSignal) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await remittanceApi.getCashPosition({ branch_id: branchToFetch }, { signal });
      if (branchToFetch !== selectedBranchRef.current) return;
      if (res.data) {
        setCashPosition({
          cash_in_hand: res.data.cash_in_hand || 0,
          opening_balance: res.data.opening_balance || 0,
          today_collection: res.data.today_collection || 0,
          today_remitted: res.data.today_remitted || 0,
          total_cash_collected: res.data.total_cash_collected || 0,
          total_remitted: res.data.total_remitted || 0,
          unremitted_receipts: res.data.unremitted_receipts || [],
          branch_name: res.data.branch_name || ''
        });
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') return;
      if (branchToFetch !== selectedBranchRef.current) return;
      console.error('Failed to fetch cash position:', err);
      setMessage({
        text: err.response?.data?.error || 'Failed to fetch read-only cash position from system.',
        type: 'error'
      });
    } finally {
      if (branchToFetch === selectedBranchRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchRecentRemittances = async (branchToFetch = selectedBranch, signal?: AbortSignal) => {
    try {
      const res = await remittanceApi.listRemittances({ branch_id: branchToFetch }, { signal });
      if (branchToFetch !== selectedBranchRef.current) return;
      if (res.data && Array.isArray(res.data)) {
        setRecentRemittances(res.data);
      }
    } catch (e: any) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || e.message === 'canceled') return;
      if (branchToFetch !== selectedBranchRef.current) return;
      console.error('Error fetching recent remittances:', e);
    }
  };

  const handleDenomChange = (index: number, qtyStr: string) => {
    const val = parseInt(qtyStr, 10);
    const validQty = isNaN(val) || val < 0 ? 0 : val;

    const updated = [...denominations];
    updated[index].quantity = qtyStr;
    updated[index].amount = updated[index].denomination * validQty;
    setDenominations(updated);
  };

  const totalDenomValue = denominations.reduce((sum, row) => sum + row.amount, 0);
  const depositVal = parseFloat(depositAmount) || 0;
  const remainingCash = cashPosition.cash_in_hand - depositVal;
  const isDenomMatch = Math.abs(totalDenomValue - depositVal) < 0.01;

  const handleSubmit = async (e: React.FormEvent, shouldPrint: boolean = false) => {
    e.preventDefault();
    setMessage(null);

    if (depositVal <= 0) {
      setMessage({ text: 'Please enter a valid deposit amount greater than zero.', type: 'error' });
      return;
    }

    if (depositVal > cashPosition.cash_in_hand) {
      setMessage({
        text: `Fraud Prevention Verification Failed: Deposit Amount (₹${depositVal.toLocaleString()}) cannot exceed available system Cash in Hand (₹${cashPosition.cash_in_hand.toLocaleString()}).`,
        type: 'error'
      });
      return;
    }

    if (!isDenomMatch) {
      setMessage({
        text: `Denomination breakdown total (₹${totalDenomValue.toLocaleString()}) must exactly match Deposit Amount (₹${depositVal.toLocaleString()}).`,
        type: 'error'
      });
      return;
    }

    if (depositType === 'Bank' && (!bankName.trim() || !accountNumber.trim() || !referenceNo.trim())) {
      setMessage({
        text: 'For Bank Deposit, Bank Name, Account Number, and Slip/Challan Reference No are mandatory.',
        type: 'error'
      });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('branch_id', selectedBranch);
      formData.append('business_date', businessDate);
      formData.append('deposit_amount', depositVal.toString());
      formData.append('deposit_type', depositType);
      if (depositType === 'Bank') {
        formData.append('bank_name', bankName);
        formData.append('account_number', accountNumber);
        formData.append('reference_no', referenceNo);
      } else {
        formData.append('reference_no', referenceNo);
      }
      formData.append('remarks', remarks);

      const activeDenoms = denominations
        .filter(d => parseInt(d.quantity, 10) > 0)
        .map(d => ({ denomination: d.denomination, quantity: parseInt(d.quantity, 10) }));
      formData.append('denominations', JSON.stringify(activeDenoms));

      if (attachment) {
        formData.append('attachment', attachment);
      }

      const res = await remittanceApi.createRemittance(formData);
      setMessage({
        text: `Remittance ${res.data.remittance_no} submitted successfully! Pending Head Office review.`,
        type: 'success'
      });

      const fullRemittance = res.data.remittance || {
        ...res.data,
        branch_name: branches.find((b: any) => b.id.toString() === selectedBranch)?.branch_name || selectedBranch,
        business_date: businessDate,
        deposit_type: depositType,
        bank_name: bankName,
        account_number: accountNumber,
        reference_no: referenceNo,
        remarks: remarks,
        deposit_amount: depositVal,
        cash_in_hand: cashPosition.cash_in_hand,
        remaining_cash: remainingCash,
        denominations: activeDenoms,
        created_at: new Date().toLocaleString()
      };
      // Reset form
      setDepositAmount('');
      setRemarks('');
      setAttachment(null);
      setBankName('');
      setAccountNumber('');
      setReferenceNo('');
      setDenominations(DEFAULT_DENOMINATIONS.map(d => ({ denomination: d, quantity: '', amount: 0 })));

      // Reload real-time position and history
      fetchCashPosition();
      fetchRecentRemittances();
      setDone(fullRemittance);

      if (shouldPrint) {
        setPrintModalData(fullRemittance);
      }
    } catch (err: any) {
      console.error('Submission failed:', err);
      setMessage({
        text: err.response?.data?.error || 'Failed to submit remittance deposit.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    setTimeout(() => {
      const content = document.getElementById('printable-remittance-receipt');
      if (!content) return window.print();

      const printWindow = window.open('', '_blank', 'width=900,height=750');
      if (!printWindow) return window.print();

      const head = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style')
      )
        .map((el) => el.outerHTML)
        .join('');
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head>${head}<style>body{margin:0;padding:24px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial;}</style></head><body>${content.innerHTML}</body></html>`);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      };
    }, 500);
  };

  const handleDownloadAttachment = async (id: number, remittance_no: string) => {
    try {
      const url = remittanceApi.getAttachmentUrl(id);
      const token = localStorage.getItem('token') || '';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Could not fetch attachment');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const extension = blob.type.split('/')[1] || 'png';
      a.download = `Deposit_Slip_${remittance_no}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      notify('Failed to download deposit slip attachment. File may not exist.');
    }
  };

  /* ------------------------------------------------------------ step helpers */
  const branchName = branches.find((b: any) => b.id.toString() === selectedBranch)?.branch_name || cashPosition.branch_name || '';
  const pendingCount = recentRemittances.filter(r => r.status === 'Pending').length;
  const amountNote =
    !selectedBranch ? 'Choose a branch first.'
      : !businessDate ? 'Choose the date.'
        : depositVal <= 0 ? 'Write how much cash you are depositing.'
          : depositVal > cashPosition.cash_in_hand ? `You can deposit at most ₹${cashPosition.cash_in_hand.toLocaleString()} (the cash in hand).`
            : '';
  const notesNote = isDenomMatch
    ? ''
    : totalDenomValue < depositVal
      ? `Notes counted so far: ₹${totalDenomValue.toLocaleString()}. Count ₹${(depositVal - totalDenomValue).toLocaleString()} more.`
      : `Notes counted (₹${totalDenomValue.toLocaleString()}) are more than the deposit (₹${depositVal.toLocaleString()}).`;
  const whereNote = depositType === 'Bank' && (!bankName.trim() || !accountNumber.trim() || !referenceNo.trim())
    ? 'Fill in the bank name, account and slip number.'
    : '';
  const reviewLine = `Deposit ₹${depositVal.toLocaleString()} ${depositType === 'Bank' ? `in ${bankName || 'the bank'}` : 'with head office'} on ${shortDate(businessDate)}`;
  const anyBlock = amountNote || notesNote || whereNote;

  const goToStep = (n: number) => { setMessage(null); setStep(n); };

  const startAnother = () => {
    setDone(null);
    setMessage(null);
    setStep(0);
  };

  const historyColumns: Column<any>[] = [
    { key: 'deposit_amount', header: 'Amount', primary: true, render: rem => `₹${rem.deposit_amount.toLocaleString()}` },
    { key: 'business_date', header: 'Date', secondary: true, render: rem => `${shortDate(rem.business_date)} · ${rem.remittance_no}` },
    {
      key: 'deposit_type', header: 'Where',
      render: rem => (
        <span>
          {rem.deposit_type === 'Bank' ? 'Bank' : 'Head office'}
          {rem.deposit_type === 'Bank' && rem.bank_name ? ` · ${rem.bank_name}${rem.account_number ? ` (••••${String(rem.account_number).slice(-4)})` : ''}` : ''}
          {rem.reference_no ? <span className="block text-xs text-slate-500 break-words">Ref: {rem.reference_no}</span> : null}
        </span>
      ),
    },
    { key: 'remaining_cash', header: 'Cash left', align: 'right', render: rem => `₹${rem.remaining_cash.toLocaleString()}` },
    {
      key: 'status', header: 'Status',
      render: rem => <Badge status={rem.status}>{rem.status === 'Approved' ? 'Approved' : rem.status === 'Rejected' ? 'Rejected' : 'Waiting for approval'}</Badge>,
    },
    {
      key: 'actions', header: '', hideOnMobile: true, align: 'right',
      render: rem => (
        <span className="inline-flex gap-1.5 whitespace-nowrap">
          {rem.attachment_path && (
            <button onClick={() => handleDownloadAttachment(rem.id, rem.remittance_no)} className="btn-soft btn-sm">Slip</button>
          )}
          <button onClick={() => setPrintModalData(rem)} className="btn-secondary btn-sm">Print</button>
        </span>
      ),
    },
  ];

  /* ------------------------------------------------------------ render steps */
  const renderAmount = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="How much cash are you depositing?"
          htmlFor="dep-amount"
          required
          error={depositVal > cashPosition.cash_in_hand ? `More than the cash in hand (₹${cashPosition.cash_in_hand.toLocaleString()}).` : null}
          hint={`Cash in hand now: ₹${(cashPosition.cash_in_hand || 0).toLocaleString()}`}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
            <input
              id="dep-amount"
              type="number"
              inputMode="numeric"
              step="1"
              placeholder="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className={`input min-h-[48px] pl-8 text-lg font-semibold ${depositVal > cashPosition.cash_in_hand ? '!border-rose-500 text-rose-700' : ''}`}
            />
          </div>
        </Field>
        <Field label="Date" htmlFor="dep-date" required>
          <input id="dep-date" type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="input min-h-[48px]" />
        </Field>
      </div>

      {depositVal > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-700">Cash left after this deposit</span>
          <span className={`text-lg font-semibold ${remainingCash < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            ₹{isNaN(remainingCash) ? '0' : remainingCash.toLocaleString()}
          </span>
        </div>
      )}

      <ActionBar note={amountNote || undefined}>
        <button type="button" className="btn-primary btn-lg" disabled={!!amountNote || loading} onClick={() => goToStep(1)}>
          Next: count notes
        </button>
      </ActionBar>
    </div>
  );

  const renderNotes = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Write how many of each note or coin you are depositing. The total must be exactly <span className="font-semibold text-slate-900">₹{depositVal.toLocaleString()}</span>.
      </p>
      <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {denominations.map((row, idx) => (
          <li key={row.denomination} className="flex items-center gap-3 px-3 py-2">
            <label htmlFor={`denom-${row.denomination}`} className="w-16 font-semibold text-slate-800">₹ {row.denomination}</label>
            <span className="text-slate-400" aria-hidden="true">×</span>
            <input
              id={`denom-${row.denomination}`}
              ref={el => { denomRefs.current[idx] = el; }}
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={row.quantity}
              onChange={(e) => handleDenomChange(idx, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  denomRefs.current[idx + 1]?.focus();
                }
              }}
              enterKeyHint={idx === denominations.length - 1 ? 'done' : 'next'}
              className="input !w-24 min-h-[44px] text-center font-semibold"
            />
            <span className="ml-auto font-semibold text-slate-900 tabular-nums">₹ {row.amount.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isDenomMatch ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <span className="text-sm font-medium text-slate-800">{isDenomMatch ? 'Notes match the deposit' : 'Notes counted'}</span>
        <span className={`text-xl font-semibold tabular-nums ${isDenomMatch ? 'text-emerald-700' : 'text-amber-800'}`}>
          ₹ {totalDenomValue.toLocaleString()} <span className="text-sm font-normal text-slate-500">of ₹{depositVal.toLocaleString()}</span>
        </span>
      </div>
      <ActionBar note={notesNote || undefined}>
        <button type="button" className="btn-secondary btn-lg" onClick={() => goToStep(0)}>Back</button>
        <button type="button" className="btn-primary btn-lg" disabled={!!notesNote} onClick={() => goToStep(2)}>
          Next: where it goes
        </button>
      </ActionBar>
    </div>
  );

  const renderWhere = () => (
    <div className="space-y-4">
      <Field label="Where is the cash going?">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'Corporate Office', label: 'Head office', icon: <Building2 className="w-5 h-5" /> },
            { value: 'Bank', label: 'Bank', icon: <Landmark className="w-5 h-5" /> },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={depositType === opt.value}
              onClick={() => setDepositType(opt.value)}
              className={`min-h-[52px] rounded-xl border-2 px-3 font-semibold text-sm flex items-center justify-center gap-2 ${depositType === opt.value
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {depositType === 'Bank' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Bank name" htmlFor="dep-bank" required>
            <input id="dep-bank" type="text" placeholder="e.g. State Bank of India" value={bankName} onChange={(e) => setBankName(e.target.value)} className="input min-h-[44px]" />
          </Field>
          <Field label="Account number or name" htmlFor="dep-acc" required>
            <input id="dep-acc" type="text" placeholder="e.g. A/C xxx1234" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="input min-h-[44px]" />
          </Field>
          <Field label="Deposit slip number" htmlFor="dep-ref" required className="sm:col-span-2" hint="The number printed on the bank slip or challan.">
            <input id="dep-ref" type="text" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="input min-h-[44px]" />
          </Field>
        </div>
      ) : (
        <Field label="Who is carrying the cash? (optional)" htmlFor="dep-ref" hint="Staff name or a reference number.">
          <input id="dep-ref" type="text" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="input min-h-[44px]" />
        </Field>
      )}

      <Field label={depositType === 'Bank' ? 'Photo of the bank slip (recommended)' : 'Photo of the proof (optional)'}>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          id="slip-upload"
          onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)}
          className="hidden"
        />
        <label
          htmlFor="slip-upload"
          className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-medium text-brand-700 hover:bg-slate-100"
        >
          {attachment ? (
            <span className="text-emerald-700 break-all"><Paperclip className="inline w-4 h-4" /> {attachment.name}</span>
          ) : (
            <><Upload className="w-4 h-4" /> Add photo or PDF</>
          )}
        </label>
      </Field>

      <Field label="Note (optional)" htmlFor="dep-note">
        <textarea id="dep-note" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input" />
      </Field>

      <ActionBar note={whereNote || undefined}>
        <button type="button" className="btn-secondary btn-lg" onClick={() => goToStep(1)}>Back</button>
        <button type="button" className="btn-primary btn-lg" disabled={!!whereNote} onClick={() => goToStep(3)}>
          Next: check
        </button>
      </ActionBar>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <Alert tone="info" title={reviewLine}>
        From {branchName || 'this branch'}
        {depositType === 'Bank' && accountNumber ? ` · Account ${accountNumber}` : ''}
        {referenceNo ? ` · Ref ${referenceNo}` : ''}
      </Alert>
      <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">Cash in hand now</dt><dd className="font-medium">₹{cashPosition.cash_in_hand.toLocaleString()}</dd></div>
        <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">Depositing</dt><dd className="font-semibold text-emerald-700">₹{depositVal.toLocaleString()}</dd></div>
        <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">Cash left after</dt><dd className="font-medium">₹{remainingCash.toLocaleString()}</dd></div>
        <div className="flex justify-between gap-3 px-4 py-2.5">
          <dt className="text-slate-600">Notes</dt>
          <dd className="text-right">{denominations.filter(d => parseInt(d.quantity, 10) > 0).map(d => `₹${d.denomination} × ${d.quantity}`).join(', ')}</dd>
        </div>
        {attachment && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">Photo</dt><dd className="text-right break-all">{attachment.name}</dd></div>}
        {remarks && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-slate-600">Note</dt><dd className="text-right break-words">{remarks}</dd></div>}
      </dl>
      <p className="text-sm text-slate-500">Head office will check and approve this deposit.</p>

      <ActionBar note={anyBlock || reviewLine}>
        <button type="button" className="btn-secondary btn-lg" onClick={() => goToStep(2)} disabled={submitting}>Back</button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, false)}
          disabled={submitting || loading || depositVal <= 0 || depositVal > cashPosition.cash_in_hand || !isDenomMatch}
          className="btn-secondary btn-lg"
        >
          {submitting ? 'Saving…' : 'Save only'}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true)}
          disabled={submitting || loading || depositVal <= 0 || depositVal > cashPosition.cash_in_hand || !isDenomMatch}
          className="btn-primary btn-lg"
        >
          <Printer className="w-4 h-4" /> {submitting ? 'Saving…' : 'Save and print'}
        </button>
      </ActionBar>
    </div>
  );

  const renderDone = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
        <p className="mt-3 text-xl font-semibold text-slate-900">₹{(done?.deposit_amount || 0).toLocaleString()} deposit saved</p>
        <p className="mt-1 text-sm text-slate-700">
          {done?.remittance_no ? <>Number <span className="font-semibold">{done.remittance_no}</span> · </> : null}
          Waiting for head office to approve.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" className="btn-primary btn-lg sm:col-span-2" onClick={() => setPrintModalData(done)}>
          <Printer className="w-4 h-4" /> Print receipt
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={startAnother}>Make another deposit</button>
        <button type="button" className="btn-secondary btn-lg" onClick={() => { startAnother(); setActiveTab('history'); }}>See past deposits</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Deposit cash</h2>
        <p className="text-sm text-slate-500">Send the day's cash to the bank or head office.</p>
      </div>

      {message && !(done && message.type === 'success') && (
        <Alert tone={message.type === 'success' ? 'success' : 'error'} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <Field label="Branch" htmlFor="dep-branch" className="flex-1">
          <select id="dep-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="input min-h-[44px]">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </Field>
        <button onClick={() => { fetchCashPosition(); fetchRecentRemittances(); }} className="btn-secondary" title="Get the latest cash figures">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <StatTiles
        tiles={[
          {
            label: 'Cash in hand now', value: `₹${(cashPosition.cash_in_hand || 0).toLocaleString()}`, tone: 'warning', wide: true,
            hint: `Cash at start of day + today's cash fees${cashPosition.today_remitted > 0 ? ` − today's deposits (₹${cashPosition.today_remitted.toLocaleString()})` : ''}`,
          },
          { label: 'Cash at start of day', value: `₹${(cashPosition.opening_balance || 0).toLocaleString()}` },
          { label: "Today's cash fees", value: `₹${(cashPosition.today_collection || 0).toLocaleString()}`, tone: 'brand' },
        ]}
      />

      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'deposit', label: 'New deposit' },
          { value: 'history', label: pendingCount > 0 ? `Past deposits · ${pendingCount} waiting` : 'Past deposits' },
        ]}
      />

      {activeTab === 'deposit' ? (
        <div className="card p-4 sm:p-5">
          {done ? renderDone() : (
            <>
              <Steps steps={STEP_LABELS} current={step} onJump={goToStep} className="mb-5" />
              {step === 0 && renderAmount()}
              {step === 1 && renderNotes()}
              {step === 2 && renderWhere()}
              {step === 3 && renderReview()}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => fetchRecentRemittances()} className="btn-soft">
              <RefreshCw className="w-4 h-4" /> Refresh list
            </button>
          </div>
          <DataList
            columns={historyColumns}
            rows={recentRemittances}
            rowKey={(rem, i) => rem.id ?? i}
            emptyTitle="No cash deposits yet"
            emptyHint="No cash deposits found for this branch."
            mobileActions={rem => (
              <>
                {rem.attachment_path && (
                  <button onClick={() => handleDownloadAttachment(rem.id, rem.remittance_no)} className="btn-soft btn-sm flex-1">
                    <Paperclip className="w-4 h-4" /> Slip
                  </button>
                )}
                <button onClick={() => setPrintModalData(rem)} className="btn-secondary btn-sm flex-1">
                  <Printer className="w-4 h-4" /> Print
                </button>
              </>
            )}
          />
        </div>
      )}

      {printModalData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
          <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col shadow-pop overflow-hidden">
            <div className="card-header no-print">
              <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
                <span>🖨️</span> Remittance Deposit Voucher Preview
              </h3>
              <button onClick={() => setPrintModalData(null)} className="btn-icon">✕</button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-slate-800" id="printable-remittance-receipt">
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">MS HIFZ EDU ERP</h1>
                <p className="text-sm font-bold text-slate-600 mt-0.5">CASH REMITTANCE DEPOSIT VOUCHER</p>
                <span className="inline-block mt-2 px-3 py-1 bg-slate-100 border border-slate-300 font-black text-xs uppercase tracking-widest rounded text-slate-800">
                  {printModalData.deposit_type === 'Bank' ? '🏦 Bank Deposit Copy' : '🏢 Corporate Office Copy'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p><span className="text-slate-500 font-semibold text-xs block">VOUCHER NO:</span> <strong className="text-blue-700 text-base font-black">{printModalData.remittance_no}</strong></p>
                  <p className="mt-2"><span className="text-slate-500 font-semibold text-xs block">BRANCH:</span> <strong className="text-slate-900">{printModalData.branch_name || branches.find((b: any) => b.id.toString() === selectedBranch)?.branch_name || '—'}</strong></p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-500 font-semibold text-xs block">BUSINESS DATE:</span> <strong className="text-slate-900">{printModalData.business_date}</strong></p>
                  <p className="mt-2"><span className="text-slate-500 font-semibold text-xs block">STATUS:</span> <strong className="text-slate-900 uppercase font-bold">{printModalData.status || 'Pending'}</strong></p>
                </div>
              </div>

              {printModalData.deposit_type === 'Bank' && (
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-300 text-sm">
                  <h4 className="font-extrabold text-emerald-900 text-xs uppercase mb-2 border-b border-emerald-200 pb-1">Bank Deposit Information</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-emerald-700 font-semibold block">Bank Name:</span>
                      <strong className="text-emerald-950 text-sm">{printModalData.bank_name || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-semibold block">Account Number:</span>
                      <strong className="text-emerald-950 text-sm">{printModalData.account_number || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-semibold block">Slip / Challan Ref:</span>
                      <strong className="text-emerald-950 text-sm">{printModalData.reference_no || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {printModalData.deposit_type !== 'Bank' && printModalData.reference_no && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs">
                  <span className="text-blue-700 font-semibold block">Messenger / Reference Info:</span>
                  <strong className="text-blue-950 text-sm">{printModalData.reference_no}</strong>
                </div>
              )}

              <div className="border border-slate-300 rounded-lg overflow-hidden text-sm">
                <div className="bg-slate-100 px-4 py-2 font-black text-slate-700 text-xs uppercase border-b border-slate-300 flex justify-between">
                  <span>Financial Summary</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="p-4 space-y-2 divide-y divide-slate-100 font-medium">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">Available Cash in Hand Before Deposit:</span>
                    <span className="font-bold">₹{(printModalData.cash_in_hand || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 bg-emerald-50/60 px-2 rounded text-base">
                    <span className="font-extrabold text-slate-900">DEPOSIT AMOUNT REMITTED:</span>
                    <span className="font-black text-emerald-800 text-lg">₹{(printModalData.deposit_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 pt-2 text-slate-600">
                    <span>Carry-Forward Remaining Cash in Hand:</span>
                    <span className="font-bold text-slate-800">₹{(printModalData.remaining_cash || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {printModalData.denominations && printModalData.denominations.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2">Currency Denominations Submitted</h4>
                  <table className="w-full text-xs border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                        <th className="p-2 text-left border-r border-slate-300">Note / Coin</th>
                        <th className="p-2 text-center border-r border-slate-300">Quantity</th>
                        <th className="p-2 text-right">Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold">
                      {printModalData.denominations.map((d: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 border-r border-slate-200 font-bold">₹ {d.denomination}</td>
                          <td className="p-2 text-center border-r border-slate-200">{d.quantity}</td>
                          <td className="p-2 text-right font-black">₹ {(d.amount || d.denomination * d.quantity).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                        <td colSpan={2} className="p-2 text-right">Total Value:</td>
                        <td className="p-2 text-right text-sm text-slate-900">₹ {(printModalData.deposit_amount || 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {printModalData.remarks && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border">
                  <span className="font-bold uppercase text-slate-500 block mb-1">Remarks / Notes:</span>
                  <p>{printModalData.remarks}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs text-slate-700">
                <div>
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto font-extrabold uppercase">
                    Cashier / Branch Manager
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Prepared & Verified</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 w-48 mx-auto font-extrabold uppercase">
                    Corporate Office / Finance
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Received & Confirmed</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setPrintModalData(null)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={printReceipt}
                className="btn-primary"
              >
                <span>🖨️</span> Print Voucher Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemittanceDeposit;
