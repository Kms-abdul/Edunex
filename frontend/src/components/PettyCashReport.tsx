import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { API_URL } from '../config';
import MonthWiseLedger from './MonthWiseLedger';
import DetailedLedger from './DetailedLedger';
import { Spinner, DataList, Field } from './ui';
import type { Column } from './ui';
import Filters from './cash/Filters';
import StatTiles from './cash/StatTiles';
import SegmentTabs from './cash/SegmentTabs';
import MonthGrid from './cash/MonthGrid';

interface BranchWiseRow {
    branch_id: number;
    branch_name: string;
    months: { [key: string]: number };
    total: number;
}

interface LedgerHeadRow {
    ledger_id: number;
    ledger_head: string;
    months: { [key: string]: number };
    total: number;
}

interface BranchDetail {
    sno: number;
    date: string;
    branch_name: string;
    voucher_no: string;
    paying_account: string;
    voucher_type: string;
    ledger_type: string;
    ledger_head: string;
    ledger_name: string;
    paid_to: string;
    description: string;
    created_by: string;
    approved_by: string;
    amount: number;
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const PettyCashReport: React.FC = () => {
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
    const globalBranchName = localStorage.getItem('currentBranch') || 'All';
    const [academicYear, setAcademicYear] = useState<string>(globalYear);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('All');
    const [branchWise, setBranchWise] = useState<BranchWiseRow[]>([]);
    const [ledgerHead, setLedgerHead] = useState<LedgerHeadRow[]>([]);
    const [branchDetails, setBranchDetails] = useState<BranchDetail[]>([]);
    const [showDetails, setShowDetails] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'month-ledger' | 'details-ledger'>('summary');

    const getHeaders = (): Record<string, string> => {
        const token = localStorage.getItem('token') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Academic-Year': academicYear,
        };
    };

    // Calculate dynamic months based on data (from first month with data to last month with data)
    const activeMonths = useMemo(() => {
        let firstIndex = -1;
        let lastIndex = -1;

        const checkMonths = (monthsData: Record<string, number>) => {
            MONTHS.forEach((m, idx) => {
                if (monthsData[m] > 0) {
                    if (firstIndex === -1 || idx < firstIndex) firstIndex = idx;
                    if (idx > lastIndex) lastIndex = idx;
                }
            });
        };

        branchWise.forEach(row => checkMonths(row.months || {}));
        ledgerHead.forEach(row => checkMonths(row.months || {}));

        if (firstIndex === -1) return MONTHS; // fallback if no data
        return MONTHS.slice(firstIndex, lastIndex + 1);
    }, [branchWise, ledgerHead]);

    // Fetch branches
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await fetch(`${API_URL}/branches`, { headers: getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    const fetchedBranches = data.branches || [];
                    setBranches(fetchedBranches);

                    if (globalBranchName !== 'All') {
                        const found = fetchedBranches.find((b: any) => b.branch_name === globalBranchName);
                        if (found) {
                            setSelectedBranch(found.id.toString());
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load branches', e);
            }
        };
        fetchBranches();
    }, []);

