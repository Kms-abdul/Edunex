import React, { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import api from "../api";
import { canWrite } from "../utils/permissions";
import { notify, confirmDialog } from './ui/feedback';
import { EmptyState, LoadingState, ActionBar, Field } from './ui';
import { SetupIntro, GridCard, GridCheck, Choice, CopyToBranchesSheet } from './exam-setup/shared';
import type { CopyTarget } from './exam-setup/shared';

interface Option {
    id: number | string;
    name: string;
}

interface BranchOption extends Option {
    location_name: string;
} 

interface Subject {
    id: number;
    name: string;
    type: string; // 'Academic' or 'Deeniyath' 
}

interface ClassItem {
    id: number;
    name: string;
}

const ClassSubjectAssignment: React.FC = () => {
    // Dropdown Data
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [academicYears, setAcademicYears] = useState<Option[]>([]);

    // Selections
    const [selectedBranch, setSelectedBranch] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [selectedSubjectType, setSelectedSubjectType] = useState<string>("Academic");

    // Matrix Data: map of "classId-subjectId" -> boolean
    const [assignments, setAssignments] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Copy Feature State
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    // Initial Load
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                // Get user from localStorage
                const user = JSON.parse(localStorage.getItem('user') || '{}');

                // Auto-populate from Header (LocalStorage)
                const storedYear = localStorage.getItem("academicYear");
                let storedBranch = localStorage.getItem("currentBranch");

                // Fallback: If no storedBranch but user has a branch, use user.branch
                if (!storedBranch && user.branch) {
                    storedBranch = user.branch;
                }

                // Fetch Classes
                const resClasses = await api.get("/classes");
                const classList = resClasses.data.classes || resClasses.data || [];
                setClasses(classList.map((c: any) => ({ id: c.id, name: c.class_name })));



                // Fetch Branches (And Filter based on Context)
                const resBranches = await api.get("/branches");
                const branchList = resBranches.data.branches || resBranches.data || [];

                let formattedBranches: BranchOption[] = Array.isArray(branchList) ? branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    branch_name: b.branch_name,
                    branch_code: b.branch_code,
                    location_name: b.location_name || "Unknown Location"
                })) : [];

                // Check user role
                const isAdmin = canWrite(user, 'academic.management.class-subject-assignment');

                // Find the branch that matches storedBranch from Header
                const matchedBranch = formattedBranches.find((b: any) =>
                    b.name === storedBranch ||
                    b.branch_name === storedBranch ||
                    b.branch_code === storedBranch
                );

                if (isAdmin) {
                    // Admin: Show All option + all branches
                    // We keep 'All' for the main dropdown, but for Copy destinations we exclude 'All'
                    const allOption = {
                        id: "All",
                        name: "All Branches",
                        branch_name: "All Branches",
                        branch_code: "ALL",
                        location_name: "Global"
                    };
                    setBranches([allOption, ...formattedBranches]);

                    if (storedBranch === "All" || storedBranch === "All Branches") {
                        setSelectedBranch("All");
                    } else if (matchedBranch) {
                        setSelectedBranch(String(matchedBranch.id));
                    } else {
                        setSelectedBranch("All");
                    }
                } else {
                    // Non-Admin: Show only their branch
                    if (matchedBranch) {
                        setBranches([matchedBranch]);
                        setSelectedBranch(String(matchedBranch.id));
                    } else {
                        console.warn("User branch not found in branch list:", storedBranch);
                        setBranches(formattedBranches);
                        if (formattedBranches.length > 0) {
                            setSelectedBranch(String(formattedBranches[0].id));
                        }
                    }
                }

                // Academic Years
                const resAcademicYears = await api.get("/org/academic-years");
                const academicYearsList = resAcademicYears.data.academic_years || resAcademicYears.data || [];
                setAcademicYears(academicYearsList.map((y: any) => ({ id: y.id, name: y.name })));

                if (storedYear) {
                    const foundYear = academicYearsList.find((y: any) => y.name.trim() === storedYear.trim());
                    if (foundYear) {
                        setSelectedYear(foundYear.id.toString());
                    } else if (academicYearsList.length > 0) {
                        setSelectedYear(academicYearsList[0].id.toString());
                    }
                } else if (academicYearsList.length > 0) {
                    setSelectedYear(academicYearsList[0].id.toString());
                }
            } catch (err) {
                console.error("Error loading metadata", err);
            }
        };
        fetchMetadata();
    }, []);

    // Fetch Subjects when Academic Year changes
    useEffect(() => {
        const fetchSubjects = async () => {
            if (!selectedYear) {
                setSubjects([]);
                return;
            }

            // Resolve Year Name
            const yearObj = academicYears.find(y => String(y.id) === String(selectedYear));
            const academicYearName = yearObj ? yearObj.name : "";

            try {
                // Fetch subjects specific to this academic year
                // Note: The backend logic creates subjects with an academic_year string.
                const resSubjects = await api.get("/academic/subjects", {
                    params: { academic_year: academicYearName }
                });

                setSubjects(resSubjects.data.map((s: any) => ({
                    id: s.id,
                    name: s.subject_name,
                    type: s.subject_type || "Academic"
                })));
            } catch (err) {
                console.error("Error loading subjects", err);
                setSubjects([]);
            }
        };

        // Only fetch if we have academic years loaded
        if (academicYears.length > 0) {
            fetchSubjects();
        }
    }, [selectedYear, academicYears]);

    // Fetch Existing Assignments for Matrix (Load Initial State)
    useEffect(() => {
        const fetchMatrixData = async () => {
            if (!selectedYear || !selectedBranch) return;

            setLoading(true);
            try {
                const res = await api.get("/academic/assigned-subjects", {
                    params: {
                        academic_year_id: selectedYear,
                        branch_id: selectedBranch === "All" ? undefined : selectedBranch
                    }
                });

                const assignmentSet = new Set<string>();
                res.data.forEach((a: any) => {
                    const subj = subjects.find(s => s.name === a.subject_name);
                    if (subj) {
                        assignmentSet.add(`${a.class_id}-${subj.id}`);
                    }
                });
                setAssignments(assignmentSet);
                setInitialAssignments(new Set(assignmentSet));

            } catch (error) {
                console.error("Failed to fetch matrix data", error);
            } finally {
                setLoading(false);
            }
        };

        if (subjects.length > 0) {
            fetchMatrixData();
        }
    }, [selectedYear, selectedBranch, subjects]);


    // Local State Toggle (Sync with local Set only)
    const handleToggle = (classId: number, subjectId: number) => {
        const key = `${classId}-${subjectId}`;
        const newSet = new Set(assignments);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setAssignments(newSet);
    };

    // Check All for a Subject Row (Horizontal)
    const handleCheckAllRow = (subjectId: number) => {
        const newSet = new Set(assignments);
        let allChecked = true;

        // Check if all visible classes are already checked
        for (const cls of classes) {
            if (!newSet.has(`${cls.id}-${subjectId}`)) {
                allChecked = false;
                break;
            }
        }

        // Toggle: If all checked, uncheck all. Else check all.
        classes.forEach(cls => {
            const key = `${cls.id}-${subjectId}`;
            if (allChecked) {
                newSet.delete(key); // Uncheck all
            } else {
                newSet.add(key); // Check all
            }
        });
        setAssignments(newSet);
    };

    // NEW: Check All for a Class Column (Vertical)
    const handleCheckAllColumn = (classId: number) => {
        const newSet = new Set(assignments);
        let allChecked = true;

        // Check if all visible subjects are already checked for this class
        for (const subj of filteredSubjects) {
            if (!newSet.has(`${classId}-${subj.id}`)) {
                allChecked = false;
                break;
            }
        }

        // Toggle: If all checked, uncheck all. Else check all.
        filteredSubjects.forEach(subj => {
            const key = `${classId}-${subj.id}`;
            if (allChecked) {
                newSet.delete(key); // Uncheck all
            } else {
                newSet.add(key); // Check all
            }
        });
        setAssignments(newSet);
    };

    // Filter Subjects by Type
    const filteredSubjects = subjects.filter(s =>
        selectedSubjectType === "All" || s.type === selectedSubjectType
    );

    // Save Changes
    const [saving, setSaving] = useState(false);
    const [initialAssignments, setInitialAssignments] = useState<Set<string>>(new Set());

    const handleSave = async () => {
        if (!selectedYear || !selectedBranch) return;
        setSaving(true);

        // Calculate Diff
        const updates: any[] = [];

        // 1. Find Added (Present in Current NOT in Initial)
        assignments.forEach(key => {
            if (!initialAssignments.has(key)) {
                const [cId, sId] = key.split('-');
                updates.push({ class_id: parseInt(cId), subject_id: parseInt(sId), action: "assign" });
            }
        });

        // 2. Find Removed (Present in Initial NOT in Current)
        initialAssignments.forEach(key => {
            if (!assignments.has(key)) {
                const [cId, sId] = key.split('-');
                updates.push({ class_id: parseInt(cId), subject_id: parseInt(sId), action: "remove" });
            }
        });

        if (updates.length === 0) {
            notify("Nothing has changed yet.");
            setSaving(false);
            return;
        }

        try {
            await api.post("/academic/manage-subject-assignment/bulk", {
                updates: updates,
                academic_year_id: selectedYear,
                branch_id: selectedBranch
            });

            // On success, update Initial to match Current
            setInitialAssignments(new Set(assignments));
            notify.success("Subjects for each class saved");
        } catch (error: any) {
            console.error("Failed to save assignments", error);
            let alertMessage = "Could not save. Please try again.";

            if (error.response && error.response.data) {
                // Check for the specific "in use by students" message
                const inUseMessages = error.response.data.details && Array.isArray(error.response.data.details)
                    ? error.response.data.details.filter((detail: string) => detail.includes("is assigned to students"))
                    : [];

                if (inUseMessages.length > 0) {
                    alertMessage = "Some students already study this subject, so it cannot be removed from the class. Remove it from those students first.";
                    // If there are multiple specific messages, append them
                } else if (error.response.data.error) {
                    alertMessage = error.response.data.error;
                }
            }
            notify(alertMessage);
            setAssignments(new Set(initialAssignments)); // Revert state to initial on save failure
        } finally {
            setSaving(false);
        }
    };

    // Copy Targets Logic
    const toggleCopyTarget = (branchId: string) => {
        const newTargets = new Set(copyTargets);
        if (newTargets.has(branchId)) {
            newTargets.delete(branchId);
        } else {
            newTargets.add(branchId);
        }
        setCopyTargets(newTargets);
    };

    // Group Available Branches by Location
    // Exclude currently selected branch and "All"
    const availableBranches = branches.filter(b => b.id !== "All" && String(b.id) !== selectedBranch);

    const branchesByLocation: { [key: string]: BranchOption[] } = {};
    availableBranches.forEach(b => {
        if (!branchesByLocation[b.location_name]) {
            branchesByLocation[b.location_name] = [];
        }
        branchesByLocation[b.location_name].push(b);
    });

    const [copying, setCopying] = useState(false);

    const handleCopy = async () => {
        if (copyTargets.size === 0) {
            notify("Choose at least one branch to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy subjects for each class to ${copyTargets.size} branch${copyTargets.size !== 1 ? "es" : ""}? Only missing subjects are added.`)) {
            return;
        }

        setCopying(true);
        try {
            await api.post("/academic/copy-subject-assignments", {
                source_branch_id: selectedBranch,
                target_branch_ids: Array.from(copyTargets),
                academic_year_id: selectedYear
            });
            notify.success("Copied to the other branches");
            setCopyTargets(new Set()); // Reset selections
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy assignments.");
        } finally {
            setCopying(false);
        }
    };

    // How many boxes differ from what is saved (for the Save button)
    let changeCount = 0;
    assignments.forEach(k => { if (!initialAssignments.has(k)) changeCount++; });
    initialAssignments.forEach(k => { if (!assignments.has(k)) changeCount++; });

    const yearName = academicYears.find(y => String(y.id) === String(selectedYear))?.name;
    const branchName = branches.find(b => String(b.id) === String(selectedBranch))?.name;
    const canCopy = !!selectedBranch && selectedBranch !== "All";

    const copyGroups: Record<string, CopyTarget[]> = {};
    Object.keys(branchesByLocation).forEach(loc => {
        copyGroups[loc] = branchesByLocation[loc].map(b => ({ key: String(b.id), label: b.name }));
    });

    const allInColumn = (classId: number) => filteredSubjects.length > 0 && filteredSubjects.every(s => assignments.has(`${classId}-${s.id}`));
    const allInRow = (subjectId: number) => classes.length > 0 && classes.every(c => assignments.has(`${c.id}-${subjectId}`));

    return (
        <div>
            <SetupIntro
                title="Subjects for each class"
                context={[yearName ? `Year ${yearName}` : null, branchName || null]}
                action={canCopy ? (
                    <button type="button" className="btn-secondary" onClick={() => setIsCopyDropdownOpen(true)}>
                        <Copy className="w-4 h-4" /> Copy to other branches
                    </button>
                ) : undefined}
            >
                Tick the subjects each class studies. Use "All" to tick a whole row or column.
            </SetupIntro>

            <div className="card p-4 mb-4">
                <Field label="Show subjects">
                    <Choice
                        label="Show subjects"
                        value={selectedSubjectType}
                        onChange={setSelectedSubjectType}
                        options={[
                            { value: 'Academic', label: 'Academic' },
                            { value: 'Deeniyath', label: 'Deeniyath' },
                            { value: 'All', label: 'All subjects' },
                        ]}
                    />
                </Field>
            </div>

            {loading && assignments.size === 0 ? (
                <div className="card"><LoadingState label="Loading subjects…" /></div>
            ) : filteredSubjects.length === 0 ? (
                <div className="card"><EmptyState compact title="No subjects in this group" description="Add subjects in the Subject list first, or choose another group." /></div>
            ) : (
                <GridCard>
                    <table className="border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr>
                                <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left min-w-[140px]">Subject</th>
                                {classes.map(c => (
                                    <th key={c.id} className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-1 py-2 text-center min-w-[64px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-semibold text-slate-800 whitespace-nowrap">{c.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleCheckAllColumn(c.id)}
                                                className={`h-9 min-w-[44px] px-2 rounded-md text-xs font-medium ${allInColumn(c.id) ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
                                                aria-label={`Tick or untick all subjects for class ${c.name}`}
                                            >
                                                All
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                <th className="sticky top-0 z-10 bg-slate-50 border-b border-l border-slate-200 px-2 py-2 text-center min-w-[72px]">Every class</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubjects.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/60">
                                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-1 font-medium text-slate-900">
                                        {s.name}
                                    </td>
                                    {classes.map(c => (
                                        <td key={c.id} className="border-b border-slate-100 p-0.5 text-center">
                                            <GridCheck
                                                checked={assignments.has(`${c.id}-${s.id}`)}
                                                onChange={() => handleToggle(c.id, s.id)}
                                                label={`${s.name} for class ${c.name}`}
                                            />
                                        </td>
                                    ))}
                                    <td className="border-b border-l border-slate-100 p-1 text-center">
                                        <button
                                            type="button"
                                            onClick={() => handleCheckAllRow(s.id)}
                                            className={`h-9 min-w-[44px] px-2 rounded-md text-xs font-medium ${allInRow(s.id) ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'}`}
                                            aria-label={`Tick or untick ${s.name} for every class`}
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
                    onClick={() => {
                        // Reset to initial assignments
                        setAssignments(new Set(initialAssignments));
                    }}
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
                    {saving ? "Saving…" : `Save changes (${changeCount})`}
                </button>
            </ActionBar>

            <CopyToBranchesSheet
                open={isCopyDropdownOpen}
                onClose={() => setIsCopyDropdownOpen(false)}
                what="subjects for each class"
                groups={copyGroups}
                selected={copyTargets}
                onToggle={toggleCopyTarget}
                onCopy={handleCopy}
                copying={copying}
                note={<>
                    Only subjects the other branch does not have yet are added. Nothing is removed there.
                    {changeCount > 0 && <span className="block mt-1 text-amber-700">You have changes that are not saved. Save them first, or they will not be copied.</span>}
                </>}
            />
        </div>
    );
};

export default ClassSubjectAssignment;