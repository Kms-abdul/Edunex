import React from 'react';
import { Check } from 'lucide-react';

/**
 * Step-by-step progress for a task, e.g. "Step 2 of 3 · Choose fees".
 * The page owns `current`; pass `onJump` to let people go back to a finished step.
 */
const Steps: React.FC<{ steps: string[]; current: number; onJump?: (index: number) => void; className?: string }> = ({
  steps, current, onJump, className = '',
}) => (
  <div className={className}>
    <p className="text-sm text-slate-500">
      Step {current + 1} of {steps.length}
    </p>
    <p className="text-lg font-semibold text-slate-900 leading-snug">{steps[current]}</p>
    <ol className="mt-3 flex items-center gap-1.5" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onJump;
        return (
          <li key={label} className="flex-1 min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump?.(i)}
              aria-current={active ? 'step' : undefined}
              title={label}
              className={`w-full flex items-center gap-1.5 text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`h-1.5 flex-1 rounded-full ${done || active ? 'bg-brand-600' : 'bg-slate-200'}`} />
              {done && <Check className="hidden sm:block w-3.5 h-3.5 text-brand-600 flex-shrink-0" />}
            </button>
            <span className={`hidden sm:block mt-1 text-xs truncate ${active ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  </div>
);

export default Steps;
