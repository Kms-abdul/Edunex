import React, { useState, useEffect } from 'react';
import api from '../api';
import { notify } from './ui/feedback';
import { Badge, DataList, ErrorState, LoadingState } from './ui';
import type { Column } from './ui';

const FeeConcessionReport: React.FC = () => {
    const [concessions, setConcessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [details, setDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get('/reports/fees/concession-report');
            setConcessions(res.data.concessions || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (student: any) => {
        setSelectedStudent(student);
        try {
            setLoadingDetails(true);
            const res = await api.get(`/reports/fees/concession-details/${student.student_id}`);
            setDetails(res.data.details || []);
        } catch (err: any) {
            notify.error(err.response?.data?.error || 'Could not load the details. Please try again.');
            setDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    const money = (n: any) => `₹${(n || 0).toLocaleString()}`;
    const totalConcession = concessions.reduce((sum, c) => sum + (Number(c.total_concession) || 0), 0);

    const columns: Column<any>[] = [
        { key: 'student', header: 'Student', primary: true, render: c => <span className="font-medium text-slate-800">{c.student_name}</span> },
        { key: 'class', header: 'Class', secondary: true, render: c => <>{c.class} {c.section}{c.admission_no ? ` · Adm ${c.admission_no}` : ''}</> },
        { key: 'branch', header: 'Branch', hideOnMobile: true, render: c => c.branch || '-' },
        { key: 'type', header: 'Concession type', render: c => c.fee_type_name || '-' },
        { key: 'by', header: 'Given by', render: c => c.assigned_by || '-' },
        { key: 'gross', header: 'Total fee', align: 'right', render: c => <span className="font-medium">{money(c.total_gross)}</span> },
        { key: 'conc', header: 'Concession', align: 'right', render: c => <span className="font-medium text-emerald-600">{money(c.total_concession)}</span> },
        { key: 'paid', header: 'Paid', align: 'right', render: c => <span className="font-medium text-brand-600">{money(c.total_paid)}</span> },
    ];

    const detailColumns: Column<any>[] = [
        { key: 'inst', header: 'Fee month', primary: true, render: d => d.installment },
        { key: 'type', header: 'Fee', secondary: true, render: d => d.fee_type },
        { key: 'total', header: 'Total fee', align: 'right', render: d => <span className="font-medium">{money(d.total_fee)}</span> },
        { key: 'conc', header: 'Concession', align: 'right', render: d => <span className="font-medium text-emerald-600">{money(d.concession)}</span> },
        { key: 'paid', header: 'Paid', align: 'right', render: d => <span className="font-medium text-brand-600">{money(d.paid)}</span> },
        {
            key: 'status', header: 'Status', render: d => (
                <Badge tone={d.status === 'Paid' ? 'success' : d.status === 'Partially Paid' ? 'warning' : 'danger'}>
                    {d.status || 'Unpaid'}
                </Badge>
            )
        },
    ];

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Concessions given</h2>
                <p className="text-sm text-slate-500">Students who get a fee concession. Tap a student to see it month by month.</p>
            </div>

            {loading ? (
                <div className="card"><LoadingState label="Loading report..." /></div>
            ) : error ? (
                <div className="card"><ErrorState title="Could not load the report" message={error} onRetry={fetchReport} /></div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="card p-4 min-w-0">
                            <p className="text-xs sm:text-sm text-slate-500">Students with a concession</p>
                            <p className="mt-1 text-lg sm:text-2xl font-bold text-slate-900">{concessions.length}</p>
                        </div>
                        <div className="card p-4 min-w-0">
                            <p className="text-xs sm:text-sm text-slate-500">Total concession</p>
                            <p className="mt-1 text-lg sm:text-2xl font-bold text-emerald-700 break-words">₹{totalConcession.toLocaleString()}</p>
                        </div>
                    </div>
                    <DataList
                        columns={columns}
                        rows={concessions}
                        rowKey={(_, i) => i}
                        onRowClick={handleViewDetails}
                        emptyTitle="No concessions found"
                    />
                </>
            )}

            {/* Details dialog */}
            {selectedStudent && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-end sm:items-center z-50 sm:p-4">
                    <div
                        className="card shadow-pop w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] rounded-b-none sm:rounded-b-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="concession-details-title"
                    >
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-start gap-3 bg-slate-50">
                            <div className="min-w-0">
                                <h3 id="concession-details-title" className="text-base font-semibold text-slate-900">Concession details</h3>
                                <p className="text-sm text-slate-500 mt-0.5 break-words">{selectedStudent.student_name} ({selectedStudent.admission_no})</p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="btn-icon text-slate-400 hover:text-slate-600 flex-shrink-0"
                                aria-label="Close"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto">
                            {loadingDetails ? (
                                <LoadingState label="Loading details..." />
                            ) : (
                                <DataList columns={detailColumns} rows={details} rowKey={(_, i) => i} emptyTitle="No details found" />
                            )}
                        </div>

                        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex justify-end">
                            <button type="button" onClick={() => setSelectedStudent(null)} className="btn-secondary min-h-[44px] w-full sm:w-auto">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeeConcessionReport;
