import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Users,
  Armchair,
  IndianRupee,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Eye,
} from 'lucide-react';

export default function SuperAdminDashboard({ onNavigate, onInspectLibrary }) {
  const { apiFetch } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [anaRes, libRes] = await Promise.all([
        apiFetch('/api/superadmin/analytics'),
        apiFetch('/api/superadmin/libraries'),
      ]);

      const anaData = await anaRes.json();
      const libData = await libRes.json();

      setAnalytics(anaData);
      setLibraries(libData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !analytics) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Loading platform administration telemetry...</div>;
  }

  const { overview } = analytics;

  return (
    <div>
      {/* Platform Stat Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-title">Registered Libraries</div>
            <div className="stat-card-value">{overview.totalLibraries}</div>
            <div className="stat-card-subtitle">
              <span style={{ color: '#059669', fontWeight: 600 }}>{overview.activeLibraries} Active</span> •{' '}
              {overview.suspendedLibraries} Suspended
            </div>
          </div>
          <div className="stat-card-icon">
            <Building2 size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card-title">Total Platform Students</div>
            <div className="stat-card-value">{overview.totalStudentsAcrossPlatform}</div>
            <div className="stat-card-subtitle">
              Across all independent tenants
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
            <Users size={22} />
          </div>
        </div>

        <div className="stat-card green">
          <div>
            <div className="stat-card-title">SaaS Platform MRR</div>
            <div className="stat-card-value" style={{ color: '#059669' }}>
              ₹{overview.totalPlatformSaaSSubscriptionRevenue.toLocaleString('en-IN')}
            </div>
            <div className="stat-card-subtitle">
              Recurring subscription revenue
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <TrendingUp size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-card-title">Managed Library Seats</div>
            <div className="stat-card-value">{overview.totalSeatsAcrossPlatform}</div>
            <div className="stat-card-subtitle">
              Configured on floor canvases
            </div>
          </div>
          <div className="stat-card-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Armchair size={22} />
          </div>
        </div>
      </div>

      {/* Libraries Overview Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '17px', color: '#0f172a' }}>Registered Library Tenants</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Independent libraries hosted on the platform. Supreme Admin can inspect each tenant in strict read-only mode.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('super-libraries')}>
            View All Libraries <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Library Tenant</th>
                <th>Owner & Contact</th>
                <th>Location</th>
                <th>Plan</th>
                <th>Students</th>
                <th>Seats</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Strict Inspection</th>
              </tr>
            </thead>
            <tbody>
              {libraries.map((lib) => (
                <tr key={lib.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#4f46e5',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '13px',
                        }}
                      >
                        {lib.name.charAt(0)}
                      </div>
                      <div>
                        <strong>{lib.name}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>slug: {lib.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{lib.owner_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{lib.email}</div>
                  </td>
                  <td>{lib.city}, {lib.state}</td>
                  <td>
                    <span className="badge badge-info">{lib.plan_name || 'Pro'}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{lib.total_students}</td>
                  <td>{lib.total_seats}</td>
                  <td>
                    <span className={`badge ${lib.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {lib.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onInspectLibrary(lib.id, lib.name, lib.logo_url)}
                      title="Open Library in Read-Only Mode"
                    >
                      <Eye size={13} /> Read-Only View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
