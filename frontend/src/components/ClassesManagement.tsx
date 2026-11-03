import React, { useState, useEffect, useRef } from 'react';
import { School, Plus, ArrowUpDown, ChevronUp, ChevronDown, Pencil, Trash2, RotateCcw, Copy } from 'lucide-react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { notify, confirmDialog } from './ui/feedback';
import { PageHeader, EmptyState, DataList, Field, ActionBar } from './ui';
import type { Column } from './ui';
import { openWithIntent } from '../utils/intent';
import { Dialog, BackBar } from './school-setup';

interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
    location_name?: string;
}

interface SectionDetail {
    id: number;
    name: string;
    strength: number;
    branch_id: number;
}

interface ClassData {
    id: number;
    class_name: string;
    class_teacher?: string;
    class_monitor?: string;
    total_students?: number;
    section?: string;
    sections?: SectionDetail[];
}

interface SectionData {
    id: number;
    name: string;
    studentStrength: string;
}

interface ClassesManagementProps {
    navigateTo?: (page: any) => void;
}

const SOON = 'Coming soon — not available yet';

const ClassesManagement: React.FC<ClassesManagementProps> = ({ navigateTo }) => {
    const { hasPermission } = useAuth();
    const canOpenTimetable = !!navigateTo && hasPermission('academics.timetable.subject-teacher-assignment', 'read');
    const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedSection, setSelectedSection] = useState<string>('all');
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [newClassName, setNewClassName] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [classSummary, setClassSummary] = useState<ClassData[]>([]); // For Create View Summary
    const [branches, setBranches] = useState<Branch[]>([]);
    const [masterClasses, setMasterClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [sections, setSections] = useState<SectionData[]>([{ id: 1, name: '', studentStrength: '' }]);

    // Copy Feature State
    const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
    const [isCopyDropdownOpen, setIsCopyDropdownOpen] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);
    const [copying, setCopying] = useState(false);

    // Order Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [orderBranchId, setOrderBranchId] = useState('');
    const [orderClasses, setOrderClasses] = useState<any[]>([]);
    const [savingOrder, setSavingOrder] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (isOrderModalOpen && orderBranchId && orderBranchId !== 'all') {
            api.get(`/classes?branch=${orderBranchId}`).then(res => {
                if (!cancelled && res.data && res.data.classes) {
                    setOrderClasses(res.data.classes);
                }
            }).catch(console.error);
        } else {
            setOrderClasses([]);
        }

        return () => {
            cancelled = true;
        };
    }, [isOrderModalOpen, orderBranchId]);
    const moveOrder = (index: number, direction: 'up' | 'down') => {
        const newClasses = [...orderClasses];
        if (direction === 'up' && index > 0) {
            [newClasses[index - 1], newClasses[index]] = [newClasses[index], newClasses[index - 1]];
        } else if (direction === 'down' && index < newClasses.length - 1) {
            [newClasses[index + 1], newClasses[index]] = [newClasses[index], newClasses[index + 1]];
        }
        setOrderClasses(newClasses);
    };

    const setSpecificOrder = (currentIndex: number, newIndexStr: string) => {
        if (!newIndexStr) return;
        let newIndex = parseInt(newIndexStr, 10) - 1;
        if (isNaN(newIndex)) return;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= orderClasses.length) newIndex = orderClasses.length - 1;

        if (newIndex === currentIndex) return;

        const newClasses = [...orderClasses];
        const [movedItem] = newClasses.splice(currentIndex, 1);
        newClasses.splice(newIndex, 0, movedItem);
        setOrderClasses(newClasses);
    };

    const handleSaveOrder = async () => {
        if (!orderBranchId || orderBranchId === 'all') {
            notify.error("Choose a branch first.");
            return;
        }
        setSavingOrder(true);
        try {
            await api.post('/classes/reorder', {
                branch_id: parseInt(orderBranchId),
                class_ids: orderClasses.map(c => c.id)
            });
            notify.success("Class order saved.");
            setIsOrderModalOpen(false);
            fetchMasterClasses();
            fetchClassSummary();
        } catch (error: any) {
            console.error("Save order failed", error);
            notify(error.response?.data?.error || "Failed to save order");
        } finally {
            setSavingOrder(false);
        }
    };

    // Mock data for list view
    const mockClasses: ClassData[] = [

    ];


    useEffect(() => {
        setClasses(mockClasses);
        fetchBranches();
        fetchMasterClasses();
    }, []);

    // Effect to set default branch from localStorage and fetch summary
    useEffect(() => {
        if (branches.length > 0) {
            const storedBranchName = localStorage.getItem('currentBranch');
            if (storedBranchName && storedBranchName !== 'All') {
                const matchingBranch = branches.find(b => b.branch_name === storedBranchName);
                if (matchingBranch) {
                    setSelectedBranch(matchingBranch.id.toString());
                    fetchClassSummary(matchingBranch.id.toString());
                } else {
                    fetchClassSummary(); // Fetch all if active branch mapping fails
                }
            } else {
                fetchClassSummary(); // Fetch all
            }
        }
    }, [branches]);


    const fetchMasterClasses = async () => {
        try {
            const res = await api.get('/classes');
            if (res.data && res.data.classes) {
                setMasterClasses(res.data.classes);
            }
        } catch (error) {
            console.error("Failed to fetch master classes", error);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await api.get('/branches');
            if (res.data && res.data.branches) {
                setBranches(res.data.branches);
            }
        } catch (error) {
            console.error("Failed to fetch branches", error);
        }
    };

    const fetchClassSummary = async (branchId?: string) => {
        try {
            setLoading(true);
            const academicYear = localStorage.getItem('academicYear') || "2026-2027";
            let url = `/classes/summary?academic_year=${academicYear}`;

            // If branchId is passed, use it. Otherwise use state or default.
            // Note: State might not be updated yet if called from effect, so prefer arg.
            const bid = branchId || selectedBranch;
            if (bid) {
                url += `&branch_id=${bid}`;
            }

            const res = await api.get(url);
            if (res.data) {
                setClassSummary(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch class summary", error);
        } finally {
            setLoading(false);
        }
    };


    const classOptions = Array.from(new Set(classes.map(c => c.class_name))).filter(Boolean);
    const sectionOptions = Array.from(new Set(classes.flatMap(c => [
        ...(c.sections || []).map(sec => sec.name),
        ...(c.section ? [c.section] : []),
    ]))).filter(Boolean).sort();

    const filteredClasses = classes.filter(cls => {
        const classMatch = selectedClass === 'all' || cls.class_name === selectedClass;
        const sectionMatch = selectedSection === 'all'
            || cls.section === selectedSection
            || (cls.sections || []).some(sec => sec.name === selectedSection);
        return classMatch && sectionMatch;
    });

    const addSection = () => {
        const newSection: SectionData = {
            id: sections.length + 1,
            name: '',
            studentStrength: ''
        };
        setSections([...sections, newSection]);
    };

    const removeSection = (id: number) => {
        if (sections.length > 1) {
            setSections(sections.filter(section => section.id !== id));
        }
    };

    const updateSection = (id: number, field: 'name' | 'studentStrength', value: string) => {
        setSections(sections.map(section =>
            section.id === id ? { ...section, [field]: value } : section
        ));
    };

    const handleSaveClass = async () => {
        if (!newClassName.trim()) {
            notify.error("Type the class name first.");
            return;
        }
        if (!selectedBranch) {
            notify.error("Pick a branch at the top of the screen first.");
            return;
        }

        const sectionsPayload = sections.map(s => ({
            name: s.name,
            strength: parseInt(s.studentStrength) || 0
        })).filter(s => s.name && s.strength > 0);

        if (sectionsPayload.length === 0) {
            notify.error("Add at least one section with its number of students.");
            return;
        }

        const payload = {
            class_name: newClassName,
            branch_id: parseInt(selectedBranch),
            academic_year: localStorage.getItem('academicYear') || "2026-2027",
            sections: sectionsPayload
        };

        try {
            await api.post('/classes/create_with_sections', payload);
            notify.success("Class saved.");
            handleReset();
            // Refresh summary with current selection
            fetchClassSummary();
        } catch (error: any) {
            console.error("Save failed", error);
            notify.error(error.response?.data?.error || "Could not save the class. Please try again.");
        }
    };

    const handleReset = () => {
        setNewClassName('');
        //setSelectedBranch('');
        setSections([{ id: 1, name: '', studentStrength: '' }]);
    };

    const handleEditClass = (cls: ClassData) => {
        setNewClassName(cls.class_name);
        if (cls.sections && cls.sections.length > 0) {
            const formSections: SectionData[] = cls.sections.map((s, index) => ({
                id: index + 1,
                name: s.name,
                studentStrength: s.strength.toString()
            }));
            setSections(formSections);

            if (cls.sections[0].branch_id) {
                setSelectedBranch(cls.sections[0].branch_id.toString());
            }
        } else {
            setSections([{ id: 1, name: '', studentStrength: '' }]);
        }
    };

    /** Fill the form with a class and bring the form into view (it may be off-screen on phones). */
    const editAndScroll = (cls: ClassData) => {
        handleEditClass(cls);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
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

    const handleCopyBranchStructure = async () => {
        if (!selectedBranch || selectedBranch === 'all' || selectedBranch === '') {
            notify.error("Pick one branch at the top of the screen first (not 'All').");
            return;
        }

        if (copyTargets.size === 0) {
            notify.error("Tick at least one branch to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy all classes and sections from this branch to ${copyTargets.size} other branch${copyTargets.size === 1 ? '' : 'es'}?`, { confirmText: 'Yes, copy' })) {
            return;
        }

        setCopying(true);
        try {
            const payload = {
                source_branch_id: selectedBranch,
                target_branch_ids: Array.from(copyTargets),
                academic_year: localStorage.getItem('academicYear') || "2026-2027"
            };

            const res = await api.post('/classes/copy_branch_structure', payload);
            notify.success(`Copied. ${res.data.copied_sections} section(s) added, ${res.data.skipped_sections} already there.`);
            setCopyTargets(new Set());
            setIsCopyDropdownOpen(false);
            // Refresh to show changes if we copied to a branch we might switch to? 
            // Doesn't affect current view much unless we switch.
        } catch (error: any) {
            console.error("Copy failed", error);
            notify(error.response?.data?.error || "Failed to copy branch structure");
        } finally {
            setCopying(false);
        }
    };

    // Group Branches for Copy Dropdown
    const availableBranches = branches.filter(b => String(b.id) !== selectedBranch && String(b.id) !== 'All'); // Exclude current and 'All'
    const branchesByLocation: { [key: string]: Branch[] } = {};
    availableBranches.forEach(b => {
        const loc = b.location_name || "Other";
        if (!branchesByLocation[loc]) {
            branchesByLocation[loc] = [];
        }
        branchesByLocation[loc].push(b);
    });


    const currentBranchName = branches.find(b => String(b.id) === selectedBranch)?.branch_name || '';
    const validSections = sections.filter(s => s.name && (parseInt(s.studentStrength) || 0) > 0).length;
    const saveNote = !newClassName.trim() ? 'Type the class name.'
        : !selectedBranch ? 'Pick a branch at the top of the screen first.'
        : validSections === 0 ? 'Add at least one section with its number of students.'
        : `Saves class ${newClassName.trim()} with ${validSections} section${validSections === 1 ? '' : 's'}.`;

    const listColumns: Column<ClassData>[] = [
        { key: 'class_name', header: 'Class', primary: true, render: c => <span className="font-medium text-slate-900">{c.class_name}</span> },
        { key: 'class_teacher', header: 'Class teacher', render: c => c.class_teacher || '—' },
        { key: 'class_monitor', header: 'Class monitor', render: c => c.class_monitor || '—' },
        { key: 'total_students', header: 'Students', render: c => c.total_students ?? '—' },
        { key: 'actions', header: 'Actions', hideOnMobile: true, render: () => rowActions() },
    ];

    const rowActions = () => (
        <>
            <button type="button" className="btn-secondary btn-sm" disabled title={SOON}>
                Give roll numbers
            </button>
            <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={!canOpenTimetable}
                title={canOpenTimetable ? 'Opens Timetable › Choose teachers for subjects' : 'You need access to subject teachers'}
                onClick={() => openWithIntent(navigateTo!, 'timetable', 'subject-teacher')}
            >
                Subject teachers
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled title={SOON}>
                Class monitor
            </button>
        </>
    );

    // List View - First screen
    if (viewMode === 'list') {
        return (
            <div className="min-h-full bg-surface-muted p-4 sm:p-6">
                <div className="w-full">
                    <PageHeader
                        title="Classes"
                        subtitle="All classes and sections of your school."
                        icon={<School className="w-6 h-6" />}
                        actions={(
                            <>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('create')}
                                    className="btn-primary"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add or change classes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderBranchId(selectedBranch || (branches.length > 0 ? branches[0].id.toString() : ''));
                                        setIsOrderModalOpen(true);
                                    }}
                                    className="btn-secondary"
                                >
                                    <ArrowUpDown className="w-4 h-4" />
                                    Change class order
                                </button>
                                <button type="button" className="btn-secondary" disabled title={SOON}>
                                    Choose class teachers
                                </button>
                                {navigateTo && (
                                    <button type="button" onClick={() => navigateTo('staffsupport')} className="btn-ghost text-brand-700">
                                        Get help
                                    </button>
                                )}
                            </>
                        )}
                    />

                    {/* Filters */}
                    <div className="card p-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end">
                            <Field label="Class" htmlFor="cm-filter-class">
                                <select
                                    id="cm-filter-class"
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="input"
                                >
                                    <option value="all">All classes</option>
                                    {classOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </Field>
                            <Field label="Section" htmlFor="cm-filter-section">
                                <select
                                    id="cm-filter-section"
                                    value={selectedSection}
                                    onChange={(e) => setSelectedSection(e.target.value)}
                                    className="input"
                                >
                                    <option value="all">All sections</option>
                                    {sectionOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </Field>
                            {(selectedClass !== 'all' || selectedSection !== 'all') && (
                                <button type="button" onClick={() => { setSelectedClass('all'); setSelectedSection('all'); }} className="btn-secondary">
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>

                    <DataList
                        columns={listColumns}
                        rows={filteredClasses}
                        rowKey={c => c.id}
                        emptyTitle="No classes found"
                        emptyHint="Tap “Add or change classes” to add one."
                        mobileActions={() => rowActions()}
                    />
                </div>

                {/* Display Order */}
                {isOrderModalOpen && (
                    <Dialog
                        title="Change class order"
                        subtitle="This is the order classes appear in lists. Use the arrows, or type a position number."
                        onClose={() => setIsOrderModalOpen(false)}
                        footer={<>
                            <button type="button" onClick={() => setIsOrderModalOpen(false)} className="btn-secondary">Back</button>
                            <button
                                type="button"
                                onClick={handleSaveOrder}
                                disabled={savingOrder || orderClasses.length === 0}
                                className="btn-primary"
                            >
                                {savingOrder ? 'Saving…' : 'Save order'}
                            </button>
                        </>}
                    >
                        <Field label="Branch" htmlFor="cm-order-branch">
                            <select
                                id="cm-order-branch"
                                value={orderBranchId}
                                onChange={(e) => setOrderBranchId(e.target.value)}
                                className="input"
                            >
                                <option value="">Choose branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </Field>
                        {orderBranchId && (
                            orderClasses.length === 0 ? (
                                <EmptyState compact title="No classes in this branch" />
                            ) : (
                                <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                                    {orderClasses.map((cls, idx) => (
                                        <li key={cls.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="1"
                                                    max={orderClasses.length}
                                                    value={idx + 1}
                                                    onChange={() => { }} // React controlled warning fix, real change handled on blur or change with caution.
                                                    onBlur={(e) => setSpecificOrder(idx, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            setSpecificOrder(idx, e.currentTarget.value);
                                                        }
                                                    }}
                                                    className="input w-16 text-center"
                                                    aria-label={`Position of class ${cls.class_name}`}
                                                    title="Type a number and press Enter to move"
                                                />
                                                <span className="font-medium text-slate-800 truncate">{cls.class_name}</span>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => moveOrder(idx, 'up')}
                                                    disabled={idx === 0}
                                                    aria-label={`Move ${cls.class_name} up`}
                                                    className={`btn-icon ${idx === 0 ? 'text-slate-300' : 'text-brand-600 hover:bg-brand-50'}`}
                                                >
                                                    <ChevronUp className="w-5 h-5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveOrder(idx, 'down')}
                                                    disabled={idx === orderClasses.length - 1}
                                                    aria-label={`Move ${cls.class_name} down`}
                                                    className={`btn-icon ${idx === orderClasses.length - 1 ? 'text-slate-300' : 'text-brand-600 hover:bg-brand-50'}`}
                                                >
                                                    <ChevronDown className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </Dialog>
                )}
            </div>
        );
    }

    // Create/Edit View - Second screen
    const summaryColumns: Column<ClassData>[] = [
        { key: 'class_name', header: 'Class', primary: true },
        { key: 'sections', header: 'Sections', secondary: true, render: c => c.sections?.map(s => s.name).join(', ') || '—' },
        {
            key: 'edit', header: '', hideOnMobile: true, align: 'right', render: c => (
                <button type="button" onClick={() => editAndScroll(c)} className="btn-soft btn-sm">
                    <Pencil className="w-4 h-4" /> Edit
                </button>
            ),
        },
    ];

    return (
        <div className="min-h-full bg-surface-muted p-4 sm:p-6">
            <BackBar
                label="Classes"
                title="Add or change classes"
                hint={<>Type a class name and its sections, then save. {currentBranchName && <>Branch: <span className="font-medium text-slate-700">{currentBranchName}</span></>}</>}
                onBack={() => setViewMode('list')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Form (first on phones) */}
                <div ref={formRef} className="card lg:order-2 scroll-mt-20">
                    <div className="card-header">
                        <h2 className="text-base font-semibold text-slate-900">Class details</h2>
                        <button type="button" onClick={handleReset} className="btn-ghost btn-sm">
                            <RotateCcw className="w-4 h-4" /> Clear form
                        </button>
                    </div>

                    <div className="card-body space-y-5">
                        <Field label="Class name" htmlFor="cm-class-name" required hint="Pick from the list or type a new one, e.g. 5 or UKG.">
                            <input
                                id="cm-class-name"
                                type="text"
                                list="master-classes-list"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="e.g. 5"
                                className="input"
                            />
                            <datalist id="master-classes-list">
                                {masterClasses.map((c) => (
                                    <option key={c.id} value={c.class_name} />
                                ))}
                            </datalist>
                        </Field>

                        <div>
                            <p className="block text-sm font-medium text-slate-800 mb-1.5">Sections<span className="text-red-600" aria-hidden="true"> *</span></p>
                            <ul className="space-y-2">
                                {sections.map((section, i) => (
                                    <li key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                            <div>
                                                <label className="label" htmlFor={`cm-sec-name-${section.id}`}>Section {i + 1} name</label>
                                                <input
                                                    id={`cm-sec-name-${section.id}`}
                                                    type="text"
                                                    value={section.name}
                                                    onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                                                    placeholder="e.g. A"
                                                    className="input"
                                                />
                                            </div>
                                            <div>
                                                <label className="label" htmlFor={`cm-sec-size-${section.id}`}>Number of students</label>
                                                <input
                                                    id={`cm-sec-size-${section.id}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={section.studentStrength}
                                                    onChange={(e) => updateSection(section.id, 'studentStrength', e.target.value)}
                                                    placeholder="e.g. 40"
                                                    className="input"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeSection(section.id)}
                                                disabled={sections.length === 1}
                                                aria-label={`Remove section ${i + 1}`}
                                                className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <button type="button" onClick={addSection} className="btn-secondary btn-sm mt-2 w-full sm:w-auto">
                                <Plus className="w-4 h-4" /> Add another section
                            </button>
                        </div>

                        <Field label="Branch" hint="Set by the branch picked at the top of the screen.">
                            <div className="input bg-slate-50 text-slate-700">{currentBranchName || 'No branch picked'}</div>
                        </Field>

                        <ActionBar note={saveNote}>
                            <button
                                type="button"
                                onClick={handleSaveClass}
                                disabled={!newClassName.trim() || !selectedBranch || validSections === 0}
                                className="btn-primary btn-lg"
                            >
                                Save class
                            </button>
                        </ActionBar>
                    </div>
                </div>

                {/* Existing classes */}
                <div className="lg:order-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h2 className="text-base font-semibold text-slate-900">Classes in this branch</h2>
                        <button
                            type="button"
                            onClick={() => setIsCopyDropdownOpen(true)}
                            className="btn-secondary btn-sm"
                            title="Copy all classes to other branches"
                        >
                            <Copy className="w-4 h-4" /> Copy to other branches
                        </button>
                    </div>
                    <DataList
                        columns={summaryColumns}
                        rows={classSummary}
                        rowKey={c => c.id}
                        loading={loading}
                        emptyTitle="No classes in this branch yet"
                        emptyHint="Add the first one using the form."
                        mobileActions={c => (
                            <button type="button" onClick={() => editAndScroll(c)} className="btn-soft btn-sm">
                                <Pencil className="w-4 h-4" /> Edit
                            </button>
                        )}
                    />
                </div>
            </div>

            {isCopyDropdownOpen && (
                <Dialog
                    title="Copy classes to other branches"
                    subtitle={<>Copies every class and section of {currentBranchName || 'this branch'}. Classes that already exist there are skipped.</>}
                    onClose={() => setIsCopyDropdownOpen(false)}
                    footer={<>
                        <button type="button" onClick={() => setIsCopyDropdownOpen(false)} className="btn-secondary">Back</button>
                        <button
                            type="button"
                            onClick={handleCopyBranchStructure}
                            disabled={copying || copyTargets.size === 0}
                            className="btn-primary"
                        >
                            {copying ? 'Copying…' : copyTargets.size === 0 ? 'Tick a branch' : `Copy to ${copyTargets.size} branch${copyTargets.size === 1 ? '' : 'es'}`}
                        </button>
                    </>}
                >
                    {Object.keys(branchesByLocation).length === 0 ? (
                        <EmptyState
                            compact
                            title={(selectedBranch === 'all' || !selectedBranch)
                                ? 'Pick a branch at the top of the screen first.'
                                : 'There are no other branches.'}
                        />
                    ) : (
                        Object.keys(branchesByLocation).map(loc => (
                            <div key={loc}>
                                <h3 className="text-sm font-semibold text-slate-500 mb-1.5">{loc}</h3>
                                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    {branchesByLocation[loc].map(b => (
                                        <label key={b.id} className="flex items-center gap-3 px-4 min-h-[48px] cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={copyTargets.has(String(b.id))}
                                                onChange={() => toggleCopyTarget(String(b.id))}
                                                className="w-5 h-5 accent-brand-600 rounded border-slate-300"
                                            />
                                            <span className="text-[15px] text-slate-800">{b.branch_name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </Dialog>
            )}
        </div>
    );
};

export default ClassesManagement;
