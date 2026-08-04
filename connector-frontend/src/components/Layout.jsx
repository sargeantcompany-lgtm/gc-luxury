import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useBuyer } from '../context/BuyerContext';
import { connectorApi } from '../services/api';

export default function Layout({ children }) {
  const { buyer, setBuyer } = useBuyer();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await connectorApi.logout();
    } catch {
      // even if the request fails, clear buyer state locally
    }
    setBuyer(null);
    navigate('/');
  };

  return (
    <>
      <div className="top-bar">
        <Link to="/" className="wordmark">
          GC Luxury <span>Connector</span>
        </Link>
        <nav className="nav-links">
          {buyer ? (
            <>
              <Link to="/home" className={isActive('/home') ? 'active' : ''}>Home</Link>
              <Link to="/brief" className={isActive('/brief') ? 'active' : ''}>Brief</Link>
              <Link to="/agents" className={isActive('/agents') ? 'active' : ''}>Agents</Link>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <Link to="/" className={isActive('/') ? 'active' : ''}>Register</Link>
          )}
        </nav>
      </div>
      {children}
    </>
  );
}
