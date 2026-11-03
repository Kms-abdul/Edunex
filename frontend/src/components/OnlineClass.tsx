import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { OnlineClassItem } from '../types';
import PageHeader from './ui/PageHeader';
import { Alert, EmptyState, LoadingState, Spinner, Badge, Field } from './ui';
import { notify, confirmDialog } from './ui/feedback';
import { Dialog } from './school-setup';
import { Video, CalendarPlus, Settings, SlidersHorizontal, ChevronLeft, ChevronRight, Clock, User, BookOpen } from 'lucide-react';

const platformLabel = (p: string) => (p === 'google_meet' ? 'Google Meet' : p === 'zoom' ? 'Zoom' : p.replace('_', ' '));
const statusText = (s: string) => (s === 'SCHEDULED' ? 'Coming up' : s === 'CANCELLED' ? 'Cancelled' : s === 'COMPLETED' ? 'Finished' : s);
const statusTone = (s: string) => (s === 'SCHEDULED' ? 'success' : s === 'CANCELLED' ? 'danger' : 'neutral') as 'success' | 'danger' | 'neutral';

// start_datetime is stored as a plain wall-clock string (e.g. "2026-09-01T12:55:00")
// representing the time in the class's own `timezone` field — not the viewer's.
// We show those exact numbers as-is and always label the timezone, so it's
// never mistaken for the viewer's own local time.
const formatClassDateTime = (isoString: string, timezone?: string | null) => {
  if (!isoString) return '-';
  const [datePart, timePart] = isoString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart || '00:00:00').split(':').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  const formatted = d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${formatted} (${timezone || 'Asia/Kolkata'})`;
};

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDay = (isoDate: string, delta: number) => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return getLocalDateString(d);
};

const OnlineClass: React.FC = () => {
    const { hasPermission } = useAuth();
  const canWrite = hasPermission('academics.online-class.online-class', 'write');
    const canManageZoomSettings = hasPermission('academics.online-class.zoom-settings', 'write');
  const [showZoomSettings, setShowZoomSettings] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; google_email?: string | null; reason?: string } | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);

  useEffect(() => {
    api.get('/online-classes/google/status')
      .then((res) => setGoogleStatus(res.data))
      .catch(() => setGoogleStatus(null));
  }, []);

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    try {
      const res = await api.get('/online-classes/google/connect');
      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to start Google connection');
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!await confirmDialog("Disconnect your Google account? You can't plan Google Meet classes until you connect it again.", { tone: 'danger', confirmText: 'Disconnect' })) return;
    try {
      await api.delete('/online-classes/google/disconnect');
      setGoogleStatus({ connected: false });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to disconnect Google account');
    }
  };

    const [classes, setClasses] = useState<OnlineClassItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OnlineClassItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<OnlineClassItem | null>(null);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => getLocalDateString());

    const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      if (viewMode === 'calendar') {
        params.from_date = calendarDate;
        params.to_date = calendarDate;
        params.page_size = 200;
      } else {
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
        params.page = page;
        params.page_size = 50;
      }
      const res = await api.get('/online-classes', { params });
      setClasses(res.data?.items || []);
      setTotalPages(res.data?.total_pages || 1);
      setTotalCount(res.data?.total || 0);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load online classes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate, page, viewMode, calendarDate]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, fromDate, toDate]);

  // Teacher/title search is done here in the browser, on top of whatever the
  // backend already filtered by status/date — the backend has no text-search
  // endpoint yet, so this keeps things simple without adding a new API.
  const displayedClasses = classes.filter((c) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.teacher_name || '').toLowerCase().includes(q);
  });

  const handleJoin = async (c: OnlineClassItem) => {
    setRowError(null);
    setJoiningId(c.id);
    try {
      const res = await api.get(`/online-classes/${c.id}/join`);
      const url = res.data?.join_url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setRowError('No join link is available for this class yet.');
      }
    } catch (e: any) {
      setRowError(e.response?.data?.error || 'Unable to join this class.');
    } finally {
      setJoiningId(null);
    }
  };

  const [showFilters, setShowFilters] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const hasFilters = !!(statusFilter || fromDate || toDate);
  const upcoming = displayedClasses.filter((c) => c.status === 'SCHEDULED');
  const others = displayedClasses.filter((c) => c.status !== 'SCHEDULED');
  const showAccountArea = canManageZoomSettings || (googleStatus && !googleStatus.reason);

  const renderCard = (c: OnlineClassItem) => (
    <li key={c.id} className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-[15px] font-semibold text-slate-900 break-words ${c.status === 'CANCELLED' ? 'line-through text-slate-500' : ''}`}>{c.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{formatClassDateTime(c.start_datetime, c.timezone)} · {c.duration_minutes} min</span>
          </p>
        </div>
        <Badge tone={statusTone(c.status)}>{statusText(c.status)}</Badge>
      </div>
      <div className="text-sm text-slate-600 space-y-1">
        <p className="flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400 flex-shrink-0" /> {c.teacher_name || 'No teacher'} · {platformLabel(c.platform)}</p>
        {(c.class_name || c.subject_name) && (
          <p className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {[c.class_name ? `Class ${c.class_name}${c.section_name ? ` - ${c.section_name}` : ''}` : '', c.subject_name || ''].filter(Boolean).join(' · ')}
          </p>
        )}
        {c.status === 'CANCELLED' && c.cancel_reason && <p className="text-red-600">Reason: {c.cancel_reason}</p>}
      </div>
      {c.status === 'SCHEDULED' && (
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleJoin(c)}
            disabled={joiningId === c.id}
            className="btn-success btn-lg w-full"
          >
            <Video className="w-5 h-5" />
            {joiningId === c.id ? 'Opening…' : 'Join class'}
          </button>
          {canWrite && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRescheduleTarget(c)} className="btn-secondary btn-sm">Change time</button>
              <button type="button" onClick={() => setCancelTarget(c)} className="btn-secondary btn-sm !text-red-600 !border-red-200 hover:!bg-red-50">Cancel class</button>
            </div>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div>
      <PageHeader
        title="Online classes"
        subtitle="Join a class, or plan one on Zoom or Google Meet."
        icon={<Video className="w-6 h-6" />}
        actions={
          <>
            {showAccountArea && (
              <button type="button" onClick={() => setShowAccounts((v) => !v)} className="btn-secondary" aria-expanded={showAccounts}>
                <Settings className="w-4 h-4" /> Accounts
              </button>
            )}
            {canWrite && (
              <button type="button" onClick={() => setShowScheduleModal(true)} className="btn-primary">
                <CalendarPlus className="w-4 h-4" /> Plan a class
              </button>
            )}
          </>
        }
      />

      {showAccounts && showAccountArea && (
        <div className="card p-4 mb-4 space-y-3">
          {googleStatus && !googleStatus.reason && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-medium text-slate-900">Google Meet</div>
                <div className="text-slate-600">
                  {googleStatus.connected ? <>Connected as {googleStatus.google_email || 'your Google account'}</> : 'Not connected. Connect to plan Google Meet classes.'}
                </div>
              </div>
              {googleStatus.connected ? (
                <button type="button" onClick={handleGoogleDisconnect} className="btn-secondary btn-sm !text-red-600 !border-red-200 hover:!bg-red-50">Disconnect Google</button>
              ) : (
                <button type="button" onClick={handleGoogleConnect} disabled={googleConnecting} className="btn-secondary btn-sm">
                  {googleConnecting ? 'Opening Google…' : 'Connect Google account'}
                </button>
              )}
            </div>
          )}
          {canManageZoomSettings && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
              <div className="text-sm">
                <div className="font-medium text-slate-900">Zoom</div>
                <div className="text-slate-600">The school's Zoom account details.</div>
              </div>
              <button type="button" onClick={() => setShowZoomSettings(true)} className="btn-secondary btn-sm">Zoom settings</button>
            </div>
          )}
        </div>
      )}

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      {rowError && (
        <Alert tone="error" className="mb-4" onClose={() => setRowError(null)}>
          {rowError}
        </Alert>
      )}

      <div className="mb-4 card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <label className="label" htmlFor="oc-search">Find a class</label>
            <input
              id="oc-search"
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="input"
              placeholder="Class name or teacher"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="segmented flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`segmented-item flex-1 min-h-[40px] ${viewMode === 'list' ? 'segmented-item-active' : ''}`}
              >List</button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`segmented-item flex-1 min-h-[40px] ${viewMode === 'calendar' ? 'segmented-item-active' : ''}`}
              >One day</button>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={hasFilters ? 'btn-soft' : 'btn-secondary'}
              aria-expanded={showFilters || hasFilters}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters{hasFilters ? ' (on)' : ''}
            </button>
          </div>
        </div>

        {(showFilters || hasFilters) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
            <Field label="Show" htmlFor="oc-status">
              <select id="oc-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
                <option value="">All classes</option>
                <option value="SCHEDULED">Coming up</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Finished</option>
              </select>
            </Field>
            {viewMode === 'list' && (
              <>
                <Field label="From date" htmlFor="oc-from">
                  <input id="oc-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
                </Field>
                <Field label="To date" htmlFor="oc-to">
                  <input id="oc-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
                </Field>
              </>
            )}
            {(hasFilters || searchText) && (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => { setStatusFilter(''); setFromDate(''); setToDate(''); setSearchText(''); }}
                  className="btn-ghost btn-sm text-brand-700"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === 'calendar' && (
        <div className="mb-4 card flex items-center gap-2 p-3">
          <button type="button" onClick={() => setCalendarDate((d) => shiftDay(d, -1))} className="btn-secondary" aria-label="Day before">
            <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Day before</span>
          </button>
          <input type="date" value={calendarDate} onChange={(e) => setCalendarDate(e.target.value)} className="input flex-1 min-w-0 sm:flex-none sm:w-auto" aria-label="Day" />
          <button type="button" onClick={() => setCalendarDate((d) => shiftDay(d, 1))} className="btn-secondary" aria-label="Next day">
            <span className="hidden sm:inline">Next day</span><ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setCalendarDate(getLocalDateString())} className="btn-ghost text-brand-700">Today</button>
        </div>
      )}

      {viewMode === 'list' && (
        loading ? (
          <LoadingState label="Loading classes…" />
        ) : displayedClasses.length === 0 ? (
          <div className="card">
            <EmptyState
              title="No online classes found."
              description={hasFilters || searchText ? 'Try clearing the filters.' : canWrite ? 'Tap “Plan a class” to add one.' : undefined}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 mb-2">Coming up ({upcoming.length})</h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{upcoming.map(renderCard)}</ul>
              </section>
            )}
            {others.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 mb-2">Finished or cancelled ({others.length})</h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{others.map(renderCard)}</ul>
              </section>
            )}
          </div>
        )
      )}

      {viewMode === 'list' && totalPages > 1 && (
        <div className="mt-4 flex flex-wrap gap-2 items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages} ({totalCount} classes)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary">Previous</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary">Next</button>
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        loading ? <LoadingState /> : (
          <>
            {/* Phones: the day's classes as simple cards, in time order */}
            <div className="md:hidden">
              {(() => {
                const dayList = displayedClasses
                  .filter((c) => c.start_datetime.startsWith(calendarDate))
                  .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
                return dayList.length === 0
                  ? <div className="card"><EmptyState compact title="No online classes on this day." /></div>
                  : <ul className="space-y-3">{dayList.map(renderCard)}</ul>;
              })()}
            </div>
            {/* Wider screens: time line for the day */}
            <div className="hidden md:block">
              <DayCalendarView
                day={calendarDate}
                classes={displayedClasses}
                canWrite={canWrite}
                joiningId={joiningId}
                onJoin={handleJoin}
                onReschedule={setRescheduleTarget}
                onCancel={setCancelTarget}
              />
            </div>
          </>
        )
      )}

      {showScheduleModal && (
        <ScheduleClassModal
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => { setShowScheduleModal(false); notify.success('Class planned.'); fetchClasses(); }}
        />
      )}

      {cancelTarget && (
        <CancelClassModal
          classItem={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={() => { setCancelTarget(null); fetchClasses(); }}
        />
      )}

      {rescheduleTarget && (
        <RescheduleClassModal
          classItem={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => { setRescheduleTarget(null); notify.success('New time saved.'); fetchClasses(); }}
        />
      )}

      {showZoomSettings && (
        <ZoomSettingsModal onClose={() => setShowZoomSettings(false)} />
      )}
    </div>
  );
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;

