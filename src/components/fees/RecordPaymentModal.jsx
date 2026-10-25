import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RecordPaymentModal({
  isOpen,
  onClose,
  preselectedInvoice = null,
  onPaymentSuccess,
}) {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Fetch unpaid/partial invoices
      apiFetch('/api/fees/invoices?status=unpaid')
        .then((res) => res.json())
        .then((data) => {
          const list = data.invoices || [];
          setInvoices(list);
          if (preselectedInvoice) {
            setSelectedInvoiceId(preselectedInvoice.id);
            setAmount(preselectedInvoice.balance_amount);
          } else if (list.length > 0) {
            setSelectedInvoiceId(list[0].id);
            setAmount(list[0].balance_amount);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [isOpen, preselectedInvoice]);

  const currentInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || preselectedInvoice;

  function handleInvoiceChange(invId) {
    setSelectedInvoiceId(invId);
    const found = invoices.find((inv) => inv.id === invId);
    if (found) {
      setAmount(found.balance_amount);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceId,
          amount: Number(amount),
          paymentMode,
          transactionRef,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to record payment.');
      }

      onPaymentSuccess(data.paymentId);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Fee Payment" maxWidth="540px">
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            gap: '8px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Select Pending Invoice</label>
          <select
            className="form-select"
            value={selectedInvoiceId}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            required
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} — {inv.student_name} (Balance: ₹{inv.balance_amount})
              </option>
            ))}
          </select>
        </div>

        {currentInvoice && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '13px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>Student:</strong> {currentInvoice.student_name}
            </div>
            <div>
              <strong>Remaining Due:</strong>{' '}
              <span style={{ color: '#dc2626', fontWeight: 700 }}>₹{currentInvoice.balance_amount}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Payment Amount (₹) *</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={currentInvoice ? currentInvoice.balance_amount : 100000}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <select
              className="form-select"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="upi">UPI / QR Code</option>
              <option value="cash">Cash in Hand</option>
              <option value="card">Debit / Credit Card</option>
              <option value="bank_transfer">Net Banking / NEFT</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Transaction Reference / UTR</label>
          <input
            type="text"
            className="form-input"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="e.g. UPI Ref / Cheque No / Bank Txn ID"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes (Optional)</label>
          <input
            type="text"
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Paid in full for next month"
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || isReadOnlyMode}>
            <CreditCard size={16} />
            {loading ? 'Recording...' : 'Record Payment & Issue Receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
