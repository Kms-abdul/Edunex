import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Plus, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { ActionBar, Alert, Badge, Button, Field, LoadingState, confirmDialog, notify } from '../ui';
import {
  CheckResult, EnquiryOptions, PrintData, Quote, enquiryApi, errorField, errorText,
  rupees, niceDate, yearLabel, joinWindow, discountLabel, aadhaarLooksRight, isDeskScreen,
} from './enquiryApi';
import { EnquirySlip, SlipPrintPortal, printSlip } from './EnquirySlip';

const YEAR_KEY = 'kampusops.enquiryYear';
const EMPTY = { student_name: '', guardian_name: '', class_name: '', contact: '', aadhaar: '' };

const digits = (v: string) => v.replace(/\D/g, '');
const groupAadhaar = (v: string) => digits(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

/** Ask once the print screen closes, so "printed" is only recorded when the paper really came out. */
export const usePrintTracking = (enquiryId: number, initiallyPrinted: boolean, onPrinted?: () => void) => {
  const [printed, setPrinted] = useState(initiallyPrinted);
  const mark = async () => {
    try {
      await enquiryApi.markPrinted(enquiryId);
      setPrinted(true);
      onPrinted?.();
      notify.success('Marked as printed.');
    } catch (err) {
      notify.error(errorText(err));
    }
  };
  const print = () => printSlip(async () => {
    const ok = await confirmDialog('Did the enquiry paper print?', { title: 'Printed?', confirmText: 'Yes, printed', cancelText: 'No', tone: 'default' });
    if (ok) await mark();
  });
  return { printed, print, mark };
};

/** Shows a saved slip with Print / New buttons (used after saving and when reopening an enquiry). */
export const SlipView: React.FC<{
  enquiryId: number;
  data: PrintData;
  yearName: string;
  title: string;
  printedAt?: string | null;
  autoPrint?: boolean;
  onNew?: () => void;
  onBack?: () => void;
  onPrinted?: () => void;
}> = ({ enquiryId, data, yearName, title, printedAt, autoPrint, onNew, onBack, onPrinted }) => {
  const { printed, print, mark } = usePrintTracking(enquiryId, !!printedAt, onPrinted);
  const desk = isDeskScreen();
  useEffect(() => {
    if (autoPrint) { const t = window.setTimeout(print, 300); return () => window.clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-4">
      {printed ? (
        <Alert tone="success" title={title}>Printed. Give this paper to the parent.</Alert>
      ) : desk ? (
        <Alert tone="success" title={title}>Print it and give the paper to the parent.</Alert>
      ) : (
        <Alert tone="success" title={title}>
          Saved. Print it later from the office computer: <b>Admission Enquiry › Enquiry list</b> shows it as <b>Not printed</b>. You can also share it as PDF with the Print button.
        </Alert>
      )}
      <div className="flex items-center gap-2 text-sm">
        <Badge tone={printed ? 'success' : 'warning'}>{printed ? 'Printed' : 'Not printed yet'}</Badge>
        {!printed && (
          <button type="button" className="text-brand-700 underline underline-offset-2 min-h-[44px]" onClick={mark}>
            Mark as printed
          </button>
        )}
      </div>
      <div className="card p-4 sm:p-6 overflow-x-auto"><EnquirySlip data={data} yearName={yearName} /></div>
      <ActionBar>
        {onBack && <Button variant="secondary" onClick={onBack}>Back</Button>}
        {onNew && <Button variant="secondary" icon={<Plus className="w-4 h-4" />} onClick={onNew}>New enquiry</Button>}
        <Button icon={<Printer className="w-4 h-4" />} onClick={print}>Print</Button>
      </ActionBar>
      <SlipPrintPortal data={data} yearName={yearName} />
    </div>
  );
};

const NewEnquiry: React.FC<{ options: EnquiryOptions; branchId: number; onOpenEnquiry: (id: number) => void }> = ({ options, branchId, onOpenEnquiry }) => {
  const years = options.academic_years;
  const [year, setYear] = useState<string>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(YEAR_KEY); } catch { /* ignore */ }
    return saved && years.some(y => y.code === saved) ? saved : options.default_year || years[0]?.code || '';
  });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<string[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: number; data: PrintData } | null>(null);
  const desk = isDeskScreen();
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(YEAR_KEY, year); } catch { /* ignore */ } }, [year]);

  useEffect(() => {
    setClasses(null);
    enquiryApi.classes(branchId).then(setClasses).catch(err => { setClasses([]); notify.error(errorText(err)); });
  }, [branchId]);

  // Fee preview for the chosen class + year
  useEffect(() => {
    if (!form.class_name || !year) { setQuote(null); return; }
    let live = true;
    setQuoteLoading(true);
    enquiryApi.quote(branchId, year, form.class_name)
      .then(q => live && setQuote(q))
      .catch(() => live && setQuote(null))
      .finally(() => live && setQuoteLoading(false));
    return () => { live = false; };
  }, [branchId, year, form.class_name]);

  // Earlier-visit check once a full Aadhaar or phone number is typed
  const aadhaarDigits = digits(form.aadhaar);
  const phoneDigits = digits(form.contact);
  useEffect(() => {
    const a = aadhaarDigits.length === 12 ? aadhaarDigits : '';
    const p = phoneDigits.length === 10 ? phoneDigits : '';
    if (!a && !p) { setCheck(null); return; }
    let live = true;
    const t = window.setTimeout(() => {
      enquiryApi.check(branchId, year, a, p).then(r => live && setCheck(r)).catch(() => live && setCheck(null));
    }, 400);
    return () => { live = false; window.clearTimeout(t); };
  }, [branchId, year, aadhaarDigits, phoneDigits]);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.student_name.trim().length < 2) e.student_name = 'Please type the student name.';
    if (form.guardian_name.trim().length < 2) e.guardian_name = 'Please type the guardian name.';
    if (!form.class_name) e.class_name = 'Please choose the class.';
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) e.contact = 'Please type a 10-digit mobile number.';
    if (aadhaarDigits && aadhaarDigits.length !== 12) e.aadhaar = 'Aadhaar has 12 digits. Leave it empty if the parent does not have it.';
    else if (aadhaarDigits && /^[01]/.test(aadhaarDigits)) e.aadhaar = 'An Aadhaar number never starts with 0 or 1. Please check the number.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const sameYear = check?.same_year || null;
  const others = useMemo(() => ({
    enquiries: (check?.enquiries || []).filter(e => e.id !== sameYear?.id),
    students: check?.students || [],
  }), [check, sameYear]);

  const save = async () => {
    if (saving || !validate() || sameYear) return;
    setSaving(true);
    try {
      const res = await enquiryApi.create({ branch_id: branchId, academic_year: year, ...form, contact: phoneDigits, aadhaar: aadhaarDigits });
      if (res.enquiry.print) {
        setSaved({ id: res.enquiry.id, data: res.enquiry.print });
        notify.success(res.message);
      }
    } catch (err: any) {
      const field = errorField(err);
      const map: Record<string, string> = { 'student name': 'student_name', 'guardian name': 'guardian_name' };
      if (field) setErrors(e => ({ ...e, [map[field] || field]: errorText(err) }));
      else notify.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const startNew = () => {
    setSaved(null); setForm(EMPTY); setErrors({}); setCheck(null); setQuote(null);
    window.setTimeout(() => firstInput.current?.focus(), 50);
  };

  const yearName = yearLabel(years, year);

  if (saved) {
    return (
      <SlipView enquiryId={saved.id} data={saved.data} yearName={yearName} title={`Enquiry ${saved.data.enquiry_no} saved`}
        autoPrint={desk} onNew={startNew} />
    );
  }

  if (!options.can_write) {
    return <Alert tone="info" title="You can only see enquiries">Ask your school admin for permission to add enquiries.</Alert>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
      {/* Form */}
      <section className="card p-4 sm:p-6 lg:col-span-7 space-y-4" aria-label="Enquiry details">
        <Field label="Admission for year" htmlFor="enq-year" required hint="Fees and schemes below are for this year.">
          <select id="enq-year" className="input" value={year} onChange={e => setYear(e.target.value)}>
            {years.map(y => <option key={y.code} value={y.code}>{y.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Student name" htmlFor="enq-student" required error={errors.student_name}>
            <input ref={firstInput} id="enq-student" className="input" autoComplete="off" autoCapitalize="words" maxLength={100}
              value={form.student_name} onChange={e => set('student_name', e.target.value)} placeholder="e.g. Ravi Kumar" />
          </Field>
          <Field label="Guardian name" htmlFor="enq-guardian" required error={errors.guardian_name}>
            <input id="enq-guardian" className="input" autoComplete="off" autoCapitalize="words" maxLength={100}
              value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} placeholder="Father / mother / guardian" />
          </Field>
          <Field label="Class" htmlFor="enq-class" required error={errors.class_name}>
            <select id="enq-class" className="input" value={form.class_name} onChange={e => set('class_name', e.target.value)} disabled={!classes}>
              <option value="">{classes ? 'Choose class' : 'Loading…'}</option>
              {(classes || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Contact number" htmlFor="enq-contact" required error={errors.contact}>
            <input id="enq-contact" className="input" type="tel" inputMode="numeric" autoComplete="off" maxLength={10}
              value={form.contact} onChange={e => set('contact', digits(e.target.value).slice(0, 10))} placeholder="10-digit mobile" />
          </Field>
        </div>
        <Field label="Student Aadhaar" htmlFor="enq-aadhaar" error={errors.aadhaar}
          hint={aadhaarDigits.length === 12 && !aadhaarLooksRight(aadhaarDigits)
            ? <span className="text-amber-700">This number may have a typing mistake. Please check it with the parent. You can still save.</span>
            : 'Optional. Used to see if this child came before. Printed as XXXX XXXX 1234.'}>
          <input id="enq-aadhaar" className="input tracking-wider" inputMode="numeric" autoComplete="off" maxLength={14}
            value={form.aadhaar} onChange={e => set('aadhaar', groupAadhaar(e.target.value))} placeholder="1234 5678 9012" />
        </Field>

        {/* Earlier visits */}
        {sameYear && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4" /> This child already has an enquiry for {yearName}</p>
            <p className="mt-1">{sameYear.enquiry_no} on {niceDate(sameYear.enquiry_date)} · Class {sameYear.class_name} · {sameYear.student_name}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onOpenEnquiry(sameYear.id)}>Open it and print again</Button>
          </div>
        )}
        {(others.enquiries.length > 0 || others.students.length > 0) && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm text-slate-700">
            <p className="flex items-center gap-2 font-semibold text-brand-800"><Info className="w-4 h-4" /> Seen before</p>
            <ul className="mt-1.5 space-y-1">
              {others.students.map(s => (
                <li key={`s-${s.admission_no}`}>
                  {s.match === 'aadhaar' ? 'Already a student' : 'Same phone as student'}: <b>{s.name}</b> (Adm. {s.admission_no}, Class {s.class_name}, {s.branch})
                </li>
              ))}
              {others.enquiries.map(e => (
                <li key={`e-${e.id}`}>
                  {e.match === 'aadhaar' ? 'Enquired before' : 'Same phone'}: <b>{e.student_name}</b> · {e.enquiry_no} on {niceDate(e.enquiry_date)} ({e.academic_year}, Class {e.class_name})
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Fee preview */}
      <aside className="card p-4 sm:p-5 lg:col-span-5 lg:sticky lg:top-4 space-y-3" aria-label="Fee and schemes">
        <h2 className="font-semibold text-slate-900">Fee for the parent</h2>
        {!form.class_name ? (
          <p className="text-sm text-slate-500">Choose the class to see the tuition fee and schemes.</p>
        ) : quoteLoading && !quote ? (
          <LoadingState label="Getting the fee…" className="py-6" />
        ) : quote ? (
          <>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-600">Tuition fee · Class {quote.class_name}</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{quote.tuition_fee !== null ? rupees(quote.tuition_fee) : '—'}</span>
            </div>
            {quote.tuition_installments && quote.tuition_installments.length > 1 && (
              <details className="rounded-lg border border-slate-200 px-3 text-sm">
                <summary className="flex min-h-[44px] cursor-pointer items-center text-brand-700 font-medium">
                  Paid in {quote.tuition_installments.length} installments (tap to see)
                </summary>
                <ul className="pb-2 divide-y divide-slate-100">
                  {quote.tuition_installments.map((i, n) => (
                    <li key={n} className="flex justify-between py-1.5"><span>{i.name}</span><span className="tabular-nums">{rupees(i.amount)}</span></li>
                  ))}
                </ul>
              </details>
            )}
            {quote.fee_note && (
              <Alert tone="warning">{quote.fee_note} Set it in Finance › Fee Masters. You can still save; the paper will say "To be announced".</Alert>
            )}
            {quote.schemes.length === 0 ? (
              <p className="text-sm text-slate-500">No admission schemes for {yearName} yet.</p>
            ) : quote.schemes.map(s => (
              <div key={s.name} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <p className="font-semibold text-slate-900">{s.name}</p>
                {joinWindow(s.valid_from, s.valid_to) && <p className="text-xs text-slate-500">{joinWindow(s.valid_from, s.valid_to)}</p>}
                <ul className="mt-1 list-disc pl-5 text-slate-700">
                  {s.discount_type !== 'NONE' && <li>{discountLabel(s.discount_type, s.discount_value)}</li>}
                  {s.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
                {s.tuition_after !== null && <p className="mt-1 font-semibold text-emerald-700">Tuition with scheme: {rupees(s.tuition_after)}</p>}
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-slate-500">Could not get the fee. You can still save.</p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 className="w-3.5 h-3.5" /> This is what will be printed.</p>
      </aside>

      <div className="lg:col-span-12">
        <ActionBar note={sameYear ? 'This child already has an enquiry for this year. Open it instead.' : undefined}>
          <Button size="lg" icon={<Printer className="w-5 h-5" />} loading={saving} disabled={!!sameYear} onClick={save}>
            {desk ? 'Save & Print' : 'Save'}
          </Button>
        </ActionBar>
      </div>
    </div>
  );
};

export default NewEnquiry;
