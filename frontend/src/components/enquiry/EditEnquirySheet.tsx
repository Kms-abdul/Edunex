import React, { useEffect, useState } from 'react';
import Sheet from '../cash/Sheet';
import { Button, Field, notify } from '../ui';
import { StudentType, aadhaarLooksRight, enquiryApi, errorField, errorText } from './enquiryApi';

const digits = (v: string) => v.replace(/\D/g, '');
const groupAadhaar = (v: string) => digits(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

export interface EditableEnquiry {
  id: number; student_name: string; guardian_name: string; class_name: string; contact: string;
  student_type: StudentType; aadhaar_masked: string | null; printed: boolean;
}

/**
 * Correct a saved enquiry (wrong mobile, spelling, class…). The old and new values are kept in the
 * history. Aadhaar is never shown in full: type a new number to replace it, or tap Remove.
 */
const EditEnquirySheet: React.FC<{ enquiry: EditableEnquiry; branchId: number; onClose: () => void; onSaved: () => void }> = ({
  enquiry, branchId, onClose, onSaved,
}) => {
  const [form, setForm] = useState({
    student_name: enquiry.student_name, guardian_name: enquiry.guardian_name,
    class_name: enquiry.class_name, contact: enquiry.contact,
  });
  const [studentType, setStudentType] = useState<StudentType>(enquiry.student_type);
  const [aadhaar, setAadhaar] = useState('');
  const [removeAadhaar, setRemoveAadhaar] = useState(false);
  const [classes, setClasses] = useState<string[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    enquiryApi.classes(branchId).then(setClasses).catch(() => setClasses([enquiry.class_name]));
  }, [branchId, enquiry.class_name]);

  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const aadhaarDigits = digits(aadhaar);
  const feeChanges = form.class_name !== enquiry.class_name || studentType !== enquiry.student_type;

  const save = async () => {
    if (saving) return;
    const next: Record<string, string> = {};
    if (!form.student_name.trim()) next.student_name = 'Please type the student name.';
    if (!form.guardian_name.trim()) next.guardian_name = 'Please type the guardian name.';
    if (digits(form.contact).length !== 10) next.contact = 'Mobile number has 10 digits.';
    if (aadhaarDigits && aadhaarDigits.length !== 12) next.aadhaar = 'Aadhaar has 12 digits, or leave it empty.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const body: Record<string, unknown> = { ...form, contact: digits(form.contact), student_type: studentType };
    if (removeAadhaar) body.aadhaar = '';
    else if (aadhaarDigits) body.aadhaar = aadhaarDigits;
    setSaving(true); setError(null);
    try {
      const res = await enquiryApi.update(enquiry.id, body);
      notify.success(res.message);
      onSaved();
    } catch (err) {
      const f = errorField(err);
      if (f) setErrors(e => ({ ...e, [f]: errorText(err) })); else setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Change details" subtitle="Correct a mistake. The old details stay in the history." onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button><Button loading={saving} onClick={save}>Save changes</Button></>}>
      <div className="space-y-3">
        <Field label="Student name" htmlFor="ed-student" required error={errors.student_name}>
          <input id="ed-student" className="input" maxLength={100} value={form.student_name} onChange={e => set('student_name', e.target.value)} />
        </Field>
        <Field label="Guardian name" htmlFor="ed-guardian" required error={errors.guardian_name}>
          <input id="ed-guardian" className="input" maxLength={100} value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Class" htmlFor="ed-class" required error={errors.class_name}>
            <select id="ed-class" className="input" value={form.class_name} onChange={e => set('class_name', e.target.value)} disabled={!classes}>
              {(classes || [enquiry.class_name]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Mobile" htmlFor="ed-contact" required error={errors.contact}>
            <input id="ed-contact" className="input" type="tel" inputMode="numeric" maxLength={10} value={form.contact}
              onChange={e => set('contact', digits(e.target.value).slice(0, 10))} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-800">Fees for</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {(['NEW', 'OLD'] as StudentType[]).map(t => (
              <button key={t} type="button" role="radio" aria-checked={studentType === t} onClick={() => setStudentType(t)}
                className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium transition-colors
                  ${studentType === t ? 'border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-300' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {t === 'NEW' ? 'New student' : 'Old student'}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Student Aadhaar" htmlFor="ed-aadhaar" error={errors.aadhaar}
          hint={aadhaarDigits.length === 12 && !aadhaarLooksRight(aadhaarDigits)
            ? <span className="text-amber-700">This number may have a typing mistake. Please check it.</span>
            : enquiry.aadhaar_masked ? `Now: ${enquiry.aadhaar_masked}. Leave empty to keep it.` : 'Optional.'}>
          <input id="ed-aadhaar" className="input tracking-wider" inputMode="numeric" autoComplete="off" maxLength={14}
            value={aadhaar} disabled={removeAadhaar} onChange={e => { setAadhaar(groupAadhaar(e.target.value)); setErrors(x => ({ ...x, aadhaar: '' })); }}
            placeholder={enquiry.aadhaar_masked ? 'Type the new number to change it' : '1234 5678 9012'} />
        </Field>
        {enquiry.aadhaar_masked && (
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={removeAadhaar} onChange={e => { setRemoveAadhaar(e.target.checked); setAadhaar(''); }} />
            Remove the Aadhaar from this enquiry
          </label>
        )}
        {(feeChanges || enquiry.printed) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            {feeChanges && 'The fee will be worked out again for the new class / fee type (same schemes as on the enquiry day). '}
            {enquiry.printed && 'The paper was printed already: print it again after saving.'}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Sheet>
  );
};

export default EditEnquirySheet;
