import React, { useState, useEffect } from 'react';
import { remittanceApi } from '../api';
import { API_URL } from '../config';
import PageHeader from './ui/PageHeader';

const RemittanceApprovals: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [remittances, setRemittances] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal inspection state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);

  const getHeaders = () => {
    const token = localStorage.getItem('token') || '';
    const globalYear = localStorage.getItem('academicYear') || '2024-2025';
    return {
      'Authorization': `Bearer ${token}`,
      'X-Academic-Year': globalYear
    };
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchRemittances();
  }, [selectedBranch, statusFilter, startDate, endDate]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/branches`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (e) {
      console.error('Error fetching branches:', e);
    }
  };

  const fetchRemittances = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params: any = { status: statusFilter };
      if (selectedBranch && selectedBranch !== 'All') {
        params.branch_id = selectedBranch;
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await remittanceApi.listRemittances(params);
      if (res.data && Array.isArray(res.data)) {
        setRemittances(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load remittances:', err);
      setMessage({
        text: err.response?.data?.error || 'Failed to load branch remittances for review.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, status: 'Approved' | 'Rejected', remarks?: string) => {
    try {
      await remittanceApi.updateStatus(id, status, remarks);
      setMessage({
        text: `Remittance successfully marked as ${status}.`,
        type: 'success'
      });
      setSelectedItem(null);
      setShowRejectModal(false);
      setRejectionRemarks('');
      fetchRemittances();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error updating status');
    }
  };

  const handleDownloadAttachment = async (id: number, remittance_no: string) => {
    try {
      const url = remittanceApi.getAttachmentUrl(id);
      const token = localStorage.getItem('token') || '';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Could not fetch attachment');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const extension = blob.type.split('/')[1] || 'png';
      a.download = `Slip_${remittance_no}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      alert('Failed to view attachment. The file may have been moved or unassigned.');
    }
  };

  const pendingCount = remittances.filter(r => r.status === 'Pending').length;
  const pendingAmount = remittances.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.deposit_amount, 0);
  const approvedAmount = remittances.filter(r => r.status === 'Approved').reduce((sum, r) => sum + r.deposit_amount, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Head Office Remittance Approvals"
        subtitle="Audit Review & Authorization of Branch Daily Cash Deposits & Bank Slips"
        actions={
          <div className="flex items-center gap-2">
            <span className="label !mb-0">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="input !w-auto"
            >
              <option value="All">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
          </div>
        }
      />

      {message && (
        <div className={`p-4 rounded-lg shadow font-semibold flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-extrabold text-sm ml-4 uppercase opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-amber-700">Awaiting HO Review</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{pendingCount} <span className="text-sm font-medium text-slate-500">Vouchers</span></div>
          </div>
          <div className="p-3 bg-amber-100 text-amber-800 rounded-lg font-black text-xl">⌛</div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-slate-500">Total Pending Cash</span>
            <div className="text-2xl font-black text-amber-600 mt-1">₹{pendingAmount.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-lg font-black text-xl">₹</div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-emerald-700">Total Authorized Cash</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">₹{approvedAmount.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-lg font-black text-xl">✓</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="label !mb-0 mr-1">Status:</span>
          {['Pending', 'Approved', 'Rejected', 'All'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s === 'Pending' ? '⌛ Pending Review' : s === 'Approved' ? '✓ Approved' : s === 'Rejected' ? '✕ Rejected' : 'All Vouchers'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span>Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input !w-auto"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input !w-auto"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-rose-600 underline hover:text-rose-800 ml-1 font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Approvals Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-semibold">
            ⏳ Loading branch cash remittances...
          </div>
        ) : remittances.length === 0 ? (
          <div className="p-16 text-center text-slate-400 font-semibold bg-slate-50/40">
            No remittances found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">Remittance ID</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type & Details</th>
                  <th className="py-3 px-4 text-right">System Hand Cash</th>
                  <th className="py-3 px-4 text-right">Deposit Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Deposit Slip</th>
                  <th className="py-3 px-4 text-center">Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {remittances.map((rem) => (
                  <tr key={rem.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-black text-blue-700">{rem.remittance_no}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{rem.branch_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{rem.business_date}</td>
                    <td className="py-3.5 px-4">
                      {rem.deposit_type === 'Bank' ? (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="badge-success w-max">🏦 Bank Deposit</span>
                          <span className="text-slate-600 font-semibold">{rem.bank_name || 'N/A'} • {rem.account_number || 'N/A'}</span>
                          {rem.reference_no && <span className="text-slate-500 font-medium">Ref: {rem.reference_no}</span>}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="badge-brand w-max">🏢 Corporate Office</span>
                          {rem.reference_no && <span className="text-slate-600 font-semibold">Slip: {rem.reference_no}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500">₹{rem.cash_in_hand.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-base">₹{rem.deposit_amount.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={rem.status === 'Approved' ? 'badge-success' : rem.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}>
                        {rem.status === 'Approved' ? '✓ Approved' : rem.status === 'Rejected' ? '✕ Rejected' : '⌛ Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {rem.attachment_path ? (
                        <button
                          onClick={() => handleDownloadAttachment(rem.id, rem.remittance_no)}
                          className="btn-soft btn-sm"
                        >
                          <span>📎 View Slip</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic font-medium">No Attachment</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedItem(rem)}
                        className="btn-primary btn-sm"
                      >
                        🔍 Inspect &amp; Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Review & Denomination Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="card shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="card-header !px-6">
              <div>
                <span className="page-eyebrow">Remittance Audit Voucher</span>
                <h2 className="page-title">{selectedItem.remittance_no} &bull; {selectedItem.branch_name}</h2>
              </div>
              <button
                onClick={() => { setSelectedItem(null); setShowRejectModal(false); }}
                className="btn-icon"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Top Financial Breakdown */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] uppercase text-slate-500 font-extrabold block">System Hand Cash</span>
                  <span className="text-lg font-black text-slate-700">₹{selectedItem.cash_in_hand.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase text-emerald-700 font-extrabold block">Deposit Amount</span>
                  <span className="text-2xl font-black text-emerald-700">₹{selectedItem.deposit_amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase text-slate-500 font-extrabold block">Remaining Balance</span>
                  <span className="text-lg font-black text-slate-700">₹{selectedItem.remaining_cash.toLocaleString()}</span>
                </div>
              </div>

              {/* Deposit Type & Details */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${selectedItem.deposit_type === 'Bank' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`text-4xl ${selectedItem.deposit_type === 'Bank' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {selectedItem.deposit_type === 'Bank' ? '🏦' : '🏢'}
                  </div>
                  <div>
                    <h3 className={`text-sm font-extrabold uppercase ${selectedItem.deposit_type === 'Bank' ? 'text-emerald-800' : 'text-blue-800'}`}>
                      {selectedItem.deposit_type === 'Bank' ? 'Bank Deposit' : 'Corporate Office Deposit'}
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold mt-1">
                      {selectedItem.deposit_type === 'Bank' ? (
                        <>
                          <span className="block">Bank: {selectedItem.bank_name || 'N/A'}</span>
                          <span className="block">Account: {selectedItem.account_number || 'N/A'}</span>
                        </>
                      ) : (
                        <span>Direct cash handover to Corporate Office</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase text-slate-500 font-extrabold block">Reference / Slip No</span>
                  <span className="text-base font-black text-slate-800">{selectedItem.reference_no || 'N/A'}</span>
                </div>
              </div>

              {/* Denominations & Receipts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Denominations */}
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 border-b pb-2 mb-2 flex items-center gap-1.5">
                    <span>💵</span> Submitted Denomination Breakdown
                  </h4>
                  {selectedItem.denominations && selectedItem.denominations.length > 0 ? (
                    <table className="w-full text-xs text-left border">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="p-2">Note</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedItem.denominations.map((d: any, i: number) => (
                          <tr key={i} className="font-medium">
                            <td className="p-2 font-bold">₹ {d.denomination}</td>
                            <td className="p-2 text-center font-bold text-slate-800">{d.quantity}</td>
                            <td className="p-2 text-right font-extrabold">₹ {(d.amount || (d.denomination * d.quantity)).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No note breakdown entered.</p>
                  )}
                </div>

                {/* Audit Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-800 border-b pb-2 mb-2">
                      📝 Cashier Remarks / Reference
                    </h4>
                    <p className="text-xs bg-slate-50 p-3 rounded-lg border text-slate-700 font-medium">
                      {selectedItem.remarks || 'No notes provided by cashier.'}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1 font-semibold text-slate-600">
                    <div className="flex justify-between">
                      <span>Submitted By:</span>
                      <span className="text-slate-900 font-extrabold">{selectedItem.created_by || 'Cashier'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Submission Date:</span>
                      <span className="text-slate-900 font-extrabold">{selectedItem.created_at || selectedItem.business_date}</span>
                    </div>
                    {selectedItem.approved_by && (
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span>Reviewed By HO:</span>
                        <span className="text-slate-900 font-extrabold">{selectedItem.approved_by} on {selectedItem.approved_at}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              {selectedItem.status === 'Pending' ? (
                showRejectModal ? (
                  <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3">
                    <h5 className="text-sm font-extrabold text-rose-900">Specify Rejection Reason &amp; Audit Note</h5>
                    <textarea
                      value={rejectionRemarks}
                      onChange={(e) => setRejectionRemarks(e.target.value)}
                      placeholder="e.g. Denomination mismatch with deposit slip image, or unreadable receipt attachment..."
                      rows={2}
                      className="input !border-red-300"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowRejectModal(false)}
                        className="btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedItem.id, 'Rejected', rejectionRemarks)}
                        className="btn-danger btn-sm"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 border-t flex justify-end gap-4">
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="btn-secondary !text-red-700 !border-red-300 hover:!bg-red-50"
                    >
                      ✕ Reject Deposit
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, 'Approved')}
                      className="btn-success"
                    >
                      ✓ Authorize &amp; Approve Remittance
                    </button>
                  </div>
                )
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl border text-center text-sm font-bold text-slate-600">
                  This voucher has already been decided and marked as <span className="underline uppercase font-black">{selectedItem.status}</span>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemittanceApprovals;
