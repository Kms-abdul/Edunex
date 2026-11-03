import React from 'react';

/** Big, tap-friendly tabs that fill the width on phones. */
function SegmentTabs<T extends string>({ value, onChange, options, className = '' }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`segmented flex w-full sm:inline-flex sm:w-auto overflow-x-auto ${className}`}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`segmented-item flex-1 sm:flex-none whitespace-nowrap min-h-[40px] inline-flex items-center justify-center gap-1.5 ${value === o.value ? 'segmented-item-active' : ''}`}
        >
          {o.label}
          {typeof o.count === 'number' && (
            <span className={`rounded-full px-1.5 text-xs ${value === o.value ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default SegmentTabs;
