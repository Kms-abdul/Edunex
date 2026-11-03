import React, { useState, useEffect } from 'react';
import api from '../api';
import { hasPermission } from '../utils/permissions';


interface Ledger {
  id: number;
  ledger_name: string;
  ledger_type: string;
}

interface PettyCashItem {
  item_name: string;
  amount: number | string;
}

interface PettyCashTxn {
  id?: number;
  branch_id?: number | string;
  transaction_date: string;
  voucher_name: string;
  voucher_type: string;
  ledger_id: number | string;
  ledger_name?: string;
  ledger_type?: string;
  paid_to: string;
  amount: number | string;
  payment_mode: string;
  academic_year?: string;
  description?: string;
  created_by?: string;
  approved_by?: string;
  approval_status?: string;
  approved_at?: string;
  items?: PettyCashItem[];
}

const PettyCash: React.FC = () => {
  const [transactions, setTransactions] = useState<PettyCashTxn[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [newLedger, setNewLedger] = useState({ ledger_name: '', ledger_type: 'Indirect' });

  const [selectedReceipt, setSelectedReceipt] = useState<PettyCashTxn | null>(null);

  // Accordion state - group by month
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState({ total_allocated: 0, total_payment: 0, net_amount: 0 });

  let user: any = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    console.warn('Invalid user data in localStorage');
  }
  const isAccountant = hasPermission(user, 'fees.fee.petty-cash', 'write');
  const [formData, setFormData] = useState<PettyCashTxn & { items: PettyCashItem[] }>({
    transaction_date: new Date().toISOString().split('T')[0],
    voucher_name: '',
    voucher_type: 'Payment',
    ledger_id: '',
    paid_to: '',
    amount: '',
    items: [{ item_name: '', amount: '' }],
    payment_mode: 'Cash',
    description: '',
    approved_by: '',
  });

  // Need to track ledger type for the form to filter ledgers
  const [selectedLedgerType, setSelectedLedgerType] = useState('Indirect');

  const fetchLedgers = async () => {
    try {
      const response = await api.get('/petty-cash/ledgers');
      setLedgers(response.data);
    } catch (err: any) {
      console.error('Error fetching ledgers', err);
      setError('Failed to load ledgers. Please refresh the page.');
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/petty-cash');
      setTransactions(response.data);

      const summaryResponse = await api.get('/petty-cash/summary');
      setSummary(summaryResponse.data);

      // Auto-expand current month
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      setExpandedMonths(prev => ({ ...prev, [currentMonth]: true }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
    fetchTransactions();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/petty-cash', formData);
      alert('Transaction saved successfully');
      // Reset form
      setFormData({
        ...formData,
        voucher_name: '',
        paid_to: '',
        amount: '',
        items: [{ item_name: '', amount: '' }],
        ledger_id: '',
        description: '',
        approved_by: '',
      });
      fetchTransactions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/petty-cash/ledgers', newLedger);
      alert('Ledger created successfully');
      setShowLedgerModal(false);
      setNewLedger({ ledger_name: '', ledger_type: 'Indirect' });
      fetchLedgers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create ledger');
    }
  };

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthStr]: !prev[monthStr] }));
  };

  const handlePrint = (txn: PettyCashTxn) => {
    setSelectedReceipt(txn);
  };

  // Group transactions by month-year
  const groupedTransactions: Record<string, PettyCashTxn[]> = {};
  transactions.forEach(txn => {
    const dateObj = new Date(txn.transaction_date);
    const monthYear = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groupedTransactions[monthYear]) {
      groupedTransactions[monthYear] = [];
    }
    groupedTransactions[monthYear].push(txn);
  });

  const filteredLedgers = ledgers.filter(l => l.ledger_type === selectedLedgerType);
  const grandTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.amount as string) || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cash In Hand Summary Section */}
      <div className="card print:hidden border-l-4 border-blue-600">
        <div className="p-4 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="bg-blue-50 p-3 rounded-full">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Cash In Hand</p>
              <h3 className={`text-xl font-semibold text-slate-900 tracking-tight ${summary.net_amount < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                ₹ {summary.net_amount?.toFixed(2) ?? '0.00'}
              </h3>
            </div>
          </div>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-8">
            <div className="text-right md:text-left">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Allocated</p>
              <p className="text-lg font-semibold text-emerald-600">₹ {summary.total_allocated?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="text-right md:text-left">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Spent</p>
              <p className="text-lg font-semibold text-rose-600">₹ {summary.total_payment?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Form Section */}
      <div className="card p-6 print:hidden">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">New Petty Cash Entry</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="flex flex-col">
            <label className="label">Date</label>
            <input type="date" name="transaction_date" value={formData.transaction_date} onChange={handleInputChange} max={new Date().toISOString().split('T')[0]} className="input w-auto" required />
          </div>

          <div className="flex flex-col">
            <label className="label">Voucher Name</label>
            <input type="text" name="voucher_name" value={formData.voucher_name} onChange={handleInputChange} className="input w-auto" placeholder="e.g. Purchase of stationery" required />
          </div>

          <div className="flex flex-col">
            <label className="label">Voucher Type</label>
            <select name="voucher_type" value={formData.voucher_type} onChange={handleInputChange} className="input w-auto" required>
              <option value="Payment">Payment</option>
              <option value="Received">Received</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="label">Ledger Type</label>
            <select
              value={selectedLedgerType}
              onChange={(e) => {
                setSelectedLedgerType(e.target.value);
                setFormData({ ...formData, ledger_id: '' }); // Reset ledger selection
              }}
              className="input w-auto"
            >
              <option value="Direct">Direct</option>
              <option value="Indirect">Indirect</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1 flex justify-between items-center">
              <span>Ledger</span>
              {isAccountant && (
                <button type="button" onClick={() => setShowLedgerModal(true)} className="text-blue-600 text-xs hover:underline">+ Add Ledger</button>
              )}
            </label>
            <select name="ledger_id" value={formData.ledger_id} onChange={handleInputChange} className="input w-auto" required>
              <option value="">Select Ledger</option>
              {filteredLedgers.map(l => (
                <option key={l.id} value={l.id}>{l.ledger_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="label">Paid To / Received From</label>
            <input type="text" name="paid_to" value={formData.paid_to} onChange={handleInputChange} className="input w-auto" placeholder="Name" />
          </div>

          <div className="lg:col-span-4 mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <label className="text-md font-semibold text-gray-800">Items to Add</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, items: [...formData.items, { item_name: '', amount: '' }] })}
                className="text-blue-600 text-sm hover:text-blue-800 font-medium flex items-center"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="flex space-x-4 items-center">
                  <input
                    type="text"
                    value={item.item_name}
                    onChange={(e) => {
                      const newItems = [...formData.items];
                      newItems[index].item_name = e.target.value;
                      setFormData({ ...formData, items: newItems });
                    }}
                    placeholder={`Item ${index + 1}`}
                    className="input flex-1"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.amount}
                    onChange={(e) => {
                      const newItems = [...formData.items];
                      newItems[index].amount = e.target.value;
                      setFormData({ ...formData, items: newItems });
                    }}
                    placeholder="Amount"
                    className="input w-32 text-right"
                    required
                  />
                  {formData.items.length > 1 && (
                    <button type="button" onClick={() => {
                      const newItems = formData.items.filter((_, i) => i !== index);
                      setFormData({ ...formData, items: newItems });
                    }} className="text-red-500 hover:text-red-700 font-bold px-2 py-1">
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end items-center mt-6 pr-8">
              <span className="font-semibold text-gray-600 mr-4 uppercase text-sm tracking-wider">Total Amount</span>
              <span className="font-bold text-2xl text-emerald-600 w-32 text-right border-t-2 border-emerald-200 pt-2">
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="label">Description</label>
            <textarea name="description" value={formData.description} onChange={handleInputChange} className="input w-auto h-10" placeholder="Details"></textarea>
          </div>

          <div className="flex flex-col">
            <label className="label">Created By</label>
            <input type="text" value={user.username || 'Current User'} readOnly className="input w-auto" />
          </div>

          <div className="flex flex-col">
            <label className="label">Approved By</label>
            <div className="flex items-center space-x-4 h-10 border p-2 rounded">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  value="Principal"
                  checked={formData.approved_by?.includes('Principal')}
                  onChange={(e) => {
                    let arr = formData.approved_by ? formData.approved_by.split(',') : [];
                    if (e.target.checked) arr.push('Principal');
                    else arr = arr.filter(a => a !== 'Principal');
                    setFormData({ ...formData, approved_by: arr.join(',') });
                  }}
                  className="mr-2"
                />
                Principal
              </label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  value="Director"
                  checked={formData.approved_by?.includes('Director')}
                  onChange={(e) => {
                    let arr = formData.approved_by ? formData.approved_by.split(',') : [];
                    if (e.target.checked) arr.push('Director');
                    else arr = arr.filter(a => a !== 'Director');
                    setFormData({ ...formData, approved_by: arr.join(',') });
                  }}
                  className="mr-2"
                />
                Director
              </label>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="label">Payment Mode</label>
            <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} className="input w-auto" required>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          <div className="lg:col-span-4 flex justify-end mt-2">
            <button type="submit" className="btn-success">Save Transaction</button>
          </div>

        </form>
      </div>

      {/* Accordion List */}
      <div className="card overflow-hidden print:hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Petty Cash Transactions History</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading transactions...</div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">{error}</div>
        ) : Object.keys(groupedTransactions).length === 0 ? (
          <div className="p-6 text-center text-gray-500">No transactions found for the current branch and academic year.</div>
        ) : (
          <div className="divide-y">
            {Object.entries(groupedTransactions).map(([monthYear, txns]) => (
              <div key={monthYear} className="w-full">
                <button
                  onClick={() => toggleMonth(monthYear)}
                  className="btn-secondary w-full justify-between text-left"
                >
                  <span className="font-semibold text-gray-700">{monthYear}</span>
                  <span className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">{txns.length} entries</span>
                    <span className="text-lg text-gray-400">{expandedMonths[monthYear] ? '▲' : '▼'}</span>
                  </span>
                </button>

                {expandedMonths[monthYear] && (
                  <div className="overflow-x-auto p-4">
                    <table className="w-full text-sm text-left">
                      <thead className="">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Voucher Name</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Ledger</th>
                          <th className="px-4 py-2">Paid To</th>
                          <th className="px-4 py-2">Mode</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map(t => (
                          <tr key={t.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">{t.transaction_date}</td>
                            <td className="px-4 py-2">{t.voucher_name}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${t.voucher_type === 'Received' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {t.voucher_type}
                              </span>
                            </td>
                            <td className="px-4 py-2">{t.ledger_name}</td>
                            <td className="px-4 py-2">{t.paid_to || '-'}</td>
                            <td className="px-4 py-2">{t.payment_mode}</td>
                            <td className="px-4 py-2 text-right font-medium">₹{Number(t.amount).toFixed(2)}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                t.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                t.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {t.approval_status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => setSelectedReceipt(t)} className="btn-secondary btn-sm text-blue-600 hover:text-blue-800 border-blue-600" title="View Details">
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger Modal */}
      {showLedgerModal && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 flex items-center justify-center z-50">
          <div className="card shadow-pop p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Add New Ledger</h3>
            <form onSubmit={handleCreateLedger} className="space-y-4">
              <div>
                <label className="label">Ledger Name</label>
                <input
                  type="text"
                  value={newLedger.ledger_name}
                  onChange={(e) => setNewLedger({ ...newLedger, ledger_name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Ledger Type</label>
                <select
                  value={newLedger.ledger_type}
                  onChange={(e) => setNewLedger({ ...newLedger, ledger_type: e.target.value })}
                  className="input"
                >
                  <option value="Direct">Direct</option>
                  <option value="Indirect">Indirect</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button type="button" onClick={() => setShowLedgerModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedReceipt && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300 print:absolute print:inset-0 print:bg-white print:p-0 print:z-auto">
          <div className="card shadow-pop w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all print:shadow-none print:max-h-none print:rounded-none">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center text-slate-900 print:bg-none print:bg-white print:text-black print:border-b-2 print:border-gray-800">
              <h3 className="text-base font-semibold">Transaction Overview</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-slate-700 transition-colors text-2xl leading-none print:hidden">&times;</button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto print:overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-blue-600 font-semibold block text-xs uppercase tracking-wider mb-1">Date</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.transaction_date}</span>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-indigo-600 font-semibold block text-xs uppercase tracking-wider mb-1">Voucher Name</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.voucher_name}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Voucher Type</span>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${selectedReceipt.voucher_type === 'Received' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {selectedReceipt.voucher_type}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Ledger</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.ledger_name}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Ledger Type</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.ledger_type || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Paid To / Received From</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.paid_to || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Payment Mode</span>
                  <div>
                    {selectedReceipt.payment_mode === 'Cash' ? <span className="bg-orange-100 text-orange-700 font-bold px-3 py-1 rounded-full text-xs">CASH</span> : <span className="bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full text-xs">UPI</span>}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-2">Items</span>
                  {selectedReceipt.items && selectedReceipt.items.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm text-left">
                        <thead className="border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2">Item Name</th>
                            <th className="px-4 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReceipt.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-white transition-colors">
                              <td className="px-4 py-2 text-gray-800">{item.item_name}</td>
                              <td className="px-4 py-2 text-right font-medium text-gray-700">₹{Number(item.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td className="px-4 py-2 font-bold text-gray-800 text-right uppercase text-xs tracking-wider">Total</td>
                            <td className="px-4 py-2 font-bold text-emerald-700 text-right text-base">₹{Number(selectedReceipt.amount).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No items recorded.</span>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Description</span>
                  <span className="font-medium text-gray-700 whitespace-pre-wrap">{selectedReceipt.description || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Created By</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.created_by || '-'}</span>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-amber-700 font-semibold block text-xs uppercase tracking-wider mb-1">Approved By</span>
                  <span className="font-bold text-amber-900 text-base">{selectedReceipt.approved_by || '-'}</span>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow md:col-span-2">
                  <span className="text-gray-500 font-semibold block text-xs uppercase tracking-wider mb-1">Academic Year</span>
                  <span className="font-bold text-gray-800 text-base">{selectedReceipt.academic_year || '-'}</span>
                </div>
              </div>

              {/* Signatures for Print */}
              <div className="hidden print:flex justify-between items-end mt-24 mb-8 px-8 w-full">
                <div className="text-center">
                  <div className="border-t-2 border-gray-800 w-48 mb-2"></div>
                  <span className="font-semibold text-gray-800">Principal Signature</span>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-gray-800 w-48 mb-2"></div>
                  <span className="font-semibold text-gray-800">Director Signature</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3 print:hidden">
              <button onClick={() => window.print()} className="btn-primary border-transparent">
                Print Receipt
              </button>
              <button onClick={() => setSelectedReceipt(null)} className="btn-secondary">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PettyCash;
