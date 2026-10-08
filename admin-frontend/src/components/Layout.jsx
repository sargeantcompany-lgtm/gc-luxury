import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './Toast';

export default function Layout() {
  // On phones the sidebar is a slide-out menu (see the mobile rules in index.css)
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="sidebar-logo-icon">O</div>
          <span className="sidebar-logo-text">Outreach HQ</span>
        </div>
        {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="main-area">
          <Outlet />
        </div>
      </div>
    </ToastProvider>
  );
}
