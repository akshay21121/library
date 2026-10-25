import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Map,
  Users,
  CreditCard,
  MessageSquare,
  BarChart3,
  Settings,
  Building2,
  ShieldCheck,
  FileText,
  LogOut,
  Layers,
  ArrowLeftCircle,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const { user, viewTenant, isReadOnlyMode, exitTenantReadOnly, logout } = useAuth();

  const isSuperAdminPlatformMode = user?.role === 'supreme_admin' && !viewTenant;

  // Navigation items for Library Owner (or Supreme Admin inspecting library)
  const ownerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'floorplan', label: 'Floor Plan & Seats', icon: Map },
    { id: 'students', label: 'Student Admissions', icon: Users },
    { id: 'fees', label: 'Fees & Receipts', icon: CreditCard },
    { id: 'whatsapp', label: 'WhatsApp Reminders', icon: MessageSquare },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Library Settings', icon: Settings },
  ];

  // Navigation items for Supreme Admin platform view
  const superAdminNavItems = [
    { id: 'super-dashboard', label: 'Platform Overview', icon: ShieldCheck },
    { id: 'super-libraries', label: 'All Libraries', icon: Building2 },
    { id: 'super-subscriptions', label: 'Plans & Revenue', icon: Layers },
    { id: 'super-reports', label: 'Platform Analytics', icon: BarChart3 },
    { id: 'super-audit', label: 'Audit Logs', icon: FileText },
  ];

  const currentNavItems = isSuperAdminPlatformMode ? superAdminNavItems : ownerNavItems;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand & Library Logo */}
      <div className="sidebar-header">
        {isSuperAdminPlatformMode ? (
          <>
            <div className="sidebar-logo">
              <ShieldCheck size={22} />
            </div>
            <div className="sidebar-library-info">
              <div className="sidebar-library-name">Platform Admin</div>
              <span className="sidebar-role-badge">Supreme Control</span>
            </div>
          </>
        ) : (
          <>
            {viewTenant?.logo || user?.libraryLogo ? (
              <img
                src={viewTenant?.logo || user?.libraryLogo}
                alt="Logo"
                className="sidebar-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="sidebar-logo">
                <Building2 size={22} />
              </div>
            )}
            <div className="sidebar-library-info">
              <div className="sidebar-library-name">
                {viewTenant ? viewTenant.name : user?.libraryName || 'My Library'}
              </div>
              <span className="sidebar-role-badge">
                {isReadOnlyMode ? 'Read-Only Mode' : 'Library Owner'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Supreme Admin Exit Tenant Button */}
      {isReadOnlyMode && (
        <div style={{ padding: '12px 16px 0 16px' }}>
          <button
            className="btn btn-danger btn-sm"
            style={{ width: '100%', fontSize: '11.5px' }}
            onClick={exitTenantReadOnly}
          >
            <ArrowLeftCircle size={14} /> Exit Library View
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">
          {isSuperAdminPlatformMode ? 'SaaS Administration' : 'Library Operations'}
        </div>

        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth <= 1024) setIsOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {/* User Strip & Logout */}
      <div className="sidebar-footer">
        <div className="user-profile-strip">
          <div className="user-profile-meta">
            <div className="user-profile-name">{user?.name}</div>
            <div className="user-profile-email">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
