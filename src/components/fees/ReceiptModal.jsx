import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { Printer, Download, CheckCircle, ShieldCheck } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, paymentId }) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && paymentId) {
      setLoading(true);
      apiFetch(`/api/fees/receipts/${paymentId}`)
        .then((res) => res.json())
        .then((resData) => setData(resData))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, paymentId]);

  function handlePrint() {
    window.print();
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Official Fee Receipt" maxWidth="680px">
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Generating receipt voucher...
        </div>
      ) : data?.payment ? (
        <div>
          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <button className="btn btn-outline btn-sm" onClick={handlePrint}>
              <Printer size={15} /> Print / Save as PDF
            </button>
          </div>

          {/* Printable Receipt Paper */}
          <div className="receipt-printable" id="printable-receipt-area">
            {/* Header Banner */}
            <div className="receipt-header-banner">
              {data.library?.logo_url && (
                <img
                  src={data.library.logo_url}
                  alt="Library Logo"
                  className="receipt-lib-logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <h2 style={{ fontSize: '20px', color: '#0f172a', textTransform: 'uppercase' }}>
                {data.library?.name || 'Library Management'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {data.library?.address}, {data.library?.city}, {data.library?.state} - {data.library?.postal_code}
              </p>
              <p style={{ fontSize: '11px', color: '#64748b' }}>
                Phone: {data.library?.phone} • Email: {data.library?.email}
                {data.library?.business_tax_id ? ` • GSTIN/Tax ID: ${data.library.business_tax_id}` : ''}
              </p>
              <div
                style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: '#fff',
                  padding: '3px 14px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginTop: '8px',
                  letterSpacing: '0.05em',
                }}
              >
                {data.library?.receipt_header || 'OFFICIAL FEE RECEIPT'}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="receipt-meta-grid">
              <div>
                <div><strong>Receipt No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.payment.receipt_number}</span></div>
                <div><strong>Invoice No:</strong> {data.payment.invoice_number}</div>
                <div><strong>Date:</strong> {data.payment.payment_date}</div>
                <div><strong>Payment Mode:</strong> <span style={{ textTransform: 'uppercase' }}>{data.payment.payment_mode}</span></div>
              </div>

              <div>
                <div><strong>Student Name:</strong> {data.payment.student_name || 'Anonymous Student'}</div>
                <div><strong>Admission No:</strong> {data.payment.admission_number || 'N/A'}</div>
                <div><strong>Contact:</strong> {data.payment.student_phone || 'N/A'}</div>
                {data.seatInfo && (
                  <div>
                    <strong>Seat Allocated:</strong> {data.seatInfo.seat_number} ({data.seatInfo.shift_name})
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>{data.payment.invoice_title || 'Monthly Membership Study Fee'}</strong>
                    {data.payment.transaction_ref && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Ref: {data.payment.transaction_ref}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    ₹{data.payment.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr className="receipt-total-row">
                  <td>TOTAL RECEIVED</td>
                  <td style={{ textAlign: 'right', color: '#059669' }}>
                    ₹{data.payment.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer Message */}
            <div style={{ fontSize: '11.5px', color: '#475569', fontStyle: 'italic', marginBottom: '16px' }}>
              {data.library?.receipt_footer || 'Thank you for your study time. Maintain quietness inside the library.'}
            </div>

            {/* Signatures */}
            <div className="receipt-signatures">
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                <div>Authorized By: <strong>{data.payment.collector_name || data.library?.name}</strong></div>
                <div>Generated: {new Date().toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                <div style={{ height: '30px' }}></div>
                <div>Authorized Signature & Seal</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#ef4444' }}>Receipt not found.</div>
      )}
    </Modal>
  );
}
