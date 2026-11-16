import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, CheckCircle2, FileUp, Image as ImageIcon, Lock, Phone } from 'lucide-react';
import { API_URL } from '../../config';
import { resizeImageToDataUrl } from '../../utils/resizeImage';

/**
 * The parent's admission form, opened from the WhatsApp link (#/apply/<token>). No login.
 * Uses its own plain HTTP client: no staff token, no staff headers, no login redirects.
 */
const http = axios.create({ baseURL: API_URL, timeout: 30000 });

type Info = { school_name: string | null; logo_url: string | null; branch_name: string | null; state: string };
type FormView = { school_name: string | null; logo_url: string | null; class_name: string | null; academic_year: string | null;
  expires_at: string; data: Record<string, string>; aadhaar_doc_name: string | null; status: string };

const errText = (err: any) => err?.response?.data?.error || 'No internet or the school server is busy. Please try again.';
const digits = (v: string) => v.replace(/\D/g, '');
const logoSrc = (url: string | null) => !url ? null : (url.startsWith('/') && !url.startsWith('/static') ? `${import.meta.env.VITE_API_URL || ''}${url}` : url);
const hasCamera = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

const Label: React.FC<{ htmlFor: string; children: React.ReactNode; required?: boolean }> = ({ htmlFor, children, required }) => (
  <label htmlFor={htmlFor} className="block text-[15px] font-medium text-slate-800 mb-1.5">
    {children}{required && <span className="text-red-600"> *</span>}
  </label>
);
const input = 'block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200';

const Screen: React.FC<{ info: { school_name: string | null; logo_url: string | null }; children: React.ReactNode }> = ({ info, children }) => (
  <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-xl px-4 py-4 flex items-center gap-3">
        {logoSrc(info.logo_url) && <img src={logoSrc(info.logo_url)!} alt="" className="h-12 w-auto max-w-[110px] object-contain" />}
        <div>
          <p className="text-lg font-bold text-slate-900 leading-tight">{info.school_name || 'School'}</p>
          <p className="text-sm text-slate-500">Admission form</p>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-xl px-4 py-5 pb-28">{children}</main>
  </div>
);

const Message: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">{icon}</div>
    <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    <p className="mt-1 text-slate-600">{text}</p>
  </div>
);

const STATE_TEXT: Record<string, [string, string]> = {
  expired: ['This link has expired', 'Please ask the school to send the form link again on WhatsApp.'],
  locked: ['Link locked', 'Too many wrong mobile numbers were tried. Please ask the school to send the link again.'],
  cancelled: ['Link cancelled', 'Please contact the school office.'],
  done: ['Admission completed', 'Thank you! The school has completed the admission.'],
  submitted: ['Form already sent', 'Thank you! The school has your form and will contact you.'],
};

