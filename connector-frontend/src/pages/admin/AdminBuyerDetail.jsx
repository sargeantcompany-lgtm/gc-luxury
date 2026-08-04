import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';

function parsePhotos(text) {
  return text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
}

function formatPrice(value) {
  if (!value) return null;
  return `$${Number(value).toLocaleString('en-US')}`;
}

export default function AdminBuyerDetail() {
  const { id } = useParams();
  const [buyer, setBuyer] = useState(null);
  const [brief, setBrief] = useState(null);
  const [matches, setMatches] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [matchUrl, setMatchUrl] = useState('');
  const [matchFetching, setMatchFetching] = useState(false);
  const [matchWarning, setMatchWarning] = useState('');
  const [newMatch, setNewMatch] = useState({ address: '', price_guide: '', description: '', photos: '', note: '' });
  const [savingMatch, setSavingMatch] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, avail] = await Promise.all([
        adminApi.buyer(id),
        adminApi.availableListingsForBuyer(id),
      ]);
      setBuyer(detail.buyer);
      setBrief(detail.brief);
      setMatches(detail.matches);
      setAvailable(avail.listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAssign = async (listingId) => {
    setError('');
    try {
      await adminApi.assignListing(id, listingId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnassign = async (listingId) => {
    setError('');
    try {
      await adminApi.unassignListing(id, listingId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFetchPreview = async () => {
    if (!matchUrl) return;
    setMatchFetching(true);
    setMatchWarning('');
    setError('');
    try {
      const { preview, warning } = await adminApi.fetchPreview(matchUrl);
      if (warning) setMatchWarning(warning);
      if (!preview.fetched_ok) setMatchWarning((w) => w || 'Auto-fill found nothing useful on this page — enter details manually.');
      setNewMatch((m) => ({
        ...m,
        address: preview.address || m.address,
        price_guide: preview.price_guide || m.price_guide,
        description: preview.description || m.description,
        photos: (preview.photos || []).join('\n'),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setMatchFetching(false);
    }
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    setSavingMatch(true);
    setError('');
    try {
      await adminApi.addConnectorMatch({
        ...newMatch,
        source_url: matchUrl || null,
        photos: parsePhotos(newMatch.photos),
        buyerId: id,
      });
      setNewMatch({ address: '', price_guide: '', description: '', photos: '', note: '' });
      setMatchUrl('');
      setMatchWarning('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingMatch(false);
    }
  };

  if (loading) return <div className="page"><p className="loading">Loading…</p></div>;
  if (!buyer) return <div className="page"><p className="msg error">{error || 'Buyer not found'}</p></div>;

  return (
    <div className="page">
      <Link to="/admin/buyers" className="agent-meta">&larr; All Buyers</Link>
      <h1 className="page-title" style={{ marginTop: '0.8rem' }}>{buyer.name}</h1>
      <p className="page-sub">{buyer.email} · {buyer.phone} · via {buyer.joined_via || 'direct'}</p>
      {error && <p className="msg error">{error}</p>}

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Brief</h2>
      <div className="card" style={{ marginBottom: '2rem' }}>
        {brief ? (
          <>
            <p className="agent-meta">Property type: {brief.property_type || '—'}</p>
            <p className="agent-meta">
              Budget: {formatPrice(brief.price_min) || '—'} {brief.price_max ? `– ${formatPrice(brief.price_max)}` : ''}
            </p>
            <p className="agent-meta">Areas: {brief.areas || '—'}</p>
            <p className="agent-meta">Must-haves: {brief.must_haves || '—'}</p>
          </>
        ) : (
          <p className="agent-meta">No brief submitted yet.</p>
        )}
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Assigned Properties</h2>
      <div className="listing-grid" style={{ marginBottom: '2rem' }}>
        {matches.length === 0 && <div className="empty-state">Nothing assigned to this buyer yet.</div>}
        {matches.map((l) => (
          <div className="listing-card" key={l.match_id}>
            <div className="listing-body">
              <div className="listing-address">{l.address}</div>
              <div className="listing-price">{l.price_guide}</div>
              <p className="agent-meta">{l.type === 'off_market' ? 'Off-Market' : 'Connector Match'}</p>
              <div className="listing-actions" style={{ marginTop: '0.8rem' }}>
                <button className="save-btn" onClick={() => handleUnassign(l.id)}>Unassign</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Assign an Off-Market Listing</h2>
      <div className="listing-grid" style={{ marginBottom: '2rem' }}>
        {available.length === 0 && <div className="empty-state">No unassigned off-market listings — add one on the Listings page.</div>}
        {available.map((l) => (
          <div className="listing-card" key={l.id}>
            <div className="listing-body">
              <div className="listing-address">{l.address}</div>
              <div className="listing-price">{l.price_guide}</div>
              <div className="listing-actions" style={{ marginTop: '0.8rem' }}>
                <button className="save-btn" onClick={() => handleAssign(l.id)}>Assign to {buyer.name}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add New Connector Match</h2>
      <div className="card">
        <div className="field">
          <label>Listing URL (realestate.com.au / domain.com.au)</label>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <input value={matchUrl} onChange={(e) => setMatchUrl(e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.7rem 1.2rem' }} onClick={handleFetchPreview} disabled={matchFetching || !matchUrl}>
              {matchFetching ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
          {matchWarning && <p className="msg error" style={{ marginTop: '0.6rem' }}>{matchWarning}</p>}
        </div>

        <form onSubmit={handleAddMatch}>
          <div className="field">
            <label>Address</label>
            <input value={newMatch.address} onChange={(e) => setNewMatch({ ...newMatch, address: e.target.value })} required />
          </div>
          <div className="field">
            <label>Price Guide</label>
            <input value={newMatch.price_guide} onChange={(e) => setNewMatch({ ...newMatch, price_guide: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows="3" value={newMatch.description} onChange={(e) => setNewMatch({ ...newMatch, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Photo URLs (one per line)</label>
            <textarea rows="2" value={newMatch.photos} onChange={(e) => setNewMatch({ ...newMatch, photos: e.target.value })} />
          </div>
          <div className="field">
            <label>Note</label>
            <textarea rows="2" value={newMatch.note} onChange={(e) => setNewMatch({ ...newMatch, note: e.target.value })} placeholder={`Why this fits ${buyer.name}`} />
          </div>
          <button className="btn" type="submit" disabled={savingMatch}>
            {savingMatch ? 'Saving…' : `Save & Assign to ${buyer.name}`}
          </button>
        </form>
      </div>
    </div>
  );
}
