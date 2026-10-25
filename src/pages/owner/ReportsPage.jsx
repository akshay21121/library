import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  CreditCard,
  AlertTriangle,
  Users,
  CheckCircle2,
} from 'lucide-react';

export default function ReportsPage() {
  const { apiFetch } = useAuth();
  const [reportType, setReportType] = useState('collections'); // 'collections', 'defaulters'
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [reportType]);

  async function loadReport() {
    setLoading(true);
    try {
      if (reportType === 'collections') {
        const res = await apiFetch(`/api/reports/collections?startDate=${startDate}&endDate=${endDate}`);
        const resData = await res.json();
        setData(resData);
      } else if (reportType === 'defaulters') {
        const res = await apiFetch('/api/reports/defaulters');
        const resData = await res.json();
        setData({ defaulters: resData });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!data) return;
    let csvContent = '';

    if (reportType === 'collections' && data.payments) {
      csvContent = 'Receipt Number,Date,Student Name,Admission No,Amount,Payment Mode,Status\n';
      data.payments.forEach((p) => {
        csvContent += `"${p.receipt_number}","${p.payment_date}","${p.student_name || ''}","${p.admission_number || ''}",${p.amount},"${p.payment_mode}","${p.status}"\n`;
      });
    } else if (reportType === 'defaulters' && data.defaulters) {
      csvContent = 'Invoice Number,Student Name,Phone,Email,Due Date,Total Fee,Paid,Balance Due\n';
      data.defaulters.forEach((d) => {
        csvContent += `"${d.invoice_number}","${d.student_name}","${d.student_phone}","${d.student_email || ''}","${d.due_date}",${d.total_amount},${d.paid_amount},${d.balance_amount}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div>
      {/* Top Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
          <button
            className={`btn btn-sm ${reportType === 'collections' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setReportType('collections')}
          >
            <CreditCard size={15} /> Fee Collections
          </button>
          <button
            className={`btn btn-sm ${reportType === 'defaulters' ? 'btn-primary' : 'btn-outline'}`}
            style={{ border: 'none' }}
            onClick={() => setReportType('defaulters')}
          >
            <AlertTriangle size={15} /> Outstanding Defaulters
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {reportType === 'collections' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="form-input"
                style={{ width: '140px', padding: '6px 10px', fontSize: '13px' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '140px', padding: '6px 10px', fontSize: '13px' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button className="btn btn-outline btn-sm" onClick={loadReport}>
                Apply
              </button>
            </div>
          )}

          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={!data}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* REPORT CONTENT: Collections */}
      {reportType === 'collections' && data && (
        <div>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Revenue Collected
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                ₹{(data.totalCollected || 0).toLocaleString('en-IN')}
              </div>
            </div>

            {data.modeBreakdown &&
              Object.entries(data.modeBreakdown).map(([mode, sum]) => (
                <div key={mode} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    {mode.toUpperCase()} Collection
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    ₹{sum.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
          </div>

          <div className="table-container">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Admission #</th>
                  <th>Fee Description</th>
                  <th>Amount</th>
                  <th>Payment Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payments?.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.receipt_number}</td>
                    <td>{p.payment_date}</td>
                    <td><strong>{p.student_name}</strong></td>
                    <td style={{ fontFamily: 'monospace' }}>{p.admission_number}</td>
                    <td>{p.fee_title || 'Monthly Membership Fee'}</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>₹{p.amount}</td>
                    <td><span className="badge badge-info">{p.payment_mode.toUpperCase()}</span></td>
                    <td>
                      <span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT CONTENT: Defaulters */}
      {reportType === 'defaulters' && data && (
        <div className="table-container">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Student</th>
                <th>Phone</th>
                <th>Fee Plan</th>
                <th>Due Date</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {data.defaulters?.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{d.invoice_number}</td>
                  <td><strong>{d.student_name}</strong></td>
                  <td>{d.student_phone}</td>
                  <td>{d.plan_name || 'Standard Plan'}</td>
                  <td><span style={{ color: '#dc2626', fontWeight: 600 }}>{d.due_date}</span></td>
                  <td>₹{d.total_amount}</td>
                  <td style={{ color: '#059669' }}>₹{d.paid_amount}</td>
                  <td style={{ fontWeight: 800, color: '#dc2626' }}>₹{d.balance_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
