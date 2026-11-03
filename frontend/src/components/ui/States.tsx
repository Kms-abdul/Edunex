import React from 'react';
import { Inbox, AlertTriangle, XCircle, CheckCircle2, Info, Loader2, RotateCw } from 'lucide-react';

/* ---------------------------------------------------------------- Spinner */
export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className = '' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return <Loader2 className={`${s} animate-spin text-brand-600 ${className}`} aria-hidden="true" />;
};

/** Centered loading block for cards, tables and full pages. */
export const LoadingState: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className = '' }) => (
  <div role="status" className={`flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500 ${className}`}>
    <Spinner size="lg" />
    <span>{label}</span>
  </div>
);

/* ------------------------------------------------------------- EmptyState */
export const EmptyState: React.FC<{
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}> = ({ title = 'Nothing here yet', description, icon, action, className = '', compact }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-14'} px-4 ${className}`}>
    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
      {icon || <Inbox className="w-6 h-6" />}
    </div>
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ------------------------------------------------------------------ Alert */
type AlertTone = 'error' | 'success' | 'warning' | 'info';
const alertStyles: Record<AlertTone, { box: string; icon: React.ReactNode }> = {
  error: { box: 'bg-red-50 border-red-200 text-red-800', icon: <XCircle className="w-5 h-5 text-red-500" /> },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" /> },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-800', icon: <AlertTriangle className="w-5 h-5 text-amber-500" /> },
  info: { box: 'bg-brand-50 border-brand-200 text-brand-800', icon: <Info className="w-5 h-5 text-brand-500" /> },
};

/** Inline message banner. */
export const Alert: React.FC<{
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
  className?: string;
}> = ({ tone = 'info', title, children, onRetry, onClose, className = '' }) => {
  const s = alertStyles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${s.box} ${className}`}>
      <span className="flex-shrink-0 mt-px">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline flex-shrink-0">
          <RotateCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="flex-shrink-0 opacity-60 hover:opacity-100">
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/** Full-block error with retry, for failed page/table loads. */
export const ErrorState: React.FC<{ title?: string; message?: React.ReactNode; onRetry?: () => void; className?: string }> = ({
  title = 'Something went wrong', message, onRetry, className = '',
}) => (
  <EmptyState
    className={className}
    icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
    title={title}
    description={message}
    action={onRetry && (
      <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
        <RotateCw className="w-3.5 h-3.5" /> Try again
      </button>
    )}
  />
);
