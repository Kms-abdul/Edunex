import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyState } from '../ui';

export interface MonthGridRow {
  key: React.Key;
  label: React.ReactNode;
  months: Record<string, number>;
  total: number;
  onClick?: () => void;
}

/**
 * A month-by-month amount grid (rows × months). It stays a real grid; on phones
 * it scrolls sideways with the first column pinned and a hint above it.
 */
const MonthGrid: React.FC<{
  firstHeader: string;
  months: string[];
  rows: MonthGridRow[];
  format: (n: number) => string;
  emptyTitle?: string;
}> = ({ firstHeader, months, rows, format, emptyTitle = 'No data' }) => {
  if (rows.length === 0) return <EmptyState compact title={emptyTitle} />;
  return (
    <>
      <p className="md:hidden px-4 pt-3 text-xs text-slate-500">Swipe sideways to see more months.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 text-left px-3 py-2.5 border-b border-slate-200 min-w-[9rem]">{firstHeader}</th>
              {months.map(m => (
                <th key={m} className="text-right px-3 py-2.5 border-b border-slate-200 whitespace-nowrap">{m}</th>
              ))}
              <th className="text-right px-3 py-2.5 border-b border-slate-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0">
                <td className="sticky left-0 z-10 bg-white px-3 py-1 border-r border-slate-100">
                  {row.onClick ? (
                    <button type="button" onClick={row.onClick} className="min-h-[44px] w-full flex items-center gap-1 text-left font-medium text-brand-700 hover:underline">
                      <ChevronRight className="w-4 h-4 flex-shrink-0" /> <span className="break-words">{row.label}</span>
                    </button>
                  ) : (
                    <span className="min-h-[44px] flex items-center font-medium">{row.label}</span>
                  )}
                </td>
                {months.map(m => (
                  <td key={m} className="text-right px-3 py-2 tabular-nums text-slate-700 whitespace-nowrap">{format(row.months[m] || 0)}</td>
                ))}
                <td className="text-right px-3 py-2 font-semibold tabular-nums whitespace-nowrap">{format(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default MonthGrid;
