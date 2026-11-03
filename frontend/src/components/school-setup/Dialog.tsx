import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * A simple dialog: full screen on phones, a centred card on wider screens.
 * Title at the top, scrolling body, and the main buttons fixed at the bottom.
 */
const Dialog: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, footer, size = 'md', children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4"
    >
      <div
        className={`bg-white w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'} sm:rounded-xl sm:border sm:border-slate-200 shadow-pop flex flex-col h-full sm:h-auto sm:max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">{children}</div>
        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 sm:rounded-b-xl flex flex-wrap items-center justify-end gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialog;
