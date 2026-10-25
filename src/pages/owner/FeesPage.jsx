import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import RecordPaymentModal from '../../components/fees/RecordPaymentModal';
import ReceiptModal from '../../components/fees/ReceiptModal';
import ReversalModal from '../../components/fees/ReversalModal';
import {
  CreditCard,
  Plus,
  FileText,
  RotateCcw,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

export default function FeesPage() {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices', 'payments', 'plans'

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [invoiceStatus, setInvoiceStatus] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [viewingReceiptId, setViewingReceiptId] = useState(null);
  const [reversingPayment, setReversingPayment] = useState(null);

  // New Plan Form states
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState(30);
  const [newPlanShifts, setNewPlanShifts] = useState(1);
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanAdmissionFee, setNewPlanAdmissionFee] = useState(0);
  const [newPlanDesc, setNewPlanDesc] = useState('');

  useEffect(() => {
    if (activeTab === 'invoices') loadInvoices();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'plans') loadPlans();
  }, [activeTab, invoiceStatus]);

  async function loadInvoices() {
    setLoading(true);
    try {
      let q = `status=${invoiceStatus}`;
      if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
      const res = await apiFetch(`/api/fees/invoices?${q}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports/collections');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlans() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/fees/plans');
      const data = await res.json();
      setPlans(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    try {
      const res = await apiFetch('/api/fees/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: newPlanName,
          duration_days: parseInt(newPlanDuration, 10),
          shifts_allowed: parseInt(newPlanShifts, 10),
          price: Number(newPlanPrice),
          admission_fee: Number(newPlanAdmissionFee) || 0,
          description: newPlanDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create plan.');

      setShowNewPlanModal(false);
      setNewPlanName('');
      setNewPlanPrice('');
      setNewPlanDesc('');
      loadPlans();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      {/* Subtab Navigation & Main Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            className={`btn btn-sm ${activeTab === 'invoices' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveTab('invoices')}
          >
            <FileText size={15} /> Invoices & Dues
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'payments' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveTab('payments')}
          >
            <CreditCard size={15} /> Payments & Receipts
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'plans' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveTab('plans')}
          >
            <Layers size={15} /> Configured Fee Plans
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'plans' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewPlanModal(true)}
              disabled={isReadOnlyMode}
            >
              <Plus size={15} /> Create Fee Plan
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSelectedInvoiceForPayment(null);
                setIsRecordPaymentOpen(true);
              }}
              disabled={isReadOnlyMode}
            >
              <CreditCard size={15} /> Record Payment
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Invoices */}
      {activeTab === 'invoices' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <select
              className="form-select"
              style={{ width: '170px' }}
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value)}
            >
              <option value="all">All Invoices</option>
              <option value="unpaid">Unpaid / Dues</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Settled</option>
            </select>
          </div>

          <div className="table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Student</th>
                  <th>Title</th>
                  <th>Total Fee</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Loading invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No invoices found for selected filter.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoice_number}</td>
                      <td>
                        <strong>{inv.student_name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{inv.admission_number}</div>
                      </td>
                      <td>{inv.title}</td>
                      <td>₹{inv.total_amount}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>₹{inv.paid_amount}</td>
                      <td style={{ color: inv.balance_amount > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        ₹{inv.balance_amount}
                      </td>
                      <td>{inv.due_date}</td>
                      <td>
                        <span
                          className={`badge ${
                            inv.status === 'paid'
                              ? 'badge-success'
                              : inv.status === 'partial'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {inv.balance_amount > 0 && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setSelectedInvoiceForPayment(inv);
                              setIsRecordPaymentOpen(true);
                            }}
                            disabled={isReadOnlyMode}
                          >
                            <CreditCard size={13} /> Collect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Payment Receipts & Financial Audit */}
      {activeTab === 'payments' && (
        <div className="table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Txn Reference</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No payment transactions recorded.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isCompleted = p.status === 'completed';
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.receipt_number}</td>
                      <td>
                        <strong>{p.student_name || 'Anonymous Student'}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.admission_number}</div>
                      </td>
                      <td style={{ fontWeight: 800, color: isCompleted ? '#059669' : '#94a3b8' }}>
                        ₹{p.amount}
                      </td>
                      <td>
                        <span className="badge badge-info">{p.payment_mode.toUpperCase()}</span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{p.transaction_ref || 'None'}</td>
                      <td>{p.payment_date}</td>
                      <td>
                        <span className={`badge ${isCompleted ? 'badge-success' : 'badge-danger'}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            title="View Official Receipt"
                            onClick={() => setViewingReceiptId(p.id)}
                          >
                            <FileText size={13} /> View
                          </button>

                          {isCompleted && (
                            <button
                              className="btn btn-outline btn-sm"
                              title="Reverse Payment"
                              onClick={() => setReversingPayment(p)}
                              disabled={isReadOnlyMode}
                            >
                              <RotateCcw size={13} style={{ color: '#dc2626' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Fee Plans */}
      {activeTab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {plans.map((pl) => (
            <div key={pl.id} className="card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ fontSize: '16px', color: '#0f172a' }}>{pl.name}</h4>
                <span className="badge badge-info">
                  {pl.shifts_allowed === 3 ? 'Full Day' : `${pl.shifts_allowed} Shift(s)`}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#4f46e5', margin: '14px 0 6px 0' }}>
                ₹{pl.price}
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  {' '}
                  / {pl.duration_days} days
                </span>
              </div>
              {pl.admission_fee > 0 && (
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  + ₹{pl.admission_fee} One-Time Admission Fee
                </div>
              )}
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginTop: '8px' }}>
                {pl.description || 'Configured membership plan for students.'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        preselectedInvoice={selectedInvoiceForPayment}
        onPaymentSuccess={(newPaymentId) => {
          setViewingReceiptId(newPaymentId);
          loadInvoices();
          loadPayments();
        }}
      />

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(viewingReceiptId)}
        onClose={() => setViewingReceiptId(null)}
        paymentId={viewingReceiptId}
      />

      {/* Payment Reversal Workflow Modal */}
      <ReversalModal
        isOpen={Boolean(reversingPayment)}
        onClose={() => setReversingPayment(null)}
        payment={reversingPayment}
        onReversalSuccess={() => {
          loadInvoices();
          loadPayments();
        }}
      />

      {/* New Fee Plan Modal */}
      {showNewPlanModal && (
        <div className="modal-backdrop" onClick={() => setShowNewPlanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create Membership Fee Plan</h3>
            </div>
            <form onSubmit={handleCreatePlan} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Plan Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. 1 Month (Single Shift)"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Price (₹) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(e.target.value)}
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPlanDuration}
                    onChange={(e) => setNewPlanDuration(e.target.value)}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Shifts Allowed</label>
                  <select
                    className="form-select"
                    value={newPlanShifts}
                    onChange={(e) => setNewPlanShifts(e.target.value)}
                  >
                    <option value="1">1 Shift</option>
                    <option value="2">2 Shifts</option>
                    <option value="3">3 Shifts (Full Day)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Admission Fee (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPlanAdmissionFee}
                    onChange={(e) => setNewPlanAdmissionFee(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  placeholder="Brief feature description..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowNewPlanModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isReadOnlyMode}>
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
