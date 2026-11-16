import React, { useState } from 'react';
import Sheet from '../cash/Sheet';
import { Button, notify } from '../ui';
import { CANCEL_REASONS, enquiryApi, errorText } from './enquiryApi';

/** Cancel an enquiry entered by mistake. Nothing is deleted: it stays in the list as "Cancelled". */
const CancelEnquirySheet: React.FC<{ enquiryId: number; title: string; onClose: () => void; onDone: () => void }> = ({
  enquiryId, title, onClose, onDone,
}) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!reason) { setError('Please choose why.'); return; }
    if (reason === 'Other' && !note.trim()) { setError('Please write the reason.'); return; }
    setSaving(true); setError(null);
    try {
      notify.success((await enquiryApi.cancel(enquiryId, reason, note.trim())).message);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Cancel this enquiry?" subtitle={title} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Keep it</Button>
        <Button variant="danger" loading={saving} onClick={save}>Cancel enquiry</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Use this only for a wrong or double entry. For a parent who said no, use <b>Update call → Not interested</b>.</p>
        <section>
          <p className="mb-2 text-sm font-medium text-slate-800">Why? <span className="text-red-600">*</span></p>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASONS.map(r => (
              <button key={r} type="button" onClick={() => { setReason(r); setError(null); }} aria-pressed={reason === r}
                className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors
                  ${reason === r ? 'border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-300' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {r}
              </button>
            ))}
          </div>
        </section>
        <section>
          <label htmlFor="cancel-note" className="mb-1.5 block text-sm font-medium text-slate-800">
            Note {reason === 'Other' ? <span className="text-red-600">*</span> : <span className="font-normal text-slate-500">(optional)</span>}
          </label>
          <input id="cancel-note" className="input" maxLength={140} value={note} onChange={e => setNote(e.target.value)}
            placeholder={reason === 'Duplicate enquiry' ? 'e.g. Same as ENQ-2027-0012' : 'Write the reason'} />
        </section>
        <p className="text-sm text-slate-500">It leaves the call list and the counts, but stays in the list as <b>Cancelled</b>. An admin can restore it.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Sheet>
  );
};

export default CancelEnquirySheet;
