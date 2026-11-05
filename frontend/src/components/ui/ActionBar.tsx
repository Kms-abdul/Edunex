import React from 'react';

/**
 * Main actions of a screen (e.g. Back / Next / Save).
 *
 * Phones/tablets (< md): pinned to the bottom of the screen, sitting directly on top of
 * the bottom tab bar (no gap), full width, so the next step is always within thumb reach.
 * A spacer of the same height keeps the end of the page from hiding behind it.
 * Desktop (md+): sits inline at the end of the form, as before.
 */
const ActionBar: React.FC<{ children: React.ReactNode; className?: string; note?: React.ReactNode }> = ({ children, className = '', note }) => (
  <>
    {/* Phone spacer: same height as the pinned bar */}
    <div aria-hidden="true" className={`md:hidden ${note ? 'h-32' : 'h-20'}`} />
    <div
      className={`no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white px-4 py-2.5
        shadow-[0_-4px_12px_-6px_rgb(15_23_42/0.12)]
        md:static md:z-auto md:mt-6 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none ${className}`}
    >
      {note && <div className="mb-2 text-[13px] leading-snug text-slate-600 line-clamp-2 md:line-clamp-none md:text-sm">{note}</div>}
      <div className="flex items-center justify-end gap-2 [&>*]:flex-1 md:[&>*]:flex-none">{children}</div>
    </div>
  </>
);

export default ActionBar;
