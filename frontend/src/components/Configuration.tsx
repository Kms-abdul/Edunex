import React, { useState, useEffect, useCallback } from 'react';
import { Page } from '../App';
import { Trash2, Pencil, Plus, Calendar, Clock, SlidersHorizontal, Building2, BadgeCheck, CalendarRange, Archive, Settings2 } from 'lucide-react';
import api from '../api';
import { confirmDialog, notify } from './ui/feedback';
import { PageHeader, Alert, DataList, Field, Badge } from './ui';
import type { Column } from './ui';
import { ChoiceList, BackBar, Dialog } from './school-setup';

interface ConfigurationProps {
    navigateTo?: (page: Page) => void;
}

interface BranchOption {
    id: number;
    branch_name: string;
    branch_code: string;
}

interface ClassOption {
    id: number;
    class_name: string;
}

interface WeekoffRule {
    id: number;
    branch_id: number;
    branch_name: string;
    class_id: number | null;
    weekday: number;
    weekday_name: string;
    week_number: number | null;
    week_label: string;
    title: string;
    academic_year: string;
}

interface Holiday {
    id: number;
    branch_id: number;
    branch_name: string;
    class_id: number | null;
    title: string;
    start_date: string;
    end_date: string;
    holiday_for: string;
    description: string;
    display_order: number | null;
    academic_year: string;
}

const WEEKDAYS = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
];

const WEEK_OPTIONS = [
    { value: null, label: 'Every week' },
    { value: 1, label: 'First week of the month' },
    { value: 2, label: 'Second week of the month' },
    { value: 3, label: 'Third week of the month' },
    { value: 4, label: 'Fourth week of the month' },
    { value: 5, label: 'Fifth week of the month' },
];

/** Resolve the user's current branch to a branch object */
function resolveCurrentBranch(branches: BranchOption[]): BranchOption | null {
    if (branches.length === 0) return null;
    const currentBranchName = localStorage.getItem('currentBranch') || '';
    if (currentBranchName && currentBranchName !== 'All' && currentBranchName !== 'All Branches') {
        const match = branches.find(
            b => b.branch_name === currentBranchName || b.branch_code === currentBranchName
        );
        if (match) return match;
    }
    return branches[0]; // fallback to first branch
}

