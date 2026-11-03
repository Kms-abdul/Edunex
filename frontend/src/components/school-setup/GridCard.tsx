import React from 'react';
import { MoveHorizontal } from 'lucide-react';

/**
 * A wide grid (timetable, register…) inside a card that scrolls sideways.
 * On phones a one-line hint tells people to swipe.
 */
const GridCard: React.FC<{ children: React.ReactNode; className?: string; footer?: React.ReactNode; id?: string }> = ({
  children, className = '', footer, id,
}) => (
  <div id={id} className={className}>
    <p className="md:hidden mb-2 flex items-center gap-1.5 text-sm text-slate-500 print:hidden">
      <MoveHorizontal className="w-4 h-4" /> Swipe sideways to see more
    </p>
    <div className="card overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">{children}</div>
      {footer}
    </div>
  </div>
);

export default GridCard;
