import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('saas_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('saas_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Supreme Admin Read-Only Impersonation state
  const [viewTenant, setViewTenant] = useState(() => {
    const saved = localStorage.getItem('saas_view_tenant');
    return saved ? JSON.parse(saved) : null;
  });

  const isReadOnlyMode = Boolean(user?.role === 'supreme_admin' && viewTenant);

  useEffect(() => {
    if (token) {
      // Validate session with backend
      apiFetch('/api/auth/me')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Session invalid');
        })
        .then((userData) => {
          setUser((prev) => ({ ...prev, ...userData }));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Authenticated fetch helper
  async function apiFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (user?.role === 'supreme_admin' && viewTenant?.id) {
      headers['x-view-tenant-id'] = viewTenant.id;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      logout();
    }

    return response;
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Login failed.');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('saas_token', data.token);
    localStorage.setItem('saas_user', JSON.stringify(data.user));
    // Clear any view tenant state on new login
    setViewTenant(null);
    localStorage.removeItem('saas_view_tenant');
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    setViewTenant(null);
    localStorage.removeItem('saas_token');
    localStorage.removeItem('saas_user');
    localStorage.removeItem('saas_view_tenant');
  }

  // Supreme Admin view-only impersonation
  function openTenantReadOnly(tenantId, libraryName, libraryLogo = null) {
    const viewObj = { id: tenantId, name: libraryName, logo: libraryLogo };
    setViewTenant(viewObj);
    localStorage.setItem('saas_view_tenant', JSON.stringify(viewObj));
  }

  function exitTenantReadOnly() {
    setViewTenant(null);
    localStorage.removeItem('saas_view_tenant');
  }

  const value = {
    user,
    token,
    loading,
    viewTenant,
    isReadOnlyMode,
    apiFetch,
    login,
    logout,
    openTenantReadOnly,
    exitTenantReadOnly,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
