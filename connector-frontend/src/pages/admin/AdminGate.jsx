import React, { useState } from 'react';
import { getAdminKey, setAdminKey, adminApi } from '../../services/adminApi';

export default function AdminGate({ children }) {
  const [unlocked, setUnlocked] = useState(Boolean(getAdminKey()));
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setChecking(true);
    setError('');
    setAdminKey(input.trim());
    try {
      await adminApi.listings();
      setUnlocked(true);
    } catch (err) {
      setError('Invalid admin key');
      setAdminKey('');
    } finally {
      setChecking(false);
    }
  };

  if (unlocked) return children;

  return (
    <div className="page page-narrow">
      <h1 className="page-title">Admin</h1>
      <p className="page-sub">Enter the admin key to continue.</p>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="adminKey">Admin Key</label>
            <input
              id="adminKey"
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button className="btn" type="submit" disabled={checking}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