    // Fetch branch-wise expenses
    useEffect(() => {
        const fetchBranchWise = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/petty-cash-report/branch-wise`, { headers: getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setBranchWise(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchBranchWise();
    }, [academicYear]);

    // Fetch ledger head expenses
    useEffect(() => {
        const fetchLedgerHead = async () => {
            try {
                const params = new URLSearchParams();
                if (selectedBranch && selectedBranch !== 'All') params.append('branch_id', selectedBranch);
                const res = await fetch(`${API_URL}/petty-cash-report/ledger-head?${params.toString()}`, { headers: getHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setLedgerHead(data);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchLedgerHead();
    }, [academicYear, selectedBranch]);

    const handleBranchClick = async (branchId: number | null) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (branchId) params.append('branch_id', String(branchId));
            const res = await fetch(`${API_URL}/petty-cash-report/branch-details?${params.toString()}`, { headers: getHeaders() });
            if (res.ok) {
                const data = await res.json();
                setBranchDetails(data);
                setShowDetails(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        try {
            const params = new URLSearchParams();
            if (selectedBranch && selectedBranch !== 'All') params.append('branch_id', selectedBranch);
            const token = localStorage.getItem('token') || '';
            const res = await fetch(`${API_URL}/petty-cash-report/export-excel?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Academic-Year': academicYear,
                }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Petty_Cash_Report_${academicYear}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const formatAmount = (n: number) => n.toFixed(2);

    const currentDateTime = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    // Build academic year options (previous, current, next)
    const academicYears = useMemo(() => {
        const startYear = parseInt(globalYear.split('-')[0], 10) || 2026;
        return [
            `${startYear - 1}-${startYear}`,
            `${startYear}-${startYear + 1}`,
            `${startYear + 1}-${startYear + 2}`
        ];
    }, [globalYear]);

    const [selectedDetailMonth, setSelectedDetailMonth] = useState<string | undefined>();
    const detailsRef = useRef<HTMLDivElement>(null);
    // Bring the entries into view when they open (on phones they are far below).
    useEffect(() => {
        if (showDetails) detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [showDetails, branchDetails]);

    const branchFilterName = selectedBranch === 'All'
        ? 'All branches'
        : branches.find(b => String(b.id) === String(selectedBranch))?.branch_name || 'Branch';

    const detailColumns: Column<BranchDetail>[] = [
        { key: 'ledger_name', header: 'Items', primary: true, render: d => d.ledger_name || d.ledger_head || '—' },
        { key: 'date', header: 'Date', secondary: true, render: d => `${d.date} · ${d.branch_name}` },
        { key: 'sno', header: 'S.No', hideOnMobile: true },
        { key: 'voucher_no', header: 'Voucher No.' },
        { key: 'paying_account', header: 'Paid from', hideOnMobile: true },
        { key: 'voucher_type', header: 'Type', hideOnMobile: true },
        { key: 'ledger_type', header: 'Type of head', hideOnMobile: true },
        { key: 'ledger_head', header: 'Head' },
        { key: 'paid_to', header: 'Paid to', render: d => d.paid_to || '—' },
        { key: 'description', header: 'Note', render: d => d.description || '—', hideOnMobile: true },
        { key: 'created_by', header: 'Made by', hideOnMobile: true },
        { key: 'approved_by', header: 'Approved by', render: d => d.approved_by || '—' },
        { key: 'amount', header: 'Amount', align: 'right', render: d => <span className="font-semibold">{formatAmount(d.amount)}</span> },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Petty cash report</h2>
                <p className="text-sm text-slate-500">See where petty cash was spent, month by month.</p>
            </div>

            {/* Tabs */}
            <SegmentTabs
                value={activeTab}
                onChange={(t) => {
                    if (t === 'details-ledger') setSelectedDetailMonth(undefined);
                    setActiveTab(t);
                }}
                options={[
                    { value: 'summary', label: 'Spending' },
                    { value: 'month-ledger', label: 'By month' },
                    { value: 'details-ledger', label: 'All entries' },
                ]}
            />

            {activeTab === 'month-ledger' && (
                <MonthWiseLedger
                    onMonthClick={(month) => {
                        setSelectedDetailMonth(month);
                        setActiveTab('details-ledger');
                    }}
                />
            )}
            {activeTab === 'details-ledger' && (
                <DetailedLedger filterMonth={selectedDetailMonth} />
            )}

            {activeTab === 'summary' && (
                <>
                    <Filters
                        summary={<>Money spent · {academicYear} · as on {currentDateTime}</>}
                        collapsible={branchWise.length > 0 || ledgerHead.length > 0}
                    >
                        <Field label="Academic year" htmlFor="pcr-year">
                            <select
                                id="pcr-year"
                                className="input min-h-[44px]"
                                value={academicYear}
                                onChange={(e) => setAcademicYear(e.target.value)}
                            >
                                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </Field>
                        <Field label="Branch (for spending by head)" htmlFor="pcr-branch">
                            <select
                                id="pcr-branch"
                                className="input min-h-[44px]"
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                                <option value="All">All Branches</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                            </select>
                        </Field>
                    </Filters>

                    <p className="text-sm text-slate-500">Only money spent is shown here (not money received).</p>

                    {/* Branch Wise Expenses Section */}
                    <div className="card overflow-hidden">
                        <div className="card-header !px-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">Spending by branch</h3>
                                <p className="text-sm text-slate-500">Tap a branch to see its entries.</p>
                            </div>
                        </div>
                        <MonthGrid
                            firstHeader="Branch"
                            months={activeMonths}
                            format={formatAmount}
                            emptyTitle={loading ? 'Loading…' : 'No data'}
                            rows={branchWise.map(row => ({
                                key: row.branch_id,
                                label: row.branch_name,
                                months: row.months,
                                total: row.total,
                                onClick: () => handleBranchClick(row.branch_id),
                            }))}
                        />
                    </div>

                    {/* Ledger Head Expenses Section */}
                    <div className="card overflow-hidden">
                        <div className="card-header !px-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">Spending by head</h3>
                                <p className="text-sm text-slate-500">{branchFilterName}. Tap a head to see all entries.</p>
                            </div>
                        </div>
                        <MonthGrid
                            firstHeader="Head"
                            months={activeMonths}
                            format={formatAmount}
                            emptyTitle={loading ? 'Loading…' : 'No data'}
                            rows={ledgerHead.map(row => ({
                                key: row.ledger_id,
                                label: row.ledger_head,
                                months: row.months,
                                total: row.total,
                                onClick: () => handleBranchClick(null),
                            }))}
                        />
                    </div>

                    {/* Branch Expense Details Section */}
                    {showDetails && (
                        <div ref={detailsRef} className="space-y-3 scroll-mt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-base font-semibold text-slate-900">Entries</h3>
                                <div className="flex gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                                    <button className="btn-success" onClick={handleExportExcel}>
                                        <FileSpreadsheet size={16} /> Download Excel
                                    </button>
                                    <button className="btn-secondary" onClick={() => setShowDetails(false)}>
                                        Close
                                    </button>
                                </div>
                            </div>
                            {branchDetails.length > 0 && (
                                <StatTiles
                                    tiles={[
                                        { label: 'Entries', value: branchDetails.length },
                                        { label: 'Total', value: formatAmount(branchDetails.reduce((s, d) => s + d.amount, 0)), tone: 'danger' },
                                    ]}
                                />
                            )}
                            <DataList
                                columns={detailColumns}
                                rows={branchDetails}
                                rowKey={(d, i) => d.sno ?? i}
                                emptyTitle="No data"
                            />
                        </div>
                    )}
                </>
            )}

            {loading && <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500"><Spinner size="sm" /> Loading...</div>}
        </div>
    );
};

export default PettyCashReport;
