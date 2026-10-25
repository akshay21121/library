import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Sparkles, Grid, AlertCircle } from 'lucide-react';

export default function QuickSetupWizard({ isOpen, onClose, onGenerate, loading }) {
  const [totalSeats, setTotalSeats] = useState(24);
  const [prefix, setPrefix] = useState('A');
  const [seatsPerRow, setSeatsPerRow] = useState(6);
  const [spacingX, setSpacingX] = useState(110);
  const [spacingY, setSpacingY] = useState(110);

  function handleSubmit(e) {
    e.preventDefault();
    onGenerate({
      totalSeats: parseInt(totalSeats, 10),
      prefix: prefix.trim() || 'S',
      seatsPerRow: parseInt(seatsPerRow, 10),
      spacingX: parseInt(spacingX, 10),
      spacingY: parseInt(spacingY, 10),
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Floor Setup Wizard" maxWidth="520px">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ background: '#eef2ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h4 style={{ fontSize: '15px', color: '#0f172a' }}>Auto-Generate Seat Layout</h4>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Quickly create a symmetrical, organized grid layout for your study hall.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Total Seats</label>
            <input
              type="number"
              className="form-input"
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
              min="1"
              max="200"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seat Prefix</label>
            <input
              type="text"
              className="form-input"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. A, B, CAB"
              maxLength="5"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Seats per Row</label>
            <input
              type="number"
              className="form-input"
              value={seatsPerRow}
              onChange={(e) => setSeatsPerRow(e.target.value)}
              min="2"
              max="15"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Horizontal Spacing (px)</label>
            <input
              type="number"
              className="form-input"
              value={spacingX}
              onChange={(e) => setSpacingX(e.target.value)}
              min="90"
              max="200"
            />
          </div>
        </div>

        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '12.5px',
            color: '#92400e',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            marginTop: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Generating a new layout replaces empty positions. If any seats currently have active student bookings, the system will prevent accidental deletion.
          </span>
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
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Grid size={16} />
            {loading ? 'Generating...' : 'Generate Layout'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
