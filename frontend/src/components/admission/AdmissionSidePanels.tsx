import React from 'react';
import { Check, AlertCircle, User, Phone, School, CalendarDays, FileText, Info } from 'lucide-react';
import { ADMISSION_STEPS, REQUIRED_FIELDS, errorsInStep } from './admissionSteps';

/* ------------------------------------------------------------------ left: steps */
export const StepRail: React.FC<{
  step: number;
  errors: Record<string, string>;
  onJump: (i: number) => void;
}> = ({ step, errors, onJump }) => (
  <nav aria-label="Admission steps" className="card p-3 sticky top-4">
    <p className="px-2 pt-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</p>
    <ol className="space-y-1">
      {ADMISSION_STEPS.map((label, i) => {
        const current = i === step;
        const done = i < step;
        const problems = errorsInStep(errors, i).length;
        const canJump = i < step; // same rule as the progress bar: go back to finished steps
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onJump(i)}
              aria-current={current ? 'step' : undefined}
              className={`w-full flex items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors
                ${current ? 'bg-brand-50 text-brand-800 font-semibold' : canJump ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-500 cursor-default'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                ${done && !problems ? 'bg-emerald-500 text-white' : done && problems ? 'bg-amber-100 text-amber-700' : current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {done && !problems ? <Check className="h-4 w-4" /> : done && problems ? <AlertCircle className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block leading-snug">{label}</span>
                {done && problems > 0 && <span className="block text-xs font-normal text-amber-700">{problems} thing{problems > 1 ? 's' : ''} missing</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
    <p className="mt-3 border-t border-slate-100 px-2 pt-3 text-xs text-slate-500 leading-relaxed">
      Fields with <span className="text-red-600 font-semibold">*</span> are needed. What you type is kept when you move between steps.
    </p>
  </nav>
);

/* ------------------------------------------------------------------ right: live summary */
const Row: React.FC<{ icon: React.ReactNode; label: string; value?: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2.5 py-2">
    <span className="mt-0.5 text-slate-400">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm break-words ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{value || 'Not filled yet'}</p>
    </div>
  </div>
);

const fmtDate = (v?: string) => {
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const LiveSummary: React.FC<{
  data: Record<string, any>;
  photo: string | null;
  errors: Record<string, string>;
  documents: number;
  mode: string;
}> = ({ data, photo, errors, documents, mode }) => {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
  const cls = [data.class, data.section].filter(Boolean).join(' - ');
  const totalRequired = Object.keys(REQUIRED_FIELDS).length;
  const missing = Object.keys(errors).filter(k => REQUIRED_FIELDS[k]).length;
  const filled = Math.max(0, totalRequired - missing);
  const pct = Math.round((filled / totalRequired) * 100);
  const initials = name ? name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : '';

  return (
    <aside className="space-y-4 sticky top-4">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-4 py-4 text-brand-contrast">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{mode === 'create' ? 'New admission' : 'Student'}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-2 ring-white/30 text-lg font-bold">
              {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials || <User className="h-6 w-6 opacity-80" />}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug break-words">{name || 'Student name'}</p>
              <p className="text-sm opacity-80">{cls ? `Class ${cls}` : 'Class not chosen'}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 divide-y divide-slate-100">
          <Row icon={<CalendarDays className="h-4 w-4" />} label="Date of birth" value={fmtDate(data.dob)} />
          <Row icon={<User className="h-4 w-4" />} label="Father's name" value={data.Fatherfirstname} />
          <Row icon={<Phone className="h-4 w-4" />} label="Main phone" value={(data.phone || '').replace(/^\+91\s?$/, '')} />
          <Row icon={<School className="h-4 w-4" />} label="Branch" value={data.branch} />
          <Row icon={<FileText className="h-4 w-4" />} label="Documents to upload" value={documents ? `${documents} added` : ''} />
        </div>
      </section>

      {mode === 'create' && (
        <section className="card p-4">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold text-slate-900">Required details</p>
            <p className="tabular-nums text-slate-600">{filled} of {totalRequired}</p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{pct === 100 ? 'All needed details are filled. You can save.' : 'Fill the fields marked * to save the student.'}</p>
        </section>
      )}

      <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-slate-700">
        <p className="flex items-center gap-2 font-semibold text-brand-800"><Info className="h-4 w-4" /> Good to know</p>
        <ul className="mt-2 space-y-1.5 list-disc pl-5 text-slate-600">
          <li>The admission number is given automatically when you save.</li>
          <li>Documents can also be added later from Student documents.</li>
          <li>After saving you can collect the first fee straight away.</li>
        </ul>
      </section>
    </aside>
  );
};
