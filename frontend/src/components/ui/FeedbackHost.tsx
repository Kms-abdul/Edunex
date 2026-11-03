import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { feedbackStore, ToastItem, ToastTone } from './feedback';

const toneStyles: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bar: 'bg-emerald-500' },
  error: { icon: <XCircle className="w-5 h-5 text-red-600" />, bar: 'bg-red-500' },
  warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, bar: 'bg-amber-500' },
  info: { icon: <Info className="w-5 h-5 text-brand-600" />, bar: 'bg-brand-500' },
};

const Toast: React.FC<{ t: ToastItem }> = ({ t }) => {
  useEffect(() => {
    const h = setTimeout(() => feedbackStore.dismissToast(t.id), t.duration);
    return () => clearTimeout(h);
  }, [t.id, t.duration]);

  const s = toneStyles[t.tone];
  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto relative w-full sm:w-[360px] overflow-hidden rounded-xl bg-white border border-slate-200 shadow-pop animate-fade-in"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${s.bar}`} />
      <div className="flex items-start gap-3 pl-4 pr-2 py-3">
        <span className="mt-0.5 flex-shrink-0">{s.icon}</span>
        <div className="min-w-0 flex-1">
          {t.title && <p className="text-sm font-semibold text-slate-900">{t.title}</p>}
          <p className="text-sm text-slate-700 whitespace-pre-line break-words">{t.message}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => feedbackStore.dismissToast(t.id)}
          className="btn-icon h-7 w-7 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ConfirmModal: React.FC = () => {
  const confirms = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getConfirms);
  const current = confirms[0];
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!current) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') feedbackStore.settleConfirm(current.id, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;
  const danger = current.tone === 'danger';
  const warning = current.tone === 'warning';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => feedbackStore.settleConfirm(current.id, false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-pop border border-slate-200 animate-scale-in"
      >
        <div className="flex gap-4 p-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50 text-red-600' : warning ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
            {danger || warning ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {current.title || (danger ? 'Please confirm' : 'Are you sure?')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line break-words">{current.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
          <button type="button" className="btn-secondary" onClick={() => feedbackStore.settleConfirm(current.id, false)}>
            {current.cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmBtn}
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => feedbackStore.settleConfirm(current.id, true)}
          >
            {current.confirmText || (danger ? 'Yes, continue' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Mount once at the app root. Renders toasts and confirm dialogs. */
const FeedbackHost: React.FC = () => {
  const toasts = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getToasts);
  return (
    <>
      <div className="no-print pointer-events-none fixed z-[210] top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:top-4 flex flex-col items-stretch sm:items-end gap-2">
        {toasts.map(t => <Toast key={t.id} t={t} />)}
      </div>
      <ConfirmModal />
    </>
  );
};

export default FeedbackHost;
