import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  confirmBtnStyle = 'btn-danger',
  loading = false,
  children,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="500px">
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '10px',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#334155', fontSize: '14px', lineHeight: 1.6 }}>{message}</p>
          {children}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <button className="btn btn-outline" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button className={`btn ${confirmBtnStyle}`} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
