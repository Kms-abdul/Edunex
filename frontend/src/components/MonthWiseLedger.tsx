import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { notify } from './ui/feedback';
import { EmptyState, LoadingState, DataList, Field } from './ui';
import type { Column } from './ui';
import Filters from './cash/Filters';
import StatTiles from './cash/StatTiles';

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

    const branchName = branches.find(b => String(b.id) === String(selectedBranch))?.branch_name || '';
    const totalIn = activeLedgerData.reduce((s, r) => s + (r.is_opening ? 0 : r.debit), 0);
    const totalOut = activeLedgerData.reduce((s, r) => s + (r.is_opening ? 0 : r.credit), 0);
    const closing = activeLedgerData.length ? activeLedgerData[activeLedgerData.length - 1].cash_in_hand : 0;

    const columns: Column<LedgerRow>[] = [
        {
            key: 'particulars', header: 'Month', primary: true,
            render: row => onMonthClick && !row.is_opening ? (
                <span className="text-brand-700 font-semibold">{row.particulars}</span>
            ) : (
                row.particulars
            ),
        },
        { key: 'debit', header: 'Money given', align: 'right', render: row => <span className="text-emerald-700">{row.debit > 0 ? `₹ ${row.debit.toFixed(2)}` : '-'}</span> },
        { key: 'credit', header: 'Money spent', align: 'right', render: row => <span className="text-rose-600">{row.credit > 0 ? `₹ ${row.credit.toFixed(2)}` : '-'}</span> },
        {
            key: 'cash_in_hand', header: 'Cash in hand', align: 'right',
            render: row => <span className={`font-semibold ${row.cash_in_hand < 0 ? 'text-red-600' : 'text-brand-700'}`}>₹ {row.cash_in_hand.toFixed(2)}</span>,
        },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Petty cash by month</h2>
                <p className="text-sm text-slate-500">
                    Money given to the branch, money spent, and the cash left at the end of each month.
                    {onMonthClick ? ' Tap a month to see its entries.' : ''}
                </p>
            </div>

            <Filters
                summary={<>Showing {branchName || 'branch'} · Academic year {academicYear}</>}
                collapsible={activeLedgerData.length > 0}
                actions={
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={loading || activeLedgerData.length === 0}
                        className="btn-secondary text-emerald-700"
                    >
                        <FileSpreadsheet size={16} /> Download Excel
                    </button>
                }
            >
                <Field label="Branch" htmlFor="mwl-branch">
                    <select
                        id="mwl-branch"
                        className="input min-h-[44px]"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                    </select>
                </Field>
                <Field label="Academic year" hint="Change it from the top bar.">
                    {/* Follows the academic year selected in the header (Apr–Mar of that year) */}
                    <div className="min-h-[44px] flex items-center"><span className="badge-brand text-sm" title="Change the academic year from the header">{academicYear}</span></div>
                </Field>
            </Filters>

            {!loading && activeLedgerData.length > 0 && (
                <StatTiles
                    tiles={[
                        { label: 'Cash in hand now', value: `₹ ${closing.toFixed(2)}`, tone: closing < 0 ? 'danger' : 'brand', wide: true },
                        { label: 'Money given', value: `₹ ${totalIn.toFixed(2)}`, tone: 'success' },
                        { label: 'Money spent', value: `₹ ${totalOut.toFixed(2)}`, tone: 'danger' },
                    ]}
                />
            )}

            {loading ? (
                <div className="card"><LoadingState label="Loading ledger…" /></div>
            ) : activeLedgerData.length === 0 ? (
                <div className="card"><EmptyState compact title="No data available" description="Nothing found for this branch and academic year." /></div>
            ) : (
                <DataList
                    columns={columns}
                    rows={activeLedgerData}
                    rowKey={(_, i) => i}
                    onRowClick={onMonthClick ? (row => { if (!row.is_opening) onMonthClick(row.particulars); }) : undefined}
                />
            )}
        </div>
    );
};

export default MonthWiseLedger;
