import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, PencilLine, Phone, Printer, RotateCcw } from 'lucide-react';
import { ActionBar, Badge, Button, ErrorState, LoadingState, confirmDialog, notify } from '../ui';
import {
  APPLICATION_STATUS_LABEL, HistoryItem, SLOT_LABEL, STATUS_LABEL, dayName, errorText, followupApi, niceDate,
  statusTone, studentTypeLabel,
} from './enquiryApi';
import CallUpdateSheet from './CallUpdateSheet';
import SendFormSheet from './SendFormSheet';

type HistoryData = Awaited<ReturnType<typeof followupApi.history>> & {
  details: {
    enquiry_no: string; enquiry_date: string; academic_year: string; student_name: string; guardian_name: string;
    class_name: string; contact: string; aadhaar_masked: string | null; student_type: 'NEW' | 'OLD';
    printed_at: string | null; taken_by: string | null;
  };
  application: { status: 'SENT' | 'SUBMITTED' | 'ADMITTED' | 'CANCELLED'; expires_at: string } | null;
  events: { kind: string; at: string | null; by: string | null; text: string }[];
};

type TimelineItem =
  | { type: 'call'; at: string; call: HistoryItem }
  | { type: 'event'; at: string; kind: string; text: string; by: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const DOT: Record<string, string> = {
  created: 'bg-slate-400', printed: 'bg-slate-400', form_sent: 'bg-emerald-500', form_opened: 'bg-emerald-300',
  form_received: 'bg-emerald-600', admitted: 'bg-emerald-700',
};

const Info: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="text-sm font-medium text-slate-900 break-words">{value || '—'}</dd>
  </div>
);

/**
 * One enquiry: its details, current status, and the complete history (enquiry taken, every call,
 * paper printed, admission form sent / opened / received, student added), newest first.
 */
