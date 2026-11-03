import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface Choice {
  key: string;
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Shown greyed out with a "Coming soon" label */
  comingSoon?: boolean;
}

/**
 * A list of big, tappable choices ("What do you want to do?").
 * One column on phones, two on wider screens.
 */
const ChoiceList: React.FC<{ title?: string; choices: Choice[]; className?: string }> = ({ title, choices, className = '' }) => (
  <section className={className}>
    {title && <h2 className="text-sm font-semibold text-slate-500 mb-2">{title}</h2>}
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {choices.map(c => (
        <li key={c.key}>
          <button
            type="button"
            onClick={c.onClick}
            disabled={c.comingSoon || !c.onClick}
            className="w-full min-h-[64px] flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-card transition-colors hover:border-brand-300 active:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-slate-200"
          >
            {c.icon && (
              <span className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{c.icon}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-slate-900">{c.title}</span>
              {c.hint && <span className="block text-sm text-slate-500 mt-0.5">{c.hint}</span>}
            </span>
            {c.comingSoon ? (
              <span className="badge-neutral flex-shrink-0">Coming soon</span>
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
            )}
          </button>
        </li>
      ))}
    </ul>
  </section>
);

export default ChoiceList;
