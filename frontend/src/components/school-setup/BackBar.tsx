import React from 'react';
import { ArrowLeft } from 'lucide-react';

/** "← Back" link plus the title of the current part of a page. */
const BackBar: React.FC<{ label?: string; title: string; hint?: React.ReactNode; onBack: () => void; actions?: React.ReactNode }> = ({
  label = 'Back', title, hint, onBack, actions,
}) => (
  <div className="mb-4">
    <button type="button" onClick={onBack} className="btn-ghost btn-sm -ml-2 mb-1">
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-sm text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
    </div>
  </div>
);

export default BackBar;
