import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Search, Filter, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';

export default function AuditLogsPage() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter]);

  async function loadAuditLogs() {
    setLoading(true);
    try {
      let q = '';
      if (actionFilter) q += `action=${encodeURIComponent(actionFilter)}`;
      const res = await apiFetch(`/api/superadmin/audit-logs?${q}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
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
        <div>
          <h3 style={{ fontSize: '18px', color: '#0f172a' }}>Platform Security & Access Audit Trail</h3>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Immutable record of sensitive tenant inspections, administrative interventions, deletions, and reversals.
          </p>
        </div>

        <select
          className="form-select"
          style={{ width: '240px' }}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Audited Actions</option>
          <option value="SUPER_ADMIN_VIEW_TENANT">Supreme Admin Tenant Views</option>
          <option value="BLOCKED_MUTATION">Blocked Mutations (Read-Only)</option>
          <option value="PERMANENT_STUDENT_DELETION">Student Deletions</option>
          <option value="PAYMENT_REVERSED">Payment Reversals</option>
          <option value="TENANT_STATUS_CHANGED">Library Suspensions / Activations</option>
        </select>
      </div>

      <div className="table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Operator</th>
              <th>Role</th>
              <th>Target Tenant</th>
              <th>Details & Trace</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading audit events...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No audit logs found for selected filter.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isBlocked = log.action.includes('BLOCKED');
                const isView = log.action.includes('VIEW');
                const isDelete = log.action.includes('DELETION');

                let badgeClass = 'badge-info';
                if (isBlocked) badgeClass = 'badge-danger';
                else if (isDelete) badgeClass = 'badge-warning';
                else if (isView) badgeClass = 'badge-success';

                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '11px' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.user_email || log.user_email_ref || 'System'}</td>
                    <td><span className="badge badge-info">{log.role}</span></td>
                    <td>{log.library_name || log.tenant_id || 'Platform'}</td>
                    <td style={{ fontSize: '12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>
                        {log.details}
                      </code>
                    </td>
                    <td style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>{log.ip_address}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
