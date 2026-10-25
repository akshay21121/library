import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import {
  Mail,
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
  ShieldCheck,
  Check,
} from 'lucide-react';

export default function WhatsAppPage() {
  const { apiFetch, isReadOnlyMode } = useAuth();
  const [subtab, setSubtab] = useState('manual'); // 'manual', 'logs', 'templates', 'settings'

  const [channel, setChannel] = useState('email'); // 'email' (Gmail SMTP) or 'whatsapp'
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

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
    checkSmtp();
  }, []);

  useEffect(() => {
    if (subtab === 'manual') loadUnpaidStudents();
    if (subtab === 'logs') loadLogs();
    if (subtab === 'templates') loadTemplates();
    if (subtab === 'settings') loadSettings();
  }, [subtab]);

  async function checkSmtp() {
    try {
      const res = await apiFetch('/api/whatsapp/smtp-status');
      const data = await res.json();
      setSmtpStatus(data);
    } catch (e) {
      setSmtpStatus({ connected: false, message: 'SMTP status check failed' });
    }
  }

  async function handleTestSmtp() {
    setTestingSmtp(true);
    await checkSmtp();
    setTestingSmtp(false);
  }

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
    const sampleMsg =
      channel === 'email'
        ? `Dear ${firstStudent?.student_name || 'Student'},\n\nThis is an official fee reminder regarding your study library membership fee of ₹${firstStudent?.balance_amount || 0} due on ${firstStudent?.due_date || 'N/A'}.\n\nPlease settle your balance at the library reception or via UPI to keep your dedicated seat reserved.\n\nWarm regards,\nLibrary Administration`
        : `Dear ${firstStudent?.student_name || 'Student'},\n\nGentle WhatsApp reminder: Your membership fee of ₹${firstStudent?.balance_amount || 0} is due on ${firstStudent?.due_date || 'N/A'}.\n\nWarm regards,\nLibrary Administration`;

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
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to dispatch reminders.');

      setIsPreviewOpen(false);
      alert(`Reminders processed via ${channel.toUpperCase()}! ${data.processed?.length || 0} messages dispatched.`);
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
      alert('Template updated successfully!');
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
            <Sliders size={15} /> Reminder Settings
          </button>
        </div>

        {subtab === 'manual' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Channel Toggle */}
            <div
              style={{
                display: 'flex',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${channel === 'email' ? 'btn-primary' : 'btn-outline'}`}
                style={{ border: 'none', padding: '5px 12px', fontSize: '12px' }}
                onClick={() => setChannel('email')}
              >
                <Mail size={13} /> Gmail SMTP Email
              </button>
              <button
                type="button"
                className={`btn btn-sm ${channel === 'whatsapp' ? 'btn-primary' : 'btn-outline'}`}
                style={{ border: 'none', padding: '5px 12px', fontSize: '12px' }}
                onClick={() => setChannel('whatsapp')}
              >
                <MessageSquare size={13} /> WhatsApp
              </button>
            </div>

            <button
              className="btn btn-outline btn-sm"
              onClick={handleTriggerAutoReminders}
              disabled={sending || isReadOnlyMode}
            >
              <RotateCw size={14} /> Run Auto Reminders
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
          {/* SMTP / Gateway Status Banner */}
          <div
            style={{
              background: channel === 'email' ? '#eef2ff' : '#ecfdf5',
              border: `1px solid ${channel === 'email' ? '#c7d2fe' : '#a7f3d0'}`,
              borderRadius: '10px',
              padding: '12px 18px',
              fontSize: '13px',
              color: channel === 'email' ? '#3730a3' : '#065f46',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {channel === 'email' ? <Mail size={18} /> : <MessageSquare size={18} />}
              <span>
                <strong>Active Channel: {channel === 'email' ? 'Gmail SMTP Email' : 'WhatsApp Cloud API'}</strong>{' '}
                — Found <strong>{unpaidInvoices.length}</strong> students with pending dues.
                {channel === 'email' && smtpStatus && (
                  <span style={{ marginLeft: '8px' }}>
                    {smtpStatus.connected ? (
                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                        ● Gmail SMTP Connected
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        ● Sandbox / Test Mode (Ready for Gmail App Password)
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>

            {channel === 'email' && (
              <button
                className="btn btn-outline btn-sm"
                style={{ fontSize: '11.5px', padding: '3px 10px' }}
                onClick={handleTestSmtp}
                disabled={testingSmtp}
              >
                {testingSmtp ? 'Testing...' : 'Test Gmail SMTP'}
              </button>
            )}
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
                  <th>Email Address (Gmail SMTP)</th>
                  <th>WhatsApp Phone</th>
                  <th>Outstanding Due</th>
                  <th>Due Date</th>
                  <th>Last Reminder</th>
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
                        <td style={{ fontWeight: 600, color: inv.student_email ? '#0f172a' : '#94a3b8' }}>
                          {inv.student_email || 'No email registered'}
                        </td>
                        <td>{inv.student_phone}</td>
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
                <th>Destination (Email/Phone)</th>
                <th>Channel / Type</th>
                <th>Message Content</th>
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
                  const isEmail = log.message_type.includes('email');
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px' }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <strong>{log.student_name || 'N/A'}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{log.admission_number}</div>
                      </td>
                      <td>{log.phone_number}</td>
                      <td>
                        <span
                          className={`badge ${isEmail ? 'badge-info' : 'badge-success'}`}
                          style={{ fontSize: '10.5px' }}
                        >
                          {isEmail ? 'GMAIL SMTP EMAIL' : 'WHATSAPP'}
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
                        {log.provider_message_id || 'sim_mode'}
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

      {/* SUBTAB 4: Automation & Gmail SMTP Settings */}
      {subtab === 'settings' && settings && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
          {/* Automated Schedule Card */}
          <div className="card">
            <h3 style={{ fontSize: '17px', marginBottom: '6px' }}>Automatic Due-Date Reminders</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Configure automatic background reminders. The system automatically inspects students with approaching due dates.
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
                    Enable Automatic Daily Reminders
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
                  <label className="form-label">Daily Trigger Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={settings.reminder_time || '10:00'}
                    onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isReadOnlyMode}>
                Save Preferences
              </button>
            </form>
          </div>

          {/* Gmail SMTP Guide Card */}
          <div className="card">
            <h3 style={{ fontSize: '17px', marginBottom: '6px' }}>Gmail SMTP Setup Instructions</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              To send real emails to students directly from your Gmail address without WhatsApp API:
            </p>

            <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: 1.7, marginBottom: '16px' }}>
              <li>Go to your <strong>Google Account</strong> &gt; <strong>Security</strong>.</li>
              <li>Enable <strong>2-Step Verification</strong> if not already enabled.</li>
              <li>Search for <strong>App Passwords</strong> in the Google Account search bar.</li>
              <li>Create an app password named <code>Library SaaS</code> (generates a 16-character code).</li>
              <li>Add the following into your <code>.env</code> file:</li>
            </ol>

            <pre
              style={{
                background: '#0f172a',
                color: '#38bdf8',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: 1.5,
                overflowX: 'auto',
                marginBottom: '14px',
              }}
            >
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="Your Library Name" <yourgmail@gmail.com>`}
            </pre>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                Status:{' '}
                {smtpStatus?.connected ? (
                  <strong style={{ color: '#059669' }}>Connected</strong>
                ) : (
                  <strong style={{ color: '#b45309' }}>Test / Sandbox Mode</strong>
                )}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleTestSmtp} disabled={testingSmtp}>
                {testingSmtp ? 'Testing...' : 'Verify Gmail SMTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Preview & Confirmation Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title={`Confirm ${channel === 'email' ? 'Gmail SMTP Email' : 'WhatsApp'} Broadcast`} maxWidth="560px">
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Dispatching fee reminder via <strong>{channel === 'email' ? 'Gmail SMTP Email' : 'WhatsApp'}</strong> to <strong>{selectedStudentIds.length}</strong> selected student recipient(s).
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Message Content Preview</label>
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
            {sending ? 'Sending...' : `Send to ${selectedStudentIds.length} Recipients`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
