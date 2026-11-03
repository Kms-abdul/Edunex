import React, { useState, useEffect } from 'react';
import api from '../api';
import { ErrorState, LoadingState } from './ui';
import DeletedReceiptList from './fee-reports/DeletedReceiptList';

const DeletedReceiptsReport: React.FC = () => {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchReport();
    }, []);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await api.get('/reports/fees/deleted-receipts');
            setReceipts(res.data.receipts || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900">Cancelled receipts</h2>
                    <p className="text-sm text-slate-500">Receipts that were cancelled, who cancelled them, and why.</p>
                </div>
                {!loading && !error && (
                    <button type="button" onClick={fetchReport} className="btn-secondary btn-sm min-h-[44px] sm:min-h-0 flex-shrink-0">Refresh</button>
                )}
            </div>

            {loading ? (
                <div className="card"><LoadingState label="Loading report..." /></div>
            ) : error ? (
                <div className="card"><ErrorState title="Could not load the report" message={error} onRetry={fetchReport} /></div>
            ) : (
                <>
                    <p className="text-sm text-slate-600">{receipts.length} cancelled {receipts.length === 1 ? 'receipt' : 'receipts'}</p>
                    <DeletedReceiptList receipts={receipts} />
                </>
            )}
        </div>
    );
};

export default DeletedReceiptsReport;
