import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

function parsePhotos(text) {
  return text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
}

export default function AdminListings() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [offMarket, setOffMarket] = useState({ address: '', price_guide: '', description: '', photos: '' });
  const [offMarketSaving, setOffMarketSaving] = useState(false);

  const [matchUrl, setMatchUrl] = useState('');
  const [matchFetching, setMatchFetching] = useState(false);
  const [matchWarning, setMatchWarning] = useState('');
  const [match, setMatch] = useState({ address: '', price_guide: '', description: '', photos: '' });
  const [matchSaving, setMatchSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { listings } = await adminApi.listings();
      setListings(listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOffMarketSubmit = async (e) => {
    e.preventDefault();
    setOffMarketSaving(true);
    setError('');
    try {
      await adminApi.addOffMarket({ ...offMarket, photos: parsePhotos(offMarket.photos) });
      setOffMarket({ address: '', price_guide: '', description: '', photos: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setOffMarketSaving(false);
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
      setMatch((m) => ({
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

  const handleMatchSubmit = async (e) => {
    e.preventDefault();
    setMatchSaving(true);
    setError('');
    try {
      await adminApi.addConnectorMatch({
        ...match,
        source_url: matchUrl || null,
        photos: parsePhotos(match.photos),
      });
      setMatch({ address: '', price_guide: '', description: '', photos: '' });
      setMatchUrl('');
      setMatchWarning('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMatchSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing? This removes it from every buyer it\'s pinned or assigned to.')) return;
    try {
      await adminApi.deleteListing(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Listings</h1>
      <p className="page-sub">
        This is the central pool. Add properties here, then go to each buyer's
        page to pin them to that buyer's Top 5 or add them to that buyer's
        Off-Market list.
      </p>
      {error && <p className="msg error">{error}</p>}

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add Off-Market Listing</h2>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleOffMarketSubmit}>
          <div className="field">
            <label>Address</label>
            <input value={offMarket.address} onChange={(e) => setOffMarket({ ...offMarket, address: e.target.value })} required />
          </div>
          <div className="field">
            <label>Price Guide</label>
            <input value={offMarket.price_guide} onChange={(e) => setOffMarket({ ...offMarket, price_guide: e.target.value })} placeholder="e.g. $4.5M - $5M" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows="3" value={offMarket.description} onChange={(e) => setOffMarket({ ...offMarket, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Photo URLs (one per line)</label>
            <textarea rows="2" value={offMarket.photos} onChange={(e) => setOffMarket({ ...offMarket, photos: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={offMarketSaving}>
            {offMarketSaving ? 'Saving…' : 'Add to Pool'}
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add via Listing Link</h2>
      <div className="card" style={{ marginBottom: '2rem' }}>
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

        <form onSubmit={handleMatchSubmit}>
          <div className="field">
            <label>Address</label>
            <input value={match.address} onChange={(e) => setMatch({ ...match, address: e.target.value })} required />
          </div>
          <div className="field">
            <label>Price Guide</label>
            <input value={match.price_guide} onChange={(e) => setMatch({ ...match, price_guide: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows="3" value={match.description} onChange={(e) => setMatch({ ...match, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Photo URLs (one per line)</label>
            <textarea rows="2" value={match.photos} onChange={(e) => setMatch({ ...match, photos: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={matchSaving}>
            {matchSaving ? 'Saving…' : 'Add to Pool'}
          </button>
        </form>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>All Listings ({listings.length})</h2>
      {loading && <p className="loading">Loading…</p>}
      <div className="listing-grid">
        {listings.map((l) => (
          <div className="listing-card" key={l.id}>
            <div className="listing-body">
              <div className="listing-address">{l.address}</div>
              <div className="listing-price">{l.price_guide}</div>
              <p className="agent-meta">
                Pinned for {l.pinned_count} buyer{l.pinned_count === '1' ? '' : 's'} · Assigned to {l.assigned_count} buyer{l.assigned_count === '1' ? '' : 's'}
              </p>
              <div className="listing-actions" style={{ marginTop: '0.8rem' }}>
                <button className="save-btn" onClick={() => handleDelete(l.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
