import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import api from "../api";
import { notify, confirmDialog } from './ui/feedback';
import { Alert, DataList, Field } from './ui';
import type { Column } from './ui';
import { SetupIntro, SetupSheet, CopyToBranchesSheet, Choice } from './exam-setup/shared';
import type { CopyTarget } from './exam-setup/shared';

interface Subject {
    id: number;
    subject_name: string;
    subject_type: "Academic" | "Deeniyath";
    academic_year: string;
    is_active: boolean;
}

interface BranchOption {
    id: number | string;
    name: string;
    location_name: string;
}

const SubjectMaster: React.FC = () => {
    // Context from Storage (Shared Header State)
    const academicYear = localStorage.getItem("academicYear") || "2024-2025";
    const currentBranch = localStorage.getItem('currentBranch');
    const isSpecificBranch = currentBranch && currentBranch !== 'All' && currentBranch !== 'All Branches';

    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [name, setName] = useState("");
    const [group, setGroup] = useState<"Academic" | "Deeniyath">("Academic");

    // Editing states
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editGroup, setEditGroup] = useState<"Academic" | "Deeniyath">("Academic");

    // Copy Feature State
    const [allBranches, setAllBranches] = useState<BranchOption[]>([]);
    const [sourceBranchId, setSourceBranchId] = useState<string | number>('');
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const [copying, setCopying] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [savingForm, setSavingForm] = useState(false);
    const loadSubjects = async () => {
        try {
            const res = await api.get("/academic/subjects", {
                params: { academic_year: academicYear }
            });

            const sortedSubjects = [...res.data].sort(
                (a, b) => a.subject_name.localeCompare(b.subject_name)
            );

            setSubjects(sortedSubjects);
        } catch (error) {
            console.error("Failed to load subjects:", error);
        }
    };


    const addSubject = async (): Promise<boolean> => {
        if (!name.trim()) return false;

        try {
            await api.post("/academic/subjects", {
                subject_name: name,
                subject_type: group,
                academic_year: academicYear,
                is_active: true
            });
            setName("");
            setGroup("Academic"); // Reset to default
            loadSubjects();
            return true;
        } catch (error: any) {
            console.error("Failed to add subject:", error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to add subject. Please try again.";
            notify(errorMsg);
            return false;
        }
    };

    const updateSubject = async (id: number): Promise<boolean> => {
        if (!editName.trim()) return false;

        try {
            await api.put(`/academic/subjects/${id}`, {
                subject_name: editName,
                subject_type: editGroup
            });
            setEditingId(null);
            loadSubjects();
            return true;
        } catch (error) {
            console.error("Failed to update subject:", error);
            notify("Could not save the subject. Please try again.");
            return false;
        }
    };

    const toggleStatus = async (id: number, currentStatus: boolean) => {
        try {
            await api.put(`/academic/subjects/${id}`, {
                is_active: !currentStatus
            });
            loadSubjects();
        } catch (error) {
            console.error("Failed to update status:", error);
            notify("Could not change the status. Please try again.");
        }
    };

    const deleteSubject = async (id: number) => {
        if (!await confirmDialog("Delete this subject? This cannot be undone. To only hide it, use Turn off instead.")) return;

        try {
            await api.delete(`/academic/subjects/${id}`);
            loadSubjects();
        } catch (error: any) {
            console.error("Failed to delete subject:", error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to delete subject. Please try again.";
            notify(errorMsg);
        }
    };

    // Fetch Branches for Copy Logic
    useEffect(() => {
        if (currentBranch && currentBranch !== 'All' && currentBranch !== 'All Branches') {
            api.get('/branches').then(res => {
                const branchList = res.data.branches || res.data || [];
                const mappedBranches = branchList.map((b: any) => ({
                    id: b.id,
                    name: b.branch_name,
                    location_name: b.location_name || 'Unknown Location'
                }));
                setAllBranches(mappedBranches);

                const b = branchList.find((br: any) => br.branch_name.toLowerCase() === currentBranch.toLowerCase());
                if (b) {
                    setSourceBranchId(b.id);
                }
            }).catch(err => console.error("Error fetching branches:", err));
        }
    }, [currentBranch]);

    useEffect(() => {
        loadSubjects();
    }, [academicYear]); // Reload if context changes (though unlikely without page reload)

    const toggleCopyTarget = (id: string) => {
        setCopyTargets(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCopySubjects = async () => {
        if (copyTargets.size === 0) {
            notify("Choose at least one branch to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy this subject list to ${copyTargets.size} branch${copyTargets.size !== 1 ? "es" : ""}?`)) return;

        setCopying(true);
        try {
            await api.post('/academic/copy-subjects', {
                source_branch_id: sourceBranchId,
                target_branch_ids: Array.from(copyTargets),
                academic_year: academicYear
            });
            notify.success("Subjects copied");
            setCopyTargets(new Set());
            setIsCopyDropdownOpen(false);
        } catch (error: any) {
            console.error('Copy failed', error);
            notify(error.response?.data?.error || "Failed to copy subjects.");
        } finally {
            setCopying(false);
        }
    };

    // Prepare Grouped Branches for Copy
    const availableBranches = allBranches.filter(b => String(b.id) !== String(sourceBranchId) && b.name !== 'All Branches' && b.name !== 'All');
    const branchesByLocation: { [key: string]: BranchOption[] } = {};
    availableBranches.forEach(b => {
        if (!branchesByLocation[b.location_name]) {
            branchesByLocation[b.location_name] = [];
        }
        branchesByLocation[b.location_name].push(b);
    });

    const openAdd = () => {
        setEditingId(null);
        setName("");
        setGroup("Academic");
        setFormOpen(true);
    };

    const openEdit = (s: Subject) => {
        setEditingId(s.id);
        setEditName(s.subject_name);
        setEditGroup(s.subject_type || "Academic");
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingId(null);
    };

    const submitForm = async () => {
        setSavingForm(true);
        const ok = editingId !== null ? await updateSubject(editingId) : await addSubject();
        setSavingForm(false);
        if (ok) {
            notify.success(editingId !== null ? "Subject saved" : "Subject added");
            closeForm();
        }
    };

    const formName = editingId !== null ? editName : name;
    const formGroup = editingId !== null ? editGroup : group;

    const copyGroups: Record<string, CopyTarget[]> = {};
    Object.keys(branchesByLocation).forEach(loc => {
        copyGroups[loc] = branchesByLocation[loc].map(b => ({ key: String(b.id), label: b.name }));
    });

    const columns: Column<Subject>[] = [
        {
            key: 'subject_name',
            header: 'Subject',
            primary: true,
            render: s => <span className={!s.is_active ? 'text-slate-400' : 'font-medium text-slate-900'}>{s.subject_name}</span>,
        },
        {
            key: 'subject_type',
            header: 'Group',
            render: s => (
                <span className={s.subject_type === 'Deeniyath' ? 'badge-success' : 'badge-brand'}>
                    {s.subject_type || 'Academic'}
                </span>
            ),
        },
        {
            key: 'is_active',
            header: 'Status',
            render: s => s.is_active ? <span className="badge-success">In use</span> : <span className="badge-neutral">Turned off</span>,
        },
        {
            key: 'actions',
            header: '',
            hideOnMobile: true,
            align: 'right',
            render: s => <div className="flex justify-end gap-1.5">{rowActions(s)}</div>,
        },
    ];

    function rowActions(s: Subject) {
        return (
            <>
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(s)}>
                    <Pencil className="w-4 h-4" /> Edit
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => toggleStatus(s.id, s.is_active)}>
                    {s.is_active ? 'Turn off' : 'Turn on'}
                </button>
                <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteSubject(s.id)}>
                    <Trash2 className="w-4 h-4" /> Delete
                </button>
            </>
        );
    }

    return (
        <div className="">
            <SetupIntro
                title="Subject list"
                context={[`Year ${academicYear}`, isSpecificBranch ? currentBranch : null]}
                action={isSpecificBranch ? (
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setIsCopyDropdownOpen(true)}>
                            <Copy className="w-4 h-4" /> Copy to other branches
                        </button>
                        <button type="button" className="btn-primary" onClick={openAdd}>
                            <Plus className="w-4 h-4" /> Add subject
                        </button>
                    </>
                ) : undefined}
            >
                All the subjects your school teaches. Turn off a subject to hide it without deleting it.
            </SetupIntro>

            {!isSpecificBranch && (
                <Alert tone="warning" className="mb-4">
                    To add subjects, first choose one branch at the top of the screen.
                </Alert>
            )}

            <DataList
                columns={columns}
                rows={subjects}
                rowKey={s => s.id}
                emptyTitle="No subjects yet"
                emptyHint={isSpecificBranch ? 'Tap "Add subject" to add the first one.' : undefined}
                mobileActions={rowActions}
            />

            {/* Add / edit subject */}
            <SetupSheet
                open={formOpen}
                onClose={closeForm}
                title={editingId !== null ? 'Edit subject' : 'Add subject'}
                footer={<>
                    <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={submitForm} disabled={!formName.trim() || savingForm}>
                        {savingForm ? 'Saving…' : editingId !== null ? 'Save subject' : 'Add subject'}
                    </button>
                </>}
            >
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (formName.trim()) submitForm(); }}>
                    <Field label="Subject name" htmlFor="subj-name" required error={null}>
                        <input
                            id="subj-name"
                            value={formName}
                            onChange={e => editingId !== null ? setEditName(e.target.value) : setName(e.target.value)}
                            className="input"
                            placeholder="For example: English"
                            autoFocus
                        />
                    </Field>
                    <Field label="Group" hint="Deeniyath subjects are shown separately on report cards.">
                        <Choice
                            label="Group"
                            value={formGroup}
                            onChange={v => editingId !== null ? setEditGroup(v) : setGroup(v)}
                            options={[{ value: 'Academic', label: 'Academic' }, { value: 'Deeniyath', label: 'Deeniyath' }]}
                        />
                    </Field>
                </form>
            </SetupSheet>

            <CopyToBranchesSheet
                open={isCopyDropdownOpen}
                onClose={() => setIsCopyDropdownOpen(false)}
                what="subject list"
                groups={copyGroups}
                selected={copyTargets}
                onToggle={toggleCopyTarget}
                onCopy={handleCopySubjects}
                copying={copying}
            />
        </div>
    );
};

export default SubjectMaster;