const EnquiryHistory: React.FC<{ enquiryId: number; branchId: number; onPrint?: () => void; onBack?: () => void }> = ({
  enquiryId, branchId, onPrint, onBack,
}) => {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [callResults, setCallResults] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [sendingForm, setSendingForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setError(null);
    followupApi.history(enquiryId).then(d => setData(d as HistoryData)).catch(err => setError(errorText(err)));
  }, [enquiryId]);
  useEffect(load, [load]);
  useEffect(() => {
    followupApi.dropdowns(branchId)
      .then(d => { setReasons(d.reject_reasons.map(r => r.label)); setCallResults((d.call_results || []).map(r => r.label)); })
      .catch(() => setReasons([]));
  }, [branchId]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading the enquiry…" />;

  const e = data.enquiry;
  // Older backends send no "details" / "events": build what we can instead of failing
  const d: HistoryData['details'] = data.details ?? {
    enquiry_no: e.enquiry_no, enquiry_date: e.enquiry_date, academic_year: e.academic_year,
    student_name: e.student_name, guardian_name: e.guardian_name, class_name: e.class_name, contact: e.contact,
    aadhaar_masked: null, student_type: 'NEW', printed_at: null, taken_by: null,
  };
  const reopen = async () => {
    if (!(await confirmDialog('Reopen this enquiry? It will be in today\'s calls.', { confirmText: 'Reopen', tone: 'default' }))) return;
    try { notify.success((await followupApi.reopen(enquiryId)).message); load(); } catch (err) { notify.error(errorText(err)); }
  };

  const timeline: TimelineItem[] = [
    ...(data.history || []).map(c => ({ type: 'call' as const, at: c.called_at, call: c })),
    ...(data.events || []).filter(ev => ev.at).map(ev => ({ type: 'event' as const, at: ev.at as string, kind: ev.kind, text: ev.text, by: ev.by })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const canSendForm = e.status === 'JOINED' && data.application?.status !== 'ADMITTED';

  return (
    <div className="space-y-4">
      {/* Details */}
      <section className="card p-4 sm:p-6" aria-label="Enquiry details">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{d.enquiry_no} · {niceDate(d.enquiry_date)}</p>
            <h2 className="text-xl font-semibold text-slate-900">{d.student_name} <span className="font-normal text-slate-500">· Class {d.class_name}</span></h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={statusTone(e.status)}>{STATUS_LABEL[e.status]}</Badge>
              {data.application && <Badge tone="brand">Form: {APPLICATION_STATUS_LABEL[data.application.status]}</Badge>}
              {e.next_call_date && (
                <span className="text-slate-600">Next call: <b>{dayName(e.next_call_date, today)}</b>{e.next_call_slot ? `, ${SLOT_LABEL[e.next_call_slot].toLowerCase()}` : ''}</span>
              )}
              {data.close_reason && <span className="text-slate-600">Reason: <b>{data.close_reason}</b></span>}
            </div>
          </div>
          <a href={`tel:${d.contact}`} className="btn-secondary min-h-[44px]"><Phone className="w-4 h-4" /> Call {d.contact}</a>
        </div>
        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
          <Info label="Guardian" value={d.guardian_name} />
          <Info label="Admission for" value={d.academic_year} />
          <Info label="Fees for" value={studentTypeLabel(d.student_type)} />
          <Info label="Aadhaar" value={d.aadhaar_masked} />
          <Info label="Taken by" value={d.taken_by} />
          <Info label="Calls made" value={e.call_count} />
          <Info label="Paper" value={d.printed_at ? `Printed ${niceDate(d.printed_at)}` : 'Not printed yet'} />
        </dl>
      </section>

      {/* History */}
      <section className="card p-4 sm:p-6" aria-label="History">
        <h2 className="font-semibold text-slate-900 mb-3">History</h2>
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
          {timeline.map((t, i) => t.type === 'call' ? (
            <li key={`c-${t.call.id}`} className="ml-4">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
              <p className="text-sm">
                <span className="text-slate-500">Call: </span><b className="text-slate-900">{t.call.outcome_label}</b>
                {t.call.reason && t.call.reason !== t.call.outcome_label && <span className="text-slate-700"> · {t.call.reason}</span>}
                {t.call.next_call_date && (
                  <span className="text-slate-700"> → {t.call.outcome === 'WILL_VISIT' ? 'visit' : 'call'} {dayName(t.call.next_call_date, today)}{t.call.next_call_slot ? ` ${SLOT_LABEL[t.call.next_call_slot].toLowerCase()}` : ''}</span>
                )}
              </p>
              {t.call.note && <p className="text-sm text-slate-600 mt-0.5">“{t.call.note}”</p>}
              <p className="text-xs text-slate-500 mt-0.5">{when(t.call.called_at)}{t.call.called_by ? ` · by ${t.call.called_by}` : ''}</p>
            </li>
          ) : (
            <li key={`e-${t.kind}-${i}`} className="ml-4">
              <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white ${DOT[t.kind] || 'bg-slate-400'}`} aria-hidden="true" />
              <p className="text-sm font-medium text-slate-900">{t.text}</p>
              <p className="text-xs text-slate-500 mt-0.5">{when(t.at)}{t.by ? ` · by ${t.by}` : ''}</p>
            </li>
          ))}
        </ol>
      </section>

      <ActionBar>
        {onBack && <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>Back</Button>}
        {onPrint && <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={onPrint}>Print paper</Button>}
        {data.can_reopen && <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={reopen}>Reopen</Button>}
        {canSendForm && <Button icon={<MessageCircle className="w-4 h-4" />} onClick={() => setSendingForm(true)}>Send admission form</Button>}
        {data.can_call && <Button icon={<PencilLine className="w-4 h-4" />} onClick={() => setUpdating(true)}>Update call</Button>}
      </ActionBar>

      {updating && (
        <CallUpdateSheet call={e} today={today} reasons={reasons} callResults={callResults} onClose={() => setUpdating(false)}
          onSaved={row => { setUpdating(false); load(); if (row.status === 'JOINED') setSendingForm(true); }} />
      )}
      {sendingForm && <SendFormSheet enquiryId={enquiryId} studentName={d.student_name} onClose={() => { setSendingForm(false); load(); }} />}
    </div>
  );
};

export default EnquiryHistory;
