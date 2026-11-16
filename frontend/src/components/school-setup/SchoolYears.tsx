import React, { useEffect, useState } from 'react';
import { CalendarRange, RotateCcw, Save } from 'lucide-react';
import api from '../../api';
import { Alert, Badge, Button, ErrorState, Field, LoadingState, confirmDialog, notify } from '../ui';
import BackBar from './BackBar';

interface SchoolYear {
    code: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    is_custom: boolean;
    default_start: string | null;
    default_end: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pretty = (iso: string | null) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const errText = (err: any) => err?.response?.data?.error || 'Could not save. Check the internet and try again.';

/**
 * Setup > School settings > School years.
 * Each school sets when its school year starts and ends. Attendance (register, report cards),
 * joining dates and the Home fee chart all follow these dates.
 */
const SchoolYears: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
    const [schoolId, setSchoolId] = useState<number | null>(null);
    const [years, setYears] = useState<SchoolYear[] | null>(null);
    const [canEdit, setCanEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<Record<string, { start: string; end: string }>>({});
    const [patternMonth, setPatternMonth] = useState(6);
    const [patternDay, setPatternDay] = useState(1);
    const [busy, setBusy] = useState<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let live = true;
        setError(null);
        api.get('/config/academic-years', { params: { school_id: schoolId ?? undefined } })
            .then(res => {
                if (!live) return;
                setSchools(res.data.schools || []);
                setSchoolId(res.data.school_id);
                setYears(res.data.years || []);
                setCanEdit(!!res.data.can_edit);
                setDraft({});
                const custom = (res.data.years || []).find((y: SchoolYear) => y.is_custom && y.start_date);
                if (custom) {
                    const [, m, d] = custom.start_date.split('-').map(Number);
                    setPatternMonth(m); setPatternDay(d);
                }
            })
            .catch(err => live && setError(errText(err)));
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId, reload]);

    const applyResult = (data: any) => {
        notify.success(data.message);
        setYears(data.years || []);
        setDraft({});
    };

    const savePattern = async () => {
        if (!schoolId) return;
        const ok = await confirmDialog(
            `Every school year will start on ${patternDay} ${MONTHS[patternMonth - 1]} and end the day before the next one. ` +
            'Attendance days are moved to the right year automatically. Continue?',
            { title: 'Set the same start for every year', confirmText: 'Yes, set it', tone: 'default' });
        if (!ok) return;
        setBusy('pattern');
        try {
            applyResult((await api.post('/config/academic-years/pattern', { school_id: schoolId, start_month: patternMonth, start_day: patternDay })).data);
        } catch (err) { notify.error(errText(err)); } finally { setBusy(null); }
    };

    const saveYear = async (y: SchoolYear) => {
        const d = draft[y.code];
        if (!d || !schoolId) return;
        setBusy(y.code);
        try {
            applyResult((await api.put(`/config/academic-years/${encodeURIComponent(y.code)}`, { school_id: schoolId, start_date: d.start, end_date: d.end })).data);
        } catch (err) { notify.error(errText(err)); } finally { setBusy(null); }
    };

    const resetYear = async (y: SchoolYear) => {
        if (!schoolId) return;
        if (!(await confirmDialog(`Use the default dates for ${y.name} (${pretty(y.default_start)} – ${pretty(y.default_end)})?`, { confirmText: 'Use default', tone: 'default' }))) return;
        setBusy(y.code);
        try {
            applyResult((await api.delete(`/config/academic-years/${encodeURIComponent(y.code)}`, { params: { school_id: schoolId } })).data);
        } catch (err) { notify.error(errText(err)); } finally { setBusy(null); }
    };

    const setDraftField = (y: SchoolYear, key: 'start' | 'end', value: string) =>
        setDraft(prev => ({ ...prev, [y.code]: { start: prev[y.code]?.start ?? y.start_date ?? '', end: prev[y.code]?.end ?? y.end_date ?? '', [key]: value } }));

    return (
        <div>
            <BackBar label="Settings" onBack={onBack} title="School years"
                hint="When your school year starts and ends. Attendance, report cards and joining dates follow these dates." />

            {schools.length > 1 && (
                <div className="card p-4 mb-4">
                    <Field label="School" htmlFor="sy-school" className="sm:w-80">
                        <select id="sy-school" className="input" value={schoolId ?? ''} onChange={e => { setYears(null); setSchoolId(Number(e.target.value)); }}>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </Field>
                </div>
            )}

            {error ? <ErrorState message={error} onRetry={() => setReload(n => n + 1)} /> : !years ? <LoadingState /> : (
                <div className="space-y-4">
                    {!canEdit && <Alert tone="info">You can see the dates. To change them you need "Set up your school" access.</Alert>}

                    {canEdit && (
                        <section className="card p-4 sm:p-5" aria-label="Same start every year">
                            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><CalendarRange className="w-5 h-5 text-brand-600" /> Same start date every year</h2>
                            <p className="text-sm text-slate-500 mt-0.5">Most schools start every year on the same day. Set it once for all years.</p>
                            <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
                                <Field label="Day" htmlFor="sy-day" className="sm:w-28">
                                    <select id="sy-day" className="input" value={patternDay} onChange={e => setPatternDay(Number(e.target.value))}>
                                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </Field>
                                <Field label="Month" htmlFor="sy-month" className="sm:w-48">
                                    <select id="sy-month" className="input" value={patternMonth} onChange={e => setPatternMonth(Number(e.target.value))}>
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </Field>
                                <Button loading={busy === 'pattern'} onClick={savePattern}>Set for all years</Button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Example: year 2026-2027 runs {patternDay} {MONTHS[patternMonth - 1]} 2026 to the day before {patternDay} {MONTHS[patternMonth - 1]} 2027.
                            </p>
                        </section>
                    )}

                    <section aria-label="Each school year">
                        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Each school year</h2>
                        {years.length === 0 ? <p className="text-sm text-slate-500">No school years are set up yet.</p> : (
                            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {years.map(y => {
                                    const d = draft[y.code];
                                    const changed = !!d && (d.start !== y.start_date || d.end !== y.end_date);
                                    return (
                                        <li key={y.code} className="card p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[15px] font-semibold text-slate-900">{y.name}</p>
                                                <Badge tone={y.is_custom ? 'brand' : 'neutral'}>{y.is_custom ? 'Set for this school' : 'Default dates'}</Badge>
                                            </div>
                                            {canEdit ? (
                                                <>
                                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                                        <Field label="First day" htmlFor={`sy-s-${y.code}`}>
                                                            <input id={`sy-s-${y.code}`} type="date" className="input" value={d?.start ?? y.start_date ?? ''}
                                                                onChange={e => setDraftField(y, 'start', e.target.value)} />
                                                        </Field>
                                                        <Field label="Last day" htmlFor={`sy-e-${y.code}`}>
                                                            <input id={`sy-e-${y.code}`} type="date" className="input" value={d?.end ?? y.end_date ?? ''}
                                                                onChange={e => setDraftField(y, 'end', e.target.value)} />
                                                        </Field>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Button size="sm" icon={<Save className="w-4 h-4" />} disabled={!changed} loading={busy === y.code && changed}
                                                            onClick={() => saveYear(y)}>Save</Button>
                                                        {y.is_custom && (
                                                            <Button size="sm" variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={() => resetYear(y)}>
                                                                Use default
                                                            </Button>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="mt-2 text-sm text-slate-700">{pretty(y.start_date)} – {pretty(y.end_date)}</p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
};

export default SchoolYears;
