import React, { useEffect, useState } from 'react';
import { FileText, MessageCircle, UserPlus } from 'lucide-react';
import type { Page } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button, EmptyState, ErrorState, LoadingState, notify } from '../ui';
import {
  ADMISSION_PREFILL_KEY, APPLICATION_STATUS_LABEL, ApplicationRow, ApplicationStatus, applicationApi, errorText, niceDate,
} from './enquiryApi';
import SendFormSheet from './SendFormSheet';

const TONE: Record<ApplicationStatus, 'warning' | 'brand' | 'success' | 'neutral'> = {
  SENT: 'warning', SUBMITTED: 'brand', ADMITTED: 'success', CANCELLED: 'neutral',
};
const FILTERS: { id: ApplicationStatus | ''; label: string }[] = [
  { id: 'SUBMITTED', label: 'Form received' }, { id: 'SENT', label: 'Waiting for parent' },
  { id: 'ADMITTED', label: 'Admitted' }, { id: '', label: 'All' },
];

/** Online admission forms: waiting for the parent, received (to admit), admitted. */
const ApplicationsList: React.FC<{ branchId: number; navigateTo?: (p: Page) => void }> = ({ branchId, navigateTo }) => {
  const { hasPermission } = useAuth();
  const canAdmit = hasPermission('administration.student.create-student', 'write');
  const [filter, setFilter] = useState<ApplicationStatus | ''>('SUBMITTED');
  const [data, setData] = useState<{ applications: ApplicationRow[]; counts: Partial<Record<ApplicationStatus, number>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [resend, setResend] = useState<ApplicationRow | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setData(null); setError(null);
    applicationApi.list(branchId, filter || undefined).then(d => live && setData(d)).catch(err => live && setError(errorText(err)));
    return () => { live = false; };
  }, [branchId, filter, reload]);

  const viewDoc = async (a: ApplicationRow) => {
    try {
      const blob = await applicationApi.doc(a.id);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (err) { notify.error(errorText(err)); }
  };

  const admit = async (a: ApplicationRow) => {
    if (!navigateTo) return;
    setOpening(a.id);
    try {
      const full = await applicationApi.get(a.id);
      sessionStorage.setItem(ADMISSION_PREFILL_KEY, JSON.stringify({
        application_id: full.id, data: full.data || {}, class_name: full.class_name,
        academic_year: full.academic_year, branch_name: full.branch_name, student_name: full.student_name,
      }));
      navigateTo('create-student');
    } catch (err) { notify.error(errorText(err)); } finally { setOpening(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Show">
        {FILTERS.map(f => {
          const n = f.id ? data?.counts?.[f.id] : undefined;
          return (
            <button key={f.label} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-medium
                ${filter === f.id ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {f.label}{n ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>

      {error ? <ErrorState message={error} onRetry={() => setReload(n => n + 1)} /> : !data ? <LoadingState /> :
        data.applications.length === 0 ? (
          <div className="card">
            <EmptyState title="Nothing here"
              description={filter === 'SUBMITTED' ? 'Forms filled by parents appear here.' : 'After "Admission confirmed", send the parent the form from the call.'} />
          </div>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {data.applications.map(a => (
              <li key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900">{a.student_name} <span className="font-normal text-slate-500">· Class {a.class_name}</span></p>
                    <p className="text-sm text-slate-600">{a.guardian_name} · {a.contact}</p>
                  </div>
                  <Badge tone={a.expired ? 'danger' : TONE[a.status]}>{a.expired ? 'Link expired' : APPLICATION_STATUS_LABEL[a.status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {a.status === 'SENT' && (a.expired ? 'The parent did not fill it in time.' : `${a.opened_at ? 'Parent opened it' : 'Not opened yet'} · link till ${niceDate(a.expires_at)}`)}
                  {a.status === 'SUBMITTED' && `Received ${niceDate(a.submitted_at)}`}
                  {a.status === 'ADMITTED' && 'Student added'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'SUBMITTED' && canAdmit && (
                    <Button size="sm" icon={<UserPlus className="w-4 h-4" />} loading={opening === a.id} onClick={() => admit(a)}>
                      Check and add student
                    </Button>
                  )}
                  {a.has_aadhaar_doc && (
                    <Button size="sm" variant="secondary" icon={<FileText className="w-4 h-4" />} onClick={() => viewDoc(a)}>Aadhaar copy</Button>
                  )}
                  {a.status === 'SENT' && (
                    <Button size="sm" variant="secondary" icon={<MessageCircle className="w-4 h-4" />} onClick={() => setResend(a)}>
                      Send again
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

      {resend && (
        <SendFormSheet enquiryId={resend.enquiry_id} studentName={resend.student_name}
          onClose={() => { setResend(null); setReload(n => n + 1); }} />
      )}
    </div>
  );
};

export default ApplicationsList;
