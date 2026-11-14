import React, { useEffect, useState } from 'react';
import { Search, Printer } from 'lucide-react';
import { Badge, Button, DataList, ErrorState, Field } from '../ui';
import type { Column } from '../ui';
import { EnquiryOptions, EnquiryRow, EnquiryStatus, STATUS_LABEL, SLOT_LABEL, enquiryApi, errorText, niceDate, statusTone, dayName } from './enquiryApi';

/** Every enquiry of a year, with its printed / not printed status and a Print button. */
const EnquiryList: React.FC<{ options: EnquiryOptions; branchId: number; onOpen: (id: number) => void }> = ({ options, branchId, onOpen }) => {
  const [year, setYear] = useState(options.default_year || options.academic_years[0]?.code || '');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'' | EnquiryStatus>('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EnquiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Search while typing, without a request for every key
  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(text.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    enquiryApi.list({ branch_id: branchId, academic_year: year, status: status || undefined, q: query || undefined, page })
      .then(d => { if (live) { setRows(d.enquiries); setTotal(d.total); setPageSize(d.page_size); } })
      .catch(err => live && setError(errorText(err)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [branchId, year, status, query, page, reload]);

  const today = new Date().toISOString().slice(0, 10);
  const columns: Column<EnquiryRow>[] = [
    { key: 'student_name', header: 'Student', primary: true },
    { key: 'enquiry_no', header: 'Enquiry no.', secondary: true, render: r => `${r.enquiry_no} · ${niceDate(r.enquiry_date)}` },
    { key: 'class_name', header: 'Class' },
    { key: 'guardian_name', header: 'Guardian' },
    { key: 'contact', header: 'Contact' },
    {
      key: 'status', header: 'Status',
      render: (r: EnquiryRow) => <Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status as EnquiryStatus] || r.status}</Badge>,
    },
    {
      key: 'next_call', header: 'Next call', hideOnMobile: false,
      render: (r: EnquiryRow) => r.next_call_date
        ? `${dayName(r.next_call_date, today)}${r.next_call_slot ? ` · ${SLOT_LABEL[r.next_call_slot]}` : ''}`
        : (r.close_reason || '—'),
    },
    {
      key: 'printed', header: 'Printed',
      render: (r: EnquiryRow) => <Badge tone={r.printed_at ? 'success' : 'warning'}>{r.printed_at ? 'Printed' : 'Not printed'}</Badge>,
    },
    {
      key: 'print', header: '', align: 'right', hideOnMobile: true,
      render: r => (
        <Button size="sm" variant="secondary" icon={<Printer className="w-4 h-4" />}
          onClick={e => { e.stopPropagation(); onOpen(r.id); }}>Print</Button>
      ),
    },
  ];

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label="Search" htmlFor="enq-search" className="sm:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input id="enq-search" type="search" className="input pl-9" value={text} onChange={e => setText(e.target.value)}
              placeholder="Name, phone or enquiry number" autoComplete="off" />
          </div>
        </Field>
        <Field label="Status" htmlFor="enq-list-status">
          <select id="enq-list-status" className="input" value={status} onChange={e => { setStatus(e.target.value as '' | EnquiryStatus); setPage(1); }}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as EnquiryStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Year" htmlFor="enq-list-year">
          <select id="enq-list-year" className="input" value={year} onChange={e => { setYear(e.target.value); setPage(1); }}>
            {options.academic_years.map(y => <option key={y.code} value={y.code}>{y.name}</option>)}
          </select>
        </Field>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => setReload(n => n + 1)} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${total} enquir${total === 1 ? 'y' : 'ies'}`}
          </p>
          <DataList
            columns={columns}
            rows={rows}
            rowKey={r => r.id}
            loading={loading}
            onRowClick={r => onOpen(r.id)}
            emptyTitle={query ? 'No enquiry found' : 'No enquiries yet'}
            emptyHint={query ? 'Try another name or number.' : 'Use "New enquiry" when a parent visits.'}
          />
          {pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-slate-600">Page {page} of {pages}</span>
              <Button variant="secondary" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EnquiryList;