// ================================================================
// WEEKOFF POLICY COMPONENT
// ================================================================
const WeekoffPolicy: React.FC<{ branches: BranchOption[]; onBack: () => void }> = ({ branches, onBack }) => {
    const [rules, setRules] = useState<WeekoffRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [selectedDay, setSelectedDay] = useState<number>(6); // Default Sunday
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null); // Every
    const [selectedBranch, setSelectedBranch] = useState<number>(0);
    const [selectedClass, setSelectedClass] = useState<number | ''>(''); // '' = All Classes
    const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
    const [showForm, setShowForm] = useState(false);

    // Auto-select current branch on mount
    useEffect(() => {
        const resolved = resolveCurrentBranch(branches);
        if (resolved) setSelectedBranch(resolved.id);
    }, [branches]);

    // Fetch classes when branch changes
    useEffect(() => {
        if (!selectedBranch) {
            setClassOptions([]);
            return;
        }
        const branchObj = branches.find(b => b.id === selectedBranch);
        const branchName = branchObj?.branch_name || '';
        api.get('/classes', { params: { branch: branchName } })
            .then(res => setClassOptions(res.data?.classes || []))
            .catch(err => {
                console.error('Error fetching classes:', err);
                setClassOptions([]);
            });
    }, [selectedBranch, branches]);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/config/weekoff');
            setRules(res.data || []);
        } catch (err: any) {
            console.error('Error fetching weekoff rules:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleSave = async () => {
        if (!selectedBranch) {
            setMessage({ type: 'error', text: 'Choose a branch first.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await api.post('/config/weekoff', {
                weekday: selectedDay,
                week_number: selectedWeek,
                branch_id: selectedBranch,
                class_id: selectedClass || null,
            });
            setMessage({ type: 'success', text: 'Weekly day off saved.' });
            setShowForm(false);
            fetchRules();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Could not save. Please try again.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog('Delete this weekly day off?', { tone: 'danger', confirmText: 'Delete' })) return;
        try {
            await api.delete(`/config/weekoff/${id}`);
            setMessage({ type: 'success', text: 'Weekly day off deleted.' });
            fetchRules();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Could not delete. Please try again.' });
        }
    };

    const handleReset = () => {
        setSelectedDay(6);
        setSelectedWeek(null);
        setSelectedClass('');
        const resolved = resolveCurrentBranch(branches);
        if (resolved) setSelectedBranch(resolved.id);
        setMessage(null);
    };

    const ruleColumns: Column<WeekoffRule>[] = [
        { key: 'title', header: 'Day off', primary: true, render: r => <span className="font-medium text-slate-900">{r.title}</span> },
        { key: 'branch_name', header: 'Branch', secondary: true },
        {
            key: 'actions', header: '', hideOnMobile: true, align: 'right', render: r => (
                <button type="button" onClick={() => handleDelete(r.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                    <Trash2 size={15} /> Delete
                </button>
            ),
        },
    ];

    const preview = `${selectedWeek === null ? 'Every' : WEEK_OPTIONS.find(o => o.value === selectedWeek)?.label?.split(' ')[0]} ${WEEKDAYS.find(d => d.value === selectedDay)?.label}${selectedWeek === null ? '' : ' of the month'}${selectedClass ? ` · Class ${classOptions.find(c => c.id === selectedClass)?.class_name}` : ' · All classes'}`;

    return (
        <div>
            <BackBar
                label="Settings"
                onBack={onBack}
                title="Weekly days off"
                hint="Days the school is closed every week, like every Sunday or the second Saturday."
                actions={
                    <button type="button" onClick={() => { handleReset(); setShowForm(true); }} className="btn-primary">
                        <Plus size={16} /> Add a weekly day off
                    </button>
                }
            />

            {message && !showForm && (
                <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <DataList
                columns={ruleColumns}
                rows={rules}
                rowKey={r => r.id}
                loading={loading}
                emptyTitle="No weekly days off yet"
                emptyHint="Tap “Add a weekly day off” to add one, for example every Sunday."
                mobileActions={r => (
                    <button type="button" onClick={() => handleDelete(r.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                        <Trash2 size={15} /> Delete
                    </button>
                )}
            />

            {showForm && (
                <Dialog
                    title="Add a weekly day off"
                    onClose={() => { setShowForm(false); setMessage(null); }}
                    footer={<>
                        <button type="button" onClick={() => { setShowForm(false); setMessage(null); }} className="btn-secondary">Back</button>
                        <button type="button" onClick={handleSave} disabled={saving || !selectedBranch} className="btn-primary">
                            {saving ? 'Saving…' : 'Save day off'}
                        </button>
                    </>}
                >
                    {message && message.type === 'error' && <Alert tone="error">{message.text}</Alert>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Branch" htmlFor="wo-branch" required>
                            <select id="wo-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(Number(e.target.value))} className="input">
                                <option value={0}>Choose branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Class" htmlFor="wo-class">
                            <select id="wo-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : '')} className="input">
                                <option value="">All classes</option>
                                {classOptions.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Field label="Day" htmlFor="wo-day">
                        <select id="wo-day" value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} className="input">
                            {WEEKDAYS.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </Field>

                    <fieldset>
                        <legend className="block text-sm font-medium text-slate-800 mb-1.5">Which weeks?</legend>
                        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {WEEK_OPTIONS.map(opt => (
                                <label key={String(opt.value)} className="flex items-center gap-3 px-4 min-h-[44px] cursor-pointer">
                                    <input
                                        type="radio"
                                        name="week_rule"
                                        checked={selectedWeek === opt.value}
                                        onChange={() => setSelectedWeek(opt.value)}
                                        className="w-5 h-5 accent-brand-600"
                                    />
                                    <span className="text-[15px] text-slate-800">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                        <span className="text-sm text-brand-700">School will be closed on:</span>
                        <p className="text-[15px] font-semibold text-brand-800 mt-0.5">{preview}</p>
                    </div>
                </Dialog>
            )}
        </div>
    );
};

// ================================================================
// HOLIDAY POLICY COMPONENT
// ================================================================
const HolidayPolicy: React.FC<{ branches: BranchOption[]; onBack: () => void }> = ({ branches, onBack }) => {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [holidayFor, setHolidayFor] = useState('All');
    const [description, setDescription] = useState('');
    const [displayOrder, setDisplayOrder] = useState<number | ''>('');
    const [selectedBranch, setSelectedBranch] = useState<number>(0);
    const [selectedClass, setSelectedClass] = useState<number | ''>(''); // '' = All Classes
    const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
    const [showForm, setShowForm] = useState(false);

    // Auto-select current branch on mount
    useEffect(() => {
        const resolved = resolveCurrentBranch(branches);
        if (resolved) setSelectedBranch(resolved.id);
    }, [branches]);

    // Fetch classes when branch changes
    useEffect(() => {
        if (!selectedBranch) {
            setClassOptions([]);
            return;
        }
        const branchObj = branches.find(b => b.id === selectedBranch);
        const branchName = branchObj?.branch_name || '';
        api.get('/classes', { params: { branch: branchName } })
            .then(res => setClassOptions(res.data?.classes || []))
            .catch(err => {
                console.error('Error fetching classes:', err);
                setClassOptions([]);
            });
    }, [selectedBranch, branches]);

    const fetchHolidays = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/config/holiday');
            setHolidays(res.data || []);
        } catch (err: any) {
            console.error('Error fetching holidays:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const handleSave = async () => {
        if (!title.trim() || !startDate || !endDate || !selectedBranch) {
            setMessage({ type: 'error', text: 'Please fill in the holiday name, first day, last day and branch.' });
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                title: title.trim(),
                start_date: startDate,
                end_date: endDate,
                holiday_for: holidayFor,
                description: description.trim(),
                display_order: displayOrder || null,
                branch_id: selectedBranch,
                class_id: selectedClass || null,
            };

            if (editingId) {
                await api.put(`/config/holiday/${editingId}`, payload);
                setMessage({ type: 'success', text: 'Holiday updated successfully!' });
                notify.success('Holiday saved.');
            } else {
                await api.post('/config/holiday', payload);
                setMessage({ type: 'success', text: 'Holiday created successfully!' });
                notify.success('Holiday added.');
            }
            handleReset();
            setShowForm(false);
            fetchHolidays();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Could not save the holiday. Please try again.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (h: Holiday) => {
        setEditingId(h.id);
        setTitle(h.title);
        setStartDate(h.start_date);
        setEndDate(h.end_date);
        setHolidayFor(h.holiday_for);
        setDescription(h.description || '');
        setDisplayOrder(h.display_order || '');
        setSelectedBranch(h.branch_id);
        setSelectedClass(h.class_id || '');
        setMessage(null);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog('Delete this holiday?', { tone: 'danger', confirmText: 'Delete' })) return;
        try {
            await api.delete(`/config/holiday/${id}`);
            setMessage({ type: 'success', text: 'Holiday deleted.' });
            fetchHolidays();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Could not delete. Please try again.' });
        }
    };

    const handleReset = () => {
        setEditingId(null);
        setTitle('');
        setStartDate('');
        setEndDate('');
        setHolidayFor('All');
        setDescription('');
        setDisplayOrder('');
        setSelectedClass('');
        const resolved = resolveCurrentBranch(branches);
        if (resolved) setSelectedBranch(resolved.id);
        setMessage(null);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        // Parse YYYY-MM-DD string into local time to avoid UTC shift
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const forLabel = (f: string) => (f === 'All' ? 'Students and staff' : f === 'StudentOnly' ? 'Students only' : 'Staff only');
    const forTone = (f: string) => (f === 'All' ? 'brand' : f === 'StudentOnly' ? 'success' : 'warning') as 'brand' | 'success' | 'warning';
    const dateText = (h: Holiday) => h.start_date !== h.end_date ? `${formatDate(h.start_date)} – ${formatDate(h.end_date)}` : formatDate(h.start_date);
    const closeForm = () => { setShowForm(false); handleReset(); };
    const missing = !selectedBranch ? 'Choose a branch.' : !title.trim() ? 'Type the holiday name.' : !startDate ? 'Choose the first day.' : !endDate ? 'Choose the last day.' : '';

    const rowActions = (h: Holiday) => (
        <>
            <button type="button" onClick={() => handleEdit(h)} className="btn-ghost btn-sm text-brand-700">
                <Pencil size={15} /> Edit
            </button>
            <button type="button" onClick={() => handleDelete(h.id)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> Delete
            </button>
        </>
    );

    const holidayColumns: Column<Holiday>[] = [
        {
            key: 'title', header: 'Holiday', primary: true, render: h => (
                <div>
                    <div className="font-medium text-slate-900">{h.title}</div>
                    {h.description && <div className="text-sm font-normal text-slate-500 mt-0.5">{h.description}</div>}
                </div>
            ),
        },
        { key: 'date', header: 'Date', secondary: true, render: h => dateText(h) },
        { key: 'for', header: 'For', render: h => <Badge tone={forTone(h.holiday_for)}>{forLabel(h.holiday_for)}</Badge> },
        { key: 'actions', header: '', hideOnMobile: true, align: 'right', render: h => <div className="flex justify-end gap-1">{rowActions(h)}</div> },
    ];

    return (
        <div>
            <BackBar
                label="Settings"
                onBack={onBack}
                title="Holidays"
                hint="Days the school is closed, like festivals and vacations."
                actions={
                    <button type="button" onClick={() => { handleReset(); setShowForm(true); }} className="btn-primary">
                        <Plus size={16} /> Add a holiday
                    </button>
                }
            />

            {message && !showForm && (
                <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <DataList
                columns={holidayColumns}
                rows={holidays}
                rowKey={h => h.id}
                loading={loading}
                emptyTitle="No holidays yet"
                emptyHint="Tap “Add a holiday” to add the first one."
                mobileActions={rowActions}
            />

            {showForm && (
                <Dialog
                    title={editingId ? 'Change holiday' : 'Add a holiday'}
                    onClose={closeForm}
                    footer={<>
                        {missing && <p className="w-full text-sm text-slate-600 sm:flex-1 sm:w-auto">{missing}</p>}
                        <button type="button" onClick={closeForm} className="btn-secondary">Back</button>
                        <button type="button" onClick={handleSave} disabled={saving || !!missing} className="btn-primary">
                            {saving ? 'Saving…' : 'Save holiday'}
                        </button>
                    </>}
                >
                    {message && message.type === 'error' && <Alert tone="error">{message.text}</Alert>}

                    <Field label="Holiday name" htmlFor="hol-title" required>
                        <input
                            id="hol-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Republic Day, Eid"
                            className="input"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="First day" htmlFor="hol-start" required>
                            <input
                                id="hol-start"
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (!endDate) setEndDate(e.target.value);
                                }}
                                className="input"
                            />
                        </Field>
                        <Field label="Last day" htmlFor="hol-end" required hint="Same as the first day for a one-day holiday.">
                            <input
                                id="hol-end"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate}
                                className="input"
                            />
                        </Field>
                    </div>

                    <Field label="Who gets the holiday?" htmlFor="hol-for">
                        <select id="hol-for" value={holidayFor} onChange={(e) => setHolidayFor(e.target.value)} className="input">
                            <option value="All">Students and staff</option>
                            <option value="StudentOnly">Students only</option>
                            <option value="StaffOnly">Staff only</option>
                        </select>
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Branch" htmlFor="hol-branch" required>
                            <select id="hol-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(Number(e.target.value))} className="input">
                                <option value={0}>Choose branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Class" htmlFor="hol-class">
                            <select id="hol-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : '')} className="input">
                                <option value="">All classes</option>
                                {classOptions.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <Field label="Note (optional)" htmlFor="hol-desc">
                        <textarea
                            id="hol-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="input resize-none"
                        />
                    </Field>

                    <Field label="Position in list (optional)" htmlFor="hol-order" hint="Lower numbers are shown first.">
                        <input
                            id="hol-order"
                            type="number"
                            inputMode="numeric"
                            value={displayOrder}
                            onChange={(e) => setDisplayOrder(e.target.value ? Number(e.target.value) : '')}
                            className="input"
                        />
                    </Field>
                </Dialog>
            )}
        </div>
    );
};

// ================================================================
// MAIN CONFIGURATION COMPONENT
// ================================================================
type ConfigSection = 'weekoff' | 'holiday';

const Configuration: React.FC<ConfigurationProps> = () => {
    const [active, setActive] = useState<ConfigSection | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);

    // Fetch branches on mount
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get('/branches');
                setBranches(res.data?.branches || []);
            } catch (err) {
                console.error('Error fetching branches:', err);
            }
        };
        fetchBranches();
    }, []);

    const back = () => setActive(null);

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-5 sm:py-6">
                {active === null && (
                    <>
                        <PageHeader
                            eyebrow="Setup"
                            title="School settings"
                            subtitle="Choose what you want to change."
                            icon={<Settings2 className="w-6 h-6" />}
                        />
                        <div className="space-y-6">
                            <ChoiceList
                                title="Days off"
                                choices={[
                                    { key: 'weekoff', title: 'Weekly days off', hint: 'For example every Sunday, or the second Saturday', icon: <Clock className="w-5 h-5" />, onClick: () => setActive('weekoff') },
                                    { key: 'holiday', title: 'Holidays', hint: 'Festivals, vacations and other closed days', icon: <Calendar className="w-5 h-5" />, onClick: () => setActive('holiday') },
                                ]}
                            />
                            <ChoiceList
                                title="Staff lists"
                                choices={[
                                    { key: 'departments', title: 'Departments', hint: 'Groups of staff, like Science or Office', icon: <Building2 className="w-5 h-5" />, comingSoon: true },
                                    { key: 'designations', title: 'Job titles', hint: 'Like Teacher, Clerk or Principal', icon: <BadgeCheck className="w-5 h-5" />, comingSoon: true },
                                ]}
                            />
                            <ChoiceList
                                title="Other settings"
                                choices={[
                                    { key: 'settings', title: 'General settings', hint: 'Other options for the whole school', icon: <SlidersHorizontal className="w-5 h-5" />, comingSoon: true },
                                    { key: 'academic-year', title: 'School years', hint: 'Start and end of each school year', icon: <CalendarRange className="w-5 h-5" />, comingSoon: true },
                                    { key: 'export-data', title: 'Bring data from last year', hint: 'Copy data from an old school year', icon: <Archive className="w-5 h-5" />, comingSoon: true },
                                ]}
                            />
                        </div>
                    </>
                )}

                {active === 'weekoff' && <WeekoffPolicy branches={branches} onBack={back} />}
                {active === 'holiday' && <HolidayPolicy branches={branches} onBack={back} />}
            </div>
        </div>
    );
};

export default Configuration;
