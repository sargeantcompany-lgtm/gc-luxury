import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectorApi } from '../services/api';
import { useBuyer } from '../context/BuyerContext';

const PROPERTY_TYPES = ['Waterfront property', 'Acreage estate', 'Penthouse / Sub-penthouse', 'Apartment', 'House', 'Other'];

export default function Join() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get('src') || null;
  const navigate = useNavigate();
  const { refresh } = useBuyer();

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [brief, setBrief] = useState({
    propertyType: '',
    priceMin: '2500000',
    priceMax: '',
    areas: '',
    mustHaves: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleContactChange = (e) => setContact({ ...contact, [e.target.name]: e.target.value });
  const handleBriefChange = (e) => setBrief({ ...brief, [e.target.name]: e.target.value });

  const handleContinue = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleFinish = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await connectorApi.join({ ...contact, src });
      await connectorApi.saveBrief(brief);
      await refresh();
      navigate('/home');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div className="page page-narrow">
        <h1 className="page-title">Private access to the Gold Coast's finest</h1>
        <p className="page-sub">
          Register your details to get early access to off-market and pre-market
          properties, $2.5M+.
        </p>

        <div className="card">
          <form onSubmit={handleContinue}>
            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input id="name" name="name" value={contact.name} onChange={handleContactChange} required />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" type="tel" value={contact.phone} onChange={handleContactChange} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" value={contact.email} onChange={handleContactChange} required />
            </div>
            <button className="btn" type="submit">Continue</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">What are you after?</h1>
      <p className="page-sub">
        Tell us what you're looking for — you can update this any time.
      </p>

      <div className="card">
        <form onSubmit={handleFinish}>
          <div className="field">
            <label htmlFor="propertyType">Property Type</label>
            <select id="propertyType" name="propertyType" value={brief.propertyType} onChange={handleBriefChange}>
              <option value="">Select a type...</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="priceMin">Price Min (floor $2.5M)</label>
            <input id="priceMin" name="priceMin" type="number" min="2500000" step="100000" value={brief.priceMin} onChange={handleBriefChange} />
          </div>
          <div className="field">
            <label htmlFor="priceMax">Price Max</label>
            <input id="priceMax" name="priceMax" type="number" min="2500000" step="100000" value={brief.priceMax} onChange={handleBriefChange} />
          </div>
          <div className="field">
            <label htmlFor="areas">Preferred Areas / Suburbs</label>
            <input id="areas" name="areas" value={brief.areas} onChange={handleBriefChange} placeholder="e.g. Sovereign Islands, Mermaid Beach" />
          </div>
          <div className="field">
            <label htmlFor="mustHaves">Must-Haves</label>
            <textarea id="mustHaves" name="mustHaves" rows="4" value={brief.mustHaves} onChange={handleBriefChange} placeholder="Pool, water frontage, home theatre, etc." />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Finishing…' : 'Save & See My Matches'}
          </button>
          {error && <p className="msg error">{error}</p>}
        </form>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
      </div>
    </div>
  );
}
