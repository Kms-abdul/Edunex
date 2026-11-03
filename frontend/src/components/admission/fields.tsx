import React, { createContext, useContext, useState } from 'react';
import { ChevronDown, Camera, User } from 'lucide-react';
import { Field } from '../ui';

/**
 * Small form building blocks for the student admission steps.
 * They read the form values / change handler / errors from context,
 * so each step only lists the fields it needs.
 */

export interface AdmissionFormCtx {
  data: Record<string, any>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Error to show next to the field (only once the person has been there). */
  errorFor: (name: string) => string | undefined;
  onBlur: (name: string) => void;
  /** Fields marked required in this mode. */
  isRequired: (name: string) => boolean;
}

export const AdmissionFormContext = createContext<AdmissionFormCtx | null>(null);

const useForm = () => {
  const ctx = useContext(AdmissionFormContext);
  if (!ctx) throw new Error('Admission fields must be used inside AdmissionFormContext');
  return ctx;
};

export const fieldId = (name: string) => `field_${name}`;

/** Fake a change event so non-input controls (choice buttons) reuse the same change handler. */
const changeEvent = (name: string, value: string) =>
  ({ target: { name, value, type: 'text' } } as unknown as React.ChangeEvent<HTMLInputElement>);

const inputClass = (error?: string, extra = '') =>
  `input min-h-[44px] ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''} ${extra}`;

/* ------------------------------------------------------------------ Text */
export const TextField: React.FC<{
  name: string;
  label: string;
  hint?: React.ReactNode;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  autoComplete?: string;
  className?: string;
  /** Extra control under the input (e.g. "Same as father's phone"). */
  extra?: React.ReactNode;
}> = ({ name, label, hint, type = 'text', inputMode, placeholder, disabled, multiline, autoComplete, className, extra }) => {
  const { data, onChange, errorFor, onBlur, isRequired } = useForm();
  const error = errorFor(name);
  const common = {
    id: fieldId(name),
    name,
    value: data[name] || '',
    onChange,
    onBlur: () => onBlur(name),
    disabled,
    placeholder,
    'aria-invalid': error ? true : undefined,
  };
  return (
    <Field label={label} htmlFor={fieldId(name)} hint={hint} error={error} required={isRequired(name)} className={className}>
      {multiline ? (
        <textarea {...common} rows={2} className={inputClass(error)} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} autoComplete={autoComplete} className={inputClass(error)} />
      )}
      {extra}
    </Field>
  );
};

/* ---------------------------------------------------------------- Select */
export type Option = string | { value: string; label: string };
const optValue = (o: Option) => (typeof o === 'string' ? o : o.value);
const optLabel = (o: Option) => (typeof o === 'string' ? o : o.label);

export const SelectField: React.FC<{
  name: string;
  label: string;
  options: Option[];
  hint?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}> = ({ name, label, options, hint, placeholder = 'Choose…', disabled, className }) => {
  const { data, onChange, errorFor, onBlur, isRequired } = useForm();
  const error = errorFor(name);
  return (
    <Field label={label} htmlFor={fieldId(name)} hint={hint} error={error} required={isRequired(name)} className={className}>
      <select
        id={fieldId(name)}
        name={name}
        value={data[name] || ''}
        onChange={onChange}
        onBlur={() => onBlur(name)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={inputClass(error)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>
        ))}
      </select>
    </Field>
  );
};

/* ------------------------------------------- Choice (big tap buttons) */
export const ChoiceField: React.FC<{
  name: string;
  label: string;
  options: Option[];
  className?: string;
}> = ({ name, label, options, className }) => {
  const { data, onChange, errorFor, onBlur, isRequired } = useForm();
  const error = errorFor(name);
  return (
    <Field label={label} error={error} required={isRequired(name)} className={className}>
      <div id={fieldId(name)} role="radiogroup" aria-label={label} tabIndex={-1} className="flex flex-wrap gap-2">
        {options.map(o => {
          const v = optValue(o);
          const active = data[name] === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { onChange(changeEvent(name, v)); onBlur(name); }}
              className={`min-h-[44px] min-w-[96px] flex-1 sm:flex-none rounded-lg border px-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                  : error
                    ? 'border-red-400 bg-white text-slate-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {optLabel(o)}
            </button>
          );
        })}
      </div>
    </Field>
  );
};

/* -------------------------------------------------------------- Checkbox */
export const CheckField: React.FC<{ name: string; label: string; className?: string }> = ({ name, label, className = '' }) => {
  const { data, onChange } = useForm();
  return (
    <label htmlFor={fieldId(name)} className={`flex min-h-[44px] items-center gap-3 cursor-pointer select-none ${className}`}>
      <input
        type="checkbox"
        id={fieldId(name)}
        name={name}
        checked={!!data[name]}
        onChange={onChange}
        className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </label>
  );
};

/** Checkbox not tied to a form value (e.g. "Same as father's phone"). */
export const Toggle: React.FC<{ id: string; label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }> = ({
  id, label, checked, onChange, className = '',
}) => (
  <label htmlFor={id} className={`mt-1 flex min-h-[44px] items-center gap-3 cursor-pointer select-none ${className}`}>
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
    />
    <span className="text-sm text-slate-700">{label}</span>
  </label>
);

/* --------------------------------------------------- Read-only value */
export const ReadOnlyField: React.FC<{
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  /** Form field name, so "Show me" can scroll here and errors can show. */
  name?: string;
  placeholder?: string;
}> = ({ label, value, hint, className, name, placeholder = 'Not set' }) => {
  const ctx = useContext(AdmissionFormContext);
  const error = name ? ctx?.errorFor(name) : undefined;
  return (
    <Field label={label} hint={hint} error={error} required={name ? ctx?.isRequired(name) : false} className={className}>
      <div
        id={name ? fieldId(name) : undefined}
        tabIndex={name ? -1 : undefined}
        className={`min-h-[44px] flex items-center rounded-lg border px-3 text-sm text-slate-700 bg-slate-50 ${error ? 'border-red-400' : 'border-slate-200'}`}
      >
        {value || <span className="text-slate-400">{placeholder}</span>}
      </div>
    </Field>
  );
};

/* ----------------------------------------- "More details (optional)" */
export const MoreDetails: React.FC<{
  title: string;
  /** Field names inside, used to show "2 filled" so nothing feels hidden. */
  names?: string[];
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, names = [], defaultOpen = false, children }) => {
  const { data } = useForm();
  const filled = names.filter(n => !!data[n]).length;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">
          {title}
          {filled > 0 && <span className="ml-2 text-xs font-normal text-slate-500">{filled} filled</span>}
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>}
    </div>
  );
};

/* ----------------------------------------------------------- Photo */
export const PhotoPicker: React.FC<{
  id: string;
  label: string;
  photo: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}> = ({ id, label, photo, onChange, readOnly }) => (
  <div className="flex items-center gap-4">
    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center">
      {photo ? <img src={photo} alt={label} className="h-full w-full object-cover" /> : <User className="h-9 w-9 text-slate-400" />}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      {!readOnly && (
        <>
          <input type="file" id={id} className="hidden" accept="image/*" onChange={onChange} />
          <label htmlFor={id} className="btn-secondary btn-sm mt-1.5 min-h-[44px] cursor-pointer">
            <Camera className="h-4 w-4" /> {photo ? 'Change photo' : 'Add photo'}
          </label>
        </>
      )}
    </div>
  </div>
);

/* ------------------------------------------------- Small card heading */
export const Group: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <section className={`card ${className}`}>
    {title && <div className="card-header"><h3 className="text-base font-semibold text-slate-900">{title}</h3></div>}
    <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </section>
);
