import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export default function LibrariesList({ onInspectLibrary }) {
  const { apiFetch } = useAuth();
  const [libraries, setLibraries] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLibraries();
  }, [status]);

  async function loadLibraries() {
    setLoading(true);
    try {
      let q = `status=${status}`;
      if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
      const res = await apiFetch(`/api/superadmin/libraries?${q}`);
      const data = await res.json();
      setLibraries(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(lib) {
    const nextStatus = lib.status === 'active' ? 'suspended' : 'active';
    const actionText = nextStatus === 'suspended' ? 'Suspend' : 'Activate';

    if (!window.confirm(`${actionText} library "${lib.name}"? ${nextStatus === 'suspended' ? 'Owner and students will be temporarily locked out.' : ''}`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/superadmin/libraries/${lib.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status change failed.');

      loadLibraries();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadLibraries();
  }

  return (
    <div>
      {/* Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search library name, city, owner..."
              className="form-input"
              style={{ paddingLeft: '36px', width: '280px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-select"
            style={{ width: '150px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended</option>
          </select>

          <button type="submit" className="btn btn-outline">
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Library Name</th>
              <th>Owner & Contact</th>
              <th>Location</th>
              <th>Subscription</th>
              <th>Students</th>
              <th>Seats</th>
              <th>Total Revenue</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading library tenants...
                </td>
              </tr>
            ) : libraries.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No libraries matched your criteria.
                </td>
              </tr>
            ) : (
              libraries.map((lib) => (
                <tr key={lib.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#e0e7ff',
                          color: '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
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
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{lib.phone}</div>
                  </td>
                  <td>
                    {lib.city}, {lib.state}
                  </td>
                  <td>
                    <span className="badge badge-info">{lib.plan_name || 'Standard'}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{lib.total_students}</td>
                  <td>{lib.total_seats}</td>
                  <td style={{ fontWeight: 700, color: '#059669' }}>
                    ₹{lib.total_revenue.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`badge ${lib.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {lib.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onInspectLibrary(lib.id, lib.name, lib.logo_url)}
                        title="Strict Read-Only Mode"
                      >
                        <Eye size={13} /> Read-Only View
                      </button>

                      <button
                        className={`btn btn-sm ${lib.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleStatus(lib)}
                      >
                        {lib.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
