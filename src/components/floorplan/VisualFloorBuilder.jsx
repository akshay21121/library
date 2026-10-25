import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import SeatCard3Shift from './SeatCard3Shift';
import QuickSetupWizard from './QuickSetupWizard';
import BookingModal from './BookingModal';
import {
  Plus,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Trash2,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Square,
  DoorOpen,
  SplitSquareVertical,
  Minus,
} from 'lucide-react';

export default function VisualFloorBuilder() {
  const { apiFetch, isReadOnlyMode } = useAuth();

  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [shifts, setShifts] = useState([]);
  const [seats, setSeats] = useState([]);
  const [elements, setElements] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedShiftSegment, setSelectedShiftSegment] = useState(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Canvas View Controls
  const [zoom, setZoom] = useState(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [searchSeat, setSearchSeat] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // all, booked, available

  const canvasRef = useRef(null);

  // Load floors on mount
  useEffect(() => {
    loadFloors();
  }, []);

  // Load seats & elements when activeFloorId changes
  useEffect(() => {
    if (activeFloorId) {
      loadFloorData(activeFloorId);
    }
  }, [activeFloorId]);

  async function loadFloors() {
    try {
      const res = await apiFetch('/api/floors');
      const data = await res.json();
      setFloors(data || []);
      if (data && data.length > 0 && !activeFloorId) {
        setActiveFloorId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load floors:', err);
    }
  }

  async function loadFloorData(floorId) {
    try {
      const [fullRes, seatsRes] = await Promise.all([
        apiFetch(`/api/floors/${floorId}/full`),
        apiFetch(`/api/seats/floor/${floorId}`),
      ]);

      const fullData = await fullRes.json();
      const seatsData = await seatsRes.json();

      setRooms(fullData.rooms || []);
      setElements(fullData.elements || []);
      setShifts(seatsData.shifts || []);
      setSeats(seatsData.seats || []);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to load floor data:', err);
    }
  }

  // Handle shift segment click -> open booking / detail modal
  function handleShiftClick(seat, shift) {
    setSelectedSeat(seat);
    setSelectedShiftSegment(shift);
    setIsBookingModalOpen(true);
  }

  // Add a new standard seat onto the canvas
  function handleAddSeat() {
    if (isReadOnlyMode) return;
    const nextNum = seats.length + 1;
    const newSeat = {
      id: `temp_${Date.now()}`,
      seat_number: `S-${String(nextNum).padStart(2, '0')}`,
      x: 100 + ((seats.length % 6) * 110),
      y: 100 + (Math.floor(seats.length / 6) * 110),
      width: 80,
      height: 80,
      rotation: 0,
      seat_type: 'standard',
      shifts: shifts.map((sh) => ({
        shiftNumber: sh.shift_number,
        shiftId: sh.id,
        shiftName: sh.name,
        status: 'AVAILABLE',
        isBooked: false,
        color: '#ef4444',
      })),
    };
    setSeats([...seats, newSeat]);
    setHasUnsavedChanges(true);
  }

  // Add a layout element (wall, table, entrance, partition)
  function handleAddElement(type) {
    if (isReadOnlyMode) return;
    const newEl = {
      id: `el_${Date.now()}`,
      element_type: type,
      x: 200,
      y: 200,
      width: type === 'wall' ? 140 : type === 'table' ? 120 : 80,
      height: type === 'wall' ? 16 : type === 'table' ? 60 : 30,
      rotation: 0,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      color: type === 'entrance' ? '#10b981' : type === 'table' ? '#64748b' : '#334155',
    };
    setElements([...elements, newEl]);
    setHasUnsavedChanges(true);
  }

  // Drag and drop movement on canvas
  function handleSeatDragEnd(e, seatId) {
    if (!isEditMode || isReadOnlyMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;

    // Grid snapping (to 20px)
    const snappedX = Math.max(20, Math.round(rawX / 20) * 20);
    const snappedY = Math.max(20, Math.round(rawY / 20) * 20);

    setSeats(
      seats.map((s) => (s.id === seatId ? { ...s, x: snappedX, y: snappedY } : s))
    );
    setHasUnsavedChanges(true);
  }

  // Delete selected seat (checks active bookings server-side and client-side)
  function handleDeleteSelectedSeat() {
    if (!selectedSeat || isReadOnlyMode) return;

    // Check if any shift is booked
    const hasBooked = selectedSeat.shifts?.some((sh) => sh.isBooked);
    if (hasBooked) {
      alert(`Cannot delete Seat ${selectedSeat.seat_number}: It currently has booked shifts. Please release or transfer the bookings first.`);
      return;
    }

    if (window.confirm(`Delete seat ${selectedSeat.seat_number}?`)) {
      setSeats(seats.filter((s) => s.id !== selectedSeat.id));
      setSelectedSeat(null);
      setHasUnsavedChanges(true);
    }
  }

  // Rotate selected seat
  function handleRotateSelectedSeat() {
    if (!selectedSeat || isReadOnlyMode) return;
    const nextRot = ((selectedSeat.rotation || 0) + 90) % 360;
    setSeats(
      seats.map((s) => (s.id === selectedSeat.id ? { ...s, rotation: nextRot } : s))
    );
    setSelectedSeat({ ...selectedSeat, rotation: nextRot });
    setHasUnsavedChanges(true);
  }

  // Save full floor layout
  async function handleSaveLayout() {
    if (isReadOnlyMode) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/floors/${activeFloorId}/layout`, {
        method: 'POST',
        body: JSON.stringify({
          seats,
          elements,
          rooms,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save layout.');

      setHasUnsavedChanges(false);
      alert('Floor plan layout saved successfully!');
      loadFloorData(activeFloorId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Run Quick Setup Wizard
  async function handleWizardGenerate(options) {
    if (isReadOnlyMode) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/floors/${activeFloorId}/quick-layout`, {
        method: 'POST',
        body: JSON.stringify(options),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Quick setup failed.');

      setIsWizardOpen(false);
      loadFloorData(activeFloorId);
      alert(`Quick setup generated ${data.count} seats successfully!`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter seats for display
  const filteredSeats = seats.filter((seat) => {
    if (searchSeat && !seat.seat_number.toLowerCase().includes(searchSeat.toLowerCase())) {
      return false;
    }

    if (filterShift !== 'all') {
      const shiftNum = parseInt(filterShift, 10);
      const targetSegment = seat.shifts?.find((sh) => sh.shiftNumber === shiftNum);
      if (filterStatus === 'booked' && !targetSegment?.isBooked) return false;
      if (filterStatus === 'available' && targetSegment?.isBooked) return false;
    } else {
      if (filterStatus === 'booked') {
        const anyBooked = seat.shifts?.some((sh) => sh.isBooked);
        if (!anyBooked) return false;
      }
      if (filterStatus === 'available') {
        const anyAvail = seat.shifts?.some((sh) => !sh.isBooked);
        if (!anyAvail) return false;
      }
    }

    return true;
  });

  // Calculate shift occupancy summary
  const summaryByShift = shifts.map((sh) => {
    const bookedCount = seats.filter((s) =>
      s.shifts?.some((seg) => seg.shiftNumber === sh.shift_number && seg.isBooked)
    ).length;
    const availCount = Math.max(0, seats.length - bookedCount);
    return { ...sh, bookedCount, availCount };
  });

  return (
    <div>
      {/* Top Controls & Floor Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Active Floor:</label>
          <select
            className="form-select"
            style={{ width: '220px' }}
            value={activeFloorId}
            onChange={(e) => setActiveFloorId(e.target.value)}
          >
            {floors.map((fl) => (
              <option key={fl.id} value={fl.id}>
                {fl.name} ({fl.total_seats || 0} seats)
              </option>
            ))}
          </select>

          <button
            className={`btn btn-sm ${isEditMode ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setIsEditMode(!isEditMode)}
            disabled={isReadOnlyMode}
          >
            {isEditMode ? 'Exit Edit Mode' : 'Design / Edit Layout'}
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditMode && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setIsWizardOpen(true)}
                disabled={isReadOnlyMode}
              >
                <Sparkles size={15} /> Quick Setup Wizard
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleAddSeat}
                disabled={isReadOnlyMode}
              >
                <Plus size={15} /> Add Seat
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={handleSaveLayout}
                disabled={saving || isReadOnlyMode}
              >
                <Save size={15} /> {saving ? 'Saving...' : 'Save Floor Plan'}
              </button>
            </>
          )}

          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px' }}>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="btn btn-outline btn-sm"
              style={{ border: 'none', padding: '6px' }}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <span style={{ fontSize: '12px', padding: '6px 4px', fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="btn btn-outline btn-sm"
              style={{ border: 'none', padding: '6px' }}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Shifts Occupancy Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {summaryByShift.map((sh) => (
          <div
            key={sh.id}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Shift {sh.shift_number}: {sh.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {sh.start_time} - {sh.end_time}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-success" title="Booked / Occupied">
                <CheckCircle2 size={12} /> {sh.bookedCount} Booked
              </span>
              <span className="badge badge-danger" title="Available">
                <XCircle size={12} /> {sh.availCount} Avail
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search seat number..."
              className="form-input"
              style={{ paddingLeft: '32px', width: '200px', fontSize: '13px' }}
              value={searchSeat}
              onChange={(e) => setSearchSeat(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: '160px', fontSize: '13px' }}
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
          >
            <option value="all">All Shifts</option>
            {shifts.map((sh) => (
              <option key={sh.id} value={sh.shift_number}>
                Shift {sh.shift_number} ({sh.name})
              </option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: '150px', fontSize: '13px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="booked">Booked (Green)</option>
            <option value="available">Available (Red)</option>
          </select>
        </div>

        {/* Selected Seat Controls when in Edit Mode */}
        {isEditMode && selectedSeat && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Seat {selectedSeat.seat_number}:</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleRotateSelectedSeat}
              title="Rotate Seat"
            >
              <RotateCw size={14} /> Rotate
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDeleteSelectedSeat}
              title="Delete Seat"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Interactive Floor Plan Canvas */}
      <div className="canvas-wrapper">
        <div className="canvas-toolbar">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Legend:
            </span>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>
              GREEN = Booked
            </span>
            <span className="badge badge-danger" style={{ fontSize: '11px' }}>
              RED = Available
            </span>
          </div>

          {isEditMode && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Insert Element:</span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleAddElement('wall')}
                title="Add Partition Wall"
              >
                <Minus size={14} /> Wall
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleAddElement('table')}
                title="Add Common Study Table"
              >
                <Square size={14} /> Table
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleAddElement('entrance')}
                title="Add Entrance / Door"
              >
                <DoorOpen size={14} /> Door
              </button>
            </div>
          )}
        </div>

        <div className="canvas-viewport" onClick={() => setSelectedSeat(null)}>
          <div
            ref={canvasRef}
            className="canvas-surface"
            style={{
              width: '1200px',
              height: '800px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Structural Elements */}
            {elements.map((el) => (
              <div
                key={el.id}
                className={`floor-${el.element_type}`}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  height: `${el.height}px`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  backgroundColor: el.color,
                }}
              >
                {el.label}
              </div>
            ))}

            {/* 3-Shift Seat Cards */}
            {filteredSeats.map((seat) => (
              <SeatCard3Shift
                key={seat.id}
                seat={seat}
                isSelected={selectedSeat?.id === seat.id}
                onSelectSeat={(s) => setSelectedSeat(s)}
                onSelectShiftSegment={(s, sh) => handleShiftClick(s, sh)}
                isDraggable={isEditMode}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', seat.id);
                }}
                onDragEnd={(e) => handleSeatDragEnd(e, seat.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Booking / Details Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        seat={selectedSeat}
        shift={selectedShiftSegment}
        allSeats={seats}
        shifts={shifts}
        onBookingSuccess={() => loadFloorData(activeFloorId)}
      />

      {/* Quick Setup Wizard Modal */}
      <QuickSetupWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onGenerate={handleWizardGenerate}
        loading={saving}
      />
    </div>
  );
}
