import React, { useState, useEffect } from 'react';
import { Pencil, Plus, ToggleLeft, ToggleRight, X, Save } from 'lucide-react';
import api from '../api';
import { notify } from './ui/feedback';
import { PageHeader, LoadingState, EmptyState } from './ui';

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
            notify(`Failed to fetch test types${status}: ${msg}. Check console for details.`);
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
            fetchTestTypes();
        } catch (error: any) {
            console.error("Save error:", error);
            const msg = error.response?.data?.error || error.message || "Failed to save";
            notify(`Error: ${msg}`);
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

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader
                title="Create-TestType"
                actions={(
                    <button
                        onClick={openAddModal}
                        disabled={!academicYear}
                        className="btn-primary"
                    >
                        <Plus size={18} /> Add Test Type
                    </button>
                )}
            />

            {/* Filters */}
            <div className="card flex flex-wrap gap-4 mb-6 p-4">
                <div>
                    <label className="label">Academic Year</label>
                    <div className="input bg-slate-50 text-slate-700 min-w-[150px]">
                        {academicYear}
                    </div>
                </div>
                <div>
                    {/* Branch and Location are no longer used for filtering tests */}
                </div>
            </div>

            {/* List */}
            <div className="card overflow-hidden text-sm">
                <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                <div className="grid grid-cols-12 bg-slate-50 p-3 font-semibold text-slate-600 border-b border-slate-200">
                    <div className="col-span-1 text-center">Order</div>
                    <div className="col-span-5">Test Name</div>
                    <div className="col-span-3 text-center">Max Marks (Ref)</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-1 text-center">Actions</div>
                </div>

                {loading ? (
                    <LoadingState />
                ) : testTypes.length === 0 ? (
                    <EmptyState compact title="No test types found" description="Add one to get started." />
                ) : (
                    testTypes.map((t, idx) => (
                        <div key={t.id} className="grid grid-cols-12 p-3 border-b border-slate-100 hover:bg-slate-50 items-center">
                            <div className="col-span-1 text-center font-mono bg-slate-100 rounded mx-2 py-1">
                                {t.display_order ?? idx + 1}
                            </div>
                            <div className="col-span-5 font-medium text-slate-800">
                                {t.test_name}
                            </div>
                            <div className="col-span-3 text-center text-slate-600">
                                {t.max_marks}
                            </div>
                            <div className="col-span-2 flex justify-center">
                                <button
                                    onClick={() => toggleStatus(t.id)}
                                    className={`btn btn-sm ${t.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    {t.is_active ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                            <div className="col-span-1 flex justify-center gap-2">
                                <button onClick={() => openEditModal(t)} className="btn-icon h-8 w-8 text-brand-600 hover:bg-brand-50 hover:text-brand-700" title="Edit">
                                    <Pencil size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
                </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex items-center justify-center z-50">
                    <div className="card shadow-pop w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="text-base font-semibold text-slate-900">
                                {editingId ? 'Edit Test Type' : 'Add Test Type'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="btn-icon h-8 w-8">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Test Name *</label>
                                <input
                                    type="text"
                                    value={formData.test_name}
                                    onChange={e => setFormData({ ...formData, test_name: e.target.value })}
                                    className="input"
                                    placeholder="e.g. Unit Test 1"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="label">Max Marks (Ref) *</label>
                                    <input
                                        type="number"
                                        value={formData.max_marks}
                                        onChange={e => setFormData({ ...formData, max_marks: parseInt(e.target.value) || 0 })}
                                        className="input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.display_order ?? ''}
                                    onChange={e => setFormData({ ...formData, display_order: e.target.value ? parseInt(e.target.value) : undefined })}
                                    className="input"
                                    placeholder="Auto"
                                />
                                <p className="text-xs text-slate-500 mt-1">Leave empty for auto-increment</p>
                            </div>

                            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <p><strong>Context:</strong> {academicYear} (Global)</p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formData.test_name}
                                className="btn-primary"
                            >
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestTypeManager;
