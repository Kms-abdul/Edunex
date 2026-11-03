import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge } from '../ui';

export interface ApprovalCardProps {
  /** Main line, e.g. "Stationery" */
  title: React.ReactNode;
  /** Amount shown big on the right */
  amount: React.ReactNode;
  /** Small lines under the title, e.g. date, branch, who made it */
  details?: React.ReactNode[];
  status?: string;
  statusLabel?: string;
  busy?: boolean;
  /** Show the Approve / Reject buttons */
  canDecide?: boolean;
  onApprove?: () => void;
  /**
   * Called when rejecting. When `askReason` is true a reason box opens first
   * and the typed reason is passed here.
   */
  onReject?: (reason: string) => void;
  askReason?: boolean;
  reasonPlaceholder?: string;
  /** Extra buttons, e.g. "See details" / "View slip" */
  extra?: React.ReactNode;
}

/** One item waiting for a decision, with big Approve / Reject buttons. */
const ApprovalCard: React.FC<ApprovalCardProps> = ({
  title, amount, details = [], status, statusLabel, busy, canDecide, onApprove, onReject,
  askReason, reasonPlaceholder, extra,
}) => {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-slate-900 break-words">{title}</p>
            {details.filter(Boolean).map((d, i) => (
              <p key={i} className="text-sm text-slate-500 mt-0.5 break-words">{d}</p>
            ))}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{amount}</p>
            {status && <Badge status={status} className="mt-1">{statusLabel || status}</Badge>}
          </div>
        </div>
      </div>

      {(canDecide || extra) && (
        <div className="border-t border-slate-100 px-4 py-2.5 space-y-2.5">
          {canDecide && rejecting && askReason ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-800">
                Why are you rejecting it?
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder={reasonPlaceholder || 'For example: the amount does not match the slip'}
                  className="input mt-1.5"
                />
              </label>
              <p className="text-xs text-slate-500">The branch will see this note.</p>
              <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setRejecting(false); setReason(''); }}>
                  Cancel
                </button>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => onReject?.(reason)}>
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {extra}
              {canDecide && (
                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                  <button
                    type="button"
                    className="btn-secondary !text-red-700 !border-red-300 hover:!bg-red-50"
                    disabled={busy}
                    onClick={() => (askReason ? setRejecting(true) : onReject?.(''))}
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <button type="button" className="btn-success" disabled={busy} onClick={onApprove}>
                    <Check className="w-4 h-4" /> Approve
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
};

export default ApprovalCard;
