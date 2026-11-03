import React, { useState, useEffect } from 'react';
import api from '../api';
import { ArrowBackIcon } from './icons';
import { notify, confirmDialog } from './ui/feedback';
import { LoadingState, EmptyState } from './ui';

interface ChangeSectionProps {
    onBack?: () => void;
}

const ChangeSection: React.FC<ChangeSectionProps> = ({ onBack }) => {
    // -------------------------------------------------------------
    // Source State 
    // -------------------------------------------------------------
    const [academicYear] = useState(localStorage.getItem('academicYear') || '');
    const [sourceClass, setSourceClass] = useState('');
    const [sourceSection, setSourceSection] = useState('');
    const [sourceStudents, setSourceStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [sourceSearch, setSourceSearch] = useState('');

    // -------------------------------------------------------------
    // Target State
    // -------------------------------------------------------------
    const [targetSection, setTargetSection] = useState('');

    // -------------------------------------------------------------
    // Common Data
    // -------------------------------------------------------------
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [loadingSource, setLoadingSource] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        // Fetch Classes
        api.get('/classes')
            .then(res => setClasses(res.data.classes || []))
            .catch(err => {
                console.error('Failed to fetch classes:', err);
            });
    }, []);

    useEffect(() => {
        if (!sourceClass) {
            setSections([]);
            setSourceSection('');
            return;
        }
        const branch = localStorage.getItem('currentBranch') || 'All';
        api.get('/sections', {
            params: {
                class: sourceClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSections(res.data.sections || []))
            .catch(() => setSections([]));
    }, [sourceClass, academicYear]);

    // Fetch Source Students
    useEffect(() => {
        if (!academicYear || !sourceClass || !sourceSection) {
            setSourceStudents([]);
            return;
        }
        setLoadingSource(true);
        const globalBranch = localStorage.getItem('currentBranch') || 'All';

        api.get('/students', {
            params: {
                class: sourceClass,
                section: sourceSection,
                search: sourceSearch,
                branch: globalBranch,
            },
            headers: {
                'X-Academic-Year': academicYear
            }
        })
            .then(res => setSourceStudents(res.data.students || []))
            .catch(err => {
                console.error(err);
                notify("Error fetching students: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setLoadingSource(false));
    }, [academicYear, sourceClass, sourceSection, sourceSearch]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedStudentIds(sourceStudents.map(s => s.student_id).filter((id): id is number => id !== undefined));
        } else {
            setSelectedStudentIds([]);
        }
    };

    const handleSelectOne = (id: number | undefined) => {
        if (!id) return;
        if (selectedStudentIds.includes(id)) {
            setSelectedStudentIds(selectedStudentIds.filter(i => i !== id));
        } else {
            setSelectedStudentIds([...selectedStudentIds, id]);
        }
    };

    const handleChangeSection = async () => {
        if (selectedStudentIds.length === 0) return notify("Select students to change section");
        if (!targetSection) return notify("Select target section");
        if (sourceSection === targetSection) return notify("Source and Target section cannot be same");

        if (!await confirmDialog(`Change section for ${selectedStudentIds.length} students to ${sourceClass} - ${targetSection}?`)) return;

        setProcessing(true);
        try {
            await api.post('/students/change-section-bulk', {
                student_ids: selectedStudentIds,
                target_class: sourceClass,
                target_section: targetSection
            }, {
                headers: { 'X-Academic-Year': academicYear }
            });
            notify("Sections changed successfully!");

            // Refresh source students
            setSourceStudents(prev =>
                prev.filter(s => s.student_id === undefined || !selectedStudentIds.includes(s.student_id))
            );
            setSelectedStudentIds([]);
            setTargetSection('');

        } catch (error: any) {
            console.error(error);
            notify("Failed to change sections: " + (error.response?.data?.error || error.message));
        } finally {
            setProcessing(false);
        }
    };

    const selectedStudentsList = sourceStudents.filter(s => s.student_id && selectedStudentIds.includes(s.student_id));

    return (
        <div className="p-4 sm:p-6 bg-surface-muted min-h-full">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button onClick={onBack} className="btn-icon" aria-label="Go back">
                            <ArrowBackIcon className="w-5 h-5 text-slate-600" />
                        </button>
                    )}
                    <h2 className="text-base font-semibold text-slate-900">Change in Section</h2>
                </div>
                <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-200">
                    Academic Year: {academicYear}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:h-[75vh]">
                {/* ----------------- LEFT PANEL: SOURCE STUDENTS ----------------- */}
                <div className="card flex-[1.5] min-w-0 flex flex-col overflow-hidden">
                    <div className="p-4 bg-brand-50 border-b border-slate-200">
                        <h3 className="font-semibold text-brand-800 mb-3 uppercase tracking-wider text-sm">Students</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <select
                                value={sourceClass}
                                onChange={e => { setSourceClass(e.target.value); setSourceSection(''); }}
                                className="input w-auto"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                            </select>
                            <select
                                value={sourceSection}
                                onChange={e => setSourceSection(e.target.value)}
                                className="input w-auto"
                                disabled={!sourceClass}
                            >
                                <option value="">Select Section</option>
                                {sections.map(section => <option key={section} value={section}>{section}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <input
                                placeholder="Search students by name or admission no..."
                                className="input pl-10"
                                value={sourceSearch}
                                onChange={e => setSourceSearch(e.target.value)}
                            />
                            <span className="absolute left-3 top-2.5 opacity-40">🔍</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr className="text-left border-b">
                                    <th className="p-3 w-12"><input type="checkbox" onChange={handleSelectAll} checked={sourceStudents.filter(s => s.student_id !== undefined).length > 0 && selectedStudentIds.length === sourceStudents.filter(s => s.student_id !== undefined).length} className="w-4 h-4 rounded text-brand-600" /></th>
                                    <th className="p-3">Admission No</th>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Father Name</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loadingSource ? (
                                    <tr><td colSpan={4}><LoadingState label="Loading students..." /></td></tr>
                                ) : sourceStudents.length === 0 ? (
                                    <tr><td colSpan={4}><EmptyState compact title="No records found" description="Please select class and section." /></td></tr>
                                ) : (
                                    sourceStudents.map((s) => (
                                        <tr key={s.student_id ?? s.admNo ?? s.admission_no} className={`hover:bg-brand-50 transition-colors ${s.student_id && selectedStudentIds.includes(s.student_id) ? 'bg-brand-50/50' : ''}`}>
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={s.student_id ? selectedStudentIds.includes(s.student_id) : false}
                                                    onChange={() => handleSelectOne(s.student_id)}
                                                    className="w-4 h-4 rounded text-brand-600"
                                                />
                                            </td>
                                            <td className="p-3 font-mono text-gray-600">{s.admNo || s.admission_no}</td>
                                            <td className="p-3 font-semibold text-gray-800">{s.name}</td>
                                            <td className="p-3 text-gray-600">{s.father}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">Total: <b className="text-brand-700">{sourceStudents.length}</b></span>
                        <span className="text-slate-600 font-medium">Selected: <b className="text-brand-700">{selectedStudentIds.length}</b></span>
                    </div>
                </div>

                {/* ----------------- RIGHT PANEL: SELECTED STUDENTS & ACTION ----------------- */}
                <div className="card flex-1 min-w-0 flex flex-col overflow-hidden">
                    <div className="p-4 bg-emerald-50 border-b border-slate-200">
                        <h3 className="font-semibold text-emerald-800 mb-3 uppercase tracking-wider text-sm">Selected Students</h3>
                        <div className="flex flex-wrap gap-3">
                            <select
                                value={targetSection}
                                onChange={e => setTargetSection(e.target.value)}
                                className="input flex-1 min-w-[10rem]"
                            >
                                <option value="">Select Target Section</option>
                                {sections.filter(s => s !== sourceSection).map(section => <option key={section} value={section}>{section}</option>)}
                            </select>
                            <button
                                onClick={handleChangeSection}
                                disabled={selectedStudentIds.length === 0 || !targetSection || processing}
                                className={`btn ${selectedStudentIds.length > 0 && targetSection && !processing ? 'bg-brand-600 text-brand-contrast hover:bg-brand-700 active:transform active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                {processing ? 'Processing...' : 'Click here for change section'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-slate-50/30">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-10 shadow-sm border-b">
                                <tr className="text-left">
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Adm No</th>
                                    <th className="p-3">Father Name</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {selectedStudentsList.length === 0 ? (
                                    <tr><td colSpan={3}><EmptyState compact title="No students selected" description="No students selected from the left panel." /></td></tr>
                                ) : (
                                    selectedStudentsList.map((s) => (
                                        <tr key={s.student_id} className="bg-white">
                                            <td className="p-3 font-semibold text-gray-800">{s.name}</td>
                                            <td className="p-3 font-mono text-gray-600">{s.admNo || s.admission_no}</td>
                                            <td className="p-3 text-gray-600">{s.father}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">Selected Count: <b className="text-emerald-700">{selectedStudentIds.length}</b></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangeSection;