const DayCalendarView: React.FC<{
  day: string;
  classes: OnlineClassItem[];
  canWrite: boolean;
  joiningId: number | null;
  onJoin: (c: OnlineClassItem) => void;
  onReschedule: (c: OnlineClassItem) => void;
  onCancel: (c: OnlineClassItem) => void;
}> = ({ day, classes, canWrite, joiningId, onJoin, onReschedule, onCancel }) => {
  const dayClasses = classes.filter((c) => c.start_datetime.startsWith(day));
  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

  const topPct = (c: OnlineClassItem) => {
    const [, timePart] = c.start_datetime.split('T');
    const [h, m] = (timePart || '00:00').split(':').map(Number);
    const minutesFromStart = (h - DAY_START_HOUR) * 60 + m;
    return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
  };
  const heightPct = (c: OnlineClassItem) => Math.max(3, (c.duration_minutes / totalMinutes) * 100);

  const statusColor = (s: string) =>
    s === 'SCHEDULED' ? 'bg-brand-50 border-brand-500 text-brand-800' :
    s === 'CANCELLED' ? 'bg-red-50 border-red-300 text-red-700 line-through' :
    'bg-slate-100 border-slate-300 text-slate-600';

  return (
    <div className="card p-4">
      {dayClasses.length === 0 ? (
        <EmptyState title="No online classes on this day." />
      ) : (
        <div className="relative flex" style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * 56}px` }}>
          <div className="w-16 flex-shrink-0 relative text-xs text-slate-400">
            {hours.map((h) => (
              <div key={h} className="absolute -translate-y-2" style={{ top: `${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}>
                {h % 12 === 0 ? 12 : h % 12}:00 {h < 12 ? 'AM' : 'PM'}
              </div>
            ))}
          </div>
          <div className="flex-1 relative border-l border-slate-200">
            {hours.map((h) => (
              <div key={h} className="absolute w-full border-t border-slate-100" style={{ top: `${((h - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }} />
            ))}
            {dayClasses.map((c) => (
              <div key={c.id} className={`absolute left-1 right-1 rounded-md border px-2 py-1 text-xs overflow-hidden ${statusColor(c.status)}`}
                   style={{ top: `${topPct(c)}%`, height: `${heightPct(c)}%`, minHeight: '28px' }}>
                <div className="font-semibold truncate">{c.title}</div>
                <div className="truncate">{c.teacher_name} · {platformLabel(c.platform)}</div>
                {c.status === 'SCHEDULED' && (
                  <div className="mt-0.5 flex gap-3">
                    <button type="button" onClick={() => onJoin(c)} disabled={joiningId === c.id} className="font-semibold underline hover:no-underline">Join class</button>
                    {canWrite && (<>
                      <button type="button" onClick={() => onReschedule(c)} className="underline hover:no-underline">Change time</button>
                      <button type="button" onClick={() => onCancel(c)} className="underline hover:no-underline">Cancel class</button>
                    </>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ScheduleClassModalProps {
  onClose: () => void;
  onScheduled: () => void;
}

const ScheduleClassModal: React.FC<ScheduleClassModalProps> = ({ onClose, onScheduled }) => {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<'zoom' | 'google_meet'>('zoom');
  const [teacherId, setTeacherId] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
    const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
    const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classes, setClassOptions] = useState<{ id: number; class_name: string; sections: { id: number; name: string }[] }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; subject_name: string }[]>([]);
  const [myAssignments, setMyAssignments] = useState<{ class_id: number; class_name: string; section_id: number; section_name: string; subject_id: number; subject_name: string }[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const { hasPermission } = useAuth();
  const canBrowseTeachers = hasPermission('hr.hr.staff-master', 'read');

  useEffect(() => {
    const loadOptions = async () => {
      setOptionsLoading(true);
      try {
        if (canBrowseTeachers) {
          // Admin / anyone with HR-level access: browse every class/section/subject in the school.
          const [classRes, subjectRes] = await Promise.all([
            api.get('/classes/summary'),
            api.get('/academic/subjects'),
          ]);
          setClassOptions(classRes.data || []);
          setSubjects(subjectRes.data || []);
        } else {
          // Teacher-locked users: only what they're actually assigned to teach,
          // from Subject-Teacher Assignment — not the full school-wide list.
          const res = await api.get('/online-classes/my-assignments');
          setMyAssignments(res.data || []);
        }
      } catch (e: any) {
        console.error('Failed to load class/subject options:', e.response?.data || e.message);
      } finally {
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, [canBrowseTeachers]);

  // Derived, teacher-locked versions of the class/section/subject lists,
  // built from myAssignments instead of the full school-wide master data.
  const myClasses = useMemo(() => {
    const map = new Map<number, { id: number; class_name: string; sections: Map<number, { id: number; name: string }> }>();
    myAssignments.forEach((a) => {
      if (!map.has(a.class_id)) {
        map.set(a.class_id, { id: a.class_id, class_name: a.class_name, sections: new Map() });
      }
      map.get(a.class_id)!.sections.set(a.section_id, { id: a.section_id, name: a.section_name });
    });
    return Array.from(map.values()).map((c) => ({ id: c.id, class_name: c.class_name, sections: Array.from(c.sections.values()) }));
  }, [myAssignments]);

  const mySubjectsForSelection = useMemo(() => {
    if (!classId || !sectionId) return [];
    const seen = new Set<number>();
    return myAssignments
      .filter((a) => String(a.class_id) === classId && String(a.section_id) === sectionId)
      .filter((a) => (seen.has(a.subject_id) ? false : (seen.add(a.subject_id), true)))
      .map((a) => ({ id: a.subject_id, subject_name: a.subject_name }));
  }, [myAssignments, classId, sectionId]);

  const effectiveClasses = canBrowseTeachers ? classes : myClasses;
  const effectiveSubjects = canBrowseTeachers ? subjects : mySubjectsForSelection;

      const [selfTeacher, setSelfTeacher] = useState<{ is_teacher: boolean; staff_id: number | null; name: string | null } | null>(null);

  useEffect(() => {
    const init = async () => {
      setTeachersLoading(true);
      try {
        if (canBrowseTeachers) {
          const res = await api.get('/hr/staff', { params: { status: 'ACTIVE' } });
          const list = (res.data || []).map((s: any) => ({
            id: s.id,
            name: s.display_name || `${s.first_name} ${s.last_name || ''}`.trim(),
          }));
          setTeachers(list);
        } else {
          const res = await api.get('/online-classes/me-as-teacher');
          setSelfTeacher(res.data);
          if (res.data?.is_teacher) {
            setTeacherId(String(res.data.staff_id));
            setTeacherSearch(res.data.name || '');
          }
        }
      } catch (e: any) {
        console.error('Failed to load teacher info:', e.response?.data || e.message);
      } finally {
        setTeachersLoading(false);
      }
    };
    init();
  }, [canBrowseTeachers]);

    const handleSubmit = async (force = false) => {
    if (!title.trim() || !teacherId || !startDatetime) {
      setError('Please fill in the class name, teacher, and date and time.');
      return;
    }
    if (isRecurring && recurrenceDays.length === 0) {
      setError('Choose at least one day to repeat on.');
      return;
    }
    if (isRecurring && !recurrenceEndDate) {
      setError('Choose the last date for the repeating class.');
      return;
    }
    setSaving(true);
    setError(null);
    setConflicts(null);
    try {
            await api.post('/online-classes', {
        title,
        platform,
        teacher_id: Number(teacherId),
        start_datetime: startDatetime.length === 16 ? `${startDatetime}:00` : startDatetime,
        duration_minutes: durationMinutes,
        class_id: classId ? Number(classId) : undefined,
        section_id: sectionId ? Number(sectionId) : undefined,
        subject_id: subjectId ? Number(subjectId) : undefined,
        is_recurring: isRecurring,
        recurrence_days: isRecurring ? recurrenceDays : undefined,
        recurrence_end_date: isRecurring ? recurrenceEndDate : undefined,
        force,
      });
      onScheduled();
    } catch (e: any) {
      const data = e.response?.data;
      if (data?.conflicts) {
        setConflicts(data.conflicts);
        setError(data.error);
      } else {
        setError(data?.error || 'Could not plan the class. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const missing = !title.trim() ? 'Type a name for the class.'
    : !teacherId ? 'Choose the teacher.'
    : !startDatetime ? 'Choose the date and time.'
    : isRecurring && recurrenceDays.length === 0 ? 'Choose the days to repeat on.'
    : isRecurring && !recurrenceEndDate ? 'Choose the last date to repeat.'
    : '';
  const DAY_NAMES: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

  return (
    <Dialog
      title="Plan an online class"
      onClose={onClose}
      footer={<>
        {missing && <p className="w-full text-sm text-slate-600 sm:flex-1 sm:w-auto">{missing}</p>}
        <button type="button" onClick={onClose} className="btn-secondary">Back</button>
        {conflicts && (
          <button type="button" onClick={() => handleSubmit(true)} disabled={saving} className="btn-warn">
            Plan anyway
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={saving || !!missing}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Plan class'}
        </button>
      </>}
    >
      {error && (
        <Alert tone="error">
          {error}
          {conflicts && (
            <ul className="list-disc pl-5 mt-1">
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </Alert>
      )}

      <Field label="Class name" htmlFor="oc-title" required>
        <input id="oc-title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Algebra basics" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date and time" htmlFor="oc-start" required>
          <input
            id="oc-start"
            type="datetime-local"
            value={startDatetime}
            onChange={(e) => setStartDatetime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="How long (minutes)" htmlFor="oc-duration">
          <input id="oc-duration" type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="input" min={5} />
        </Field>
      </div>

      <Field label="Where" required>
        <div className="segmented w-full">
          {([['zoom', 'Zoom'], ['google_meet', 'Google Meet']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              aria-pressed={platform === value}
              className={`segmented-item flex-1 min-h-[40px] ${platform === value ? 'segmented-item-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-800 mb-1.5" htmlFor="oc-teacher">
          Teacher<span className="text-red-600" aria-hidden="true"> *</span>
        </label>
        {canBrowseTeachers ? (
          <>
            <input
              id="oc-teacher"
              value={teacherSearch}
              onChange={(e) => {
                setTeacherSearch(e.target.value);
                setTeacherId('');
                setShowTeacherDropdown(true);
              }}
              onFocus={() => setShowTeacherDropdown(true)}
              onBlur={() => setTimeout(() => setShowTeacherDropdown(false), 150)}
              className="input"
              placeholder={teachersLoading ? 'Loading…' : 'Type a name'}
              disabled={teachersLoading}
              autoComplete="off"
            />
            {teacherSearch.trim() && !teacherId && !showTeacherDropdown && (
              <p className="mt-1.5 text-sm text-amber-700">Tap a name from the list.</p>
            )}
            {showTeacherDropdown && teacherSearch.trim() && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {teachers
                  .filter((t) => t.name.toLowerCase().includes(teacherSearch.trim().toLowerCase()))
                  .slice(0, 20)
                  .map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        setTeacherId(String(t.id));
                        setTeacherSearch(t.name);
                        setShowTeacherDropdown(false);
                      }}
                      className="w-full text-left px-3 py-3 text-[15px] hover:bg-brand-50"
                    >
                      {t.name}
                    </button>
                  ))}
                {teachers.filter((t) => t.name.toLowerCase().includes(teacherSearch.trim().toLowerCase())).length === 0 && (
                  <div className="px-3 py-3 text-sm text-slate-500">No teacher with that name</div>
                )}
              </div>
            )}
          </>
        ) : teachersLoading ? (
          <div className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm flex items-center gap-2"><Spinner size="sm" /> Loading…</div>
        ) : selfTeacher?.is_teacher ? (
          <div className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 text-sm">
            {selfTeacher.name} <span className="text-slate-500">(you)</span>
          </div>
        ) : (
          <div className="w-full px-3 py-2.5 border border-red-200 rounded-lg bg-red-50 text-red-700 text-sm">
            You can't choose a teacher. Please ask your school admin.
          </div>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-800 mb-1.5">For which class? {canBrowseTeachers && <span className="font-normal text-slate-500">(optional)</span>}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            aria-label="Class"
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}
            className="input"
            disabled={optionsLoading}
          >
            <option value="">{optionsLoading ? 'Loading…' : canBrowseTeachers ? 'Any class' : 'Choose class'}</option>
            {effectiveClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
          <select
            aria-label="Section"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="input"
            disabled={!classId}
          >
            <option value="">{classId ? (canBrowseTeachers ? 'Any section' : 'Choose section') : 'Choose a class first'}</option>
            {(effectiveClasses.find((c) => String(c.id) === classId)?.sections || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            aria-label="Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="input"
            disabled={optionsLoading || (!canBrowseTeachers && (!classId || !sectionId))}
          >
            <option value="">{canBrowseTeachers ? 'Any subject' : (!classId || !sectionId) ? 'Choose class and section first' : 'Choose subject'}</option>
            {effectiveSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.subject_name}</option>
            ))}
          </select>
        </div>
        {!canBrowseTeachers && !optionsLoading && effectiveClasses.length === 0 && (
          <p className="text-sm text-red-600">You are not set as the teacher of any class yet. Please ask your school admin.</p>
        )}
      </fieldset>

      <div className="border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 min-h-[44px]">
          <input
            type="checkbox"
            className="w-5 h-5 accent-brand-600"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          Repeat this class every week
        </label>

        {isRecurring && (
          <div className="mt-3 space-y-4">
            <Field label="Repeat on" required>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => (
                  <button
                    type="button"
                    key={day}
                    aria-pressed={recurrenceDays.includes(day)}
                    onClick={() =>
                      setRecurrenceDays((prev) =>
                        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                      )
                    }
                    className={`min-h-[44px] px-2 text-sm font-medium rounded-lg border ${
                      recurrenceDays.includes(day)
                        ? 'bg-brand-600 text-brand-contrast border-brand-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {DAY_NAMES[day]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Last date" htmlFor="oc-until" required>
              <input
                id="oc-until"
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Cancel Class Modal
// ---------------------------------------------------------------------------

interface CancelClassModalProps {
  classItem: OnlineClassItem;
  onClose: () => void;
  onCancelled: () => void;
}

const CancelClassModal: React.FC<CancelClassModalProps> = ({ classItem, onClose, onCancelled }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const handleCancel = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/online-classes/${classItem.id}/cancel`, { reason: reason.trim() || undefined });
      if (res.data?.warning) {
        notify(res.data.warning);
      }
      onCancelled();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not cancel the class. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Cancel this class?"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="btn-secondary">Keep class</button>
        <button type="button" onClick={handleCancel} disabled={saving} className="btn-danger">
          {saving ? 'Cancelling…' : 'Cancel class'}
        </button>
      </>}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-slate-700">
        You are cancelling <span className="font-semibold text-slate-900">“{classItem.title}”</span> on{' '}
        {formatClassDateTime(classItem.start_datetime, classItem.timezone)}. Students and the teacher will not be able to join.
      </p>
      <Field label="Reason (optional)" htmlFor="oc-cancel-reason">
        <textarea
          id="oc-cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input"
          rows={3}
          placeholder="e.g. Teacher is on leave"
        />
      </Field>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Reschedule Class Modal
// ---------------------------------------------------------------------------

interface RescheduleClassModalProps {
  classItem: OnlineClassItem;
  onClose: () => void;
  onRescheduled: () => void;
}

const toDatetimeLocalValue = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const RescheduleClassModal: React.FC<RescheduleClassModalProps> = ({ classItem, onClose, onRescheduled }) => {
  const [startDatetime, setStartDatetime] = useState(toDatetimeLocalValue(classItem.start_datetime));
  const [durationMinutes, setDurationMinutes] = useState(classItem.duration_minutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);

  const handleSubmit = async (force = false) => {
    setSaving(true);
    setError(null);
    setConflicts(null);
    try {
      await api.put(`/online-classes/${classItem.id}`, {
        start_datetime: startDatetime.length === 16 ? `${startDatetime}:00` : startDatetime,
        duration_minutes: durationMinutes,
        force,
      });
      onRescheduled();
    } catch (e: any) {
      const data = e.response?.data;
      if (data?.conflicts) {
        setConflicts(data.conflicts);
        setError(data.error);
      } else {
        setError(data?.error || 'Could not change the time. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Change class time"
      subtitle={<>For “{classItem.title}”</>}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="btn-secondary">Back</button>
        {conflicts && (
          <button type="button" onClick={() => handleSubmit(true)} disabled={saving} className="btn-warn">
            Save anyway
          </button>
        )}
        <button type="button" onClick={() => handleSubmit(false)} disabled={saving || !startDatetime} className="btn-primary">
          {saving ? 'Saving…' : 'Save new time'}
        </button>
      </>}
    >
      {error && (
        <Alert tone="error">
          {error}
          {conflicts && (
            <ul className="list-disc pl-5 mt-1">
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="New date and time" htmlFor="oc-new-start" required>
          <input
            id="oc-new-start"
            type="datetime-local"
            value={startDatetime}
            onChange={(e) => setStartDatetime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="How long (minutes)" htmlFor="oc-new-duration">
          <input
            id="oc-new-duration"
            type="number"
            inputMode="numeric"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="input"
            min={5}
          />
        </Field>
      </div>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Zoom Settings Modal
// ---------------------------------------------------------------------------

interface ZoomSettingsModalProps {
  onClose: () => void;
}

interface ZoomCredentialRow {
  id: number;
  school_id: number;
  branch_id: number | null;
  scope: string;
  default_host_email: string;
}

const ZoomSettingsModal: React.FC<ZoomSettingsModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const currentBranchId = localStorage.getItem('currentBranchId');
  const currentBranchName = localStorage.getItem('currentBranch');
  const hasSpecificBranch = !!currentBranchId && currentBranchName !== 'All';
  // "Shared" only makes sense if this user's own access spans more than one branch —
  // an unset/empty allowed_branches list means unrestricted (e.g. SuperAdmin).
  const branchCount = user?.allowed_branches?.length ?? 0;
  const canSetShared = branchCount === 0 || branchCount > 1;

  const [existing, setExisting] = useState<ZoomCredentialRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [scopeType, setScopeType] = useState<'branch' | 'shared'>(hasSpecificBranch ? 'branch' : 'shared');
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [defaultHostEmail, setDefaultHostEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setAccountId('');
    setClientId('');
    setClientSecret('');
    setDefaultHostEmail('');
  };

  const handleEditClick = async (row: ZoomCredentialRow) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await api.get(`/online-classes/settings/zoom/${row.id}`);
      const cred = res.data;
      setEditingId(cred.id);
      setAccountId(cred.account_id || '');
      setClientId(cred.client_id || '');
      setClientSecret(''); // never prefilled — blank means "keep existing" on save
      setDefaultHostEmail(cred.default_host_email || '');
      setScopeType(cred.branch_id ? 'branch' : 'shared');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load Zoom configuration for editing');
    }
  };

  const handleDeactivate = async (row: ZoomCredentialRow) => {
    if (!await confirmDialog(`Turn off the Zoom account ${row.default_host_email}? New Zoom classes can't be planned until another account is added.`, { tone: 'danger', confirmText: 'Turn off' })) {
      return;
    }
    setDeletingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/online-classes/settings/zoom/${row.id}`);
      setSuccess('Zoom account turned off.');
      if (editingId === row.id) resetForm();
      loadExisting();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to deactivate Zoom configuration');
    } finally {
      setDeletingId(null);
    }
  };

    const loadExisting = async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/online-classes/settings/zoom', {
        params: currentBranchId ? { branch_id: Number(currentBranchId) } : {},
      });
      setExisting(res.data || []);
    } catch (e: any) {
      console.error('Failed to load Zoom settings:', e.response?.data || e.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadExisting();
  }, []);

  const handleSave = async () => {
    const isEditing = editingId !== null;
    // On create, the secret is mandatory. On edit, a blank secret means "keep the existing one".
    if (!accountId.trim() || !clientId.trim() || !defaultHostEmail.trim() || (!isEditing && !clientSecret.trim())) {
      setError('Please fill in every field marked *.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (isEditing) {
        const payload: Record<string, any> = {
          account_id: accountId.trim(),
          client_id: clientId.trim(),
          default_host_email: defaultHostEmail.trim(),
        };
        if (clientSecret.trim()) {
          payload.client_secret = clientSecret.trim();
        }
        await api.put(`/online-classes/settings/zoom/${editingId}`, payload);
        setSuccess('Zoom account saved.');
      } else {
        const payload: Record<string, any> = {
          account_id: accountId.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          default_host_email: defaultHostEmail.trim(),
        };
        if (scopeType === 'branch' && currentBranchId) {
          payload.branch_id = Number(currentBranchId);
        }
        // scopeType === 'shared' -> branch_id omitted entirely -> backend treats as school-wide
        await api.post('/online-classes/settings/zoom', payload);
        setSuccess('Zoom account added.');
      }
      resetForm();
      loadExisting();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save Zoom credentials');
    } finally {
      setSaving(false);
    }
  };

  const editing = editingId !== null;

  return (
    <Dialog
      title="Zoom settings"
      subtitle="The Zoom account used to make online classes."
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        {editing && (
          <button type="button" onClick={resetForm} className="btn-secondary">Stop editing</button>
        )}
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save Zoom account'}
        </button>
      </>}
    >
      {error && <Alert tone="error">{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Saved Zoom accounts</h3>
        {loadingList ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size="sm" /> Loading…</div>
        ) : existing.length === 0 ? (
          <EmptyState compact title="No Zoom account added yet." />
        ) : (
          <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {existing.map((r) => (
              <li key={r.id} className="px-3 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-900 font-medium break-all">{r.default_host_email}</div>
                  <div className="text-slate-500">{r.scope}</div>
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
                  <button type="button" onClick={() => handleEditClick(r)} className="btn-secondary btn-sm">Edit</button>
                  <button
                    type="button"
                    onClick={() => handleDeactivate(r)}
                    disabled={deletingId === r.id}
                    className="btn-secondary btn-sm !text-red-600 !border-red-200 hover:!bg-red-50"
                  >
                    {deletingId === r.id ? 'Turning off…' : 'Turn off'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-slate-100 pt-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">
          {editing ? 'Edit Zoom account' : 'Add a Zoom account'}
        </h3>

        <Field
          label="Used by"
          htmlFor="zoom-scope"
          hint={editing
            ? "This can't be changed. To change it, turn this account off and add it again."
            : !hasSpecificBranch
              ? 'To add an account for one branch only, first pick that branch at the top of the screen.'
              : !canSetShared
                ? 'You can only add an account for your own branch.'
                : undefined}
        >
          <select
            id="zoom-scope"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as 'branch' | 'shared')}
            disabled={editing}
            className="input disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="branch" disabled={!hasSpecificBranch}>
              This branch only {!hasSpecificBranch ? '(pick a branch first)' : `(${currentBranchName})`}
            </option>
            <option value="shared" disabled={!canSetShared}>
              All branches of the school {!canSetShared ? '(needs access to more than one branch)' : ''}
            </option>
          </select>
        </Field>

        <Field label="Zoom account ID" htmlFor="zoom-account" required>
          <input id="zoom-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Client ID" htmlFor="zoom-client" required>
            <input id="zoom-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input" autoComplete="off" />
          </Field>
          <Field label="Client secret" htmlFor="zoom-secret" required={!editing} hint={editing ? 'Leave empty to keep the saved one.' : undefined}>
            <input
              id="zoom-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="input"
              autoComplete="new-password"
              placeholder={editing ? '••••••' : ''}
            />
          </Field>
        </div>
        <Field label="Main host email" htmlFor="zoom-email" required>
          <input id="zoom-email" type="email" inputMode="email" value={defaultHostEmail} onChange={(e) => setDefaultHostEmail(e.target.value)} className="input" placeholder="e.g. admin@school.com" />
        </Field>
      </section>
    </Dialog>
  );
};

export default OnlineClass;