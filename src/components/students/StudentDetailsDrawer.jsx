import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, Mail, MapPin, Calendar, CreditCard, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

export default function StudentDetailsDrawer({ isOpen, onClose, studentId, onOpenReceipt }) {
  const { apiFetch } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && studentId) {
      setLoading(true);
      apiFetch(`/api/students/${studentId}`)
        .then((res) => res.json())
        .then((data) => setStudent(data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? `Student Profile: ${student.name}` : 'Student Details'}
      maxWidth="720px"
    >
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading profile details...
        </div>
      ) : student ? (
        <div>
          {/* Header Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '20px',
              }}
            >
              {student.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', color: '#0f172a' }}>{student.name}</h3>
                <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                  {student.status.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                Admission #{student.admission_number} • Enrolled {student.admission_date}
              </p>
            </div>
          </div>

          {/* Contact & KYC Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            <div>
              <strong>Phone:</strong> {student.phone}
            </div>
            <div>
              <strong>Email:</strong> {student.email || 'N/A'}
            </div>
            <div>
              <strong>Emergency:</strong> {student.emergency_contact_name || 'N/A'} ({student.emergency_contact_phone || 'N/A'})
            </div>
            <div>
              <strong>ID Proof:</strong> {student.id_proof_type || 'N/A'} - {student.id_proof_number || 'N/A'}
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <strong>Address:</strong> {student.address || 'N/A'}
            </div>
          </div>

          {/* Active Seat Allocation */}
          <h4 style={{ fontSize: '15px', color: '#0f172a', marginBottom: '10px' }}>
            Allocated Seats & Shifts
          </h4>
          {student.bookings?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {student.bookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: '#065f46' }}>
                      Seat {b.seat_number} — {b.shift_name}
                    </span>
                    <div style={{ fontSize: '12px', color: '#047857' }}>
                      {b.floor_name} {b.room_name ? `• ${b.room_name}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#047857', textAlign: 'right' }}>
                    <div>Valid: {b.start_date} to {b.end_date}</div>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '8px',
                color: '#64748b',
                fontSize: '13px',
                marginBottom: '24px',
              }}
            >
              No active seat currently booked. Visit the Floor Plan to allocate a seat.
            </div>
          )}

          {/* Payments & Receipts History */}
          <h4 style={{ fontSize: '15px', color: '#0f172a', marginBottom: '10px' }}>
            Payment Receipts History
          </h4>
          {student.payments?.length > 0 ? (
            <div className="table-container" style={{ marginBottom: '24px' }}>
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {student.payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.receipt_number}</td>
                      <td>{p.payment_date}</td>
                      <td style={{ fontWeight: 700 }}>₹{p.amount}</td>
                      <td><span className="badge badge-info">{p.payment_mode.toUpperCase()}</span></td>
                      <td>
                        <span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => onOpenReceipt(p.id)}
                        >
                          <FileText size={13} /> View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
              No payments recorded yet.
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: '#ef4444' }}>Student profile not found.</div>
      )}
    </Modal>
  );
}
