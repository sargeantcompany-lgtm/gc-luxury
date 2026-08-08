import React, { useState } from 'react';
import { getAdminKey, setAdminKey, brandsApi } from '../services/api';

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
      await brandsApi.list();
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
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Outreach HQ</h1>
      <p style={{ color: 'var(--muted, #667085)', marginBottom: 20 }}>Enter the admin key to continue.</p>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 20 }}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="adminKey">Admin Key</label>
          <input
            id="adminKey"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            required
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <button className="btn" type="submit" disabled={checking}>
          {checking ? 'Checking…' : 'Unlock'}
        </button>
        {error && <p style={{ color: '#c0392b', marginTop: 10 }}>{error}</p>}
      </form>
    </div>
  );
}
