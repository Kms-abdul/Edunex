import React, { useCallback, useEffect, useState } from 'react';
import { PencilLine, RotateCcw } from 'lucide-react';
import { Badge, Button, LoadingState, confirmDialog, notify } from '../ui';
import { HistoryItem, SLOT_LABEL, STATUS_LABEL, dayName, errorText, followupApi, statusTone } from './enquiryApi';
import CallUpdateSheet from './CallUpdateSheet';

type HistoryData = Awaited<ReturnType<typeof followupApi.history>>;

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Status, next call and every call made for one enquiry (newest first). */
const EnquiryHistory: React.FC<{ enquiryId: number; branchId: number }> = ({ enquiryId, branchId }) => {
  const [data, setData] = useState<HistoryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [callResults, setCallResults] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    followupApi.history(enquiryId).then(setData).catch(() => setFailed(true));
  }, [enquiryId]);
  useEffect(load, [load]);
  useEffect(() => {
    followupApi.dropdowns(branchId)
      .then(d => { setReasons(d.reject_reasons.map(r => r.label)); setCallResults((d.call_results || []).map(r => r.label)); })
      .catch(() => setReasons([]));
  }, [branchId]);

  // Users without follow-up access simply do not see this section
  if (failed) return null;
  if (!data) return <LoadingState label="Loading calls…" className="py-6" />;

  const e = data.enquiry;
  const reopen = async () => {
    if (!(await confirmDialog('Reopen this enquiry? It will be in today\'s calls.', { confirmText: 'Reopen', tone: 'default' }))) return;
    try { notify.success((await followupApi.reopen(enquiryId)).message); load(); } catch (err) { notify.error(errorText(err)); }
  };

  return (
    <section className="card p-4 sm:p-6 space-y-4" aria-label="Calls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Calls</h2>
          <p className="text-sm text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>
            {e.next_call_date && <span>Next call: <b>{dayName(e.next_call_date, today)}</b>{e.next_call_slot ? `, ${SLOT_LABEL[e.next_call_slot].toLowerCase()}` : ''}</span>}
            {data.close_reason && <span>Reason: <b>{data.close_reason}</b></span>}
          </p>
        </div>
        <div className="flex gap-2">
          {data.can_call && <Button icon={<PencilLine className="w-4 h-4" />} onClick={() => setUpdating(true)}>Update call</Button>}
          {data.can_reopen && <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={reopen}>Reopen</Button>}
        </div>
      </div>

      {data.history.length === 0 ? (
        <p className="text-sm text-slate-500">No calls yet.</p>
      ) : (
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
          {data.history.map((h: HistoryItem) => (
            <li key={h.id} className="ml-4">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
              <p className="text-sm">
                <b className="text-slate-900">{h.outcome_label}</b>
                {h.reason && h.reason !== h.outcome_label && <span className="text-slate-700"> · {h.reason}</span>}
                {h.next_call_date && (
                  <span className="text-slate-700"> → {h.outcome === 'WILL_VISIT' ? 'visit' : 'call'} {dayName(h.next_call_date, today)}{h.next_call_slot ? ` ${SLOT_LABEL[h.next_call_slot].toLowerCase()}` : ''}</span>
                )}
              </p>
              {h.note && <p className="text-sm text-slate-600 mt-0.5">“{h.note}”</p>}
              <p className="text-xs text-slate-500 mt-0.5">{when(h.called_at)}{h.called_by ? ` · by ${h.called_by}` : ''}</p>
            </li>
          ))}
        </ol>
      )}

      {updating && (
        <CallUpdateSheet call={e} today={today} reasons={reasons} callResults={callResults} onClose={() => setUpdating(false)}
          onSaved={() => { setUpdating(false); load(); }} />
      )}
    </section>
  );
};

export default EnquiryHistory;
