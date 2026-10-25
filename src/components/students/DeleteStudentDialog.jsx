import React, { useState } from 'react';
import Modal from '../common/Modal';
import { AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';

export default function DeleteStudentDialog({
  isOpen,
  onClose,
  student,
  onConfirmDelete,
  loading,
}) {
  const [deleteMode, setDeleteMode] = useState('compliance_anonymize');

  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permanent Student Deletion" maxWidth="560px">
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={26} />
        </div>
        <div>
          <h4 style={{ fontSize: '16px', color: '#0f172a' }}>
            Permanently Delete {student.name}?
          </h4>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Admission No: <strong>{student.admission_number}</strong> • Phone: {student.phone}
          </p>
        </div>
      </div>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, marginBottom: '14px' }}>
          Please choose your deletion policy:
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px',
            borderRadius: '8px',
            border: `2px solid ${deleteMode === 'compliance_anonymize' ? '#4f46e5' : '#e2e8f0'}`,
            background: deleteMode === 'compliance_anonymize' ? '#eef2ff' : '#fff',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        >
          <input
            type="radio"
            name="deleteMode"
            value="compliance_anonymize"
            checked={deleteMode === 'compliance_anonymize'}
            onChange={() => setDeleteMode('compliance_anonymize')}
            style={{ marginTop: '3px' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                Privacy Anonymization & Financial Retention
              </span>
              <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                Recommended
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Immediately purges all personal data (name, phone, email, identity proofs, photo). Releases active seat bookings. Retains anonymized financial transaction entries for statutory tax, GST, and audit ledger integrity.
            </p>
          </div>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px',
            borderRadius: '8px',
            border: `2px solid ${deleteMode === 'hard_purge' ? '#dc2626' : '#e2e8f0'}`,
            background: deleteMode === 'hard_purge' ? '#fef2f2' : '#fff',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name="deleteMode"
            value="hard_purge"
            checked={deleteMode === 'hard_purge'}
            onChange={() => setDeleteMode('hard_purge')}
            style={{ marginTop: '3px' }}
          />
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#991b1b' }}>
              Complete Hard Purge
            </span>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Permanently and irrevocably erases the student record and releases all seat allocations. No recoverable copy is retained.
            </p>
          </div>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <button className="btn btn-outline" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onConfirmDelete(student.id, deleteMode)}
          disabled={loading}
        >
          <Trash2 size={16} />
          {loading ? 'Deleting...' : 'Permanently Delete'}
        </button>
      </div>
    </Modal>
  );
}
