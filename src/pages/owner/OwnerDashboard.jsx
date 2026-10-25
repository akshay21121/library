import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Armchair,
  IndianRupee,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  UserPlus,
  CreditCard,
  Map,
  MessageSquare,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function OwnerDashboard({ onNavigate, onOpenReceipt }) {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports/dashboard');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Loading dashboard metrics...</div>;
  }

  return (
    <div>
      {/* Quick Action Ribbon */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('students')}>
          <UserPlus size={15} /> New Admission
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate('fees')}>
          <CreditCard size={15} /> Record Payment
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate('floorplan')}>
          <Map size={15} /> Visual Floor Plan
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate('whatsapp')}>
          <MessageSquare size={15} /> Fee Reminders
        </button>
      </div>

      {/* Primary KPI Stat Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-title">Enrolled Students</div>
            <div className="stat-card-value">{stats.students?.total || 0}</div>
            <div className="stat-card-subtitle">
              <span style={{ color: '#059669', fontWeight: 600 }}>{stats.students?.active || 0} Active</span> •{' '}
              {stats.students?.inactive || 0} Inactive
            </div>
          </div>
          <div className="stat-card-icon">
            <Users size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card-title">Total Study Seats</div>
            <div className="stat-card-value">{stats.seats?.total || 0}</div>
            <div className="stat-card-subtitle">
              Across {stats.seats?.shifts?.length || 3} Daily Shifts
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Armchair size={22} />
          </div>
        </div>

        <div className="stat-card green">
          <div>
            <div className="stat-card-title">Today's Fee Collection</div>
            <div className="stat-card-value">₹{(stats.financial?.todayCollection || 0).toLocaleString('en-IN')}</div>
            <div className="stat-card-subtitle">
              This Month: ₹{(stats.financial?.monthlyCollection || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <IndianRupee size={22} />
          </div>
        </div>

        <div className="stat-card red">
          <div>
            <div className="stat-card-title">Outstanding / Due Fees</div>
            <div className="stat-card-value" style={{ color: '#dc2626' }}>
              ₹{(stats.financial?.pendingFeesTotal || 0).toLocaleString('en-IN')}
            </div>
            <div className="stat-card-subtitle">
              <span style={{ color: '#dc2626', fontWeight: 600 }}>Action Required</span>
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Real-Time Shift Occupancy Progress Cards */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '17px', color: '#0f172a' }}>Real-Time Seat Occupancy by Shift</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Live occupancy status calculated from active seat allocation records today.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('floorplan')}>
            View on Map <ArrowUpRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {stats.seats?.shifts?.map((sh) => (
            <div
              key={sh.shiftId}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  Shift {sh.shiftNumber}: {sh.shiftName}
                </strong>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                  {sh.startTime} - {sh.endTime}
                </span>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  margin: '12px 0 8px 0',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${sh.occupancyPercent}%`,
                    background: sh.occupancyPercent > 80 ? '#dc2626' : '#10b981',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>
                  ● {sh.bookedSeats} Booked ({sh.occupancyPercent}%)
                </span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>
                  ● {sh.availableSeats} Available
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Split Grid: Expiring Soon & Recent Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Expiring Memberships */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '16px', color: '#0f172a' }}>Memberships Expiring Soon</h4>
            <span className="badge badge-warning">Next 7 Days</span>
          </div>

          {stats.expiringSoon?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.expiringSoon.map((st) => (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#92400e' }}>{st.name}</div>
                    <div style={{ fontSize: '11.5px', color: '#b45309' }}>Phone: {st.phone}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>
                      Expires: {st.membership_expiry}
                    </div>
                    <div style={{ fontSize: '11px', color: '#b45309' }}>{st.plan_name || 'Standard'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No memberships expiring within the next 7 days.
            </div>
          )}
        </div>

        {/* Recent Payment Receipts */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ fontSize: '16px', color: '#0f172a' }}>Recent Fee Payments</h4>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('fees')}>
              View All
            </button>
          </div>

          {stats.recentPayments?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.recentPayments.map((pm) => (
                <div
                  key={pm.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0f172a' }}>
                      {pm.student_name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Receipt: <span style={{ fontFamily: 'monospace' }}>{pm.receipt_number}</span> • {pm.payment_mode.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#059669' }}>
                      +₹{pm.amount}
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '10px', padding: '2px 8px', marginTop: '2px' }}
                      onClick={() => onOpenReceipt && onOpenReceipt(pm.id)}
                    >
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No payments recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
