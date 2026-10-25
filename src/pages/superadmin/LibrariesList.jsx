import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  Plus,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import Modal from '../../components/common/Modal';

export default function LibrariesList({ onInspectLibrary }) {
  const { apiFetch } = useAuth();
  const [libraries, setLibraries] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  // Add Library Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    planId: '',
    status: 'active',
  });

  // Creation Result Modal state
  const [createdResult, setCreatedResult] = useState(null);

  // SMTP test state
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState(null);

  // Resend state
  const [resendingId, setResendingId] = useState(null);

  useEffect(() => {
    loadLibraries();
    loadPlans();
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

  async function loadPlans() {
    try {
      const res = await apiFetch('/api/superadmin/analytics');
      const data = await res.json();
      if (data?.plans && data.plans.length > 0) {
        setPlans(data.plans);
        setFormData((prev) => ({ ...prev, planId: prev.planId || data.plans[0].id }));
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }

  async function handleTestSmtp() {
    setTestingSmtp(true);
    try {
      const res = await apiFetch('/api/superadmin/test-smtp');
      const data = await res.json();
      setSmtpStatus(data);
    } catch (err) {
      setSmtpStatus({ connected: false, message: err.message });
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleCreateLibrary(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.ownerName.trim() || !formData.ownerEmail.trim() || !formData.ownerPhone.trim()) {
      alert('Please fill all required fields.');
      return;
    }
    if (!formData.planId) {
      alert('Please select a subscription plan.');
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch('/api/superadmin/libraries', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create library.');
      }

      setIsAddModalOpen(false);
      setCreatedResult(data);
      // Reset form
      setFormData({
        name: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        planId: plans[0]?.id || '',
        status: 'active',
      });
      loadLibraries();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleResendActivation(lib) {
    if (!window.confirm(`Resend activation email to ${lib.email} (${lib.owner_name})? A fresh 48-hour secure activation token will be generated.`)) {
      return;
    }

    setResendingId(lib.id);
    try {
      const res = await apiFetch(`/api/superadmin/libraries/${lib.id}/resend-activation`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to resend activation email.');
      }

      if (data.emailDelivery?.sent) {
        alert(`Activation email successfully delivered to ${lib.email}!`);
      } else {
        alert(`Activation token refreshed, but email delivery failed: ${data.emailDelivery?.error || 'Check SMTP configuration'}`);
      }
      loadLibraries();
    } catch (err) {
      alert(err.message);
    } finally {
      setResendingId(null);
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

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  }

  return (
    <div>
      {/* Top Controls Bar */}
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
              placeholder="Search library, owner, ID, city..."
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
            <option value="pending">Pending Approval</option>
            <option value="suspended">Suspended</option>
          </select>

          <button type="submit" className="btn btn-outline">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleTestSmtp}
            disabled={testingSmtp}
            title="Verify Gmail SMTP connection"
          >
            <Mail size={15} />
            {testingSmtp ? 'Testing SMTP...' : 'Test Email Config'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} /> Add Library
          </button>
        </div>
      </div>

      {/* SMTP Test Status Banner */}
      {smtpStatus && (
        <div
          style={{
            background: smtpStatus.connected ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${smtpStatus.connected ? '#a7f3d0' : '#fde68a'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {smtpStatus.connected ? <CheckCircle2 size={18} color="#059669" /> : <AlertTriangle size={18} color="#d97706" />}
            <span style={{ fontWeight: 600, color: smtpStatus.connected ? '#065f46' : '#92400e' }}>
              {smtpStatus.message}
            </span>
          </div>
          <button
            onClick={() => setSmtpStatus(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Libraries Table */}
      <div className="table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Library Info</th>
              <th>Owner &amp; Login Account</th>
              <th>Location</th>
              <th>Subscription</th>
              <th>Activation</th>
              <th>Students / Seats</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading library tenants...
                </td>
              </tr>
            ) : libraries.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  No libraries matched your search criteria.
                </td>
              </tr>
            ) : (
              libraries.map((lib) => (
                <tr key={lib.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
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
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          ID: {lib.library_code || lib.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{lib.owner_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{lib.email}</div>
                    <div style={{ fontSize: '11px', color: '#4338ca', fontFamily: 'monospace' }}>
                      Login ID: {lib.owner_account_id || 'N/A'}
                    </div>
                  </td>
                  <td>
                    {lib.city ? `${lib.city}, ${lib.state || 'India'}` : 'Main Campus'}
                  </td>
                  <td>
                    <span className="badge badge-info">{lib.plan_name || 'Standard'}</span>
                  </td>
                  <td>
                    {lib.owner_is_activated === 1 ? (
                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                        <CheckCircle2 size={12} /> Activated
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        <Clock size={12} /> Pending Setup
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>
                      <strong>{lib.total_students}</strong> students
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {lib.total_seats} seats ({lib.active_bookings || 0} booked)
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        lib.status === 'active'
                          ? 'badge-success'
                          : lib.status === 'pending'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
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
                        <Eye size={13} /> Inspect
                      </button>

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleResendActivation(lib)}
                        disabled={resendingId === lib.id}
                        title="Resend activation email link"
                      >
                        <Send size={13} />
                        {resendingId === lib.id ? 'Sending...' : 'Resend Email'}
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

      {/* Add Library Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !creating && setIsAddModalOpen(false)}
        title="Add New Study Library"
        maxWidth="640px"
      >
        <form onSubmit={handleCreateLibrary}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Enter library and owner details. The platform will automatically provision the library tenant, create the owner account, and dispatch an activation email with a secure password creation link.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Library Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Takshashila Reading Hall &amp; Library"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Chandra Sharma"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Email Address *</label>
              <input
                type="email"
                className="form-input"
                placeholder="owner@gmail.com"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Phone Number *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subscription Plan *</label>
              <select
                className="form-select"
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.price_monthly}/mo (Max {p.max_students} Students)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Premises Street Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="Plot No. 42, Near City Center"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jaipur"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rajasthan"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Initial Account Status</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active Immediately (Can access right after setting password)</option>
                <option value="pending">Pending Approval (Authorized by admin before access)</option>
                <option value="suspended">Suspended / Inactive</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAddModalOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? 'Creating & Dispatching Email...' : 'Create Library & Send Activation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Creation Result Modal */}
      {createdResult && (
        <Modal
          isOpen={Boolean(createdResult)}
          onClose={() => setCreatedResult(null)}
          title="Library &amp; Owner Account Provisioned"
          maxWidth="560px"
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <CheckCircle2 size={32} color="#059669" />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
              "{createdResult.library.name}" Created Successfully
            </h3>
          </div>

          {/* Details Table */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '18px',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Library ID:</span>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#4338ca' }}>
                  {createdResult.library.libraryCode}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Owner Account ID:</span>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#4338ca' }}>
                  {createdResult.owner.accountId}
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Owner Name:</span>
                <div style={{ fontWeight: 600 }}>{createdResult.owner.name}</div>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Registered Email:</span>
                <div style={{ fontWeight: 600 }}>{createdResult.owner.email}</div>
              </div>
            </div>
          </div>

          {/* Email Delivery Status Banner */}
          {createdResult.emailDelivery?.sent ? (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={20} color="#059669" />
              <div style={{ fontSize: '13px', color: '#065f46' }}>
                <strong>Activation Email Sent:</strong> Delivered to <strong>{createdResult.owner.email}</strong>. The owner can click the link to set their password.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={18} color="#d97706" />
                <strong style={{ fontSize: '13px', color: '#92400e' }}>
                  Library created, but email delivery failed.
                </strong>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#78350f', lineHeight: 1.5 }}>
                Reason: {createdResult.emailDelivery?.error || 'Gmail SMTP is not configured in .env'}.
              </p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                You can copy the secure activation link below and provide it manually to the owner:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  style={{ fontSize: '11px', background: '#fff' }}
                  value={createdResult.emailDelivery?.activationLink || ''}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => copyToClipboard(createdResult.emailDelivery?.activationLink)}
                >
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={() => setCreatedResult(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
