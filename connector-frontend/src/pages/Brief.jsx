import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectorApi } from '../services/api';

const PROPERTY_TYPES = ['Waterfront property', 'Acreage estate', 'Penthouse / Sub-penthouse', 'Apartment', 'House', 'Other'];

export default function Brief() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    propertyType: '',
    priceMin: '2500000',
    priceMax: '',
    areas: '',
    mustHaves: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    connectorApi.getBrief()
      .then(({ brief }) => {
        if (brief) {
          setForm({
            propertyType: brief.property_type || '',
            priceMin: brief.price_min || '2500000',
            priceMax: brief.price_max || '',
            areas: brief.areas || '',
            mustHaves: brief.must_haves || '',
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await connectorApi.saveBrief(form);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page"><p className="loading">Loading…</p></div>;

  return (
    <div className="page page-narrow">
      <h1 className="page-title">Your Brief</h1>
      <p className="page-sub">
        Tell us what you're after. You can update this any time — it's what we
        match against for Off-Market and Connector opportunities.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="propertyType">Property Type</label>
            <select id="propertyType" name="propertyType" value={form.propertyType} onChange={handleChange}>
              <option value="">Select a type...</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priceMin">Price Min (floor $2.5M)</label>
            <input id="priceMin" name="priceMin" type="number" min="2500000" step="100000" value={form.priceMin} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="priceMax">Price Max</label>
            <input id="priceMax" name="priceMax" type="number" min="2500000" step="100000" value={form.priceMax} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="areas">Preferred Areas / Suburbs</label>
            <input id="areas" name="areas" value={form.areas} onChange={handleChange} placeholder="e.g. Sovereign Islands, Mermaid Beach" />
          </div>
          <div className="field">
            <label htmlFor="mustHaves">Must-Haves</label>
            <textarea id="mustHaves" name="mustHaves" rows="4" value={form.mustHaves} onChange={handleChange} placeholder="Pool, water frontage, home theatre, etc." />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Brief'}
          </button>
          {saved && <p className="msg success">Brief saved.</p>}
          {error && <p className="msg error">{error}</p>}
        </form>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/home')}>Go to Home</button>
      </div>
    </div>
  );
}
