import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Layers, Check, IndianRupee, ShieldCheck } from 'lucide-react';

export default function SubscriptionsPage() {
  const { apiFetch } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/superadmin/analytics')
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !analytics) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Loading subscription plans...</div>;
  }

  const { plans = [], recentSubscriptions = [] } = analytics;

  return (
    <div>
      <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '6px' }}>SaaS Subscription Plans</h3>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
        Tiers available for Library Owners. Subscriptions fund the multi-tenant cloud platform.
      </p>

      {/* Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {plans.map((p) => {
          let features = [];
          try {
            features = JSON.parse(p.features || '[]');
          } catch (e) {
            features = [];
          }
          return (
            <div key={p.id} className="card" style={{ borderTop: '4px solid #4f46e5' }}>
              <h4 style={{ fontSize: '18px', color: '#0f172a' }}>{p.name}</h4>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#4f46e5', margin: '14px 0 6px 0' }}>
                ₹{p.price_monthly.toLocaleString('en-IN')}
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}> / month</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                Annual: ₹{p.price_annual.toLocaleString('en-IN')} / year
              </div>

              <div style={{ padding: '12px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                  Max Students: <strong>{p.max_students}</strong>
                </div>
                <div style={{ fontSize: '13px' }}>
                  Max Floor Seats: <strong>{p.max_seats}</strong>
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {features.map((f, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#059669" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Active Subscriptions Ledger */}
      <h3 style={{ fontSize: '18px', color: '#0f172a', marginBottom: '12px' }}>Recent Library Subscriptions</h3>
      <div className="table-container">
        <table className="saas-table">
          <thead>
            <tr>
              <th>Library Tenant</th>
              <th>Owner Name</th>
              <th>Plan Tier</th>
              <th>Billing Cycle</th>
              <th>Amount</th>
              <th>Period Valid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentSubscriptions.map((sub) => (
              <tr key={sub.id}>
                <td><strong>{sub.library_name}</strong></td>
                <td>{sub.owner_name}</td>
                <td><span className="badge badge-info">{sub.plan_name}</span></td>
                <td>{sub.billing_cycle.toUpperCase()}</td>
                <td style={{ fontWeight: 700, color: '#059669' }}>₹{sub.amount}</td>
                <td>{sub.current_period_start} to {sub.current_period_end}</td>
                <td>
                  <span className="badge badge-success">{sub.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
