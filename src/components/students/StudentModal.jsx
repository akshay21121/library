import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Save, AlertCircle } from 'lucide-react';

export default function StudentModal({ isOpen, onClose, student = null, onSaved }) {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [idProofType, setIdProofType] = useState('Aadhaar');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [address, setAddress] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [membershipPlanId, setMembershipPlanId] = useState('');
  const [initialPayment, setInitialPayment] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Fetch fee plans
      apiFetch('/api/fees/plans')
        .then((res) => res.json())
        .then((data) => setPlans(data || []))
        .catch((err) => console.error(err));

      if (student) {
        setName(student.name || '');
        setPhone(student.phone || '');
        setEmail(student.email || '');
        setEmergencyName(student.emergency_contact_name || '');
        setEmergencyPhone(student.emergency_contact_phone || '');
        setIdProofType(student.id_proof_type || 'Aadhaar');
        setIdProofNumber(student.id_proof_number || '');
        setAddress(student.address || '');
        setAdmissionDate(student.admission_date || new Date().toISOString().split('T')[0]);
        setMembershipPlanId(student.membership_plan_id || '');
        setNotes(student.notes || '');
      } else {
        setName('');
        setPhone('');
        setEmail('');
        setEmergencyName('');
        setEmergencyPhone('');
        setIdProofType('Aadhaar');
        setIdProofNumber('');
        setAddress('');
        setAdmissionDate(new Date().toISOString().split('T')[0]);
        setMembershipPlanId('');
        setInitialPayment(0);
        setPaymentMode('cash');
        setNotes('');
      }
    }
  }, [isOpen, student]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    setError(null);
    setLoading(true);

    const payload = {
      name,
      phone,
      email,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      id_proof_type: idProofType,
      id_proof_number: idProofNumber,
      address,
      admission_date: admissionDate,
      membership_plan_id: membershipPlanId || null,
      notes,
    };

    if (!student) {
      payload.initial_payment_amount = Number(initialPayment) || 0;
      payload.payment_mode = paymentMode;
    }

    try {
      const url = student ? `/api/students/${student.id}` : '/api/students';
      const method = student ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to save student.');
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={student ? `Edit Student: ${student.name}` : 'New Student Admission'}
      maxWidth="680px"
    >
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp / Phone *</label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Admission Date</label>
            <input
              type="date"
              className="form-input"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Emergency Contact Name</label>
            <input
              type="text"
              className="form-input"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Parent / Guardian Name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Emergency Contact Phone</label>
            <input
              type="tel"
              className="form-input"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+91..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Identity Proof Type</label>
            <select
              className="form-select"
              value={idProofType}
              onChange={(e) => setIdProofType(e.target.value)}
            >
              <option value="Aadhaar">Aadhaar Card</option>
              <option value="Driving License">Driving License</option>
              <option value="Passport">Passport</option>
              <option value="Student ID">College / Institute ID</option>
              <option value="Voter ID">Voter ID</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">ID Proof Number</label>
            <input
              type="text"
              className="form-input"
              value={idProofNumber}
              onChange={(e) => setIdProofNumber(e.target.value)}
              placeholder="e.g. 1234-5678-9012"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Postal Address</label>
          <input
            type="text"
            className="form-input"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Complete local / residential address"
          />
        </div>

        {/* Fee Plan Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Assign Membership Fee Plan</label>
            <select
              className="form-select"
              value={membershipPlanId}
              onChange={(e) => setMembershipPlanId(e.target.value)}
            >
              <option value="">-- No Plan / Custom Fee Later --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{p.price} / {p.duration_days} days)
                </option>
              ))}
            </select>
          </div>

          {!student && (
            <div className="form-group">
              <label className="form-label">Initial Payment Collected (₹)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                  min="0"
                  placeholder="0"
                />
                <select
                  className="form-select"
                  style={{ width: '130px' }}
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-textarea"
            rows="2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preparation goal, target exam, desk preference..."
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
            {student ? <Save size={16} /> : <UserPlus size={16} />}
            {loading ? 'Saving...' : student ? 'Save Changes' : 'Confirm Admission'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
