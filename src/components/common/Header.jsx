import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, ShieldAlert, ArrowLeftCircle } from 'lucide-react';

export default function Header({ title, subtitle, onToggleSidebar }) {
  const { user, viewTenant, isReadOnlyMode, exitTenantReadOnly } = useAuth();

  return (
    <>
      {/* Strict Read-Only Banner for Supreme Admin */}
      {isReadOnlyMode && (
        <div className="readonly-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} />
            <span>
              STRICT READ-ONLY MODE: Viewing "{viewTenant?.name}". Server-side authorization blocks all edits, deletes, and payment mutations.
            </span>
          </div>
          <button className="readonly-banner-btn" onClick={exitTenantReadOnly}>
            <ArrowLeftCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Return to Super Admin
          </button>
        </div>
      )}

      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onToggleSidebar}
            className="btn btn-outline btn-sm"
            style={{ display: window.innerWidth <= 1024 ? 'inline-flex' : 'none' }}
          >
            <Menu size={18} />
          </button>
          <div className="page-title-wrap">
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.role === 'library_owner' && (
            <span className="badge badge-success">
              {user.libraryName || 'Active Library'}
            </span>
          )}
          {user?.role === 'supreme_admin' && !viewTenant && (
            <span className="badge badge-info">
              Supreme Admin Console
            </span>
          )}
        </div>
      </header>
    </>
  );
}
