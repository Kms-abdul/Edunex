import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

/**
 * Filters in a card. On phones, once results are showing (`collapsible`),
 * the fields hide behind a "Change filters" button with a one-line summary.
 */
const Filters: React.FC<{
  summary?: React.ReactNode;
  collapsible?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ summary, collapsible, actions, children }) => {
  const [open, setOpen] = useState(false);
  const hideOnPhone = collapsible && !open;
  return (
    <div className="card p-4 space-y-3">
      {collapsible && (
        <div className="md:hidden flex items-center justify-between gap-3">
          <p className="text-sm text-slate-700 min-w-0 break-words">{summary}</p>
          <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <SlidersHorizontal className="w-4 h-4" /> {open ? 'Hide filters' : 'Change filters'}
          </button>
        </div>
      )}
      <div className={hideOnPhone ? 'hidden md:block' : ''}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">{children}</div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      {summary && <p className={`text-sm text-slate-600 ${collapsible ? 'hidden md:block' : ''}`}>{summary}</p>}
    </div>
  );
};

export default Filters;
