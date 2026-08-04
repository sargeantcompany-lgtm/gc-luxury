import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectorApi } from '../services/api';
import { useBuyer } from '../context/BuyerContext';

export default function Join() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get('src') || null;
  const navigate = useNavigate();
  const { refresh } = useBuyer();

  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await connectorApi.join({ ...form, src });
      await refresh();
      navigate('/brief');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-narrow">
      <h1 className="page-title">Private access to the Gold Coast's finest</h1>
      <p className="page-sub">
        Register your details to get early access to off-market and pre-market
        properties, $2.5M+.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full Name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Joining…' : 'Join The Connector'}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
