import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { connectorApi } from '../services/api';
import { useBuyer } from '../context/BuyerContext';
import CurrencyInput from '../components/CurrencyInput';
import SuburbPicker from '../components/SuburbPicker';

const PROPERTY_TYPES = ['Waterfront property', 'Acreage estate', 'Penthouse / Sub-penthouse', 'Apartment', 'House', 'Other'];

export default function Join() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get('src') || null;
  const navigate = useNavigate();
  const { refresh } = useBuyer();

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
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
    setError('');
    if (contact.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (contact.password !== contact.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setStep(2);
  };

  const handleFinish = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { confirmPassword, ...contactPayload } = contact;
      await connectorApi.join({ ...contactPayload, src });
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
        <p className="brand-label">GC Luxury</p>
        <p className="tagline"><strong>The Connector</strong> — find Gold Coast luxury property on-market, off-market, and everything in between.</p>

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
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" value={contact.password} onChange={handleContactChange} minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" value={contact.confirmPassword} onChange={handleContactChange} minLength={8} required />
            </div>
            <button className="btn" type="submit">Continue</button>
            {error && <p className="msg error">{error}</p>}
          </form>
        </div>

        <p className="page-sub" style={{ marginTop: '1.2rem', marginBottom: 0, textAlign: 'center' }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">What's Your Brief</h1>
      <p className="page-sub">
        Please fill in the details below and the Connector will curate you a
        list of suitable properties. You will receive an email when the
        property search has been completed.
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
            <CurrencyInput id="priceMin" name="priceMin" value={brief.priceMin} onChange={handleBriefChange} />
          </div>
          <div className="field">
            <label htmlFor="priceMax">Price Max</label>
            <CurrencyInput id="priceMax" name="priceMax" value={brief.priceMax} onChange={handleBriefChange} />
          </div>
          <div className="field">
            <label htmlFor="areas">Preferred Suburbs (up to 3)</label>
            <SuburbPicker id="areas" name="areas" value={brief.areas} onChange={handleBriefChange} />
          </div>
          <div className="field">
            <label htmlFor="mustHaves">Must-Haves</label>
            <textarea id="mustHaves" name="mustHaves" rows="4" value={brief.mustHaves} onChange={handleBriefChange} placeholder="Pool, water frontage, home theatre, etc." />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit and Go to Dashboard'}
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
