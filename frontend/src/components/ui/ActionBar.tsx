import React from 'react';

/**
 * Main actions of a screen (e.g. Back / Next / Save).
 * On phones it sticks to the bottom of the screen, just above the tab bar,
 * so the next step is always within thumb reach. On desktop it sits inline.
 */
const ActionBar: React.FC<{ children: React.ReactNode; className?: string; note?: React.ReactNode }> = ({ children, className = '', note }) => (
  <div
    className={`no-print sticky bottom-16 md:bottom-0 z-30 -mx-4 sm:mx-0 mt-6 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3
      sm:rounded-xl sm:border sm:shadow-card md:static md:bg-transparent md:border-0 md:shadow-none md:px-0 md:backdrop-blur-0 ${className}`}
  >
    {note && <div className="mb-2 text-sm text-slate-600">{note}</div>}
    <div className="flex items-center justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
  </div>
);

export default ActionBar;
