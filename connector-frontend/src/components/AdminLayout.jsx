import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clearAdminKey } from '../services/adminApi';

export default function AdminLayout({ children }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      <div className="top-bar">
        <Link to="/admin" className="wordmark">
          GC Luxury <span>Connector</span> — Admin
        </Link>
        <nav className="nav-links">
          <Link to="/admin/listings" className={isActive('/admin/listings') ? 'active' : ''}>Listings</Link>
          <Link to="/admin/valuations" className={isActive('/admin/valuations') ? 'active' : ''}>Valuations</Link>
          <Link to="/admin/buyers" className={isActive('/admin/buyers') ? 'active' : ''}>Buyers</Link>
          <Link to="/admin/agents" className={isActive('/admin/agents') ? 'active' : ''}>Agents</Link>
          <button onClick={() => { clearAdminKey(); window.location.reload(); }}>Lock</button>
        </nav>
      </div>
      {children}
    </>
  );
}
