import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users, CalendarCheck, Wallet, AlertTriangle, Contact, PartyPopper, CalendarDays, Receipt } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { ErrorState } from '../ui';

/* ------------------------------------------------------------------ types */
interface Overview {
  as_of: string;
  academic_year: string;
  branch: string;
  students: null | { total: number; boys: number; girls: number; new_this_month: number; by_class: { class: string; count: number }[] };
  attendance: null | { date: string; total_students: number; marked: number; not_marked: number; present: number; absent: number; leave: number; percent_present: number | null };
  fees: null | {
    collected_today: number; receipts_today: number; collected_this_month: number; collected_this_session: number;
    total_due: number; overdue_amount: number; overdue_students: number;
    today_by_mode: { mode: string; amount: number }[];
    last_7_days: { date: string; amount: number }[];
    recent_receipts: { receipt_no: string; student: string; class: string; amount: number; mode: string; date: string | null }[];
  };
  staff: null | { total: number; present: number; late: number; on_leave: number; absent: number; not_recorded: number };
  upcoming: null | { holidays: { title: string; start: string; end: string }[]; birthdays_today: { name: string; class: string }[] };
}

/* ---------------------------------------------------------------- helpers */
const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
/** Short money for tiles: ₹3.2L, ₹1.4Cr */
const inrShort = (n: number) => {
  const v = Math.round(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  return inr(v);
};
const num = (n: number) => (n || 0).toLocaleString('en-IN');
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Nursery/LKG/UKG first, then 1, 2, … 10, then anything else alphabetically */
const classOrder = (c: string) => {
  const s = c.toLowerCase();
  const pre = ['playgroup', 'pre', 'nursery', 'lkg', 'ukg'].findIndex(p => s.startsWith(p));
  if (pre >= 0) return pre - 10;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : 1000;
};

/* -------------------------------------------------------------- building blocks */
const Card: React.FC<{ title: string; icon?: React.ReactNode; aside?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, icon, aside, className = '', children }) => (
  <section className={`card ${className}`}>
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        {icon && <span className="text-slate-400">{icon}</span>}{title}
      </h2>
      {aside && <div className="text-sm text-slate-500">{aside}</div>}
    </div>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; detail?: React.ReactNode; icon: React.ReactNode; tone?: 'brand' | 'good' | 'warn' }> = ({ label, value, detail, icon, tone = 'brand' }) => {
  const iconTone = tone === 'good' ? 'bg-emerald-50 text-emerald-600' : tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600';
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-500 leading-snug">{detail}</p>}
    </div>
  );
};

