import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { connectorApi } from '../services/api';
import { useBuyer } from '../context/BuyerContext';

export default function Login() {
  const navigate = useNavigate();
  const { refresh } = useBuyer();

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await connectorApi.login(form);
      await refresh();
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-narrow">
      <p className="brand-label">GC Luxury</p>
      <p className="tagline"><strong>The Connector</strong> — find Gold Coast luxury property on-market, off-market, and everything in between.</p>
      <h1 className="page-title">Log In</h1>
      <p className="page-sub">Welcome back.</p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={form.password} onChange={handleChange} required />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log In'}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
      </div>

      <p className="page-sub" style={{ marginTop: '1.2rem', marginBottom: 0, textAlign: 'center' }}>
        Not registered yet? <Link to="/">Register</Link>
      </p>
    </div>
  );
}
