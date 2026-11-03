import React from 'react';
import { Pencil, User } from 'lucide-react';
import { SUMMARY, LABELS, displayValue } from './admissionSteps';

const DATE_FIELDS = new Set(['dob', 'admission_date']);

const formatDate = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Readable summary of everything entered, one card per step.
 * With `onEdit` each card gets an "Edit" link back to its step.
 */
const AdmissionSummary: React.FC<{
  data: Record<string, any>;
  photo?: string | null;
  onEdit?: (step: number) => void;
  errors?: Record<string, string>;
}> = ({ data, photo, onEdit, errors = {} }) => {
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');
  const classLabel = [data.class, data.section].filter(Boolean).join(' - ');

  return (
    <div className="space-y-4">
      <div className="card card-body flex items-center gap-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center">
          {photo ? <img src={photo} alt="Student" className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-slate-400" />}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900 break-words">{fullName || 'Name not entered'}</p>
          <p className="text-sm text-slate-600">
            {classLabel ? `Class ${classLabel}` : 'Class not chosen'}
            {data.branch ? ` · ${data.branch}` : ''}
          </p>
        </div>
      </div>

      {SUMMARY.map(section => {
        const rows = [
          ...section.main,
          ...section.extra.filter(n => displayValue(data[n]) !== ''),
        ];
        // Permanent address: say "same" instead of repeating it
        const sameAddress = section.step === 2 && data.isSameAddress;
        return (
          <section key={section.step} className="card">
            <div className="card-header">
              <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(section.step)}
                  className="btn-ghost btn-sm min-h-[44px] text-brand-700"
                  aria-label={`Edit ${section.title}`}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
            </div>
            <dl className="card-body grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {rows
                .filter(n => !(sameAddress && (n === 'permanentAddress' || n === 'permanentCity_ui')))
                .map(name => {
                  const raw = displayValue(data[name]);
                  const value = raw && DATE_FIELDS.has(name) ? formatDate(raw) : raw;
                  const error = errors[name];
                  return (
                    <div key={name} className="min-w-0">
                      <dt className="text-xs text-slate-500">{LABELS[name] || name}</dt>
                      <dd className={`text-sm break-words ${error ? 'text-red-600' : value ? 'text-slate-900' : 'text-slate-400'}`}>
                        {error ? error : value || '—'}
                      </dd>
                    </div>
                  );
                })}
              {sameAddress && (
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{LABELS.permanentAddress}</dt>
                  <dd className="text-sm text-slate-900">Same as home address</dd>
                </div>
              )}
            </dl>
          </section>
        );
      })}
    </div>
  );
};

export default AdmissionSummary;
