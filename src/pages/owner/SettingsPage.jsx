import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Upload,
  Save,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

export default function SettingsPage() {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/tenant/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e, type) {
    if (isReadOnlyMode) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    if (type === 'logo') setUploadingLogo(true);
    if (type === 'banner') setUploadingBanner(true);

    try {
      const res = await apiFetch('/api/uploads', {
        method: 'POST',
        headers: {}, // multer boundary set automatically when body is FormData and headers is empty
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed.');

      if (type === 'logo') {
        setSettings({ ...settings, logo_url: data.url });
      } else if (type === 'banner') {
        setSettings({ ...settings, banner_url: data.url });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      if (type === 'banner') setUploadingBanner(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/tenant/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update settings.');

      alert('Library settings and branding updated successfully!');
      loadSettings();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Loading library configuration...</div>;
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <form onSubmit={handleSave}>
        {/* SECTION 1: Identity & Visual Branding */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '4px' }}>
            Library Identity & Visual Branding
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
            Upload your official library logo and cover banner. These appear on receipts, dashboards, and student communications.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'flex-start' }}>
            {/* Logo Preview & Upload */}
            <div>
              <label className="form-label">Official Library Logo</label>
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  marginBottom: '10px',
                  position: 'relative',
                }}
              >
                {settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ImageIcon size={32} color="#94a3b8" />
                )}
              </div>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '12px', marginBottom: '8px' }}
                placeholder="Or paste image URL"
                value={settings.logo_url || ''}
                onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
              />
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                {uploadingLogo ? 'Uploading...' : 'Upload Logo File'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'logo')}
                  disabled={uploadingLogo || isReadOnlyMode}
                />
              </label>
            </div>

            {/* Banner Preview & Upload */}
            <div>
              <label className="form-label">Library Cover / Banner Photo</label>
              <div
                style={{
                  height: '120px',
                  width: '100%',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  marginBottom: '10px',
                }}
              >
                {settings.banner_url ? (
                  <img
                    src={settings.banner_url}
                    alt="Banner"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ImageIcon size={32} color="#94a3b8" />
                )}
              </div>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '12px', marginBottom: '8px' }}
                placeholder="Or paste banner image URL"
                value={settings.banner_url || ''}
                onChange={(e) => setSettings({ ...settings, banner_url: e.target.value })}
              />
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                {uploadingBanner ? 'Uploading...' : 'Upload Banner File'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e, 'banner')}
                  disabled={uploadingBanner || isReadOnlyMode}
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
            <div className="form-group">
              <label className="form-label">Library Name *</label>
              <input
                type="text"
                className="form-input"
                value={settings.name || ''}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Display Name *</label>
              <input
                type="text"
                className="form-input"
                value={settings.owner_name || ''}
                onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone *</label>
              <input
                type="tel"
                className="form-input"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official Email Address *</label>
              <input
                type="email"
                className="form-input"
                value={settings.email || ''}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Location & Address */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '16px' }}>
            Postal Address & Premises Location
          </h3>

          <div className="form-group">
            <label className="form-label">Street / Building Address</label>
            <input
              type="text"
              className="form-input"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="e.g. Plot 42, Knowledge Corridor, Near Metro Station"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-input"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">State / Province</label>
              <input
                type="text"
                className="form-input"
                value={settings.state || ''}
                onChange={(e) => setSettings({ ...settings, state: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Postal / ZIP Code</label>
              <input
                type="text"
                className="form-input"
                value={settings.postal_code || ''}
                onChange={(e) => setSettings({ ...settings, postal_code: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-input"
                value={settings.country || 'India'}
                onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Operating Hours & Financial Details */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '16px' }}>
            Operating Hours & Receipt Header/Footer
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Daily Opening Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.opening_time || '07:00'}
                onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Closing Time</label>
              <input
                type="time"
                className="form-input"
                value={settings.closing_time || '23:00'}
                onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Header Tagline</label>
              <input
                type="text"
                className="form-input"
                value={settings.receipt_header || ''}
                onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business Tax ID / GSTIN</label>
              <input
                type="text"
                className="form-input"
                value={settings.business_tax_id || ''}
                onChange={(e) => setSettings({ ...settings, business_tax_id: e.target.value })}
                placeholder="Optional GST or registration number"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Receipt Footer Message</label>
            <textarea
              className="form-textarea"
              rows="2"
              value={settings.receipt_footer || ''}
              onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
            />
          </div>
        </div>

        {/* Save Bar */}
        <div
          style={{
            position: 'sticky',
            bottom: '20px',
            background: '#ffffff',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            border: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button type="submit" className="btn btn-primary" disabled={saving || isReadOnlyMode}>
            <Save size={16} />
            {saving ? 'Saving Changes...' : 'Save Library Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
