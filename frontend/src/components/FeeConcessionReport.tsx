import React, { useState, useEffect } from 'react';
import api from '../api';

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
            alert(err.response?.data?.error || 'Failed to load details');
            setDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="container mx-auto p-6 font-sans">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-6 flex items-center">
                <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                </span>
                Fee Concession Report
            </h2>

            {loading ? (
                <div className="card p-4 text-center">Loading report...</div>
            ) : error ? (
                <div className="card p-4 text-red-500 text-center">Error: {error}</div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-sm text-left">
                            <thead className="border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-4">Student</th>
                                    <th className="px-4 py-4">Adm No</th>
                                    <th className="px-4 py-4">Class</th>
                                    <th className="px-4 py-4">Branch</th>
                                    <th className="px-4 py-4">Concession Type</th>
                                    <th className="px-4 py-4">Assigned By</th>
                                    <th className="px-4 py-4 text-right">Total Fee</th>
                                    <th className="px-4 py-4 text-right">Concession</th>
                                    <th className="px-4 py-4 text-right">Paid</th>
                                    <th className="px-4 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {concessions.length === 0 ? (
                                    <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No concessions found</td></tr>
                                ) : (
                                    concessions.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4 font-medium text-slate-800">{c.student_name}</td>
                                            <td className="px-4 py-4 text-slate-600">{c.admission_no}</td>
                                            <td className="px-4 py-4 text-slate-600">{c.class} {c.section}</td>
                                            <td className="px-4 py-4 text-slate-600">{c.branch}</td>
                                            <td className="px-4 py-4 text-slate-600">{c.fee_type_name}</td>
                                            <td className="px-4 py-4 text-slate-600">{c.assigned_by}</td>
                                            <td className="px-4 py-4 text-right font-medium">₹{(c.total_gross || 0).toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right font-medium text-emerald-600">₹{(c.total_concession || 0).toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right font-medium text-blue-600">₹{(c.total_paid || 0).toLocaleString()}</td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    onClick={() => handleViewDetails(c)}
                                                    className="btn-primary btn-sm"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal for Details */}
            {selectedStudent && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="card shadow-pop w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Concession Details</h3>
                                <p className="text-sm text-slate-500 mt-1">{selectedStudent.student_name} ({selectedStudent.admission_no})</p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="btn-icon text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {loadingDetails ? (
                                <div className="text-center py-8 text-slate-500">Loading details...</div>
                            ) : (
                                <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                                    <thead className="border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Installment</th>
                                            <th className="px-4 py-3">Fee Type</th>
                                            <th className="px-4 py-3 text-right">Total Fee</th>
                                            <th className="px-4 py-3 text-right">Concession</th>
                                            <th className="px-4 py-3 text-right">Paid</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {details.length === 0 ? (
                                            <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No details found</td></tr>
                                        ) : (
                                            details.map((d, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">{d.installment}</td>
                                                    <td className="px-4 py-3 text-slate-600">{d.fee_type}</td>
                                                    <td className="px-4 py-3 text-right font-medium">₹{(d.total_fee || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-emerald-600">₹{(d.concession || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-blue-600">₹{(d.paid || 0).toLocaleString()}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                                            d.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {d.status || 'Unpaid'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeeConcessionReport;
