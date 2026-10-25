import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';

// Owner Pages
import OwnerDashboard from './pages/owner/OwnerDashboard';
import FloorPlanPage from './components/floorplan/VisualFloorBuilder';
import StudentsPage from './pages/owner/StudentsPage';
import FeesPage from './pages/owner/FeesPage';
import WhatsAppPage from './pages/owner/WhatsAppPage';
import ReportsPage from './pages/owner/ReportsPage';
import SettingsPage from './pages/owner/SettingsPage';

// Super Admin Pages
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import LibrariesList from './pages/superadmin/LibrariesList';
import SubscriptionsPage from './pages/superadmin/SubscriptionsPage';
import AuditLogsPage from './pages/superadmin/AuditLogsPage';

// Modals
import ReceiptModal from './components/fees/ReceiptModal';

export default function App() {
  const { user, token, loading, viewTenant, openTenantReadOnly, exitTenantReadOnly } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalReceiptId, setGlobalReceiptId] = useState(null);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#4f46e5',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
        }}
      >
        Loading Library Management SaaS...
      </div>
    );
  }

  if (!token || !user) {
    return <Login />;
  }

  // Determine if viewing as Platform Super Admin or Library Tenant (either as Owner or in Read-Only View)
  const isSuperAdminPlatformMode = user.role === 'supreme_admin' && !viewTenant;

  // Header Titles Map
  const titleMap = {
    // Owner
    dashboard: { title: 'Library Dashboard', subtitle: 'Real-time student admissions, fees, and seat occupancy' },
    floorplan: { title: 'Visual Floor Plan Builder', subtitle: 'Design study halls, arrange seats, and monitor 3-shift statuses' },
    students: { title: 'Student Management', subtitle: 'Student records, admissions, KYC, and privacy deletion' },
    fees: { title: 'Fees & Official Receipts', subtitle: 'Fee plans, invoices, payment collection, and accounting reversals' },
    whatsapp: { title: 'WhatsApp Fee Reminders', subtitle: 'Automated due-date reminders, templates, and delivery logs' },
    reports: { title: 'Reports & Export Analytics', subtitle: 'Collections audit, payment modes, and defaulters ledger' },
    settings: { title: 'Library Profile & Branding', subtitle: 'Logo, address, business tax ID, and operational hours' },

    // Super Admin
    'super-dashboard': { title: 'Supreme Platform Overview', subtitle: 'Multi-tenant metrics, platform MRR, and seat counts' },
    'super-libraries': { title: 'All Registered Libraries', subtitle: 'Manage library tenants, subscriptions, and read-only inspection' },
    'super-subscriptions': { title: 'SaaS Plans & Platform Revenue', subtitle: 'Subscription tiers and billing subscriptions' },
    'super-reports': { title: 'Platform Analytics', subtitle: 'Platform-wide growth and aggregate revenue' },
    'super-audit': { title: 'Platform Security Audit Logs', subtitle: 'Access trail, tenant inspections, and administrative events' },
  };

  const currentHeaderInfo = titleMap[activeTab] || { title: 'Library Management', subtitle: '' };

  function handleInspectLibrary(tenantId, libraryName, logoUrl) {
    openTenantReadOnly(tenantId, libraryName, logoUrl);
    setActiveTab('dashboard');
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          title={currentHeaderInfo.title}
          subtitle={currentHeaderInfo.subtitle}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="page-container">
          {/* Super Admin Platform Routes */}
          {isSuperAdminPlatformMode ? (
            <>
              {activeTab === 'super-dashboard' && (
                <SuperAdminDashboard
                  onNavigate={setActiveTab}
                  onInspectLibrary={handleInspectLibrary}
                />
              )}
              {activeTab === 'super-libraries' && (
                <LibrariesList onInspectLibrary={handleInspectLibrary} />
              )}
              {activeTab === 'super-subscriptions' && <SubscriptionsPage />}
              {activeTab === 'super-reports' && (
                <SuperAdminDashboard
                  onNavigate={setActiveTab}
                  onInspectLibrary={handleInspectLibrary}
                />
              )}
              {activeTab === 'super-audit' && <AuditLogsPage />}
            </>
          ) : (
            /* Library Tenant Routes (Owner or Supreme Admin Read-Only Mode) */
            <>
              {activeTab === 'dashboard' && (
                <OwnerDashboard
                  onNavigate={setActiveTab}
                  onOpenReceipt={(recId) => setGlobalReceiptId(recId)}
                />
              )}
              {activeTab === 'floorplan' && <FloorPlanPage />}
              {activeTab === 'students' && (
                <StudentsPage
                  onOpenReceipt={(recId) => setGlobalReceiptId(recId)}
                  onSendWhatsApp={() => setActiveTab('whatsapp')}
                />
              )}
              {activeTab === 'fees' && <FeesPage />}
              {activeTab === 'whatsapp' && <WhatsAppPage />}
              {activeTab === 'reports' && <ReportsPage />}
              {activeTab === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>

      {/* Global Receipt Modal accessible across dashboard, student drawer, and fees */}
      <ReceiptModal
        isOpen={Boolean(globalReceiptId)}
        onClose={() => setGlobalReceiptId(null)}
        paymentId={globalReceiptId}
      />
    </div>
  );
}
