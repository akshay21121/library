import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, Calendar, ArrowRightLeft, Trash2, AlertCircle } from 'lucide-react';

export default function BookingModal({
  isOpen,
  onClose,
  seat,
  shift,
  onBookingSuccess,
  allSeats = [],
  shifts = [],
}) {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [studentId, setStudentId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  // Transfer states
  const [isTransferring, setIsTransferring] = useState(false);
  const [targetSeatId, setTargetSeatId] = useState('');
  const [targetShiftId, setTargetShiftId] = useState('');

  const isBooked = shift?.isBooked || shift?.status === 'BOOKED';

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsTransferring(false);
      // Fetch active students for dropdown
      apiFetch('/api/students?limit=100&status=active')
        .then((res) => res.json())
        .then((data) => {
          setStudents(data.students || []);
          if (data.students?.length > 0 && !studentId) {
            setStudentId(data.students[0].id);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [isOpen]);

  async function handleAllocate(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/seats/allocate', {
        method: 'POST',
        body: JSON.stringify({
          seatId: seat.id,
          shiftId: shift.shiftId,
          studentId,
          startDate,
          endDate,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to allocate seat.');
      }

      onBookingSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease() {
    if (isReadOnlyMode) return;
    if (!window.confirm(`Release seat ${seat.seat_number} (${shift.shiftName}) from ${shift.studentName}?`)) {
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/seats/release', {
        method: 'POST',
        body: JSON.stringify({ bookingId: shift.bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to release seat.');

      onBookingSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    if (!targetSeatId || !targetShiftId) {
      setError('Please select both a target seat and shift.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/seats/transfer', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: shift.bookingId,
          targetSeatId,
          targetShiftId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to transfer seat.');

      onBookingSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!seat || !shift) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isBooked
          ? `Seat ${seat.seat_number} — ${shift.shiftName} (Booked)`
          : `Allocate Seat ${seat.seat_number} — ${shift.shiftName}`
      }
      maxWidth="540px"
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

      {isBooked ? (
        // Details of currently booked shift segment
        <div>
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '6px' }}>
                  ACTIVE BOOKING
                </span>
                <h4 style={{ fontSize: '16px', color: '#065f46' }}>{shift.studentName}</h4>
                <p style={{ fontSize: '13px', color: '#047857' }}>
                  Admission #{shift.admissionNumber} • Phone: {shift.studentPhone || 'N/A'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '12.5px', color: '#047857' }}>
              <div>
                <strong>Valid From:</strong> {shift.startDate}
              </div>
              <div>
                <strong>Expires:</strong> {shift.endDate}
              </div>
            </div>
          </div>

          {!isTransferring ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setIsTransferring(true)}
                disabled={isReadOnlyMode}
              >
                <ArrowRightLeft size={16} /> Transfer Seat
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={handleRelease}
                disabled={loading || isReadOnlyMode}
              >
                <Trash2 size={16} /> {loading ? 'Releasing...' : 'Release Seat'}
              </button>
            </div>
          ) : (
            // Transfer Form
            <form onSubmit={handleTransfer}>
              <h5 style={{ fontSize: '14px', marginBottom: '12px' }}>Transfer Student to New Seat</h5>
              <div className="form-group">
                <label className="form-label">Select Destination Seat</label>
                <select
                  className="form-select"
                  value={targetSeatId}
                  onChange={(e) => setTargetSeatId(e.target.value)}
                  required
                >
                  <option value="">-- Select Target Seat --</option>
                  {allSeats
                    .filter((s) => s.id !== seat.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Seat {s.seat_number} ({s.room_name || 'Main Hall'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Destination Shift</label>
                <select
                  className="form-select"
                  value={targetShiftId}
                  onChange={(e) => setTargetShiftId(e.target.value)}
                  required
                >
                  <option value="">-- Select Shift --</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.start_time} - {sh.end_time})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsTransferring(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading || isReadOnlyMode}>
                  {loading ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        // Allocation Form for Available Shift
        <form onSubmit={handleAllocate}>
          <div className="form-group">
            <label className="form-label">Select Enrolled Student</label>
            <select
              className="form-select"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">-- Select Student --</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.admission_number}) — {st.phone}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UPSC Aspirant, prefers corner table"
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
              <UserCheck size={16} />
              {loading ? 'Allocating...' : 'Allocate Seat'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
