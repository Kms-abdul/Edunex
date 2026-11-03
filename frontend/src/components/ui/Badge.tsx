import React from 'react';

type Tone = 'success' | 'danger' | 'warning' | 'neutral' | 'brand';

/** Status pill. `status` maps common ERP statuses to a tone automatically. */
const Badge: React.FC<{ tone?: Tone; status?: string; dot?: boolean; className?: string; children?: React.ReactNode }> = ({
  tone, status, dot, className = '', children,
}) => {
  const resolved: Tone = tone || toneForStatus(status);
  const dotColor = { success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-500', neutral: 'bg-slate-400', brand: 'bg-brand-500' }[resolved];
  return (
    <span className={`badge-${resolved} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {children ?? status}
    </span>
  );
};

export const toneForStatus = (status?: string): Tone => {
  const s = (status || '').toLowerCase();
  if (/(active|approved|paid|present|success|completed|deposited|verified|open)/.test(s) && !/inactive|unpaid/.test(s)) return 'success';
  if (/(inactive|rejected|failed|absent|cancel|deleted|overdue|unpaid|closed|blocked)/.test(s)) return 'danger';
  if (/(pending|partial|late|draft|hold|review|leave)/.test(s)) return 'warning';
  return 'neutral';
};

export default Badge;
