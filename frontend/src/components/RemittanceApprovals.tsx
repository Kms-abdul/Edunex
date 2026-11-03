import React, { useState, useEffect } from 'react';
import { remittanceApi } from '../api';
import { API_URL } from '../config';
import { Paperclip } from 'lucide-react';
import { notify } from './ui/feedback';
import { Alert, EmptyState, LoadingState, Field } from './ui';
import ApprovalCard from './cash/ApprovalCard';
import Filters from './cash/Filters';
import Sheet from './cash/Sheet';
import SegmentTabs from './cash/SegmentTabs';
import StatTiles from './cash/StatTiles';
import { shortDate } from './cash/format';

const RemittanceApprovals: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'All'>('Pending');
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
    const globalYear = localStorage.getItem('academicYear') || '2026-2027';
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
      notify(err.response?.data?.error || 'Error updating status');
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
      notify('Failed to view attachment. The file may have been moved or unassigned.');
    }
  };

  const pendingCount = remittances.filter(r => r.status === 'Pending').length;
  const pendingAmount = remittances.filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.deposit_amount, 0);
  const approvedAmount = remittances.filter(r => r.status === 'Approved').reduce((sum, r) => sum + r.deposit_amount, 0);

  const statusLabel = (s: string) => (s === 'Approved' ? 'Approved' : s === 'Rejected' ? 'Rejected' : 'Waiting');
  const branchLabel = selectedBranch === 'All' ? 'All branches' : branches.find(b => String(b.id) === String(selectedBranch))?.branch_name || 'Branch';
  const dateLabel = startDate || endDate ? ` · ${startDate ? shortDate(startDate) : 'start'} to ${endDate ? shortDate(endDate) : 'today'}` : '';
  const whereLine = (rem: any) => rem.deposit_type === 'Bank'
    ? `Bank: ${rem.bank_name || 'N/A'} • ${rem.account_number || 'N/A'}${rem.reference_no ? ` · Ref: ${rem.reference_no}` : ''}`
    : `Given to head office${rem.reference_no ? ` · ${rem.reference_no}` : ''}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Approve cash deposits</h2>
        <p className="text-sm text-slate-500">Branches send their cash to the bank or head office. Check each deposit, then approve or reject it.</p>
      </div>

      {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'error'} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <StatTiles
        tiles={[
          { label: 'Waiting', value: pendingCount, tone: 'warning' },
          { label: 'Cash waiting', value: `₹${pendingAmount.toLocaleString()}`, tone: 'warning' },
          { label: 'Cash approved', value: `₹${approvedAmount.toLocaleString()}`, tone: 'success', wide: true },
        ]}
      />

      <SegmentTabs
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'Pending', label: 'Waiting' },
          { value: 'Approved', label: 'Approved' },
          { value: 'Rejected', label: 'Rejected' },
          { value: 'All', label: 'All' },
        ]}
      />

      <Filters
        summary={<>{branchLabel}{dateLabel}</>}
        collapsible
        actions={(startDate || endDate) ? (
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="btn-ghost text-rose-700">
            Clear dates
          </button>
        ) : undefined}
      >
        <Field label="Branch" htmlFor="ra-branch">
          <select id="ra-branch" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="input min-h-[44px]">
            <option value="All">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.branch_name}</option>
            ))}
          </select>
        </Field>
        <Field label="From date" htmlFor="ra-from">
          <input id="ra-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input min-h-[44px]" />
        </Field>
        <Field label="To date" htmlFor="ra-to">
          <input id="ra-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input min-h-[44px]" />
        </Field>
      </Filters>

      {loading ? (
        <div className="card"><LoadingState label="Loading deposits…" /></div>
      ) : remittances.length === 0 ? (
        <div className="card"><EmptyState title="No deposits found" description="Nothing matches these filters." /></div>
      ) : (
        <ul className="space-y-2.5">
          {remittances.map(rem => (
            <ApprovalCard
              key={rem.id}
              title={<>{rem.branch_name} <span className="font-normal text-slate-500">· {rem.remittance_no}</span></>}
              amount={<span className="text-emerald-700">₹{rem.deposit_amount.toLocaleString()}</span>}
              details={[
                `${shortDate(rem.business_date)} · ${whereLine(rem)}`,
                `Cash in hand before: ₹${rem.cash_in_hand.toLocaleString()}`,
              ]}
              status={rem.status}
              statusLabel={statusLabel(rem.status)}
              canDecide={rem.status === 'Pending'}
              askReason
              reasonPlaceholder="For example: the notes do not match the deposit slip"
              onApprove={() => handleStatusChange(rem.id, 'Approved')}
              onReject={(reason) => handleStatusChange(rem.id, 'Rejected', reason)}
              extra={
                <>
                  <button onClick={() => setSelectedItem(rem)} className="btn-secondary btn-sm">See details</button>
                  {rem.attachment_path && (
                    <button onClick={() => handleDownloadAttachment(rem.id, rem.remittance_no)} className="btn-soft btn-sm">
                      <Paperclip className="w-4 h-4" /> View slip
                    </button>
                  )}
                </>
              }
            />
          ))}
        </ul>
      )}

      {/* Details of one deposit */}
      {selectedItem && (
        <Sheet
          size="lg"
          title={<>{selectedItem.branch_name} · ₹{selectedItem.deposit_amount.toLocaleString()}</>}
          subtitle={<>{selectedItem.remittance_no} · {shortDate(selectedItem.business_date)} · {statusLabel(selectedItem.status)}</>}
          onClose={() => { setSelectedItem(null); setShowRejectModal(false); }}
          footer={selectedItem.status === 'Pending' && !showRejectModal ? (
            <>
              <button onClick={() => setShowRejectModal(true)} className="btn-secondary btn-lg !text-red-700 !border-red-300 hover:!bg-red-50">
                Reject
              </button>
              <button onClick={() => handleStatusChange(selectedItem.id, 'Approved')} className="btn-success btn-lg">
                Approve ₹{selectedItem.deposit_amount.toLocaleString()}
              </button>
            </>
          ) : undefined}
        >
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div><dt className="text-slate-500">Cash in hand before</dt><dd className="text-lg font-semibold text-slate-800">₹{selectedItem.cash_in_hand.toLocaleString()}</dd></div>
              <div><dt className="text-emerald-700">Deposited</dt><dd className="text-xl font-semibold text-emerald-700">₹{selectedItem.deposit_amount.toLocaleString()}</dd></div>
              <div><dt className="text-slate-500">Cash left</dt><dd className="text-lg font-semibold text-slate-800">₹{selectedItem.remaining_cash.toLocaleString()}</dd></div>
            </dl>

            <div className={`rounded-xl border p-3 text-sm ${selectedItem.deposit_type === 'Bank' ? 'bg-emerald-50 border-emerald-200' : 'bg-brand-50 border-brand-200'}`}>
              <p className="font-semibold text-slate-900">{selectedItem.deposit_type === 'Bank' ? 'Paid into the bank' : 'Given to head office'}</p>
              {selectedItem.deposit_type === 'Bank' ? (
                <>
                  <p className="text-slate-700">Bank: {selectedItem.bank_name || 'N/A'}</p>
                  <p className="text-slate-700">Account: {selectedItem.account_number || 'N/A'}</p>
                </>
              ) : (
                <p className="text-slate-700">Cash handed over directly to head office</p>
              )}
              <p className="text-slate-700">Slip or reference number: <span className="font-medium">{selectedItem.reference_no || 'N/A'}</span></p>
              {selectedItem.attachment_path && (
                <button onClick={() => handleDownloadAttachment(selectedItem.id, selectedItem.remittance_no)} className="btn-soft btn-sm mt-2">
                  <Paperclip className="w-4 h-4" /> View slip
                </button>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Notes counted</h4>
              {selectedItem.denominations && selectedItem.denominations.length > 0 ? (
                <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
                  {selectedItem.denominations.map((d: any, i: number) => (
                    <li key={i} className="flex justify-between gap-3 px-3 py-2">
                      <span>₹ {d.denomination} × {d.quantity}</span>
                      <span className="font-semibold tabular-nums">₹ {(d.amount || (d.denomination * d.quantity)).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No note count entered.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-1">Cashier's note</h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-3">
                {selectedItem.remarks || 'No note.'}
              </p>
            </div>

            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Sent by</dt><dd className="font-medium text-right">{selectedItem.created_by || 'Cashier'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Sent on</dt><dd className="font-medium text-right">{selectedItem.created_at || selectedItem.business_date}</dd></div>
              {selectedItem.approved_by && (
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Checked by</dt><dd className="font-medium text-right">{selectedItem.approved_by} on {selectedItem.approved_at}</dd></div>
              )}
            </dl>

            {selectedItem.status === 'Pending' ? (
              showRejectModal && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <Field label="Why are you rejecting it?" htmlFor="ra-reason" hint="The branch will see this note.">
                    <textarea
                      id="ra-reason"
                      value={rejectionRemarks}
                      onChange={(e) => setRejectionRemarks(e.target.value)}
                      placeholder="For example: the notes do not match the deposit slip"
                      rows={2}
                      autoFocus
                      className="input"
                    />
                  </Field>
                  <div className="flex gap-2 justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
                    <button onClick={() => setShowRejectModal(false)} className="btn-secondary">Cancel</button>
                    <button onClick={() => handleStatusChange(selectedItem.id, 'Rejected', rejectionRemarks)} className="btn-danger">
                      Reject deposit
                    </button>
                  </div>
                </div>
              )
            ) : (
              <Alert tone={selectedItem.status === 'Approved' ? 'success' : 'warning'}>
                This deposit is already {selectedItem.status === 'Approved' ? 'approved' : 'rejected'}.
              </Alert>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
};

export default RemittanceApprovals;
