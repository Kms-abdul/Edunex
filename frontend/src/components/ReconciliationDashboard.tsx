import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../config';
import { FileSpreadsheet, RefreshCw, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Alert, EmptyState, LoadingState, DataList, Field } from './ui';
import type { Column } from './ui';
import StatTiles from './cash/StatTiles';
import SegmentTabs from './cash/SegmentTabs';

interface MonthLedgerRow {
  particulars: string;
  debit: number;
  credit: number;
  cash_in_hand: number;
  is_opening: boolean;
}

interface DetailLedgerRow {
  date: string;
  date_formatted: string;
  voucher_no: string;
  voucher_type: string;
  ledger_type: string;
  ledger_head: string;
  narration: string;
  debit: number;
  credit: number;
  cash_in_hand: number;
  is_opening: boolean;
}

const ReconciliationDashboard: React.FC = () => {
  const globalYear = localStorage.getItem('academicYear') || '2026-2027';
  const globalBranch = localStorage.getItem('currentBranch') || 'All';

  const academicYear = globalYear;
  const [activeTab, setActiveTab] = useState<'month-ledger' | 'details-ledger'>('month-ledger');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');

  const [monthData, setMonthData] = useState<MonthLedgerRow[]>([]);
  const [detailData, setDetailData] = useState<DetailLedgerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => {
    const token = localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Academic-Year': academicYear,
      'X-Branch': globalBranch,
    };
  };

  const fetchMonthLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/reports/reconciliation/month-wise?academic_year=${academicYear}&branch=${encodeURIComponent(globalBranch)}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMonthData(data || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch month wise cash ledger');
        setMonthData([]);
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred while fetching ledger');
      setMonthData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const monthQuery = selectedMonth && selectedMonth !== 'All' ? `&month=${encodeURIComponent(selectedMonth)}` : '';
      const res = await fetch(`${API_URL}/reports/reconciliation/details?academic_year=${academicYear}&branch=${encodeURIComponent(globalBranch)}${monthQuery}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDetailData(data || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to fetch detailed cash ledger');
        setDetailData([]);
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred while fetching ledger details');
      setDetailData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'month-ledger') {
      fetchMonthLedger();
    } else {
      fetchDetailLedger();
    }
  }, [activeTab, academicYear, selectedMonth, globalBranch]);

  const handleMonthClick = (monthLabel: string) => {
    setSelectedMonth(monthLabel);
    setActiveTab('details-ledger');
  };

  const activeMonthLedgerData = useMemo(() => {
    if (!monthData || monthData.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (Jan=0, Aug=7, Sep=8)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return monthData.filter(row => {
      if (row.is_opening) return true;
      if (row.debit > 0 || row.credit > 0) return true;

      const [mStr, yStr] = row.particulars.split('-');
      const rowYear = parseInt(yStr, 10);
      const rowMonth = monthNames.indexOf(mStr);

      if (rowYear < currentYear || (rowYear === currentYear && rowMonth <= currentMonth)) {
        return true;
      }
      return false;
    });
  }, [monthData]);

  const monthTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;

    if (activeMonthLedgerData && activeMonthLedgerData.length > 0) {
      activeMonthLedgerData.forEach(row => {
        totalDebit += (row.debit || 0);
        totalCredit += (row.credit || 0);
      });
      closingBalance = activeMonthLedgerData[activeMonthLedgerData.length - 1].cash_in_hand || 0;
    }

    return { totalDebit, totalCredit, closingBalance };
  }, [activeMonthLedgerData]);

  const detailTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;

    if (detailData && detailData.length > 0) {
      detailData.forEach(row => {
        totalDebit += (row.debit || 0);
        totalCredit += (row.credit || 0);
      });
      closingBalance = detailData[detailData.length - 1].cash_in_hand || 0;
    }

    return { totalDebit, totalCredit, closingBalance };
  }, [detailData]);

  const handleExportMonthExcel = () => {
    if (activeMonthLedgerData.length === 0) return;
    const wsData = [
      ["Reconciliation Dashboard - Month Wise Cash Ledger"],
      ["Branch:", globalBranch, "FY:", academicYear],
      [],
      ["Particulars", "Debit (Cash Fee Collected)", "Credit (Remittance Deposited)", "Cash in Hand (Balance)"],
      ...activeMonthLedgerData.map(row => [
        row.particulars,
        row.debit > 0 ? row.debit : '-',
        row.credit > 0 ? row.credit : '-',
        row.cash_in_hand
      ]),
      [],
      ["Total:", monthTotals.totalDebit > 0 ? monthTotals.totalDebit : '-', monthTotals.totalCredit > 0 ? monthTotals.totalCredit : '-', monthTotals.closingBalance]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Month Wise Ledger");
    XLSX.writeFile(wb, `Month_Wise_Reconciliation_${globalBranch}_${academicYear}.xlsx`);
  };

  const handleExportDetailExcel = () => {
    if (detailData.length === 0) return;
    const wsData = [
      ["Reconciliation Dashboard - Cash Ledger in Details"],
      ["Branch:", globalBranch, "FY:", academicYear, "Month:", selectedMonth],
      [],
      ["S.No", "Date", "Voucher No", "Voucher Type", "Ledger Head / Fee Type", "Narration / Details", "Debit (Dr)", "Credit (Cr)", "Cash in Hand"],
      ...detailData.map((row, idx) => [
        idx + 1,
        row.date_formatted || row.date,
        row.voucher_no,
        row.voucher_type,
        row.ledger_head,
        row.narration,
        row.debit > 0 ? row.debit : '-',
        row.credit > 0 ? row.credit : '-',
        row.cash_in_hand
      ]),
      [],
      ["", "", "", "", "", "Total (Current Period):", detailTotals.totalDebit > 0 ? detailTotals.totalDebit : '-', detailTotals.totalCredit > 0 ? detailTotals.totalCredit : '-', detailTotals.closingBalance]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cash Ledger Details");
    XLSX.writeFile(wb, `Cash_Ledger_Details_${globalBranch}_${selectedMonth}.xlsx`);
  };

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '-';
    return `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatBalance = (val: number) => {
    return `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const monthOptions = useMemo(() => {
    const startYear = parseInt(academicYear.split('-')[0], 10) || 2026;
    const allMonths = [
      `Apr-${startYear}`, `May-${startYear}`, `Jun-${startYear}`, `Jul-${startYear}`,
      `Aug-${startYear}`, `Sep-${startYear}`, `Oct-${startYear}`, `Nov-${startYear}`, `Dec-${startYear}`,
      `Jan-${startYear + 1}`, `Feb-${startYear + 1}`, `Mar-${startYear + 1}`
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const activeMonths = allMonths.filter(m => {
      const [mStr, yStr] = m.split('-');
      const mYear = parseInt(yStr, 10);
      const mIdx = monthNames.indexOf(mStr);
      if (mYear < currentYear || (mYear === currentYear && mIdx <= currentMonth)) return true;
      const found = monthData.find(r => r.particulars === m);
      return found && (found.debit > 0 || found.credit > 0);
    });

    return ['All', ...activeMonths];
  }, [academicYear, monthData]);

  const monthColumns: Column<MonthLedgerRow>[] = [
    {
      key: 'particulars', header: 'Month', primary: true,
      render: row => row.is_opening
        ? <span className="font-semibold text-slate-800">{row.particulars}</span>
        : <span className="font-semibold text-brand-700">{row.particulars}</span>,
    },
    { key: 'debit', header: 'Cash fees collected', align: 'right', render: row => <span className="text-emerald-700">{formatCurrency(row.debit)}</span> },
    { key: 'credit', header: 'Cash deposited', align: 'right', render: row => <span className="text-rose-700">{formatCurrency(row.credit)}</span> },
    {
      key: 'cash_in_hand', header: 'Cash in hand', align: 'right',
      render: row => <span className={`font-semibold ${row.cash_in_hand < 0 ? 'text-rose-600' : 'text-brand-800'}`}>{formatBalance(row.cash_in_hand)}</span>,
    },
  ];

  const detailColumns: Column<DetailLedgerRow>[] = [
    { key: 'narration', header: 'Details', primary: true, render: row => row.narration || row.ledger_head || row.voucher_type },
    {
      key: 'date', header: 'Date', secondary: true,
      render: row => `${row.date_formatted || row.date}${row.is_opening ? '' : ` · ${row.voucher_no}`}`,
    },
    {
      key: 'voucher_type', header: 'Type',
      render: row => (
        <span className={row.is_opening ? 'badge-warning' : row.voucher_type === 'Fee Receipt' ? 'badge-success' : 'badge-danger'}>
          {row.voucher_type}
        </span>
      ),
    },
    { key: 'ledger_head', header: 'Fee type / head', render: row => row.ledger_head || '-', hideOnMobile: true },
    { key: 'debit', header: 'Money in', align: 'right', render: row => <span className="text-emerald-700">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</span> },
    { key: 'credit', header: 'Money out', align: 'right', render: row => <span className="text-rose-700">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</span> },
    {
      key: 'cash_in_hand', header: 'Cash in hand', align: 'right',
      render: row => <span className={`font-semibold whitespace-nowrap ${row.cash_in_hand < 0 ? 'text-rose-600' : 'text-brand-800'}`}>{formatBalance(row.cash_in_hand)}</span>,
    },
  ];

  const branchLabel = globalBranch && globalBranch !== 'All' ? globalBranch : 'All branches';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Cash check (reconciliation)</h2>
        <p className="text-sm text-slate-500">
          Cash fees collected against cash deposited, so you can see how much cash should be in hand.
        </p>
        <p className="mt-1 text-sm text-slate-700">{branchLabel} · Academic year {academicYear}</p>
      </div>

      <SegmentTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'month-ledger', label: 'By month' },
          { value: 'details-ledger', label: 'Day by day' },
        ]}
      />

      {error && <Alert tone="error">{error}</Alert>}

      {/* TAB 1: Month Wise Cash Ledger */}
      {activeTab === 'month-ledger' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Tap a month to see each fee receipt and deposit in it.</p>
            <div className="flex gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
              <button onClick={fetchMonthLedger} disabled={loading} className="btn-secondary">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={handleExportMonthExcel} disabled={loading || activeMonthLedgerData.length === 0} className="btn-success">
                <FileSpreadsheet className="w-4 h-4" />
                Download Excel
              </button>
            </div>
          </div>

          {!loading && activeMonthLedgerData.length > 0 && (
            <StatTiles
              tiles={[
                { label: 'Cash in hand now', value: formatBalance(monthTotals.closingBalance), tone: monthTotals.closingBalance < 0 ? 'danger' : 'brand', wide: true },
                { label: 'Cash fees collected', value: formatCurrency(monthTotals.totalDebit), tone: 'success' },
                { label: 'Cash deposited', value: formatCurrency(monthTotals.totalCredit), tone: 'danger' },
              ]}
            />
          )}

          {loading ? (
            <div className="card"><LoadingState label="Working out cash for each month…" /></div>
          ) : activeMonthLedgerData.length === 0 ? (
            <div className="card"><EmptyState compact title="No cash records found" description="Nothing found for this branch and academic year." /></div>
          ) : (
            <DataList
              columns={monthColumns}
              rows={activeMonthLedgerData}
              rowKey={(_, i) => i}
              onRowClick={row => { if (!row.is_opening) handleMonthClick(row.particulars); }}
            />
          )}
        </div>
      )}

      {/* TAB 2: Cash Ledger in Details */}
      {activeTab === 'details-ledger' && (
        <div className="space-y-4">
          {selectedMonth !== 'All' && (
            <button onClick={() => setActiveTab('month-ledger')} className="btn-ghost !px-1">
              <ArrowLeft className="w-4 h-4" /> Back to months
            </button>
          )}

          <div className="card p-4 space-y-3">
            <Field label="Month" htmlFor="rd-month">
              <select
                id="rd-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input min-h-[44px] sm:max-w-xs"
              >
                {monthOptions.map((m, i) => (
                  <option key={i} value={m}>{m === 'All' ? 'All months (full year)' : m}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <button onClick={fetchDetailLedger} disabled={loading} className="btn-secondary">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={handleExportDetailExcel} disabled={loading || detailData.length === 0} className="btn-success">
                <FileSpreadsheet className="w-4 h-4" />
                Download Excel
              </button>
            </div>
          </div>

          {!loading && detailData.length > 0 && (
            <StatTiles
              tiles={[
                { label: 'Cash in hand at end', value: formatBalance(detailTotals.closingBalance), tone: detailTotals.closingBalance < 0 ? 'danger' : 'brand', wide: true },
                { label: 'Money in', value: formatCurrency(detailTotals.totalDebit), tone: 'success' },
                { label: 'Money out', value: formatCurrency(detailTotals.totalCredit), tone: 'danger' },
              ]}
            />
          )}

          {loading ? (
            <div className="card"><LoadingState label="Loading each day's cash…" /></div>
          ) : (
            <DataList
              columns={detailColumns}
              rows={detailData}
              rowKey={(_, i) => i}
              emptyTitle="Nothing found"
              emptyHint="No receipts or deposits for this month."
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ReconciliationDashboard;
