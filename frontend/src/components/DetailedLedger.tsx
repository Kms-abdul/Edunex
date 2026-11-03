import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmptyState, LoadingState, DataList, Field } from './ui';
import type { Column } from './ui';
import Filters from './cash/Filters';
import StatTiles from './cash/StatTiles';
import Sheet from './cash/Sheet';

interface LedgerDetailRow {
    date: string;
    voucher_no: string;
    voucher_type: string;
    ledger_type?: string;
    ledger_name: string;
    narration: string;
    debit: number;
    credit: number;
    items?: { item_name: string; amount: number }[];
}

interface DetailedLedgerProps {
    filterMonth?: string;
}

const DetailedLedger: React.FC<DetailedLedgerProps> = ({ filterMonth }) => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const globalBranchName = localStorage.getItem('currentBranch') || 'All';
    // The financial year always follows the academic year chosen in the header.
    const academicYear = globalYear;
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('All');
    const [detailsData, setDetailsData] = useState<LedgerDetailRow[]>([]);
    const [selectedTxn, setSelectedTxn] = useState<LedgerDetailRow | null>(null);
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

    const fetchDetails = async () => {
        if (!selectedBranch || selectedBranch === 'All') return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/petty-cash-report/ledger-details?branch_id=${selectedBranch}`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setDetailsData(data);
            } else {
                setDetailsData([]);
            }
        } catch (e) {
            console.error(e);
            setDetailsData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    useEffect(() => {
        if (selectedBranch && selectedBranch !== 'All') {
            fetchDetails();
        }
    }, [selectedBranch, academicYear]);

    const filteredData = React.useMemo(() => {
        if (!filterMonth) return detailsData;
        return detailsData.filter(row => {
            // row.date is like "2026-06-01"
            const parts = row.date.split('-');
            if (parts.length >= 3) {
                const yr = parts[0];
                const mn = parseInt(parts[1]) - 1;
                const dateObj = new Date(parseInt(yr), mn, 1);
                const monthStr = dateObj.toLocaleString('en-US', { month: 'short' });
                return `${monthStr}-${yr}` === filterMonth;
            }
            return true;
        });
    }, [detailsData, filterMonth]);

    const handleExcelExport = () => {
        const totalDebit = filteredData.reduce((sum, r) => sum + r.debit, 0);
        const totalCredit = filteredData.reduce((sum, r) => sum + r.credit, 0);

        const wsData = [
            ["S.No", "Voucher Date", "Voucher No", "Ledger Type", "Ledger Head", "Narration", "Debit (Dr)", "Credit (Cr)"],
            ...filteredData.map((row, idx) => [
                idx + 1,
                row.date,
                row.voucher_no,
                row.ledger_type || '',
                row.ledger_name,
                row.narration,
                row.debit > 0 ? row.debit : '-',
                row.credit > 0 ? row.credit : '-'
            ]),
            ["", "", "", "", "", "Total:", totalDebit, totalCredit]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Detailed Ledger");

        const colWidths = [
            { wch: 6 },
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            { wch: 20 },
            { wch: 30 },
            { wch: 15 },
            { wch: 15 }
        ];
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `Detailed_Ledger_${academicYear}.xlsx`);
    };

    const branchName = branches.find(b => String(b.id) === String(selectedBranch))?.branch_name || '';
    const totalDebit = filteredData.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = filteredData.reduce((sum, row) => sum + row.credit, 0);

    const columns: Column<LedgerDetailRow>[] = [
        { key: 'narration', header: 'Details', primary: true, render: row => row.narration || row.ledger_name || '—' },
        { key: 'date', header: 'Date', secondary: true, render: row => `${row.date} · ${row.voucher_no}` },
        { key: 'ledger_name', header: 'Head', render: row => <>{row.ledger_name}{row.ledger_type ? <span className="text-slate-500"> ({row.ledger_type})</span> : null}</> },
        { key: 'debit', header: 'Money in', align: 'right', render: row => <span className="text-emerald-600">{row.debit > 0 ? row.debit.toFixed(2) : '-'}</span> },
        { key: 'credit', header: 'Money out', align: 'right', render: row => <span className="text-rose-600">{row.credit > 0 ? row.credit.toFixed(2) : '-'}</span> },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">
                    Petty cash entries {filterMonth ? `· ${filterMonth}` : ''}
                </h2>
                <p className="text-sm text-slate-500">Every entry one by one. Tap an entry to see its items.</p>
            </div>

            <Filters
                summary={<>Showing {branchName || 'branch'} · {filterMonth ? `${filterMonth} · ` : ''}Academic year {academicYear}</>}
                collapsible={filteredData.length > 0}
                actions={
                    <button type="button" onClick={handleExcelExport} className="btn-secondary text-emerald-700">
                        <FileSpreadsheet size={16} /> Download Excel
                    </button>
                }
            >
                <Field label="Branch" htmlFor="dl-branch">
                    <select
                        id="dl-branch"
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

            {!loading && filteredData.length > 0 && (
                <StatTiles
                    tiles={[
                        { label: 'Money in', value: `₹ ${totalDebit.toFixed(2)}`, tone: 'success' },
                        { label: 'Money out', value: `₹ ${totalCredit.toFixed(2)}`, tone: 'danger' },
                    ]}
                />
            )}

            {loading ? (
                <div className="card"><LoadingState label="Loading entries…" /></div>
            ) : filteredData.length === 0 ? (
                <div className="card"><EmptyState compact title="No entries found" /></div>
            ) : (
                <DataList
                    columns={columns}
                    rows={filteredData}
                    rowKey={(_, i) => i}
                    onRowClick={row => setSelectedTxn(row)}
                />
            )}

            {selectedTxn && (
                <Sheet
                    title={`Entry ${selectedTxn.voucher_no}`}
                    subtitle={selectedTxn.date}
                    onClose={() => setSelectedTxn(null)}
                    footer={<button onClick={() => setSelectedTxn(null)} className="btn-secondary btn-lg">Close</button>}
                >
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-5">
                        <div><dt className="text-slate-500">Type</dt><dd className="text-slate-900">{selectedTxn.voucher_type}</dd></div>
                        <div><dt className="text-slate-500">Type of head</dt><dd className="text-slate-900">{selectedTxn.ledger_type || '—'}</dd></div>
                        <div className="col-span-2"><dt className="text-slate-500">Head</dt><dd className="text-slate-900">{selectedTxn.ledger_name}</dd></div>
                        <div className="col-span-2"><dt className="text-slate-500">Details</dt><dd className="text-slate-900 break-words">{selectedTxn.narration || '—'}</dd></div>
                        <div><dt className="text-slate-500">Money in</dt><dd className="text-emerald-700 font-semibold">{selectedTxn.debit > 0 ? selectedTxn.debit.toFixed(2) : '-'}</dd></div>
                        <div><dt className="text-slate-500">Money out</dt><dd className="text-rose-600 font-semibold">{selectedTxn.credit > 0 ? selectedTxn.credit.toFixed(2) : '-'}</dd></div>
                    </dl>

                    {selectedTxn.items && selectedTxn.items.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-slate-900 mb-2">Items</h4>
                            <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                                {selectedTxn.items.map((item, idx) => (
                                    <li key={idx} className="flex justify-between gap-3 px-3 py-2">
                                        <span className="break-words min-w-0">{item.item_name}</span>
                                        <span className="tabular-nums">{item.amount.toFixed(2)}</span>
                                    </li>
                                ))}
                                <li className="flex justify-between gap-3 px-3 py-2 bg-slate-50 font-semibold">
                                    <span>Total</span>
                                    <span className="tabular-nums">{selectedTxn.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                                </li>
                            </ul>
                        </div>
                    )}
                </Sheet>
            )}
        </div>
    );
};

export default DetailedLedger;
