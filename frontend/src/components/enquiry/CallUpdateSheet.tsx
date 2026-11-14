import React, { useState } from 'react';
import { Clock, PhoneOff, School, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import Sheet from '../cash/Sheet';
import { Button, notify } from '../ui';
import { CallRow, CallSlot, Outcome, SLOT_LABEL, addDays, dayName, errorText, followupApi } from './enquiryApi';

const OUTCOMES: { id: Outcome; label: string; hint: string; icon: React.ReactNode; tone: string }[] = [
  { id: 'CALL_LATER', label: 'Call me later', hint: 'Parent asked to call again', icon: <Clock className="w-6 h-6" />, tone: 'text-brand-700 bg-brand-50' },
  { id: 'NO_ANSWER', label: 'Not answered', hint: 'No answer / switched off / busy', icon: <PhoneOff className="w-6 h-6" />, tone: 'text-slate-700 bg-slate-100' },
  { id: 'WILL_VISIT', label: 'Will visit school', hint: 'Coming to see the school', icon: <School className="w-6 h-6" />, tone: 'text-amber-700 bg-amber-50' },
  { id: 'JOINED', label: 'Admission confirmed', hint: 'Parent said yes', icon: <CheckCircle2 className="w-6 h-6" />, tone: 'text-emerald-700 bg-emerald-50' },
  { id: 'NOT_INTERESTED', label: 'Not interested', hint: 'Parent said no', icon: <XCircle className="w-6 h-6" />, tone: 'text-red-700 bg-red-50' },
  { id: 'WRONG_NUMBER', label: 'Wrong number', hint: 'Not this family', icon: <AlertTriangle className="w-6 h-6" />, tone: 'text-slate-700 bg-slate-100' },
];
const SLOTS: CallSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={active}
    className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors
      ${active ? 'border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-300' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
    {children}
  </button>
);

/** "How did the call go?": tap the result, tap when / why, Save. No typing needed. */
const CallUpdateSheet: React.FC<{
  call: Pick<CallRow, 'id' | 'student_name' | 'guardian_name' | 'class_name' | 'contact'>;
  today: string;
  reasons: string[];
  onClose: () => void;
  onSaved: (row: CallRow) => void;
}> = ({ call, today, reasons, onClose, onSaved }) => {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [date, setDate] = useState<string>('');
  const [slot, setSlot] = useState<CallSlot | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (o: Outcome) => {
    setOutcome(o); setError(null); setReason('');
    setDate(o === 'NO_ANSWER' ? addDays(today, 1) : '');
    setSlot(null);
  };

  const needsDate = outcome === 'CALL_LATER' || outcome === 'WILL_VISIT';
  const dateChoices = outcome === 'NO_ANSWER'
    ? [{ label: 'Later today', d: today }, { label: 'Tomorrow', d: addDays(today, 1) }, { label: 'In 2 days', d: addDays(today, 2) }]
    : [{ label: 'Today', d: today }, { label: 'Tomorrow', d: addDays(today, 1) }, { label: 'In 2 days', d: addDays(today, 2) },
       { label: 'In 1 week', d: addDays(today, 7) }];
  const pickedOther = !!date && !dateChoices.some(c => c.d === date);

  const save = async () => {
    if (!outcome || saving) return;
    if (needsDate && !date) { setError(outcome === 'WILL_VISIT' ? 'Please choose the visit day.' : 'Please choose when to call again.'); return; }
    if (outcome === 'NOT_INTERESTED' && !reason) { setError('Please choose the reason.'); return; }
    if (reason === 'Other' && !note.trim()) { setError('Please write the reason in the note.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await followupApi.record(call.id, {
        outcome, next_call_date: date || undefined, next_call_slot: slot || undefined,
        reason: reason || undefined, note: note.trim() || undefined,
      });
      notify.success(res.message);
      onSaved(res.call);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const chosen = OUTCOMES.find(o => o.id === outcome);

  return (
    <Sheet
      title={outcome ? chosen?.label : 'How did the call go?'}
      subtitle={`${call.student_name} · Class ${call.class_name} · ${call.guardian_name}`}
      onClose={onClose}
      footer={outcome ? (
        <>
          <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setOutcome(null)} disabled={saving}>Change</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>
      ) : undefined}
    >
      {!outcome ? (
        <div className="grid grid-cols-2 gap-2.5">
          {OUTCOMES.map(o => (
            <button key={o.id} type="button" onClick={() => choose(o.id)}
              className="flex min-h-[96px] flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-300 active:bg-slate-50">
              <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${o.tone}`}>{o.icon}</span>
              <span>
                <span className="block text-[15px] font-semibold leading-tight text-slate-900">{o.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(needsDate || outcome === 'NO_ANSWER') && (
            <section>
              <p className="mb-2 text-sm font-medium text-slate-800">
                {outcome === 'WILL_VISIT' ? 'Which day will they visit?' : outcome === 'NO_ANSWER' ? 'Try again' : 'When should we call?'}
              </p>
              <div className="flex flex-wrap gap-2">
                {dateChoices.map(c => <Chip key={c.label} active={date === c.d} onClick={() => setDate(c.d)}>{c.label}</Chip>)}
                <label className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-sm font-medium
                  ${pickedOther ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                  Pick date
                  <input type="date" min={today} value={pickedOther ? date : ''} onChange={e => setDate(e.target.value)}
                    className="bg-transparent text-sm outline-none" aria-label="Pick a date" />
                </label>
              </div>
              <p className="mt-3 mb-2 text-sm font-medium text-slate-800">Time of day <span className="font-normal text-slate-500">(optional)</span></p>
              <div className="flex flex-wrap gap-2">
                {SLOTS.map(s => <Chip key={s} active={slot === s} onClick={() => setSlot(slot === s ? null : s)}>{SLOT_LABEL[s]}</Chip>)}
              </div>
              {date && (
                <p className="mt-3 text-sm text-slate-600">
                  {outcome === 'WILL_VISIT' ? 'Visit' : 'Next call'}: <b>{dayName(date, today)}</b>{slot ? `, ${SLOT_LABEL[slot].toLowerCase()}` : ''}
                </p>
              )}
            </section>
          )}

          {outcome === 'NOT_INTERESTED' && (
            <section>
              <p className="mb-2 text-sm font-medium text-slate-800">Why? <span className="text-red-600">*</span></p>
              <div className="flex flex-wrap gap-2">
                {[...reasons, 'Other'].map(r => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
              </div>
            </section>
          )}

          {outcome === 'JOINED' && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">The parent confirmed admission. This enquiry will be marked <b>Joined</b>.</p>
          )}
          {outcome === 'WRONG_NUMBER' && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">This enquiry will be closed. If you have the right number, add a new enquiry.</p>
          )}

          <section>
            <label htmlFor="call-note" className="mb-1.5 block text-sm font-medium text-slate-800">
              Note {reason === 'Other' ? <span className="text-red-600">*</span> : <span className="font-normal text-slate-500">(optional)</span>}
            </label>
            <textarea id="call-note" className="input min-h-[72px]" maxLength={1000} value={note} onChange={e => setNote(e.target.value)}
              placeholder={reason === 'Other' ? 'Write the reason' : 'Anything to remember for next time'} />
          </section>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Sheet>
  );
};

export default CallUpdateSheet;
