import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Copy } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, ErrorState, Field, LoadingState, notify } from '../ui';
import { DiscountType, EnquiryOptions, Scheme, enquiryApi, errorField, errorText, joinWindow, discountLabel, followupApi } from './enquiryApi';
import DropdownSettings from './DropdownSettings';

type Draft = {
  id?: number; name: string; valid_from: string; valid_to: string; tuition_fee_type: string;
  discount_type: DiscountType; discount_value: string; benefits: string; display_order: string; is_active: boolean;
};

const blank = (feeTypes: string[]): Draft => ({
  name: '', valid_from: '', valid_to: '', tuition_fee_type: feeTypes.find(f => /tuition/i.test(f)) || '',
  discount_type: 'NONE', discount_value: '', benefits: '', display_order: '0', is_active: true,
});

const SchemesSetup: React.FC<{ options: EnquiryOptions; branchId: number }> = ({ options, branchId }) => {
  const years = options.academic_years;
  const canEdit = options.can_manage_schemes;
  const [year, setYear] = useState(options.default_year || years[0]?.code || '');
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [feeTypes, setFeeTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [reload, setReload] = useState(0);
  const [commonBenefits, setCommonBenefits] = useState<string[]>([]);
  const [listsTick, setListsTick] = useState(0);

  // Common benefits (Settings below) to pick instead of typing
  useEffect(() => {
    followupApi.dropdowns(branchId).then(d => setCommonBenefits(d.benefits.map(b => b.label))).catch(() => setCommonBenefits([]));
  }, [branchId, listsTick]);

  useEffect(() => {
    let live = true;
    setSchemes(null); setError(null); setDraft(null);
    enquiryApi.schemes(branchId, year).then(s => live && setSchemes(s)).catch(err => live && setError(errorText(err)));
    if (canEdit) enquiryApi.feeTypes(branchId, year).then(f => live && setFeeTypes(f)).catch(() => live && setFeeTypes([]));
    return () => { live = false; };
  }, [branchId, year, reload, canEdit]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft(d => (d ? { ...d, [k]: v } : d));
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  };

  const edit = (s: Scheme) => {
    setErrors({});
    setDraft({
      id: s.id, name: s.name, valid_from: s.valid_from || '', valid_to: s.valid_to || '', tuition_fee_type: s.tuition_fee_type,
      discount_type: s.discount_type, discount_value: s.discount_type === 'NONE' ? '' : String(s.discount_value),
      benefits: s.benefits, display_order: String(s.display_order), is_active: s.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!draft || saving) return;
    const e: Record<string, string> = {};
    if (draft.name.trim().length < 2) e.name = 'Please type a scheme name.';
    if (!draft.tuition_fee_type) e.tuition_fee_type = 'Please choose which fee is the tuition fee.';
    if (draft.discount_type !== 'NONE' && !(Number(draft.discount_value) > 0)) e.discount_value = 'Please type the discount.';
    if (draft.discount_type === 'PERCENT' && Number(draft.discount_value) > 100) e.discount_value = 'Percent cannot be more than 100.';
    if (draft.valid_from && draft.valid_to && draft.valid_to < draft.valid_from) e.valid_to = 'The end date must be on or after the start date.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await enquiryApi.saveScheme({
        branch_id: branchId, academic_year: year, name: draft.name, valid_from: draft.valid_from || null,
        valid_to: draft.valid_to || null, tuition_fee_type: draft.tuition_fee_type, discount_type: draft.discount_type,
        discount_value: Number(draft.discount_value || 0), benefits: draft.benefits,
        display_order: Number(draft.display_order || 0), is_active: draft.is_active,
      }, draft.id);
      notify.success('Scheme saved.');
      setDraft(null);
      setReload(n => n + 1);
    } catch (err) {
      const f = errorField(err);
      if (f) setErrors({ [f]: errorText(err) }); else notify.error(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!copyFrom) return;
    try {
      const r = await enquiryApi.copySchemes(branchId, copyFrom, year);
      notify(r.message);
      setCopyFrom('');
      setReload(n => n + 1);
    } catch (err) {
      notify.error(errorText(err));
    }
  };

  const benefitLines = (draft?.benefits || '').split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <Field label="Schemes for year" htmlFor="sch-year" className="sm:w-60">
          <select id="sch-year" className="input" value={year} onChange={e => setYear(e.target.value)}>
            {years.map(y => <option key={y.code} value={y.code}>{y.name}</option>)}
          </select>
        </Field>
        {canEdit && !draft && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setErrors({}); setDraft(blank(feeTypes)); }}>Add scheme</Button>
        )}
      </div>

      {!canEdit && <Alert tone="info">You can see the schemes. Only the school admin can change them.</Alert>}

      {/* Add / edit form */}
      {draft && (
        <section className="card p-4 sm:p-6 space-y-4" aria-label="Scheme details">
          <h2 className="font-semibold text-slate-900">{draft.id ? 'Change scheme' : 'New scheme'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Scheme name" htmlFor="sch-name" required error={errors.name} className="sm:col-span-2">
              <input id="sch-name" className="input" maxLength={100} value={draft.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Admission Scheme 1" />
            </Field>
            <Field label="Joining from" htmlFor="sch-from" hint="Leave empty if there is no start date." error={errors.valid_from}>
              <input id="sch-from" type="date" className="input" value={draft.valid_from} onChange={e => set('valid_from', e.target.value)} />
            </Field>
            <Field label="Joining up to" htmlFor="sch-to" hint="After this date the scheme is no longer printed." error={errors.valid_to}>
              <input id="sch-to" type="date" className="input" value={draft.valid_to} onChange={e => set('valid_to', e.target.value)} />
            </Field>
            <Field label="Which fee is the tuition fee?" htmlFor="sch-fee" required error={errors.tuition_fee_type}
              hint={feeTypes.length ? undefined : 'No fees are set up for this year yet (Finance › Fee Masters).'}>
              <select id="sch-fee" className="input" value={draft.tuition_fee_type} onChange={e => set('tuition_fee_type', e.target.value)}>
                <option value="">Choose fee</option>
                {feeTypes.map(f => <option key={f} value={f}>{f}</option>)}
                {draft.tuition_fee_type && !feeTypes.includes(draft.tuition_fee_type) && <option value={draft.tuition_fee_type}>{draft.tuition_fee_type}</option>}
              </select>
            </Field>
            <Field label="Discount on tuition fee" htmlFor="sch-disc" error={errors.discount_value}>
              <div className="flex gap-2">
                <select id="sch-disc" className="input w-40 flex-shrink-0" value={draft.discount_type}
                  onChange={e => set('discount_type', e.target.value as DiscountType)}>
                  <option value="NONE">No discount</option>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="AMOUNT">Amount (₹)</option>
                </select>
                {draft.discount_type !== 'NONE' && (
                  <input aria-label="Discount value" className="input" inputMode="decimal" value={draft.discount_value}
                    onChange={e => set('discount_value', e.target.value.replace(/[^\d.]/g, ''))}
                    placeholder={draft.discount_type === 'PERCENT' ? 'e.g. 10' : 'e.g. 5000'} />
                )}
              </div>
            </Field>
            <Field label="What the parent gets (one per line)" htmlFor="sch-benefits" className="sm:col-span-2"
              hint="Pick from the list or type your own. Printed exactly as written.">
              {commonBenefits.length > 0 && (
                <select className="input mb-2" value="" aria-label="Add a common benefit"
                  onChange={e => {
                    const v = e.target.value;
                    if (!v) return;
                    const lines = draft.benefits.split('\n').map(l => l.trim()).filter(Boolean);
                    if (!lines.includes(v)) set('benefits', [...lines, v].join('\n'));
                  }}>
                  <option value="">+ Add a common benefit…</option>
                  {commonBenefits.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
              <textarea id="sch-benefits" className="input min-h-[110px]" maxLength={2000} value={draft.benefits}
                onChange={e => set('benefits', e.target.value)} placeholder={'Free uniform (2 sets)\nBooks at 20% discount'} />
            </Field>
            <Field label="Order on the paper" htmlFor="sch-order" hint="Smaller number prints first.">
              <input id="sch-order" className="input" inputMode="numeric" value={draft.display_order}
                onChange={e => set('display_order', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <div className="flex items-end">
              <label className="flex min-h-[44px] items-center gap-3 text-sm font-medium text-slate-800">
                <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={draft.is_active}
                  onChange={e => set('is_active', e.target.checked)} />
                Show this scheme on the enquiry paper
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On the paper</p>
            <p className="mt-1 font-bold">{draft.name || 'Scheme name'}</p>
            {joinWindow(draft.valid_from || null, draft.valid_to || null) && (
              <p className="text-xs text-slate-600">{joinWindow(draft.valid_from || null, draft.valid_to || null)}</p>
            )}
            <ul className="mt-1 list-disc pl-5">
              {draft.discount_type !== 'NONE' && Number(draft.discount_value) > 0 && <li>{discountLabel(draft.discount_type, Number(draft.discount_value))}</li>}
              {benefitLines.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
            <Button loading={saving} onClick={save}>Save scheme</Button>
          </div>
        </section>
      )}

      {/* List */}
      {error ? (
        <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />
      ) : !schemes ? (
        <LoadingState />
      ) : schemes.length === 0 ? (
        <div className="card">
          <EmptyState title={`No schemes for ${year} yet`}
            description={canEdit ? 'Tap "Add scheme", or copy last year\'s schemes below.' : 'Ask the school admin to add schemes.'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {schemes.map(s => (
            <article key={s.id} className="card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{joinWindow(s.valid_from, s.valid_to) || 'No date limit'} · Fee: {s.tuition_fee_type}</p>
                </div>
                <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'On' : 'Off'}</Badge>
              </div>
              <ul className="mt-2 list-disc pl-5 text-slate-700">
                {s.discount_type !== 'NONE' && <li>{discountLabel(s.discount_type, s.discount_value)}</li>}
                {s.benefits.split('\n').map(l => l.trim()).filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              {canEdit && (
                <Button size="sm" variant="secondary" className="mt-3" icon={<Pencil className="w-4 h-4" />} onClick={() => edit(s)}>Change</Button>
              )}
            </article>
          ))}
        </div>
      )}

      {canEdit && years.length > 1 && (
        <section className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <Field label="Copy schemes from another year" htmlFor="sch-copy" className="sm:w-72"
            hint="Copied schemes start switched off. Set the new dates, then switch them on.">
            <select id="sch-copy" className="input" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
              <option value="">Choose year</option>
              {years.filter(y => y.code !== year).map(y => <option key={y.code} value={y.code}>{y.name}</option>)}
            </select>
          </Field>
          <Button variant="secondary" icon={<Copy className="w-4 h-4" />} disabled={!copyFrom} onClick={copy}>Copy to {year}</Button>
        </section>
      )}

      {canEdit && <DropdownSettings branchId={branchId} onChanged={() => setListsTick(n => n + 1)} />}
    </div>
  );
};

export default SchemesSetup;
