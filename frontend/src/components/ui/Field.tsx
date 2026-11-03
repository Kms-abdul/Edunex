import React from 'react';

/** Form field wrapper: a clear label, an optional plain-words hint, and an error message. */
const Field: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, error, required, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800 mb-1.5">
      {label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
    </label>
    {children}
    {error ? (
      <p role="alert" className="mt-1.5 text-sm text-red-600">{error}</p>
    ) : hint ? (
      <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
    ) : null}
  </div>
);

export default Field;
