import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Save } from 'lucide-react';
import api from '../api';
import { notify } from './ui/feedback';
import { DataList, Field } from './ui';
import type { Column } from './ui';
import { SetupIntro, SetupSheet } from './exam-setup/shared';

interface TestType {
    id: number;
    test_name: string;
    max_marks: number;
    display_order?: number;
    is_active: boolean; 
    academic_year: string;
}

const TestTypeManager: React.FC = () => {
    // --- State ---
    const [testTypes, setTestTypes] = useState<TestType[]>([]);
    const [loading, setLoading] = useState(false);

    // Context Filters
    const [academicYear, setAcademicYear] = useState(localStorage.getItem('academicYear') || '');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<Partial<TestType>>({
        test_name: '',
        max_marks: 50,
        display_order: undefined
    });

    // --- Effects ---
    // Initialize Academic Year
    useEffect(() => {
        const initializeAcademicYear = async () => {
            const storedYear = localStorage.getItem('academicYear');
            try {
                const resYears = await api.get("/org/academic-years");
                const yearsList = resYears.data.academic_years || [];

                if (storedYear) {
                    const foundYear = yearsList.find((y: any) => y.name === storedYear);
                    if (foundYear) {
                        setAcademicYear(foundYear.name);
                    } else if (yearsList.length > 0) {
                        setAcademicYear(yearsList[0].name);
                    }
                } else if (yearsList.length > 0) {
                    setAcademicYear(yearsList[0].name);
                }
            } catch (err) {
                console.error("Failed to fetch academic years", err);
                // Fallback: If no API, use stored or empty. 
                // We rely on backend validation or user to fix config.
            }
        };

        initializeAcademicYear();
    }, []);

    useEffect(() => {
        if (academicYear) {
            fetchTestTypes();
        }
    }, [academicYear]);

    // --- Actions ---
    const fetchTestTypes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/test-types/', {
                params: {
                    academic_year: academicYear
                }
            });
            setTestTypes(res.data);
        } catch (error: any) {
            console.error("Failed to fetch test types", error);
            const msg = error.response?.data?.error || error.message || "Unknown error";
            const status = error.response?.status ? ` (${error.response.status})` : "";
            notify(`Could not load exam names${status}: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const payload = {
                ...formData,
                academic_year: academicYear
            };

            if (editingId) {
                await api.put(`/test-types/${editingId}`, payload);
            } else {
                // If creating, display_order handled by backend if 0 or null? 
                // We initialized display_order to 0. 
                // Let's pass null if we want backend to decide, or let user edit.
                // If user didn't touch it, maybe send null?
                // The Modal will show suggested order.
                await api.post('/test-types/', payload);
            }
            setShowModal(false);
            notify.success(editingId ? 'Exam name saved' : 'Exam name added');
            fetchTestTypes();
        } catch (error: any) {
            console.error("Save error:", error);
            const msg = error.response?.data?.error || error.message || "Failed to save";
            notify(`Could not save: ${msg}`);
        }
    };



    const toggleStatus = async (id: number) => {
        try {
            await api.patch(`/test-types/${id}/status`);
            fetchTestTypes();
        } catch (error) {
            console.error("Status update failed", error);
        }
    };

    const openAddModal = () => {
        setFormData({
            test_name: '',
            max_marks: 50,
            display_order: undefined
        });
        setEditingId(null);
        setShowModal(true);
    };

    const openEditModal = (t: TestType) => {
        setFormData({
            test_name: t.test_name,
            max_marks: t.max_marks,
            display_order: t.display_order
        });
        setEditingId(t.id);
        setShowModal(true);
    };

    const rowActions = (t: TestType) => (
        <>
            <button type="button" onClick={() => openEditModal(t)} className="btn-secondary btn-sm">
                <Pencil size={16} /> Edit
            </button>
            <button type="button" onClick={() => toggleStatus(t.id)} className="btn-ghost btn-sm">
                {t.is_active ? 'Turn off' : 'Turn on'}
            </button>
        </>
    );

    const columns: Column<TestType & { _idx: number }>[] = [
        {
            key: 'test_name',
            header: 'Exam name',
            primary: true,
            render: t => <span className="font-medium text-slate-900">{t.test_name}</span>,
        },
        {
            key: 'order',
            header: 'Position',
            secondary: true,
            render: t => <span className="text-slate-600">{`No. ${t.display_order ?? t._idx + 1} in the list`}</span>,
        },
        { key: 'max_marks', header: 'Full marks', align: 'center' },
        {
            key: 'is_active',
            header: 'Status',
            render: t => t.is_active ? <span className="badge-success">In use</span> : <span className="badge-neutral">Turned off</span>,
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            hideOnMobile: true,
            render: t => <div className="flex justify-end gap-1.5">{rowActions(t)}</div>,
        },
    ];

    return (
        <div className="">
            <SetupIntro
                title="Exam names"
                context={[academicYear ? `Year ${academicYear}` : 'Loading year…', 'Same for all branches']}
                action={(
                    <button
                        type="button"
                        onClick={openAddModal}
                        disabled={!academicYear}
                        className="btn-primary"
                    >
                        <Plus size={18} /> Add exam name
                    </button>
                )}
            >
                The exams your school holds, like Unit test 1 or Final exam. They are listed in this order on report cards.
            </SetupIntro>

            <DataList
                columns={columns}
                rows={testTypes.map((t, i) => ({ ...t, _idx: i }))}
                rowKey={t => t.id}
                loading={loading}
                emptyTitle="No exam names yet"
                emptyHint='Tap "Add exam name" to add the first one.'
                mobileActions={rowActions}
            />

            <SetupSheet
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingId ? 'Edit exam name' : 'Add exam name'}
                subtitle={`Year ${academicYear} · all branches`}
                footer={<>
                    <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} disabled={!formData.test_name} className="btn-primary">
                        <Save size={16} /> Save exam name
                    </button>
                </>}
            >
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (formData.test_name) handleSave(); }}>
                    <Field label="Exam name" htmlFor="tt-name" required>
                        <input
                            id="tt-name"
                            type="text"
                            value={formData.test_name}
                            onChange={e => setFormData({ ...formData, test_name: e.target.value })}
                            className="input"
                            placeholder="For example: Unit test 1"
                            autoFocus
                        />
                    </Field>

                    <Field label="Full marks" htmlFor="tt-max" required hint="The highest total marks for this exam. Used as a guide when you add subjects.">
                        <input
                            id="tt-max"
                            type="number"
                            inputMode="numeric"
                            value={formData.max_marks}
                            onChange={e => setFormData({ ...formData, max_marks: parseInt(e.target.value) || 0 })}
                            className="input"
                        />
                    </Field>

                    <Field label="Position in the list (optional)" htmlFor="tt-order" hint="Leave empty to put it at the end.">
                        <input
                            id="tt-order"
                            type="number"
                            inputMode="numeric"
                            value={formData.display_order ?? ''}
                            onChange={e => setFormData({ ...formData, display_order: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="input"
                            placeholder="At the end"
                        />
                    </Field>
                </form>
            </SetupSheet>
        </div>
    );
};

export default TestTypeManager;