/** Single-series vertical bars (one hue), value shown on hover/focus and for the latest bar. */
const DayBars: React.FC<{ data: { date: string; amount: number }[] }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.amount));
  return (
    <div>
      <div className="flex items-end gap-2 h-36" role="list" aria-label="Fee collected each day, last 7 days">
        {data.map((d, i) => {
          const h = d.amount > 0 ? Math.max(4, (d.amount / max) * 100) : 0;
          const last = i === data.length - 1;
          return (
            <div key={d.date} role="listitem" tabIndex={0}
              className="group relative flex-1 h-full flex flex-col justify-end items-center focus:outline-none"
              aria-label={`${dateLabel(d.date)}: ${inr(d.amount)}`}>
              <span className={`absolute -top-1 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-pop
                ${last ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'} transition-opacity pointer-events-none`}>
                {dateLabel(d.date)} · {inr(d.amount)}
              </span>
              {last && d.amount > 0 && <span className="mb-1 text-xs font-medium text-slate-700 tabular-nums">{inrShort(d.amount)}</span>}
              <div className="w-full max-w-[42px] rounded-t bg-brand-500 group-hover:bg-brand-600 transition-colors" style={{ height: `${h}%` }} />
              {d.amount === 0 && <div className="w-full max-w-[42px] h-px bg-slate-200" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => (
          <span key={d.date} className={`flex-1 text-center text-xs ${i === data.length - 1 ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
            {i === data.length - 1 ? 'Today' : dayLabel(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Horizontal single-series bars with the number written at the end. */
const HBars: React.FC<{ rows: { label: string; value: number }[]; unit?: string }> = ({ rows, unit = '' }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 truncate text-slate-600" title={r.label}>{r.label}</span>
          <span className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-12 shrink-0 text-right font-medium text-slate-800 tabular-nums">{num(r.value)}{unit}</span>
        </li>
      ))}
    </ul>
  );
};

/** Labelled parts of a whole (status colours), with a legend that carries the numbers. */
const PartsBar: React.FC<{ parts: { label: string; value: number; color: string }[]; ariaLabel: string }> = ({ parts, ariaLabel }) => {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter(p => p.value > 0);
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100" role="img" aria-label={ariaLabel}>
        {total > 0 && shown.map(p => (
          <span key={p.label} className={`h-full ${p.color}`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${num(p.value)}`} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {parts.map(p => (
          <li key={p.label} className="flex items-center gap-2 min-w-0">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.color}`} aria-hidden="true" />
            <span className="text-slate-600 truncate">{p.label}</span>
            <span className="ml-auto font-medium text-slate-900 tabular-nums">{num(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Skeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse" aria-hidden="true">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map(i => <div key={i} className="card h-[124px]" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map(i => <div key={i} className="card h-56" />)}
    </div>
  </div>
);

/* ------------------------------------------------------------------ page */
const REFRESH_MS = 5 * 60 * 1000;

const SchoolOverview: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await api.get('/dashboard/overview');
      setData(res.data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load the school overview. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load now, refresh every 5 minutes and whenever the app comes back to the screen
  useEffect(() => {
    load();
    const t = window.setInterval(() => load(true), REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const classRows = useMemo(
    () => (data?.students?.by_class || [])
      .slice()
      .sort((a, b) => classOrder(a.class) - classOrder(b.class) || a.class.localeCompare(b.class))
      .map(c => ({ label: /^\d+$/.test(c.class) ? `Class ${c.class}` : c.class, value: c.count })),
    [data],
  );

  const name = (user as any)?.name || user?.username || '';
  const todayText = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const { students: st, attendance: at, fees: fe, staff: sf, upcoming: up } = data || ({} as Overview);
  const nothingAllowed = data && !st && !at && !fe && !sf;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-5 sm:py-7 space-y-5">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{greeting()}{name ? `, ${name}` : ''}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {todayText}
            {data && <> · {data.branch} · Session {data.academic_year}</>}
          </p>
        </div>
        <button type="button" onClick={() => load()} disabled={loading} className="btn-secondary btn-sm" aria-label="Refresh the overview">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Refresh'}
        </button>
      </div>

      {loading && !data && <Skeleton />}
      {error && !data && <div className="card"><ErrorState title="Could not load the overview" message={error} onRetry={() => load()} /></div>}
      {error && data && <p role="alert" className="text-sm text-amber-700">Showing the last loaded numbers. {error}</p>}

      {nothingAllowed && (
        <div className="card p-6 text-sm text-slate-600">
          There is no school information for your account yet. Use the menu to open your work.
        </div>
      )}

      {data && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {st && (
              <Stat label="Students" icon={<Users className="w-5 h-5" />} value={num(st.total)}
                detail={<>{num(st.boys)} boys · {num(st.girls)} girls{st.new_this_month > 0 && <><br />{num(st.new_this_month)} joined this month</>}</>} />
            )}
            {at && (
              <Stat label="Present today" icon={<CalendarCheck className="w-5 h-5" />} tone="good"
                value={at.percent_present === null ? '—' : `${at.percent_present}%`}
                detail={at.marked === 0
                  ? 'Attendance not taken yet today'
                  : <>{num(at.present)} of {num(at.marked)} marked{at.not_marked > 0 && <><br />{num(at.not_marked)} not marked yet</>}</>} />
            )}
            {fe && (
              <Stat label="Fee collected today" icon={<Wallet className="w-5 h-5" />} value={inrShort(fe.collected_today)}
                detail={<>{num(fe.receipts_today)} receipt{fe.receipts_today === 1 ? '' : 's'}<br />{inrShort(fe.collected_this_month)} this month</>} />
            )}
            {fe && (
              <Stat label="Fees still due" icon={<AlertTriangle className="w-5 h-5" />} tone="warn" value={inrShort(fe.total_due)}
                detail={fe.overdue_amount > 0
                  ? <><span className="font-medium text-amber-700">{inrShort(fe.overdue_amount)} overdue</span> from {num(fe.overdue_students)} student{fe.overdue_students === 1 ? '' : 's'}</>
                  : 'Nothing overdue'} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Fee collection trend */}
            {fe && (
              <Card title="Fee collected, last 7 days" icon={<Wallet className="w-4 h-4" />}
                aside={<span>This session: <span className="font-medium text-slate-800">{inrShort(fe.collected_this_session)}</span></span>}>
                <DayBars data={fe.last_7_days} />
                {fe.today_by_mode.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-sm text-slate-500 mb-2">Today, by payment type</p>
                    <ul className="flex flex-wrap gap-2">
                      {fe.today_by_mode.map(m => (
                        <li key={m.mode} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-sm">
                          <span className="text-slate-600">{m.mode === 'CardSwap' ? 'Card' : m.mode === 'Online' ? 'Bank transfer' : m.mode}</span>{' '}
                          <span className="font-medium text-slate-900 tabular-nums">{inr(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* Attendance today */}
            {at && (
              <Card title="Student attendance today" icon={<CalendarCheck className="w-4 h-4" />}
                aside={at.marked > 0 ? `${num(at.marked)} of ${num(at.total_students)} marked` : undefined}>
                {at.total_students === 0 ? (
                  <p className="text-sm text-slate-500">No active students.</p>
                ) : (
                  <PartsBar
                    ariaLabel={`Attendance today: ${at.present} present, ${at.absent} absent, ${at.leave} on leave, ${at.not_marked} not marked`}
                    parts={[
                      { label: 'Present', value: at.present, color: 'bg-emerald-500' },
                      { label: 'Absent', value: at.absent, color: 'bg-red-500' },
                      { label: 'On leave', value: at.leave, color: 'bg-amber-400' },
                      { label: 'Not marked yet', value: at.not_marked, color: 'bg-slate-300' },
                    ]}
                  />
                )}
              </Card>
            )}

            {/* Students by class */}
            {st && classRows.length > 0 && (
              <Card title="Students in each class" icon={<Users className="w-4 h-4" />} aside={`${classRows.length} classes`}>
                <div className={classRows.length > 10 ? 'max-h-72 overflow-y-auto pr-1' : ''}>
                  <HBars rows={classRows} />
                </div>
              </Card>
            )}

            {/* Staff today */}
            {sf && (
              <Card title="Staff today" icon={<Contact className="w-4 h-4" />} aside={`${num(sf.total)} staff`}>
                {sf.total === 0 ? (
                  <p className="text-sm text-slate-500">No active staff in this branch.</p>
                ) : (
                  <>
                    <PartsBar
                      ariaLabel={`Staff today: ${sf.present} present, ${sf.on_leave} on leave, ${sf.absent} absent, ${sf.not_recorded} not recorded`}
                      parts={[
                        { label: 'Present', value: sf.present, color: 'bg-emerald-500' },
                        { label: 'On leave', value: sf.on_leave, color: 'bg-amber-400' },
                        { label: 'Absent', value: sf.absent, color: 'bg-red-500' },
                        { label: 'No punch yet', value: sf.not_recorded, color: 'bg-slate-300' },
                      ]}
                    />
                    {sf.late > 0 && <p className="mt-3 text-sm text-amber-700">{num(sf.late)} came in late today</p>}
                  </>
                )}
              </Card>
            )}

            {/* Latest receipts */}
            {fe && (
              <Card title="Latest fee receipts" icon={<Receipt className="w-4 h-4" />}>
                {fe.recent_receipts.length === 0 ? (
                  <p className="text-sm text-slate-500">No fee collected yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 -my-1">
                    {fe.recent_receipts.map(r => (
                      <li key={`${r.receipt_no}-${r.student}`} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{r.student}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {r.class && <>Class {r.class} · </>}Receipt {r.receipt_no}{r.date && <> · {dateLabel(r.date)}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">{inr(r.amount)}</p>
                          <p className="text-xs text-slate-500">{r.mode === 'CardSwap' ? 'Card' : r.mode === 'Online' ? 'Bank transfer' : r.mode}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {/* Coming up */}
            {up && (
              <Card title="Coming up" icon={<CalendarDays className="w-4 h-4" />}>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">Holidays (next 45 days)</p>
                    {up.holidays.length === 0 ? (
                      <p className="text-sm text-slate-700">No holidays coming up.</p>
                    ) : (
                      <ul className="space-y-2">
                        {up.holidays.map(h => (
                          <li key={`${h.title}-${h.start}`} className="flex items-center gap-3 text-sm">
                            <span className="w-24 shrink-0 font-medium text-slate-800 tabular-nums">
                              {dateLabel(h.start)}{h.end !== h.start && <> – {dateLabel(h.end)}</>}
                            </span>
                            <span className="text-slate-700 truncate">{h.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1.5 text-sm text-slate-500 mb-2"><PartyPopper className="w-4 h-4" /> Birthdays today</p>
                    {up.birthdays_today.length === 0 ? (
                      <p className="text-sm text-slate-700">No student birthdays today.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {up.birthdays_today.map(b => (
                          <li key={`${b.name}-${b.class}`} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-800">
                            {b.name}{b.class && <span className="text-brand-600"> · {b.class}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SchoolOverview;
