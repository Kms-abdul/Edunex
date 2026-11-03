import React from 'react';

export interface StatTile {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'brand' | 'success' | 'danger' | 'warning' | 'neutral';
  /** Make this tile wider on phones (spans both columns). */
  wide?: boolean;
}

const toneClass: Record<NonNullable<StatTile['tone']>, string> = {
  brand: 'text-brand-700',
  success: 'text-emerald-700',
  danger: 'text-red-600',
  warning: 'text-amber-700',
  neutral: 'text-slate-900',
};

/** A row of simple number tiles: 2 per row on phones, all in one row on wide screens. */
const StatTiles: React.FC<{ tiles: StatTile[]; className?: string }> = ({ tiles, className = '' }) => (
  <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${tiles.length >= 4 ? 'md:grid-cols-4' : tiles.length === 3 ? 'md:grid-cols-3' : ''} ${className}`}>
    {tiles.map(t => (
      <div key={t.label} className={`card px-4 py-3 min-w-0 ${t.wide ? 'col-span-2 md:col-span-1' : ''}`}>
        <p className="text-sm text-slate-500">{t.label}</p>
        <p className={`mt-0.5 text-lg sm:text-xl font-semibold tabular-nums break-words ${toneClass[t.tone || 'neutral']}`}>{t.value}</p>
        {t.hint && <p className="mt-0.5 text-xs text-slate-500">{t.hint}</p>}
      </div>
    ))}
  </div>
);

export default StatTiles;
