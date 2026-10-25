import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function ReversalModal({ isOpen, onClose, payment, onReversalSuccess }) {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!payment) return null;

  async function handleReverse(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    if (!reason.trim()) {
      setError('Please provide a mandatory explanation for reversing this payment.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/fees/payments/${payment.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to reverse payment.');
      }

      onReversalSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Reversal / Adjustment" maxWidth="520px">
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div
          style={{
            background: '#fffbeb',
            color: '#b45309',
            padding: '10px',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={24} />
        </div>
        <div>
          <h4 style={{ fontSize: '15px', color: '#0f172a' }}>
            Reverse Receipt #{payment.receipt_number}?
          </h4>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
            Amount: <strong>₹{payment.amount}</strong> • Mode: {payment.payment_mode.toUpperCase()}
          </p>
        </div>
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          fontSize: '12.5px',
          color: '#475569',
          marginBottom: '18px',
        }}
      >
        <strong>Accounting Integrity Notice:</strong> Financial transactions cannot be silently deleted. Reversing this payment will restore the student's invoice balance to ₹{payment.amount} due and record an immutable audit entry with your stated justification.
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '14px',
            fontSize: '12.5px',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleReverse}>
        <div className="form-group">
          <label className="form-label">Mandatory Reason for Reversal *</label>
          <textarea
            className="form-textarea"
            rows="3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Bank chargeback, duplicate manual entry, incorrect student selected..."
            required
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
          <button type="submit" className="btn btn-danger" disabled={loading || isReadOnlyMode}>
            <RotateCcw size={15} />
            {loading ? 'Reversing...' : 'Confirm Reversal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
