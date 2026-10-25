import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Settings,
  Users,
  Eye,
  RotateCw,
  Sliders,
} from 'lucide-react';

export default function WhatsAppPage() {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [subtab, setSubtab] = useState('manual'); // 'manual', 'logs', 'templates', 'settings'

  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [sending, setSending] = useState(false);

  // Template Editing
  const [editingTemplateKey, setEditingTemplateKey] = useState(null);
  const [templateText, setTemplateText] = useState('');

  useEffect(() => {
    if (subtab === 'manual') loadUnpaidStudents();
    if (subtab === 'logs') loadLogs();
    if (subtab === 'templates') loadTemplates();
    if (subtab === 'settings') loadSettings();
  }, [subtab]);

  async function loadUnpaidStudents() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports/defaulters');
      const data = await res.json();
      setUnpaidInvoices(data || []);
      // By default select all
      setSelectedStudentIds((data || []).map((item) => item.student_id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/whatsapp/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/whatsapp/templates');
      const data = await res.json();
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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

  function toggleStudentSelection(sId) {
    if (selectedStudentIds.includes(sId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== sId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, sId]);
    }
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      setSelectedStudentIds(unpaidInvoices.map((i) => i.student_id));
    } else {
      setSelectedStudentIds([]);
    }
  }

  function handleOpenPreview() {
    if (selectedStudentIds.length === 0) {
      alert('Please select at least one student recipient.');
      return;
    }

    const firstStudent = unpaidInvoices.find((i) => selectedStudentIds.includes(i.student_id));
    const sampleMsg = `Dear ${firstStudent?.student_name || 'Student'},\n\nThis is a gentle reminder that your membership fee of ₹${firstStudent?.balance_amount || 0} is due on ${firstStudent?.due_date || 'N/A'}.\n\nPlease complete your fee payment to maintain your reserved seat.\n\nWarm regards,\nLibrary Administration`;
    setPreviewContent(sampleMsg);
    setIsPreviewOpen(true);
  }

  async function handleSendReminders() {
    if (isReadOnlyMode) return;
    setSending(true);
    try {
      const res = await apiFetch('/api/whatsapp/remind-manual', {
        method: 'POST',
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          customMessage: previewContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch reminders.');

      setIsPreviewOpen(false);
      alert(`Reminders processed! ${data.processed?.length || 0} messages queued / dispatched.`);
      setSubtab('logs');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleTriggerAutoReminders() {
    if (isReadOnlyMode) return;
    setSending(true);
    try {
      const res = await apiFetch('/api/whatsapp/run-auto', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auto reminders failed.');

      alert(`Automatic engine evaluated ${data.evaluated || 0} overdue invoices. Sent: ${data.sentCount || 0} reminders.`);
      setSubtab('logs');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveTemplate(templateKey) {
    if (isReadOnlyMode) return;
    try {
      const res = await apiFetch(`/api/whatsapp/templates/${templateKey}`, {
        method: 'PUT',
        body: JSON.stringify({ bodyText: templateText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update template.');

      setEditingTemplateKey(null);
      loadTemplates();
      alert('WhatsApp template updated successfully!');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (isReadOnlyMode) return;
    try {
      const res = await apiFetch('/api/tenant/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update settings.');

      alert('Automatic reminder preferences saved!');
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      {/* Subtab Bar */}
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
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            className={`btn btn-sm ${subtab === 'manual' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setSubtab('manual')}
          >
            <Send size={15} /> Send Reminders
          </button>
          <button
            className={`btn btn-sm ${subtab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setSubtab('logs')}
          >
            <Clock size={15} /> Notification Logs
          </button>
          <button
            className={`btn btn-sm ${subtab === 'templates' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setSubtab('templates')}
          >
            <MessageSquare size={15} /> Message Templates
          </button>
          <button
            className={`btn btn-sm ${subtab === 'settings' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setSubtab('settings')}
          >
            <Sliders size={15} /> Automation Settings
          </button>
        </div>

        {subtab === 'manual' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleTriggerAutoReminders}
              disabled={sending || isReadOnlyMode}
            >
              <RotateCw size={14} /> Run Auto Reminders Now
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleOpenPreview}
              disabled={selectedStudentIds.length === 0 || isReadOnlyMode}
            >
              <Send size={14} /> Preview & Send ({selectedStudentIds.length})
            </button>
          </div>
        )}
      </div>

      {/* SUBTAB 1: Manual Reminders */}
      {subtab === 'manual' && (
        <div>
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              padding: '14px 18px',
              fontSize: '13px',
              color: '#065f46',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>Pending Fee Reminders:</strong> Found <strong>{unpaidInvoices.length}</strong> students with pending dues. Idempotency guarantees each student will not receive accidental duplicate messages today.
            </div>
          </div>

          <div className="table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === unpaidInvoices.length && unpaidInvoices.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Student</th>
                  <th>Admission #</th>
                  <th>WhatsApp Phone</th>
                  <th>Invoice #</th>
                  <th>Outstanding Due</th>
                  <th>Due Date</th>
                  <th>Last Reminder Sent</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Finding students with pending dues...
                    </td>
                  </tr>
                ) : unpaidInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Great job! There are no overdue students at this time.
                    </td>
                  </tr>
                ) : (
                  unpaidInvoices.map((inv) => {
                    const isSelected = selectedStudentIds.includes(inv.student_id);
                    return (
                      <tr key={inv.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(inv.student_id)}
                          />
                        </td>
                        <td>
                          <strong>{inv.student_name}</strong>
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{inv.admission_number}</td>
                        <td style={{ fontWeight: 600 }}>{inv.student_phone}</td>
                        <td>{inv.invoice_number}</td>
                        <td style={{ fontWeight: 800, color: '#dc2626' }}>₹{inv.balance_amount}</td>
                        <td>{inv.due_date}</td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>
                          {inv.last_reminder_sent_at
                            ? new Date(inv.last_reminder_sent_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Notification Logs */}
      {subtab === 'logs' && (
        <div className="table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Recipient</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Message Snippet</th>
                <th>Status</th>
                <th>Provider ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading message audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No notification logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isDelivered = log.status === 'delivered' || log.status === 'sent';
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <strong>{log.student_name || 'N/A'}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{log.admission_number}</div>
                      </td>
                      <td>{log.phone_number}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '10.5px' }}>
                          {log.message_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.message_content}
                      </td>
                      <td>
                        <span className={`badge ${isDelivered ? 'badge-success' : 'badge-danger'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                        {log.provider_message_id || 'sandbox_sim'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 3: Templates */}
      {subtab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', color: '#0f172a' }}>{tmpl.title}</h4>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                  {tmpl.template_key}
                </span>
              </div>

              {editingTemplateKey === tmpl.template_key ? (
                <div>
                  <textarea
                    className="form-textarea"
                    rows="6"
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setEditingTemplateKey(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveTemplate(tmpl.template_key)}
                      disabled={isReadOnlyMode}
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <pre
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '12.5px',
                      color: '#334155',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      marginBottom: '14px',
                    }}
                  >
                    {tmpl.body_text}
                  </pre>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setEditingTemplateKey(tmpl.template_key);
                      setTemplateText(tmpl.body_text);
                    }}
                    disabled={isReadOnlyMode}
                  >
                    Edit Template
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SUBTAB 4: Automation Settings */}
      {subtab === 'settings' && settings && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h3 style={{ fontSize: '17px', marginBottom: '6px' }}>Automatic WhatsApp Reminders</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
            Configure background reminder schedules. The system automatically inspects students with approaching due dates and sends WhatsApp alerts.
          </p>

          <form onSubmit={handleSaveSettings}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings.auto_whatsapp_enabled)}
                  onChange={(e) =>
                    setSettings({ ...settings, auto_whatsapp_enabled: e.target.checked ? 1 : 0 })
                  }
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Enable Automatic Due-Date Reminders
                </span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Days Before Due Date</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.reminder_days_before || 3}
                  onChange={(e) =>
                    setSettings({ ...settings, reminder_days_before: parseInt(e.target.value, 10) })
                  }
                  min="1"
                  max="15"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Daily Reminder Trigger Time</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.reminder_time || '10:00'}
                  onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#475569',
                marginBottom: '18px',
              }}
            >
              <strong>Meta WhatsApp Cloud Integration:</strong> Currently running in transparent Sandbox / Test Mode. To broadcast with your official Meta Verified Number, configure <code>WHATSAPP_TOKEN</code> and <code>WHATSAPP_PHONE_ID</code> in <code>.env</code>.
            </div>

            <button type="submit" className="btn btn-primary" disabled={isReadOnlyMode}>
              Save Preferences
            </button>
          </form>
        </div>
      )}

      {/* Message Preview & Confirmation Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="Confirm WhatsApp Broadcast" maxWidth="560px">
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Sending fee reminder to <strong>{selectedStudentIds.length}</strong> selected student recipient(s). Preview how the message will appear to students below:
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Message Preview & Customization</label>
          <textarea
            className="form-textarea"
            rows="7"
            value={previewContent}
            onChange={(e) => setPreviewContent(e.target.value)}
            style={{ fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button className="btn btn-outline" onClick={() => setIsPreviewOpen(false)} disabled={sending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSendReminders} disabled={sending || isReadOnlyMode}>
            <Send size={15} />
            {sending ? 'Sending Broadcast...' : `Send to ${selectedStudentIds.length} Recipients`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
