import React, { useState, useEffect } from 'react';
import { Calendar, Save } from 'lucide-react';
import api from '../api';
import { notify } from './ui/feedback';
import { Alert, LoadingState, ActionBar, Field, Steps } from './ui';
import { SetupIntro } from './exam-setup/shared';

const STEP_TITLES = ['Choose class and exam', 'Choose months'];

interface TestType {
    id: number;
    test_name: string;
    is_active: boolean;
}

interface MonthOption { 
    name: string;
    month: number;
    year: number;
    key: string;
}

interface ClassOption {
    id: number;
    class_name: string;
}

interface Branch {
    branch_code: string;
    branch_name: string;
}


const SetExamAttendance: React.FC = () => {
    // --- Context State ---
    const [academicYear] = useState(localStorage.getItem('academicYear') || '');
    // Removed userRole
    const [, setUserBranch] = useState('');

    // --- Selection State ---
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState('');

    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [selectedClass, setSelectedClass] = useState('');

    const [testTypes, setTestTypes] = useState<TestType[]>([]);
    const [selectedTestId, setSelectedTestId] = useState<number | null>(null);

    // --- Data Loading State ---
    const [, setLoadingBranches] = useState(false);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [loadingTests, setLoadingTests] = useState(false);

    // --- Mapping State ---
    const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
    const [loadingMapping, setLoadingMapping] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    // UI only: true when the months step is showing
    const [onMonths, setOnMonths] = useState(false);

    // --- Init ---
    // --- Init ---
    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            // Removed setUserRole
            setUserBranch(user.branch);

            fetchBranches().then((fetchedBranches) => {
                // Auto-select current branch from localStorage if available and valid
                const current = localStorage.getItem('currentBranch');

                if (current && current !== 'All' && current !== 'All Locations' && fetchedBranches) {
                    // Check if 'current' matches a branch_code OR branch_name
                    const matched = fetchedBranches.find((b: Branch) => b.branch_code === current || b.branch_name === current);
                    if (matched) {
                        setSelectedBranch(matched.branch_code);
                    } else if (fetchedBranches.length > 0) {
                        setSelectedBranch(fetchedBranches[0].branch_code);
                    }
                } else if (fetchedBranches && fetchedBranches.length > 0) {
                    setSelectedBranch(fetchedBranches[0].branch_code);
                }
            });
        }
    }, []);

    useEffect(() => {
        // Generate months for 2 full calendar years (Start & End year of academic year)
        // e.g. 2025-2026 => Jan 2025 to Dec 2026
        if (academicYear) {
            const [startYearStr, endYearStr] = academicYear.split('-');
            const startYear = parseInt(startYearStr);
            const endYear = parseInt(endYearStr);

            if (!isNaN(startYear) && !isNaN(endYear)) {
                const m: MonthOption[] = [];
                const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

                // Full Start Year (2025)
                for (let i = 1; i <= 12; i++) {
                    m.push({ name: monthNames[i], month: i, year: startYear, key: `${i}-${startYear}` });
                }

                // Full End Year (2026)
                for (let i = 1; i <= 12; i++) {
                    m.push({ name: monthNames[i], month: i, year: endYear, key: `${i}-${endYear}` });
                }
                setAvailableMonths(m);
            }
        }
    }, [academicYear]);

    useEffect(() => {
        if (selectedBranch) {
            fetchClasses();
            // Clear class and test selection when branch changes
            setSelectedClass('');
            setTestTypes([]);
            setSelectedTestId(null);
        } else {
            setClasses([]);
            setTestTypes([]);
            setSelectedClass('');
        }
    }, [selectedBranch, academicYear]);

    useEffect(() => {
        if (selectedBranch && selectedClass) {
            fetchTestsForClass();
            setSelectedTestId(null);
        } else {
            setTestTypes([]);
            setSelectedTestId(null);
        }
    }, [selectedBranch, selectedClass, academicYear]);

    useEffect(() => {
        if (selectedTestId && selectedBranch && selectedClass) {
            fetchMapping();
        } else {
            setSelectedMonths(new Set());
        }
    }, [selectedTestId, selectedBranch, selectedClass]);

    // --- Actions ---
    const fetchBranches = async () => {
        setLoadingBranches(true);
        try {
            const res = await api.get('/branches');
            const b = res.data.branches || [];
            setBranches(b);
            return b;
        } catch (error) {
            console.error("Failed to fetch branches", error);
            return [];
        } finally {
            setLoadingBranches(false);
        }
    };

    const fetchClasses = async () => {
        setLoadingClasses(true);
        try {
            const res = await api.get('/classes', { params: { branch: selectedBranch } });
            setClasses(res.data.classes || []);
        } catch (error) {
            console.error("Failed to fetch classes", error);
        } finally {
            setLoadingClasses(false);
        }
    };

    const fetchTestsForClass = async () => {
        setLoadingTests(true);
        try {
            // Use the specific endpoint that checks ClassTest assignments
            const res = await api.get('/class-tests/list', {
                params: {
                    academic_year: academicYear,
                    branch: selectedBranch,
                    class_id: selectedClass
                }
            });
            // Result is list of { test_id, test_name, ... }
            // Ensure unique tests if multiple entries (though unique constraint should prevent it)
            const uniqueTests = Array.from(new Map(res.data.map((item: any) => [item.test_id, item])).values());

            // Map to TestType interface
            const mappedTests: TestType[] = uniqueTests.map((t: any) => ({
                id: t.test_id, // ensure ID matches
                test_name: t.test_name,
                is_active: true // Assumed active if assigned
            }));

            setTestTypes(mappedTests);
        } catch (error) {
            console.error("Failed to fetch class tests", error);
            setTestTypes([]);
        } finally {
            setLoadingTests(false);
        }
    };

    const fetchMapping = async () => {
        if (!selectedTestId || !selectedBranch || !selectedClass) return;

        setLoadingMapping(true);
        setMessage(null);
        try {
            const res = await api.get('/test-attendance', {
                params: {
                    test_id: selectedTestId,
                    academic_year: academicYear,
                    branch: selectedBranch,
                    class_id: selectedClass // This is class ID
                }
            });
            const loaded = new Set<string>();
            res.data.forEach((m: any) => {
                loaded.add(`${m.month}-${m.year}`);
            });
            setSelectedMonths(loaded);
        } catch (error) {
            console.error("Failed to fetch mapping", error);
            setMessage({ type: 'error', text: "Could not load the saved months. Please try again." });
        } finally {
            setLoadingMapping(false);
        }
    };

    const handleSave = async () => {
        if (!selectedTestId || !selectedBranch || !selectedClass) return;

        setSaving(true);
        setMessage(null);

        try {
            const monthsPayload = Array.from(selectedMonths).map(key => {
                const [month, year] = key.split('-').map(Number);
                return { month, year };
            });

            await api.post('/test-attendance', {
                test_id: selectedTestId,
                academic_year: academicYear,
                branch: selectedBranch,
                class_id: selectedClass,
                months: monthsPayload
            });

            setMessage({ type: 'success', text: "Saved. These months now count for this exam." });
        } catch (error: any) {
            console.error("Save error", error);
            setMessage({ type: 'error', text: error.response?.data?.error || "Could not save. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    const toggleMonth = (key: string) => {
        const newSet = new Set(selectedMonths);

        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            if (newSet.size >= 12) {
                notify("You can choose at most 12 months. Untick one first.");
                return;
            }
            newSet.add(key);
        }
        setSelectedMonths(newSet);
    };

    const toggleAll = () => {
        // "Select All" logic with 12 months limit is tricky. 
        // For now, let's just make it "Deselect All" if not empty
        if (selectedMonths.size > 0) {
            setSelectedMonths(new Set());
        } else {
            setMessage({ type: 'error', text: 'Tick the months you want (up to 12).' });
        }
    };

    const renderYearSection = (year: number) => {
        const yearMonths = availableMonths.filter(m => m.year === year);
        if (yearMonths.length === 0) return null;

        return (
            <div key={year} className="mb-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{year}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {yearMonths.map(m => {
                        const on = selectedMonths.has(m.key);
                        return (
                            <label
                                key={m.key}
                                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-lg border cursor-pointer select-none ${on
                                    ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500 text-brand-900'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleMonth(m.key)}
                                    className="w-5 h-5 accent-brand-600 flex-shrink-0"
                                />
                                <span className="font-medium">{m.name}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        );
    };

    const branchName = branches.find(b => b.branch_code === selectedBranch)?.branch_name || selectedBranch;
    const className = classes.find(c => String(c.id) === String(selectedClass))?.class_name;
    const testName = testTypes.find(t => t.id === selectedTestId)?.test_name;
    const years = academicYear.split('-').map(y => parseInt(y)).filter(y => !isNaN(y));
    const ready = !!(selectedTestId && selectedBranch && selectedClass);
    const step = ready && onMonths ? 1 : 0;

    const intro = (
        <SetupIntro
            title="Exam attendance"
            context={[academicYear ? `Year ${academicYear}` : null, branchName || null]}
        >
            Choose which months of attendance count for an exam. This attendance is shown on the report card.
        </SetupIntro>
    );

    /* Step 1: class and exam */
    if (step === 0) {
        return (
            <div className="">
                {intro}
                <Steps steps={STEP_TITLES} current={0} className="mb-4" />
                <div className="card p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Class" htmlFor="sea-class">
                            <select
                                id="sea-class"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="input"
                                disabled={!selectedBranch || loadingClasses}
                            >
                                <option value="">{loadingClasses ? 'Loading…' : 'Choose a class'}</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                        </Field>

                        <Field
                            label="Exam"
                            htmlFor="sea-test"
                            hint={selectedClass && !loadingTests && testTypes.length === 0 ? 'This class has no exams yet. Add one in "Add an exam to classes".' : undefined}
                        >
                            <select
                                id="sea-test"
                                value={selectedTestId || ''}
                                onChange={(e) => setSelectedTestId(Number(e.target.value) || null)}
                                className="input"
                                disabled={!selectedClass || loadingTests}
                            >
                                <option value="">{!selectedClass ? 'Choose a class first' : loadingTests ? 'Loading…' : 'Choose an exam'}</option>
                                {testTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.test_name}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </div>
                <ActionBar note={!selectedClass ? 'Choose a class first' : !selectedTestId ? 'Choose an exam' : undefined}>
                    <button type="button" className="btn-primary btn-lg" disabled={!ready} onClick={() => { setMessage(null); setOnMonths(true); }}>
                        Choose months
                    </button>
                </ActionBar>
            </div>
        );
    }

    /* Step 2: months */
    return (
        <div className="">
            {intro}
            <Steps steps={STEP_TITLES} current={1} onJump={() => setOnMonths(false)} className="mb-4" />

            <div className="card p-4 mb-4 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 break-words">{testName || 'Exam'} · Class {className || ''}</p>
                    <p className="text-sm text-slate-600">Choose up to 12 months{years.length === 2 ? ` between January ${years[0]} and December ${years[1]}` : ''}.</p>
                </div>
                <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => setOnMonths(false)}>Change</button>
            </div>

            {message && (
                <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4" onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <div className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-base font-semibold text-slate-900" aria-live="polite">{selectedMonths.size} of 12 months chosen</p>
                    {selectedMonths.size > 0 && (
                        <button type="button" onClick={toggleAll} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                            Clear all
                        </button>
                    )}
                </div>

                {loadingMapping ? (
                    <LoadingState label="Loading months…" />
                ) : (
                    <div>
                        {years.map(year => renderYearSection(year))}
                    </div>
                )}
            </div>

            <ActionBar note={selectedMonths.size === 0 && !loadingMapping ? 'Choose at least one month' : undefined}>
                <button type="button" className="btn-secondary btn-lg" onClick={() => setOnMonths(false)}>
                    Back
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loadingMapping || selectedMonths.size === 0}
                    className="btn-primary btn-lg"
                >
                    <Save size={18} /> {saving ? 'Saving…' : `Save ${selectedMonths.size} month${selectedMonths.size !== 1 ? 's' : ''}`}
                </button>
            </ActionBar>
        </div>
    );
};

export default SetExamAttendance;
