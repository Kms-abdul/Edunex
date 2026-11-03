import React, { useState, useEffect, useCallback } from 'react';
import { Page } from '../App';
import { ChevronDown, Trash2, Edit2, Plus, RotateCcw, Calendar, Clock, Settings2 } from 'lucide-react';
import api from '../api';
import { confirmDialog } from './ui/feedback';
import { PageHeader, Alert, LoadingState, EmptyState } from './ui';

interface ConfigurationProps {
    navigateTo?: (page: Page) => void;
}

interface DropdownItem {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
}

interface DropdownProps {
    title: string;
    items: DropdownItem[];
    isActive?: boolean;
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
    { value: null, label: 'Every Week' },
    { value: 1, label: 'First Week' },
    { value: 2, label: 'Second Week' },
    { value: 3, label: 'Third Week' },
    { value: 4, label: 'Fourth Week' },
    { value: 5, label: 'Fifth Week' },
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

const NavDropdown: React.FC<DropdownProps> = ({ title, items, isActive }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button className={`btn-primary ${isActive ? 'bg-brand-700' : ''}`}>
                {title} <ChevronDown size={14} />
            </button>

            {isOpen && (
                <div className="menu left-0 z-50 w-48">
                    {items.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                if (!item.disabled && item.onClick) {
                                    item.onClick();
                                    setIsOpen(false);
                                }
                            }}
                            disabled={item.disabled}
                            className={`menu-item ${item.disabled ? "text-slate-400 cursor-not-allowed hover:bg-transparent hover:text-slate-400" : "" }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ================================================================
// WEEKOFF POLICY COMPONENT
// ================================================================
const WeekoffPolicy: React.FC<{ branches: BranchOption[] }> = ({ branches }) => {
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
            setMessage({ type: 'error', text: 'Please select a branch' });
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
            setMessage({ type: 'success', text: 'Weekoff rule created successfully!' });
            fetchRules();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to create rule';
            setMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog('Are you sure you want to delete this weekoff rule?')) return;
        try {
            await api.delete(`/config/weekoff/${id}`);
            setMessage({ type: 'success', text: 'Rule deleted' });
            fetchRules();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to delete rule' });
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

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Clock className="text-brand-600" size={22} />
                <h2 className="text-base font-semibold text-slate-900">Week-off Policy</h2>
                <span className="badge-brand">
                    {rules.length} Rules
                </span>
            </div>

            {message && (
                <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Add New Weekoff Rule</h3>

                    <div className="space-y-4">
                        {/* Branch */}
                        <div>
                            <label className="label">Branch</label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(Number(e.target.value))}
                                className="input"
                            >
                                <option value={0}>--Select Branch--</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Class */}
                        <div>
                            <label className="label">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : '')}
                                className="input"
                            >
                                <option value="">All Classes</option>
                                {classOptions.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Day */}
                        <div>
                            <label className="label">Day</label>
                            <select
                                value={selectedDay}
                                onChange={(e) => setSelectedDay(Number(e.target.value))}
                                className="input"
                            >
                                {WEEKDAYS.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Week Rule */}
                        <div>
                            <label className="label">Rule</label>
                            <div className="space-y-2">
                                {WEEK_OPTIONS.map(opt => (
                                    <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="week_rule"
                                            checked={selectedWeek === opt.value}
                                            onChange={() => setSelectedWeek(opt.value)}
                                            className="text-brand-600 focus:ring-brand-500"
                                        />
                                        <span className="text-sm text-slate-700">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                            <span className="text-xs text-brand-500 font-medium">Preview:</span>
                            <p className="text-sm font-semibold text-brand-700 mt-1">
                                {selectedWeek === null ? 'Every' : WEEK_OPTIONS.find(o => o.value === selectedWeek)?.label?.replace(' Week', '')} – {WEEKDAYS.find(d => d.value === selectedDay)?.label}
                                {selectedClass ? ` (${classOptions.find(c => c.id === selectedClass)?.class_name})` : ' (All Classes)'}
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary flex-1"
                            >
                                <Plus size={16} />
                                {saving ? 'Saving...' : 'Save Rule'}
                            </button>
                            <button
                                onClick={handleReset}
                                className="btn-secondary"
                            >
                                <RotateCcw size={16} />
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Table */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Existing Rules</h3>
                    {loading ? (
                        <LoadingState />
                    ) : rules.length === 0 ? (
                        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <EmptyState compact title="No weekoff rules configured yet" icon={<Clock size={24} />} />
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left">S.No</th>
                                        <th className="px-4 py-3 text-left">Rule Title</th>
                                        <th className="px-4 py-3 text-left">Branch</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rules.map((rule, idx) => (
                                        <tr key={rule.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{rule.title}</td>
                                            <td className="px-4 py-3 text-slate-600">{rule.branch_name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="btn-icon h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ================================================================
// HOLIDAY POLICY COMPONENT
// ================================================================
const HolidayPolicy: React.FC<{ branches: BranchOption[] }> = ({ branches }) => {
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
            setMessage({ type: 'error', text: 'Title, Start Date, End Date, and Branch are required' });
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
            } else {
                await api.post('/config/holiday', payload);
                setMessage({ type: 'success', text: 'Holiday created successfully!' });
            }
            handleReset();
            fetchHolidays();
        } catch (err: any) {
            const msg = err.response?.data?.error || 'Failed to save holiday';
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
    };

    const handleDelete = async (id: number) => {
        if (!await confirmDialog('Are you sure you want to delete this holiday?')) return;
        try {
            await api.delete(`/config/holiday/${id}`);
            setMessage({ type: 'success', text: 'Holiday deleted' });
            fetchHolidays();
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Failed to delete holiday' });
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

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <Calendar className="text-brand-600" size={22} />
                <h2 className="text-base font-semibold text-slate-900">Holiday Policy</h2>
                <span className="badge-brand">
                    {holidays.length} Holidays
                </span>
            </div>

            {message && (
                <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">
                        {editingId ? 'Edit Holiday' : 'Add New Holiday'}
                    </h3>

                    <div className="space-y-4">
                        {/* Branch */}
                        <div>
                            <label className="label">Branch</label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(Number(e.target.value))}
                                className="input"
                            >
                                <option value={0}>--Select Branch--</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Class */}
                        <div>
                            <label className="label">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : '')}
                                className="input"
                            >
                                <option value="">All Classes</option>
                                {classOptions.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="label">Holiday Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Republic Day, Eid-ul-Fitr"
                                className="input"
                            />
                        </div>

                        {/* Holiday For */}
                        <div>
                            <label className="label">Holiday For</label>
                            <select
                                value={holidayFor}
                                onChange={(e) => setHolidayFor(e.target.value)}
                                className="input"
                            >
                                <option value="All">All (Students & Staff)</option>
                                <option value="StudentOnly">Students Only</option>
                                <option value="StaffOnly">Staff Only</option>
                            </select>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Start Date *</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        if (!endDate) setEndDate(e.target.value);
                                    }}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">End Date *</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    min={startDate}
                                    className="input"
                                />
                            </div>
                        </div>

                        {/* Display Order */}
                        <div>
                            <label className="label">Display Order</label>
                            <input
                                type="number"
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(e.target.value ? Number(e.target.value) : '')}
                                placeholder="Optional ordering"
                                className="input"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="label">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description..."
                                rows={2}
                                className="input resize-none"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary flex-1"
                            >
                                <Plus size={16} />
                                {saving ? 'Saving...' : (editingId ? 'Update Holiday' : 'Save Holiday')}
                            </button>
                            <button
                                onClick={handleReset}
                                className="btn-secondary"
                            >
                                <RotateCcw size={16} />
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Table */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">Holiday Calendar</h3>
                    {loading ? (
                        <LoadingState />
                    ) : holidays.length === 0 ? (
                        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <EmptyState compact title="No holidays configured yet" icon={<Calendar size={24} />} />
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-3 py-3 text-left">S.No</th>
                                        <th className="px-3 py-3 text-left">Name</th>
                                        <th className="px-3 py-3 text-left">Date</th>
                                        <th className="px-3 py-3 text-left">For</th>
                                        <th className="px-3 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {holidays.map((h, idx) => (
                                        <tr key={h.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-3 text-slate-600">{idx + 1}</td>
                                            <td className="px-3 py-3">
                                                <div className="font-medium text-slate-800">{h.title}</div>
                                                {h.description && <div className="text-xs text-slate-400 mt-0.5">{h.description}</div>}
                                            </td>
                                            <td className="px-3 py-3 text-slate-600 text-xs">
                                                {formatDate(h.start_date)}
                                                {h.start_date !== h.end_date && (
                                                    <> – {formatDate(h.end_date)}</>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={h.holiday_for === 'All' ? 'badge-brand'
                                                    : h.holiday_for === 'StudentOnly' ? 'badge-success'
                                                        : 'badge-warning'
                                                    }>
                                                    {h.holiday_for === 'All' ? 'All' : h.holiday_for === 'StudentOnly' ? 'Students' : 'Staff'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(h)}
                                                        className="btn-icon h-8 w-8 text-brand-600 hover:bg-brand-50 hover:text-brand-700"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(h.id)}
                                                        className="btn-icon h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ================================================================
// MAIN CONFIGURATION COMPONENT
// ================================================================
const Configuration: React.FC<ConfigurationProps> = () => {
    const [activeTab, setActiveTab] = useState<string>('masters');
    const [activeMaster, setActiveMaster] = useState<string | null>(null);
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

    const handleMastersClick = (masterType: string) => {
        setActiveTab('masters');
        setActiveMaster(masterType);
    };

    return (
        <div className="min-h-full bg-slate-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
                    <PageHeader
                        eyebrow="Setup"
                        title="Configuration Management"
                        className="mb-5"
                        icon={
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        }
                        actions={<>
                            <span className="text-sm text-brand-600 cursor-pointer hover:underline mr-2">Get Help</span>
                            <NavDropdown
                                title="Masters"
                                isActive={activeTab === 'masters'}
                                items={[
                                    { label: "Departments", onClick: () => handleMastersClick("Departments") },
                                    { label: "Designations", onClick: () => handleMastersClick("Designations") },
                                    { label: "Week-off Policy", onClick: () => handleMastersClick("Week-off Policy") },
                                    { label: "Holiday Policy", onClick: () => handleMastersClick("Holiday Policy") },
                                ]}
                            />
                            <button
                                onClick={() => { setActiveTab('settings'); setActiveMaster(null); }}
                                className={activeTab === 'settings' ? 'btn-soft' : 'btn-ghost text-brand-600'}
                            >
                                Setting
                            </button>
                            <button
                                onClick={() => { setActiveTab('academic-year'); setActiveMaster(null); }}
                                className={activeTab === 'academic-year' ? 'btn-soft' : 'btn-ghost text-brand-600'}
                            >
                                Academic Year
                            </button>
                            <button
                                onClick={() => { setActiveTab('export-data'); setActiveMaster(null); }}
                                className={activeTab === 'export-data' ? 'btn-soft' : 'btn-ghost text-brand-600'}
                            >
                                Export Data From Old Academic Year
                            </button>
                        </>}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
                <div className="card min-h-[500px] p-5">

                    {/* Masters Tab */}
                    {activeTab === 'masters' && !activeMaster && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="Masters Configuration" description="Select a master from the dropdown to configure." />
                    )}

                    {activeTab === 'masters' && activeMaster === 'Week-off Policy' && (
                        <WeekoffPolicy branches={branches} />
                    )}

                    {activeTab === 'masters' && activeMaster === 'Holiday Policy' && (
                        <HolidayPolicy branches={branches} />
                    )}

                    {activeTab === 'masters' && activeMaster === 'Departments' && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="Departments" description="Department management coming soon." />
                    )}

                    {activeTab === 'masters' && activeMaster === 'Designations' && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="Designations" description="Designation management coming soon." />
                    )}

                    {/* Other Tabs */}
                    {activeTab === 'settings' && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="System Settings" description="General system configuration options will appear here." />
                    )}
                    {activeTab === 'academic-year' && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="Academic Year Settings" description="Manage academic years here." />
                    )}
                    {activeTab === 'export-data' && (
                        <EmptyState className="mt-10" icon={<Settings2 className="w-6 h-6" />} title="Export Data" description="Export data from previous academic years." />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuration;
