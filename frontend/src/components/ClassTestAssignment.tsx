import React, { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import api from "../api";
import { notify, confirmDialog } from './ui/feedback';
import { Alert, EmptyState, LoadingState, ActionBar } from './ui';
import { SetupIntro, GridCard, GridCheck, CopyToBranchesSheet } from './exam-setup/shared';
import type { CopyTarget } from './exam-setup/shared';

interface ClassItem {
    id: number;
    name: string;
}

interface TestType {
    id: number; 
    name: string;
}

interface Assignment { 
    class_id: number;
    test_id: number;
    test_order: number;
    status: boolean;
}

interface BranchOption {
    id: number | string;
    name: string;
    location_name: string;
}

interface AcademicYearOption {
    id: number;
    name: string;
}
const ClassTestAssignment: React.FC = () => {
    // --- Metadata State ---
    const [, setAcademicYears] = useState<AcademicYearOption[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]); // Primarily to map names if needed, or unused if strictly readonly

    // --- Selection State ---
    const [selectedYear, setSelectedYear] = useState<string>(""); // Name
    const [selectedBranch, setSelectedBranch] = useState<string>(""); // Name
    const [selectedLocation, setSelectedLocation] = useState<string>(""); // Captured from branch selection logic
    const [isAllBranchesMode, setIsAllBranchesMode] = useState(false);

    // --- Matrix Data State ---
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [testTypes, setTestTypes] = useState<TestType[]>([]);

    // Map: Key = `${class_id}-${test_id}` -> Assignment
    const [assignmentMap, setAssignmentMap] = useState<Map<string, Assignment>>(new Map());
    const [initialAssignmentMap, setInitialAssignmentMap] = useState<Map<string, Assignment>>(new Map());

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // --- Copy Feature State ---
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set()); // Set of "BranchName|LocationName" strings
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);

    // --- Initial Load ---
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const storedYear = localStorage.getItem("academicYear");
                const storedBranch = localStorage.getItem("currentBranch");
                const storedLocation = localStorage.getItem("currentLocation");

                // Strictly rely on Global Context
                if (storedBranch === "All Branches" || storedBranch === "All" || !storedBranch) {
                    setIsAllBranchesMode(true);
                    // Even if All Branches, we might need to load metadata to show context, but user can't create.
                    // Actually, if All Branches, we usually just show the warning and stop.
                } else {
                    setIsAllBranchesMode(false);
                    setSelectedBranch(storedBranch);
                    setSelectedLocation(storedLocation || "Hyderabad"); // Default if missing
                }

                // 2. Fetch Academic Years
                const resYears = await api.get("/org/academic-years");
                const yearsList = resYears.data.academic_years || resYears.data || [];
                setAcademicYears(yearsList.map((y: any) => ({ id: y.id, name: y.name })));

                if (storedYear) {
                    const foundYear = yearsList.find((y: any) => y.name === storedYear);
                    if (foundYear) setSelectedYear(foundYear.name);
                    else if (yearsList.length > 0) setSelectedYear(yearsList[0].name);
                } else if (yearsList.length > 0) {
                    setSelectedYear(yearsList[0].name);
                }

                // Fetch branches solely for Copy targets (excluding current)
                const resBranches = await api.get("/branches");
                const branchList = resBranches.data.branches || resBranches.data || [];
                setBranches(branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    location_name: b.location_name || "Unknown"
                })));

            } catch (err) {
                console.error("Error loading metadata", err);
            }
        };
        fetchMetadata();
    }, []);


    // --- Fetch Matrix Data ---
    const fetchMatrix = async () => {
        if (!selectedYear || !selectedBranch || isAllBranchesMode) return;
        setLoading(true);
        try {
            const res = await api.get("/class-tests/matrix", {
                params: {
                    academic_year: selectedYear,
                    branch: selectedBranch
                }
            });

            setClasses(res.data.classes);
            setTestTypes(res.data.test_types);

            const newMap = new Map<string, Assignment>();
            res.data.assignments.forEach((a: Assignment) => {
                newMap.set(`${a.class_id}-${a.test_id}`, a);
            });
            setAssignmentMap(newMap);
            // Deep copy for initial state tracking
            const initialMap = new Map<string, Assignment>();
            res.data.assignments.forEach((a: Assignment) => {
                initialMap.set(`${a.class_id}-${a.test_id}`, { ...a });
            });
            setInitialAssignmentMap(initialMap);

        } catch (e) {
            console.error("Error fetching matrix", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatrix();
    }, [selectedYear, selectedBranch, isAllBranchesMode]);


    // --- Handlers ---

    // Helper: Get next available order for a class
    const getNextOrder = (classId: number, currentMap: Map<string, Assignment>) => {
        let maxOrder = 0;
        for (const [key, val] of currentMap.entries()) {
            if (key.startsWith(`${classId}-`) && val.status) {
                if (val.test_order > maxOrder) maxOrder = val.test_order;
            }
        }
        return maxOrder + 1;
    };

    const handleCheck = (classId: number, testId: number, checked: boolean) => {
        const key = `${classId}-${testId}`;
        const newMap = new Map(assignmentMap);

        if (checked) {
            // Assigning
            const existing = newMap.get(key);
            if (existing) {
                newMap.set(key, { ...existing, status: true });
            } else {
                const nextOrder = getNextOrder(classId, newMap);
                newMap.set(key, {
                    class_id: classId,
                    test_id: testId,
                    test_order: nextOrder,
                    status: true
                });
            }
        } else {
            // Unassigning
            const existing = newMap.get(key);
            if (existing) {
                newMap.set(key, { ...existing, status: false });
            }
        }
        setAssignmentMap(newMap);
    };

    // Toggle Column (Test Type)
    const toggleColumn = (testId: number) => {
        const newMap = new Map(assignmentMap);
        let allChecked = true;

        // Check current state
        for (const cls of classes) {
            const key = `${cls.id}-${testId}`;
            const entry = newMap.get(key);
            if (!entry || !entry.status) {
                allChecked = false;
                break;
            }
        }

        // Toggle
        classes.forEach(cls => {
            const key = `${cls.id}-${testId}`;
            if (allChecked) {
                // Uncheck all
                const existing = newMap.get(key);
                if (existing) newMap.set(key, { ...existing, status: false });
            } else {
                // Check all
                const existing = newMap.get(key);
                if (existing) {
                    if (!existing.status) newMap.set(key, { ...existing, status: true });
                } else {
                    const nextOrder = getNextOrder(cls.id, newMap);
                    newMap.set(key, {
                        class_id: cls.id,
                        test_id: testId,
                        test_order: nextOrder,
                        status: true
                    });
                }
            }
        });
        setAssignmentMap(newMap);
    };

    // Toggle Row (Class)
    const toggleRow = (classId: number) => {
        const newMap = new Map(assignmentMap);
        let allChecked = true;

        for (const t of testTypes) {
            const key = `${classId}-${t.id}`;
            const entry = newMap.get(key);
            if (!entry || !entry.status) {
                allChecked = false;
                break;
            }
        }

        testTypes.forEach(t => {
            const key = `${classId}-${t.id}`;
            if (allChecked) {
                // Uncheck all
                const existing = newMap.get(key);
                if (existing) newMap.set(key, { ...existing, status: false });
            } else {
                // Check all
                const existing = newMap.get(key);
                if (existing) {
                    if (!existing.status) newMap.set(key, { ...existing, status: true });
                } else {
                    // Need to be careful about getNextOrder in loop. 
                    // Since we are modifying newMap in place, getNextOrder should see previous additions if we calculate correctly.
                    // But getNextOrder iterates newMap. So it should work!
                    const nextOrder = getNextOrder(classId, newMap);
                    newMap.set(key, {
                        class_id: classId,
                        test_id: t.id,
                        test_order: nextOrder,
                        status: true
                    });
                }
            }
        });
        setAssignmentMap(newMap);
    };


    const handleOrderChange = (classId: number, testId: number, order: number) => {
        const key = `${classId}-${testId}`;
        const newMap = new Map(assignmentMap);
        const existing = newMap.get(key);
        if (existing) {
            newMap.set(key, { ...existing, test_order: order });
            setAssignmentMap(newMap);
        }
    };

    const handleSave = async () => {
        if (!selectedYear || !selectedBranch) return;
        setSaving(true);

        const promises: Promise<any>[] = [];

        // Check for duplicate orders in a class
        for (const cls of classes) {
            const orders = new Set<number>();
            for (const test of testTypes) {
                const key = `${cls.id}-${test.id}`;
                const item = assignmentMap.get(key);
                if (item && item.status) {
                    if (orders.has(item.test_order)) {
                        notify(`Class ${cls.name} has two exams at position ${item.test_order}. Give each exam a different number, then save.`);
                        setSaving(false);
                        return;
                    }
                    orders.add(item.test_order);
                }
            }
        }

        // Identify changes
        assignmentMap.forEach((val, key) => {
            const initial = initialAssignmentMap.get(key);
            let hasChanged = false;
            if (!initial) {
                // New item
                if (val.status) hasChanged = true;
            } else {
                // Existing item
                if (initial.status !== val.status || initial.test_order !== val.test_order) {
                    hasChanged = true;
                }
            }

            if (hasChanged) {
                promises.push(api.post('/class-tests/assign', {
                    academic_year: selectedYear,
                    branch: selectedBranch,
                    location: selectedLocation,
                    class_id: val.class_id,
                    test_id: val.test_id,
                    test_order: val.test_order,
                    status: val.status
                }));
            }
        });

        try {
            await Promise.all(promises);
            notify.success("Exams for each class saved");
            fetchMatrix(); // Refresh
        } catch (e: any) {
            console.error("Save error", e);
            notify.error("Could not save: " + (e.response?.data?.error || e.message));
        } finally {
            setSaving(false);
        }
    };

    // --- Copy Logic ---
    const branchesByLocation: { [key: string]: BranchOption[] } = {};
    branches.filter(b => b.name !== selectedBranch && b.name !== 'All Branches').forEach(b => {
        if (!branchesByLocation[b.location_name]) branchesByLocation[b.location_name] = [];
        branchesByLocation[b.location_name].push(b);
    });

    const handleCopy = async () => {
        if (copyTargets.size === 0) return notify("Choose at least one branch to copy to.");
        if (!await confirmDialog(`Copy exams for each class to ${copyTargets.size} branch${copyTargets.size !== 1 ? "es" : ""}?`)) return;

        setCopying(true);
        try {
            for (const targetKey of Array.from(copyTargets)) {
                // targetKey is "BranchName|LocationName" - we need both
                const [targetBranch, targetLocation] = targetKey.split('|');

                await api.post('/class-tests/copy', {
                    from_branch: selectedBranch,
                    to_branch: targetBranch,
                    to_location: targetLocation,
                    academic_year: selectedYear
                });
            }
            notify.success("Copied to the other branches");
            setIsCopyDropdownOpen(false);
            setCopyTargets(new Set());
        } catch (e: any) {
            notify.error("Could not copy: " + e.message);
        } finally {
            setCopying(false);
        }
    };

    if (isAllBranchesMode) {
        return (
            <div className="">
                <SetupIntro title="Exams for each class" />
                <Alert tone="warning" title="Choose one branch first">
                    You are looking at all branches. Choose one branch at the top of the screen to add exams to its classes.
                </Alert>
            </div>
        );
    }

    // How many boxes or order numbers differ from what is saved (same test as handleSave)
    let changeCount = 0;
    assignmentMap.forEach((val, key) => {
        const initial = initialAssignmentMap.get(key);
        if (!initial) { if (val.status) changeCount++; }
        else if (initial.status !== val.status || initial.test_order !== val.test_order) changeCount++;
    });

    const copyGroups: Record<string, CopyTarget[]> = {};
    Object.keys(branchesByLocation).forEach(loc => {
        copyGroups[loc] = branchesByLocation[loc].map(b => ({ key: `${b.name}|${b.location_name}`, label: b.name }));
    });

    const isOn = (classId: number, testId: number) => !!assignmentMap.get(`${classId}-${testId}`)?.status;
    const allInColumn = (testId: number) => classes.length > 0 && classes.every(c => isOn(c.id, testId));
    const allInRow = (classId: number) => testTypes.length > 0 && testTypes.every(t => isOn(classId, t.id));
    const allBtn = (on: boolean) => `h-9 min-w-[44px] px-2 rounded-md text-xs font-medium ${on ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`;

    return (
        <div>
            <SetupIntro
                title="Exams for each class"
                context={[selectedYear ? `Year ${selectedYear}` : 'Loading year…', selectedBranch]}
                action={(
                    <button type="button" onClick={() => setIsCopyDropdownOpen(true)} className="btn-secondary">
                        <Copy className="w-4 h-4" /> Copy to other branches
                    </button>
                )}
            >
                Tick the exams each class writes. The small number next to a tick is the exam's position for that class (1 = first).
            </SetupIntro>

            {loading ? (
                <div className="card"><LoadingState label="Loading exams…" /></div>
            ) : classes.length === 0 ? (
                <div className="card"><EmptyState compact title="Nothing to show" description="No classes or exam names were found for this year and branch." /></div>
            ) : (
                <GridCard>
                    <table className="border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left min-w-[90px]">Class</th>
                                {testTypes.map(t => (
                                    <th key={t.id} className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center min-w-[104px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-semibold text-slate-800 leading-tight">{t.name}</span>
                                            <button
                                                type="button"
                                                className={allBtn(allInColumn(t.id))}
                                                aria-label={`Tick or untick ${t.name} for all classes`}
                                                onClick={() => toggleColumn(t.id)}
                                            >
                                                All
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                <th className="sticky top-0 z-10 bg-slate-50 border-b border-l border-slate-200 px-2 py-2 text-center min-w-[72px]">Every exam</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classes.map(cls => (
                                <tr key={cls.id} className="hover:bg-slate-50/60">
                                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-1 font-semibold text-slate-900 whitespace-nowrap">{cls.name}</td>
                                    {testTypes.map(t => {
                                        const key = `${cls.id}-${t.id}`;
                                        const entry = assignmentMap.get(key);
                                        const isChecked = entry?.status || false;
                                        const order = entry?.test_order;

                                        return (
                                            <td key={t.id} className="border-b border-slate-100 p-0.5 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <GridCheck
                                                        checked={isChecked}
                                                        onChange={checked => handleCheck(cls.id, t.id, checked)}
                                                        label={`${t.name} for class ${cls.name}`}
                                                    />
                                                    {isChecked && (
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            aria-label={`Position of ${t.name} for class ${cls.name}`}
                                                            value={order || ''}
                                                            onChange={e => handleOrderChange(cls.id, t.id, parseInt(e.target.value) || 0)}
                                                            className="input h-9 w-11 px-1 py-1 text-center no-spinner"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="border-b border-l border-slate-100 p-1 text-center">
                                        <button
                                            type="button"
                                            className={allBtn(allInRow(cls.id))}
                                            aria-label={`Tick or untick every exam for class ${cls.name}`}
                                            onClick={() => toggleRow(cls.id)}
                                        >
                                            All
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </GridCard>
            )}

            <ActionBar note={changeCount > 0 ? `${changeCount} change${changeCount !== 1 ? 's' : ''} not saved yet` : 'No changes yet. Tick or untick boxes above.'}>
                <button
                    type="button"
                    onClick={() => fetchMatrix()}
                    disabled={saving || changeCount === 0}
                    className="btn-secondary btn-lg"
                >
                    Undo changes
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || changeCount === 0}
                    className="btn-primary btn-lg"
                >
                    {saving ? 'Saving…' : `Save changes (${changeCount})`}
                </button>
            </ActionBar>

            <CopyToBranchesSheet
                open={isCopyDropdownOpen}
                onClose={() => setIsCopyDropdownOpen(false)}
                what="exams for each class"
                groups={copyGroups}
                selected={copyTargets}
                onToggle={key => {
                    const next = new Set(copyTargets);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    setCopyTargets(next);
                }}
                onCopy={handleCopy}
                copying={copying}
                note={changeCount > 0 ? <span className="text-amber-700">You have changes that are not saved. Save them first, or they will not be copied.</span> : undefined}
            />
        </div>
    );
};

export default ClassTestAssignment;
