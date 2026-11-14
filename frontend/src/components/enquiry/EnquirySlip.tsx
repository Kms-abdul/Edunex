import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PrintData, rupees, niceDate, joinWindow, discountLabel } from './enquiryApi';

const logoSrc = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('/static') || /^https?:/.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${url}` : url;
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2 py-1">
    <dt className="w-32 flex-shrink-0 text-slate-500">{label}</dt>
    <dd className="font-medium text-slate-900 break-words">{value || '—'}</dd>
  </div>
);

/** The paper given to the parent. Plain black and white so it prints well on any printer. */
export const EnquirySlip: React.FC<{ data: PrintData; yearName?: string }> = ({ data, yearName }) => {
  const h = data.header;
  const logo = logoSrc(h.logo_url);
  return (
    <article className="enquiry-slip mx-auto w-full max-w-[180mm] bg-white text-[13px] leading-snug text-slate-900">
      <header className="flex items-center gap-3 border-b-2 border-slate-800 pb-3">
        {logo && <img src={logo} alt="" className="h-14 w-auto max-w-[120px] object-contain" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">{h.school_name || 'School'}</h1>
          <p className="text-slate-600">{h.branch_name}</p>
          {(h.address || h.phone) && <p className="text-xs text-slate-500">{[h.address, h.phone].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Admission enquiry</p>
          <p className="font-bold">{data.enquiry_no}</p>
          <p className="text-xs text-slate-600">{niceDate(data.enquiry_date)}</p>
        </div>
      </header>

      <section className="mt-3">
        <dl>
          <Row label="Student name" value={data.student_name} />
          <Row label="Guardian name" value={data.guardian_name} />
          <Row label="Class" value={`${data.class_name} (${yearName || data.academic_year})`} />
          <Row label="Contact" value={data.contact} />
          {data.aadhaar_masked && <Row label="Aadhaar" value={data.aadhaar_masked} />}
        </dl>
      </section>

      <section className="mt-3 rounded border border-slate-400 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Tuition fee for the year</p>
          <p className="text-base font-bold">{data.tuition_fee !== null ? rupees(data.tuition_fee) : 'To be announced'}</p>
        </div>
        {data.tuition_installments && data.tuition_installments.length > 0 && (
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-slate-300 text-left">
                <th className="py-1 pr-2 font-semibold">Installment</th>
                <th className="py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.tuition_installments.map((i, n) => (
                <tr key={n} className="border-b border-slate-200">
                  <td className="py-1 pr-2">{i.name}</td>
                  <td className="py-1 text-right tabular-nums">{rupees(i.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1 pr-2">Total</td>
                <td className="py-1 text-right tabular-nums">{rupees(data.tuition_fee)}</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="mt-1 text-xs text-slate-500">Only the tuition fee is shown. Other fees (books, uniform, transport) are told at admission.</p>
      </section>

      {data.schemes.length > 0 && (
        <section className="mt-3">
          <h2 className="mb-1.5 font-semibold">Admission schemes</h2>
          <div className="space-y-2">
            {data.schemes.map(s => (
              <div key={s.name} className="break-inside-avoid rounded border border-slate-300 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-bold">{s.name}</p>
                  {joinWindow(s.valid_from, s.valid_to) && <p className="text-xs text-slate-600">{joinWindow(s.valid_from, s.valid_to)}</p>}
                </div>
                {(s.benefits.length > 0 || s.discount_type !== 'NONE') && (
                  <ul className="mt-1 list-disc pl-5">
                    {s.discount_type !== 'NONE' && <li>{discountLabel(s.discount_type, s.discount_value)}</li>}
                    {s.benefits.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
                {s.tuition_after !== null && (
                  <p className="mt-1 font-semibold">Tuition fee with this scheme: {rupees(s.tuition_after)}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-6 flex items-end justify-between gap-4 text-xs text-slate-600">
        <p>Fees are for the academic year {yearName || data.academic_year}. Schemes apply only for the joining dates shown.</p>
        <p className="w-40 flex-shrink-0 border-t border-slate-500 pt-1 text-center">Office signature</p>
      </footer>
    </article>
  );
};

/**
 * Prints only the slip, in the same tab (works on phones, where pop-up windows are blocked).
 * Mount once; call printSlip() to open the print / save-as-PDF screen.
 */
export const SlipPrintPortal: React.FC<{ data: PrintData | null; yearName?: string }> = ({ data, yearName }) => {
  useEffect(() => {
    const done = () => document.body.classList.remove('printing-slip');
    window.addEventListener('afterprint', done);
    return () => { window.removeEventListener('afterprint', done); done(); };
  }, []);
  if (!data) return null;
  return createPortal(
    <div className="slip-print-portal" aria-hidden="true">
      <EnquirySlip data={data} yearName={yearName} />
    </div>,
    document.body,
  );
};

export const printSlip = (onClosed?: () => void) => {
  document.body.classList.add('printing-slip');
  const after = () => {
    window.removeEventListener('afterprint', after);
    document.body.classList.remove('printing-slip');
    onClosed?.();
  };
  window.addEventListener('afterprint', after);
  // Let the browser apply the class before opening the print screen
  window.setTimeout(() => window.print(), 50);
};
