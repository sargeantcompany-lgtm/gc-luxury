import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBuyer } from '../context/BuyerContext';

export default function Layout({ children }) {
  const { buyer } = useBuyer();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <div className="top-bar">
        <Link to="/" className="wordmark">
          GC Luxury <span>Connector</span>
        </Link>
        {buyer && (
          <nav className="nav-links">
            <Link to="/home" className={isActive('/home') ? 'active' : ''}>Home</Link>
            <Link to="/brief" className={isActive('/brief') ? 'active' : ''}>Brief</Link>
            <Link to="/agents" className={isActive('/agents') ? 'active' : ''}>Agents</Link>
          </nav>
        )}
      </div>
      {children}
    </>
  );
}
