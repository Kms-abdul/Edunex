import React from 'react';
import { ChevronRight } from 'lucide-react';
import { EmptyState, LoadingState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** Shown as the card title on phones */
  primary?: boolean;
  /** Shown as the small line under the title on phones */
  secondary?: boolean;
  /** Hide this column on phone cards */
  hideOnMobile?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataListProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => React.Key;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: React.ReactNode;
  /** Extra content per row on phone cards, e.g. action buttons */
  mobileActions?: (row: T) => React.ReactNode;
}

const cell = <T,>(col: Column<T>, row: T) => (col.render ? col.render(row) : ((row as any)[col.key] ?? '—'));

/**
 * A list that is a table on wide screens and simple cards on phones,
 * so nobody has to scroll sideways to read a row.
 */
function DataList<T>({ columns, rows, rowKey, onRowClick, loading, emptyTitle = 'Nothing to show', emptyHint, mobileActions }: DataListProps<T>) {
  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState compact title={emptyTitle} description={emptyHint} />;

  const primary = columns.find(c => c.primary) || columns[0];
  const secondary = columns.find(c => c.secondary);
  const details = columns.filter(c => c !== primary && c !== secondary && !c.hideOnMobile);

  return (
    <>
      {/* Phone: cards */}
      <ul className="md:hidden space-y-2.5">
        {rows.map((row, i) => (
          <li key={rowKey(row, i)} className="rounded-xl border border-slate-200 bg-white">
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? e => { if (e.key === 'Enter') onRowClick(row); } : undefined}
              className={`px-4 py-3 ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-slate-900 break-words">{cell(primary, row)}</div>
                  {secondary && <div className="text-sm text-slate-500 mt-0.5 break-words">{cell(secondary, row)}</div>}
                </div>
                {onRowClick && <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />}
              </div>
              {details.length > 0 && (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {details.map(col => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-xs text-slate-500">{col.header}</dt>
                      <dd className="text-slate-800 break-words">{cell(col, row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {mobileActions && <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5">{mobileActions(row)}</div>}
          </li>
        ))}
      </ul>

      {/* Wide screens: table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={`px-4 py-2.5 border-b border-slate-200 text-${col.align || 'left'}`}>{col.header}</th>
                ))}
                {onRowClick && <th className="w-8 border-b border-slate-200" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-slate-100 last:border-0 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 text-${col.align || 'left'} ${col.className || ''}`}>{cell(col, row)}</td>
                  ))}
                  {onRowClick && <td className="pr-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default DataList;
