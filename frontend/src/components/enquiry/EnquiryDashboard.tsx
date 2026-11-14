import React, { useEffect, useState } from 'react';
import { ErrorState, LoadingState } from '../ui';
import { DashboardData, errorText, followupApi, niceDate } from './enquiryApi';

const PERIODS = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' }, { id: 'year', label: 'This year' },
];

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: string; onClick?: () => void }> = ({ label, value, hint, tone = 'text-slate-900', onClick }) => {
  const body = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="card p-4 text-left hover:border-brand-300">{body}</button>
  ) : (
    <div className="card p-4">{body}</div>
  );
};

/** Enquiry numbers for the principal / admin. "To call" tiles always show the work waiting right now. */
const EnquiryDashboard: React.FC<{ branchId: number; onGoToCalls?: () => void }> = ({ branchId, onGoToCalls }) => {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    followupApi.dashboard(branchId, period).then(d => live && setData(d)).catch(err => live && setError(errorText(err)));
    return () => { live = false; };
  }, [branchId, period, reload]);

  const maxReason = Math.max(1, ...(data?.reasons.map(r => r.count) || [1]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {PERIODS.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-medium
              ${period === p.id ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error} onRetry={() => setReload(n => n + 1)} /> : !data ? <LoadingState /> : (
        <>
          <section aria-label="Work waiting now">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Waiting now</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="To call today" value={data.tiles.to_call_today} tone="text-brand-700" onClick={onGoToCalls} />
              <Tile label="Late calls" value={data.tiles.overdue} tone={data.tiles.overdue ? 'text-red-600' : 'text-slate-900'}
                hint="Should have been called before today" onClick={onGoToCalls} />
            </div>
          </section>

          <section aria-label="Enquiries in this period">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Enquiries {niceDate(data.from)}{data.from !== data.to ? ` – ${niceDate(data.to)}` : ''}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Enquiries" value={data.tiles.enquiries} hint="Parents who came" />
              <Tile label="Called" value={data.tiles.called} hint={`${data.tiles.not_called} not called yet`} />
              <Tile label="In follow-up" value={data.tiles.in_follow_up} hint={`${data.tiles.visits_planned} planning a visit`} />
              <Tile label="Calls made" value={data.tiles.calls_made} />
              <Tile label="Joined" value={data.tiles.joined} tone="text-emerald-700" hint={`${data.tiles.joined_percent}% of enquiries`} />
              <Tile label="Not interested" value={data.tiles.not_interested} tone="text-red-600" />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="card p-4" aria-label="Why parents said no">
              <h2 className="font-semibold text-slate-900">Why parents said no</h2>
              {data.reasons.length === 0 ? <p className="mt-2 text-sm text-slate-500">No one said no in this period.</p> : (
                <ul className="mt-3 space-y-2.5">
                  {data.reasons.map(r => (
                    <li key={r.reason}>
                      <div className="flex justify-between text-sm"><span className="text-slate-700">{r.reason}</span><span className="font-semibold tabular-nums">{r.count}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-red-400" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-4" aria-label="Calls by team member">
              <h2 className="font-semibold text-slate-900">Calls by team member</h2>
              {data.callers.length === 0 ? <p className="mt-2 text-sm text-slate-500">No calls in this period.</p> : (
                <table className="mt-2 w-full text-sm">
                  <thead><tr className="text-left text-slate-500"><th className="py-1.5 font-medium">Name</th><th className="py-1.5 text-right font-medium">Calls</th><th className="py-1.5 text-right font-medium">Joined</th></tr></thead>
                  <tbody>
                    {data.callers.map(c => (
                      <tr key={c.name} className="border-t border-slate-100">
                        <td className="py-2">{c.name}</td>
                        <td className="py-2 text-right tabular-nums">{c.calls}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700 font-semibold">{c.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default EnquiryDashboard;
