import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Building2,
  UserCheck,
  ArrowRight,
  Clock,
} from 'lucide-react';

export default function ActivateAccount() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [validData, setValidData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activatedResult, setActivatedResult] = useState(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (!tokenParam) {
      setErrorMessage('No activation token provided. Please click the full link in your welcome email.');
      setLoading(false);
      return;
    }
    setToken(tokenParam);
    validateToken(tokenParam);
  }, []);

  async function validateToken(t) {
    try {
      const res = await fetch(`/api/auth/validate-activation-token?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Invalid or expired activation link.');
      }
      setValidData(data);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(e) {
    e.preventDefault();
    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/activate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Activation failed.');
      }
      setActivatedResult(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToLogin() {
    window.location.href = '/';
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Card Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            padding: '28px 24px',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <ShieldCheck size={28} color="#ffffff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
            Account Activation &amp; Password Setup
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', opacity: 0.9 }}>
            Multi-Tenant Library Management SaaS
          </p>
        </div>

        {/* Card Body */}
        <div style={{ padding: '32px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#4f46e5',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px',
                }}
              />
              <p style={{ fontSize: '14px', fontWeight: 500 }}>Validating secure activation link...</p>
            </div>
          ) : errorMessage ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <AlertTriangle size={32} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '8px' }}>
                Activation Link Invalid or Expired
              </h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
                {errorMessage}
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleGoToLogin}>
                Back to Sign In
              </button>
            </div>
          ) : activatedResult ? (
            /* Success State */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 size={34} color="#059669" />
              </div>

              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: 700 }}>
                {activatedResult.tenantStatus === 'pending'
                  ? 'Password Configured — Pending Approval'
                  : 'Account Activated Successfully!'}
              </h3>

              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
                {activatedResult.tenantStatus === 'pending'
                  ? 'Your password has been securely saved. However, your library is currently marked as "Pending Approval" by platform administration. You will gain full access once authorized.'
                  : 'Your personal password has been securely created and your library management account is now live.'}
              </p>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '24px',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <div style={{ color: '#64748b', marginBottom: '4px' }}>Registered Email Login:</div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{activatedResult.email}</div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleGoToLogin}
              >
                Proceed to Sign In <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Password Setup Form */
            <div>
              {/* Account Details Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Building2 size={16} color="#4f46e5" />
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{validData.libraryName}</strong>
                  <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: '11px' }}>
                    {validData.libraryCode}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Owner Name: </span>
                    <strong style={{ color: '#334155' }}>{validData.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Account ID: </span>
                    <strong style={{ color: '#334155', fontFamily: 'monospace' }}>{validData.accountId}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Registered Email: </span>
                    <strong style={{ color: '#334155' }}>{validData.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Status: </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: validData.tenantStatus === 'active' ? '#059669' : '#d97706',
                      }}
                    >
                      {validData.tenantStatus === 'active' ? 'Active' : 'Pending Approval'}
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleActivate}>
                <div className="form-group">
                  <label className="form-label">Create Your Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-type password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Password validation indicators */}
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                  <div style={{ color: password.length >= 8 ? '#059669' : '#64748b' }}>
                    {password.length >= 8 ? '✓' : '•'} At least 8 characters
                  </div>
                  <div style={{ color: password && password === confirmPassword ? '#059669' : '#64748b' }}>
                    {password && password === confirmPassword ? '✓' : '•'} Passwords match
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600 }}
                  disabled={submitting}
                >
                  {submitting ? 'Setting Password & Activating...' : 'Activate Account & Set Password'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
