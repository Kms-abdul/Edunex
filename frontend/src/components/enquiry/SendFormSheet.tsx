import React, { useEffect, useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import Sheet from '../cash/Sheet';
import { Alert, Button, LoadingState, notify } from '../ui';
import { SentLink, applicationApi, errorText, formLink, niceDate, whatsappUrl } from './enquiryApi';

/**
 * After "Admission confirmed": makes the parent's private form link and opens WhatsApp with the
 * thank-you message ready. The staff member only taps Send in WhatsApp.
 */
const SendFormSheet: React.FC<{ enquiryId: number; studentName: string; onClose: () => void }> = ({ enquiryId, studentName, onClose }) => {
  const [sent, setSent] = useState<SentLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applicationApi.send(enquiryId).then(setSent).catch(err => setError(errorText(err)));
  }, [enquiryId]);

  const link = sent ? formLink(sent.form_path) : '';
  const text = sent ? sent.text.replace('{link}', link) : '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); notify.success('Message copied. Paste it in WhatsApp or SMS.'); }
    catch { notify.error('Could not copy. Long-press the message to copy it.'); }
  };

  return (
    <Sheet title="Send the admission form" subtitle={studentName} onClose={onClose}
      footer={sent ? (
        <>
          <Button variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={copy}>Copy message</Button>
          <a href={whatsappUrl(sent.parent_phone, text)} target="_blank" rel="noopener noreferrer"
            className="btn-primary min-h-[44px] justify-center" onClick={() => window.setTimeout(onClose, 300)}>
            <MessageCircle className="w-4 h-4" /> Send on WhatsApp
          </a>
        </>
      ) : undefined}>
      {error ? <Alert tone="error">{error}</Alert> : !sent ? <LoadingState label="Making the link…" className="py-8" /> : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">WhatsApp opens with this message for <b>{sent.parent_phone}</b>. Just tap Send.</p>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-emerald-50 border border-emerald-200 p-3 font-sans text-slate-800">{text}</pre>
          <p className="text-xs text-slate-500">
            The link works till {niceDate(sent.expires_at)} and only with the parent's mobile number.
            Sending again makes a new link (the old one stops working).
          </p>
        </div>
      )}
    </Sheet>
  );
};

export default SendFormSheet;
