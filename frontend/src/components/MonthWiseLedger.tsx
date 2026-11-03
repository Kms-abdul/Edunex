import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { notify } from './ui/feedback';
import { EmptyState, LoadingState } from './ui';

interface LedgerRow {
    particulars: string;
    debit: number;
    credit: number;
    cash_in_hand: number;
    is_opening: boolean;
}

interface MonthWiseLedgerProps {
    onMonthClick?: (month: string) => void;
}

const MonthWiseLedger: React.FC<MonthWiseLedgerProps> = ({ onMonthClick }) => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const globalBranchName = localStorage.getItem('currentBranch') || 'All';
    // The financial year always follows the academic year chosen in the header.
    const academicYear = globalYear;
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('All');
    const [ledgerData, setLedgerData] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem('token') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Academic-Year': academicYear,
        };
    };

    const fetchBranches = async () => {
        try {
            const res = await fetch(`${API_URL}/branches`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                const fetchedBranches = data.branches || [];
                setBranches(fetchedBranches);

                if (globalBranchName !== 'All') {
                    const found = fetchedBranches.find((b: any) => b.branch_name === globalBranchName);
                    if (found) setSelectedBranch(found.id.toString());
                } else if (fetchedBranches.length > 0) {
                    setSelectedBranch(fetchedBranches[0].id.toString());
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchLedger = async () => {
        if (!selectedBranch || selectedBranch === 'All') return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/petty-cash-report/month-wise-ledger?branch_id=${selectedBranch}`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setLedgerData(data);
            } else {
                setLedgerData([]);
            }
        } catch (e) {
            console.error(e);
            setLedgerData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    useEffect(() => {
        if (selectedBranch && selectedBranch !== 'All') {
            fetchLedger();
        }
    }, [selectedBranch, academicYear]);

    const activeLedgerData = React.useMemo(() => {
        if (!ledgerData || ledgerData.length === 0) return [];

        // Find the index of the last month that has non-zero debit or credit
        let lastActiveIdx = 0; // default to first month after opening balance
        for (let i = 1; i < ledgerData.length; i++) {
            if (ledgerData[i].debit > 0 || ledgerData[i].credit > 0) {
                lastActiveIdx = i;
            }
        }

        // If there's no data at all, just show Opening Balance and the first month (April)
        if (lastActiveIdx === 0 && ledgerData.length > 1) {
            return ledgerData.slice(0, 2);
        }

        return ledgerData.slice(0, lastActiveIdx + 1);
    }, [ledgerData]);

    const handleExportExcel = () => {
        if (activeLedgerData.length === 0) {
            notify.warning('There is no ledger data to export.');
            return;
        }
        const branchName = branches.find(b => String(b.id) === String(selectedBranch))?.branch_name || selectedBranch;
        const rows = activeLedgerData.map(r => ({
            'Particulars': r.particulars,
            'Debit (Allocated)': Number(r.debit.toFixed(2)),
            'Credit (Spent)': Number(r.credit.toFixed(2)),
            'Cash in hand': Number(r.cash_in_hand.toFixed(2)),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cash Ledger');
        XLSX.writeFile(wb, `Month_Wise_Cash_Ledger_${String(branchName).replace(/\s+/g, '_')}_${academicYear}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <h2 className="page-title">
                Month wise cash ledger
            </h2>
            <div className="card overflow-hidden">
                <div className="card-header flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-slate-900">📅 Month wise cash ledger</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-700">Branch:</span>
                            <select
                                className="input w-auto"
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-700">FY:</span>
                            {/* Follows the academic year selected in the header (Apr–Mar of that year) */}
                            <span className="badge-brand text-xs" title="Change the academic year from the header">{academicYear}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={loading || activeLedgerData.length === 0}
                            className="btn-secondary btn-sm text-emerald-700"
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-3 border">Particulars</th>
                                <th className="p-3 border text-right">Debit (Allocated)</th>
                                <th className="p-3 border text-right">Credit (Spent)</th>
                                <th className="p-3 border text-right">Cash in hand</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeLedgerData.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4}><EmptyState compact title="No data available" description="No data available for the selected branch and FY." /></td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan={4}><LoadingState label="Loading ledger data..." /></td>
                                </tr>
                            )}
                            {activeLedgerData.map((row, idx) => (
                                <tr key={idx} className={row.is_opening ? 'bg-brand-50 font-medium' : 'hover:bg-slate-50'}>
                                    <td className="p-3 border">
                                        {onMonthClick && !row.is_opening ? (
                                            <button
                                                className="text-brand-600 hover:text-brand-800 hover:underline font-medium"
                                                onClick={() => onMonthClick(row.particulars)}
                                            >
                                                {row.particulars}
                                            </button>
                                        ) : (
                                            row.particulars
                                        )}
                                    </td>
                                    <td className="p-3 border text-right text-emerald-600">
                                        {row.debit > 0 ? `₹ ${row.debit.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="p-3 border text-right text-rose-600">
                                        {row.credit > 0 ? `₹ ${row.credit.toFixed(2)}` : '-'}
                                    </td>
                                    <td className={`p-3 border text-right font-semibold ${row.cash_in_hand < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                                        ₹ {row.cash_in_hand.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MonthWiseLedger;
