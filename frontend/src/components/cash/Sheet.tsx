import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * A simple dialog: slides up from the bottom on phones, centred on wide screens.
 * The body scrolls; `footer` stays visible at the bottom.
 */
const Sheet: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, footer, size = 'md', children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`w-full ${size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-pop overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 break-words">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5 break-words">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 sm:px-5 py-3 [&>*]:flex-1 sm:[&>*]:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sheet;
