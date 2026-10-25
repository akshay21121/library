import React from 'react';
import { User, CheckCircle2, XCircle } from 'lucide-react';

/**
 * SeatCard3Shift Component
 * Renders a seat with three distinct shift segments:
 * 1. First Shift
 * 2. Second Shift
 * 3. Third Shift
 *
 * Each segment strictly displays:
 * - GREEN (#10b981) = Booked / Occupied
 * - RED (#ef4444) = Available / Empty
 * - Accessible text labels and icons
 */
export default function SeatCard3Shift({
  seat,
  isSelected,
  onSelectSeat,
  onSelectShiftSegment,
  isDraggable = false,
  onDragStart,
}) {
  const shifts = seat.shifts || [
    { shiftNumber: 1, shiftName: 'Shift 1', status: 'AVAILABLE', isBooked: false, color: '#ef4444' },
    { shiftNumber: 2, shiftName: 'Shift 2', status: 'AVAILABLE', isBooked: false, color: '#ef4444' },
    { shiftNumber: 3, shiftName: 'Shift 3', status: 'AVAILABLE', isBooked: false, color: '#ef4444' },
  ];

  return (
    <div
      className={`seat-card-node ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${seat.x}px`,
        top: `${seat.y}px`,
        transform: seat.rotation ? `rotate(${seat.rotation}deg)` : undefined,
        cursor: isDraggable ? 'move' : 'pointer',
      }}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSeat(seat);
      }}
    >
      {/* Seat Header */}
      <div className="seat-card-header">
        <span className="seat-number-tag">{seat.seat_number}</span>
        <span className="seat-type-indicator">{seat.seat_type || 'STD'}</span>
      </div>

      {/* 3 Shift Segments */}
      <div className="seat-segments-container">
        {shifts.map((shift) => {
          const isBooked = shift.isBooked || shift.status === 'BOOKED';
          return (
            <div
              key={shift.shiftNumber || shift.shiftId}
              className={`shift-segment ${isBooked ? 'booked' : 'available'}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectShiftSegment(seat, shift);
              }}
              title={
                isBooked
                  ? `Shift ${shift.shiftNumber}: BOOKED by ${shift.studentName} (${shift.admissionNumber || ''})`
                  : `Shift ${shift.shiftNumber}: AVAILABLE (Click to Allocate)`
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                {isBooked ? (
                  <CheckCircle2 size={11} style={{ flexShrink: 0 }} />
                ) : (
                  <XCircle size={11} style={{ flexShrink: 0 }} />
                )}
                <span className="shift-segment-label">
                  {shift.shiftName ? shift.shiftName.split(' ')[0] : `Shift ${shift.shiftNumber}`}
                </span>
              </div>

              <span className="shift-segment-badge">
                {isBooked ? 'BOOKED' : 'AVAIL'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