const PublicAdmissionForm: React.FC<{ token: string }> = ({ token }) => {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [session, setSession] = useState<string | null>(null);
  const [view, setView] = useState<FormView | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [docName, setDocName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const touched = useRef(false);
  const camera = useMemo(hasCamera, []);

  useEffect(() => {
    http.get(`/public/apply/${encodeURIComponent(token)}`).then(r => setInfo(r.data)).catch(err => setLoadError(errText(err)));
  }, [token]);

  // Save the draft quietly a moment after the parent stops typing
  useEffect(() => {
    if (!session || !touched.current) return;
    const t = window.setTimeout(() => {
      http.put(`/public/apply/${encodeURIComponent(token)}`, { data: form }, { headers: { 'X-Apply-Session': session } })
        .then(() => setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })))
        .catch(() => { /* the final Submit checks everything again */ });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [form, session, token]);

  const set = (k: string, v: string) => { touched.current = true; setForm(f => ({ ...f, [k]: v })); };

  const verify = async () => {
    setBusy(true); setError(null);
    try {
      const r = await http.post(`/public/apply/${encodeURIComponent(token)}/verify`, { mobile: digits(mobile) });
      setSession(r.data.session); setView(r.data.form); setForm(r.data.form.data || {}); setDocName(r.data.form.aadhaar_doc_name);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose a photo.'); return; }
    set('photo', await resizeImageToDataUrl(f, 800));
  };

  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !session) return;
    setBusy(true); setError(null);
    try {
      let file: Blob = f;
      let name = f.name;
      if (f.type.startsWith('image/')) {
        // Phone photos are big: shrink (still easy to read) so it uploads fast on mobile data
        const dataUrl = await resizeImageToDataUrl(f, 1600, 0.85);
        file = await (await fetch(dataUrl)).blob();
        name = 'aadhaar.jpg';
      } else if (f.type !== 'application/pdf') {
        setError('Please upload a photo or a PDF of the Aadhaar card.'); return;
      }
      const body = new FormData();
      body.append('file', file, name);
      const r = await http.post(`/public/apply/${encodeURIComponent(token)}/aadhaar-doc`, body, { headers: { 'X-Apply-Session': session } });
      setDocName(r.data.aadhaar_doc_name);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!session) return;
    setBusy(true); setError(null);
    try {
      const r = await http.post(`/public/apply/${encodeURIComponent(token)}/submit`, { data: form }, { headers: { 'X-Apply-Session': session } });
      setDone(r.data.message);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(errText(err));
      if (err?.response?.status === 401) setSession(null);
    } finally { setBusy(false); }
  };

  if (loadError) return <Screen info={{ school_name: null, logo_url: null }}><Message icon={<Lock className="w-6 h-6 text-slate-500" />} title="Link not working" text={loadError} /></Screen>;
  if (!info) return <Screen info={{ school_name: null, logo_url: null }}><p className="text-center text-slate-500 py-10">Opening the form…</p></Screen>;
  if (done) return <Screen info={info}><Message icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />} title="Form sent" text={done} /></Screen>;
  if (info.state !== 'open') {
    const [t, x] = STATE_TEXT[info.state] || ['Link not working', 'Please contact the school office.'];
    return <Screen info={info}><Message icon={<Lock className="w-6 h-6 text-slate-500" />} title={t} text={x} /></Screen>;
  }

  if (!session || !view) {
    return (
      <Screen info={info}>
        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Welcome!</h1>
            <p className="mt-1 text-slate-600">To open the form, type the mobile number you gave the school.</p>
          </div>
          <div>
            <Label htmlFor="pf-mobile" required>Mobile number</Label>
            <input id="pf-mobile" className={input} type="tel" inputMode="numeric" autoComplete="tel" maxLength={14}
              value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit mobile number" />
          </div>
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <button type="button" disabled={busy || digits(mobile).length < 10} onClick={verify}
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <Phone className="w-5 h-5" /> Open the form
          </button>
        </div>
      </Screen>
    );
  }

  const field = (k: string, label: string, opts: { required?: boolean; type?: string; mode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; max?: number; placeholder?: string } = {}) => (
    <div>
      <Label htmlFor={`pf-${k}`} required={opts.required}>{label}</Label>
      <input id={`pf-${k}`} className={input} type={opts.type || 'text'} inputMode={opts.mode} maxLength={opts.max}
        value={form[k] || ''} placeholder={opts.placeholder}
        onChange={e => set(k, opts.mode === 'numeric' ? digits(e.target.value).slice(0, opts.max) : e.target.value)} />
    </div>
  );

  return (
    <Screen info={info}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
          <p className="font-semibold">Thank you for choosing us!</p>
          <p className="text-sm mt-0.5">Admission for Class {view.class_name} ({view.academic_year}). Fields with * are needed. Your answers are saved as you type.</p>
        </div>

        <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">1. Student</h2>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center">
              {form.photo ? <img src={form.photo} alt="Student" className="h-full w-full object-cover" /> : <Camera className="w-8 h-8 text-slate-400" />}
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium text-slate-800">Student photo</p>
              {camera && (
                <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 px-3 font-medium cursor-pointer">
                  <Camera className="w-4 h-4" /> Take photo
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={pickPhoto} />
                </label>
              )}
              <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 px-3 font-medium cursor-pointer">
                <ImageIcon className="w-4 h-4" /> {camera ? 'Choose from gallery' : 'Choose photo'}
                <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              </label>
            </div>
          </div>
          {field('first_name', 'First name', { required: true })}
          {field('last_name', 'Last name', { required: true })}
          <div>
            <Label htmlFor="pf-gender" required>Boy or girl</Label>
            <div className="grid grid-cols-2 gap-2" id="pf-gender" role="radiogroup">
              {[['Male', 'Boy'], ['Female', 'Girl']].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={form.gender === v} onClick={() => set('gender', v)}
                  className={`min-h-[48px] rounded-xl border text-base font-medium ${form.gender === v ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200' : 'border-slate-300 bg-white text-slate-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {field('dob', 'Date of birth', { required: true, type: 'date' })}
          {field('Adharcardno', "Student's Aadhaar number", { required: true, mode: 'numeric', max: 12, placeholder: '12 digits' })}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">2. Parents</h2>
          {field('Fatherfirstname', "Father's name", { required: true })}
          {field('FatherPhone', "Father's mobile", { required: true, type: 'tel', mode: 'numeric', max: 10 })}
          {field('Motherfirstname', "Mother's name", { required: true })}
          {field('SecondaryPhone', "Mother's mobile", { type: 'tel', mode: 'numeric', max: 10 })}
          {field('phone', 'Main phone for school messages', { required: true, type: 'tel', mode: 'numeric', max: 10 })}
          {field('FatherEmail', 'Email', { type: 'email' })}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">3. Address</h2>
          <div>
            <Label htmlFor="pf-address">House address</Label>
            <textarea id="pf-address" className={`${input} min-h-[90px]`} maxLength={300} value={form.address || ''} onChange={e => set('address', e.target.value)} />
          </div>
          {field('presentCity', 'City / area')}
          {field('presentPin', 'PIN code', { mode: 'numeric', max: 6 })}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">4. Aadhaar card copy <span className="text-sm font-normal text-slate-500">(optional)</span></h2>
          <p className="text-sm text-slate-600">If you have it, a clear photo of the student's Aadhaar card, or a PDF. You can also give it at the school office.</p>
          {docName && <p className="flex items-center gap-2 text-emerald-700 font-medium"><CheckCircle2 className="w-5 h-5" /> Uploaded</p>}
          <div className="flex flex-wrap gap-2">
            {camera && (
              <label className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 px-4 font-medium cursor-pointer">
                <Camera className="w-5 h-5" /> Take photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadDoc} />
              </label>
            )}
            <label className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 px-4 font-medium cursor-pointer">
              <FileUp className="w-5 h-5" /> {docName ? 'Change file' : 'Choose photo or PDF'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadDoc} />
            </label>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-xl">
          {error && <p role="alert" className="mb-2 text-red-600">{error}</p>}
          {!error && savedAt && <p className="mb-1 text-xs text-slate-500">Saved at {savedAt}. You can close and finish later with the same link.</p>}
          <button type="button" disabled={busy} onClick={submit}
            className="w-full min-h-[52px] rounded-xl bg-emerald-600 text-white text-lg font-semibold disabled:opacity-60">
            {busy ? 'Please wait…' : 'Send to school'}
          </button>
        </div>
      </div>
    </Screen>
  );
};

export default PublicAdmissionForm;
