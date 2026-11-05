import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { RefreshCw, Users, Wallet, Landmark, Percent, AlarmClock, BadgePercent } from 'lucide-react';
import api from '../../api';
import { ErrorState } from '../ui';

/* ------------------------------------------------------------------ data */
interface FeesData {
  academic_year: string;
  last_year: string;
  branch: string;
  kpis: { students: number; total_fee: number; collected: number; collection_percent: number | null; outstanding: number; concession: number };
  monthly: { month: string; fee: number; collected: number; last_year: number }[];
  by_fee_type: { label: string; amount: number }[];
  by_class: { class: string; fee: number; collected: number }[];
  by_mode: { label: string; amount: number }[];
  by_branch: { label: string; amount: number }[];
}

/* Validated categorical palette (fixed order, never cycled) */
const SERIES = ['#2a78d6', '#1baf7a', '#eda100', '#6250d6', '#e34948', '#eb6834', '#e87ba4', '#008300'];
const TOTAL = SERIES[0];      // "Total fee" / "This year"
const COLLECTED = SERIES[1];  // "Collected" / "Last year"
const GRID = '#e8ebf0';
const AXIS = '#64748b';

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const inrShort = (n: number) => {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${v}`;
};
const classOrder = (c: string) => {
  const s = c.toLowerCase();
  const pre = ['playgroup', 'pre', 'nursery', 'lkg', 'ukg'].findIndex(p => s.startsWith(p));
  if (pre >= 0) return pre - 10;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : 1000;
};

/* --------------------------------------------------------------- pieces */
const Kpi: React.FC<{ label: string; value: string; icon: React.ReactNode; tint: string }> = ({ label, value, icon, tint }) => (
  <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3.5 min-w-0">
    <span className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 leading-snug">{label}</p>
      <p className="mt-0.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums break-all">{value}</p>
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; legend?: { label: string; color: string }[]; children: React.ReactNode; empty?: boolean }> = ({ title, legend, children, empty }) => (
  <section className="card p-4 sm:p-5 min-w-0">
    <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
    {legend && (
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {legend.map(l => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} aria-hidden="true" />{l.label}
          </li>
        ))}
      </ul>
    )}
    <div className="mt-3 h-56">
      {empty ? <div className="h-full flex items-center justify-center text-sm text-slate-400">No data yet</div> : children}
    </div>
  </section>
);

/** Tooltip in text tokens; the coloured dot carries identity. */
const Tip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      {label !== undefined && <p className="font-semibold text-slate-900 mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-semibold text-slate-900 tabular-nums">{inr(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

/** Donut + list with percentages (labels carry identity, not colour alone). */
const Donut: React.FC<{ rows: { label: string; amount: number }[] }> = ({ rows }) => {
  const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
  return (
    <div className="h-full flex items-center gap-3">
      <div className="h-full aspect-square max-h-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="label" innerRadius="58%" outerRadius="92%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {rows.map((r, i) => <Cell key={r.label} fill={SERIES[i % SERIES.length]} />)}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span className="text-slate-700 leading-snug break-words min-w-0">{r.label}</span>
            <span className="ml-auto font-semibold text-slate-900 tabular-nums">{((r.amount / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const axisProps = { tick: { fill: AXIS, fontSize: 11 }, tickLine: false, axisLine: false } as const;

/* ------------------------------------------------------------------ page */
const FeesDashboard: React.FC = () => {
  const [data, setData] = useState<FeesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/fees');
      setData(res.data); setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not load the fees dashboard.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const classRows = useMemo(
    () => (data?.by_class || []).slice().sort((a, b) => classOrder(a.class) - classOrder(b.class) || a.class.localeCompare(b.class)),
    [data],
  );

  if (error && !data) return <div className="card"><ErrorState title="Could not load the fees dashboard" message={error} onRetry={load} /></div>;
  if (!data) {
    return (
      <div className="space-y-4 animate-pulse" aria-hidden="true">
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="card h-[76px]" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="card h-72" />)}</div>
      </div>
    );
  }

  const k = data.kpis;
  const hasMonthly = data.monthly.some(m => m.fee || m.collected);
  const hasCompare = data.monthly.some(m => m.collected || m.last_year);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Financial overview</h2>
          <p className="text-sm text-slate-500">{data.branch} · {data.academic_year}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-soft btn-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
        <Kpi label="Total students" value={k.students.toLocaleString('en-IN')} icon={<Users className="w-5 h-5" />} tint="bg-brand-50 text-brand-600" />
        <Kpi label="Total fee amount" value={inr(k.total_fee)} icon={<Wallet className="w-5 h-5" />} tint="bg-emerald-50 text-emerald-600" />
        <Kpi label="Total collected" value={inr(k.collected)} icon={<Landmark className="w-5 h-5" />} tint="bg-indigo-50 text-indigo-600" />
        <Kpi label="Collection %" value={k.collection_percent === null ? '—' : `${k.collection_percent}%`} icon={<Percent className="w-5 h-5" />} tint="bg-amber-50 text-amber-600" />
        <Kpi label="Outstanding" value={inr(k.outstanding)} icon={<AlarmClock className="w-5 h-5" />} tint="bg-red-50 text-red-600" />
        <Kpi label="Concessions given" value={inr(k.concession)} icon={<BadgePercent className="w-5 h-5" />} tint="bg-teal-50 text-teal-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Fee collection trend" empty={!hasMonthly}
          legend={[{ label: 'Total fee (due that month)', color: TOTAL }, { label: 'Collected', color: COLLECTED }]}>
          <ResponsiveContainer>
            <LineChart data={data.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={inrShort} width={56} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="fee" name="Total fee" stroke={TOTAL} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="collected" name="Collected" stroke={COLLECTED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fee type distribution" empty={!data.by_fee_type.length}>
          <Donut rows={data.by_fee_type} />
        </ChartCard>

        {data.by_branch.length > 0 ? (
          <ChartCard title="Top branch collection">
            <ResponsiveContainer>
              <BarChart data={data.by_branch} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" {...axisProps} width={96} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="amount" name="Collected" fill={TOTAL} radius={[0, 4, 4, 0]} isAnimationActive={false}
                  label={{ position: 'right', formatter: (v: any) => inrShort(Number(v)), fill: '#334155', fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <ChartCard title="Payment mode distribution" empty={!data.by_mode.length}>
            <Donut rows={data.by_mode} />
          </ChartCard>
        )}

        <ChartCard title="Class-wise collection status" empty={!classRows.length}
          legend={[{ label: 'Total fee', color: TOTAL }, { label: 'Collected', color: COLLECTED }]}>
          <ResponsiveContainer>
            <BarChart data={classRows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="class" {...axisProps} interval={0} />
              <YAxis {...axisProps} tickFormatter={inrShort} width={56} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="fee" name="Total fee" fill={TOTAL} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              <Bar dataKey="collected" name="Collected" fill={COLLECTED} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly collection comparison" empty={!hasCompare}
          legend={[{ label: `This year (${data.academic_year})`, color: TOTAL }, { label: `Last year (${data.last_year})`, color: COLLECTED }]}>
          <ResponsiveContainer>
            <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={inrShort} width={56} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="collected" name="This year" fill={TOTAL} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="last_year" name="Last year" fill={COLLECTED} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {data.by_branch.length > 0 && (
          <ChartCard title="Payment mode distribution" empty={!data.by_mode.length}>
            <Donut rows={data.by_mode} />
          </ChartCard>
        )}
      </div>
    </div>
  );
};

export default FeesDashboard;
