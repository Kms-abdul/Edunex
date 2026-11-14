import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PencilLine } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '../ui';
import { CallRow, SLOT_LABEL, dayName, errorText, followupApi, timeAgo } from './enquiryApi';
import CallUpdateSheet from './CallUpdateSheet';

/**
 * Today's calls for the marketing team.
 * Call → the phone's dialer opens; when they come back, "How did the call go?" opens by itself.
 */
const CallsList: React.FC<{ branchId: number; canCall: boolean; onOpen: (id: number) => void; onCountChange?: (n: number) => void }> = ({
  branchId, canCall, onOpen, onCountChange,
}) => {
  const [bucket, setBucket] = useState<'due' | 'upcoming'>('due');
  const [mine, setMine] = useState(false);
  const [data, setData] = useState<{ today: string; counts: { overdue: number; today: number; upcoming: number }; calls: CallRow[] } | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [callResults, setCallResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<CallRow | null>(null);
  const [reload, setReload] = useState(0);
  const dialled = useRef<CallRow | null>(null);

  const load = useCallback(() => {
    setError(null);
    followupApi.calls(branchId, bucket, mine)
      .then(d => { setData(d); onCountChange?.(d.counts.overdue + d.counts.today); })
      .catch(err => setError(errorText(err)));
  }, [branchId, bucket, mine, onCountChange]);

  useEffect(() => { setData(null); load(); }, [load, reload]);
  useEffect(() => {
    followupApi.dropdowns(branchId)
      .then(d => { setReasons(d.reject_reasons.map(r => r.label)); setCallResults((d.call_results || []).map(r => r.label)); })
      .catch(() => setReasons([]));
  }, [branchId]);

  // Back from the dialer: ask how the call went
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === 'visible' && dialled.current) {
        setUpdating(dialled.current);
        dialled.current = null;
      }
    };
    document.addEventListener('visibilitychange', onBack);
    return () => document.removeEventListener('visibilitychange', onBack);
  }, []);

  const today = data?.today || new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-auto" role="tablist">
          {(['due', 'upcoming'] as const).map(b => {
            const n = b === 'due' ? (data ? data.counts.overdue + data.counts.today : null) : data?.counts.upcoming;
            return (
              <button key={b} type="button" role="tab" aria-selected={bucket === b} onClick={() => setBucket(b)}
                className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${bucket === b ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
                {b === 'due' ? 'To call now' : 'Next 7 days'}{n !== null && n !== undefined ? ` (${n})` : ''}
              </button>
            );
          })}
        </div>
        <label className="flex min-h-[44px] items-center gap-2.5 text-sm font-medium text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={mine} onChange={e => setMine(e.target.checked)} />
          Only my calls
        </label>
      </div>

      {bucket === 'due' && data && data.counts.overdue > 0 && (
        <p className="text-sm font-medium text-red-700">{data.counts.overdue} call{data.counts.overdue > 1 ? 's are' : ' is'} late. Please call them first.</p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />
      ) : !data ? (
        <LoadingState />
      ) : data.calls.length === 0 ? (
        <div className="card">
          <EmptyState title={bucket === 'due' ? 'No calls to make now' : 'No calls in the next 7 days'}
            description={bucket === 'due' ? 'Well done! New enquiries appear here the day after the visit.' : undefined} />
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {data.calls.map(c => {
            const late = !!c.next_call_date && c.next_call_date < today;
            return (
              <li key={c.id} className={`card p-4 ${late ? 'border-red-200' : ''}`}>
                <button type="button" onClick={() => onOpen(c.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-slate-900">{c.student_name} <span className="font-normal text-slate-500">· Class {c.class_name}</span></p>
                    <Badge tone={late ? 'danger' : 'brand'}>
                      {dayName(c.next_call_date, today)}{c.next_call_slot ? ` · ${SLOT_LABEL[c.next_call_slot]}` : ''}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{c.guardian_name} · {c.contact}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.last_outcome_label
                      ? `Last: ${c.last_outcome_label} · ${timeAgo(c.last_call_at)}${c.last_called_by ? ` by ${c.last_called_by}` : ''}`
                      : `New enquiry · ${c.enquiry_no}`}
                  </p>
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`tel:${c.contact}`} onClick={() => { dialled.current = c; }}
                    className="btn-secondary min-h-[44px] justify-center" aria-label={`Call ${c.guardian_name}`}>
                    <Phone className="w-4 h-4" /> Call
                  </a>
                  {canCall && (
                    <Button icon={<PencilLine className="w-4 h-4" />} onClick={() => setUpdating(c)}>Update</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {updating && canCall && (
        <CallUpdateSheet call={updating} today={today} reasons={reasons} callResults={callResults}
          onClose={() => setUpdating(null)}
          onSaved={() => { setUpdating(null); setReload(n => n + 1); }} />
      )}
    </div>
  );
};

export default CallsList;
