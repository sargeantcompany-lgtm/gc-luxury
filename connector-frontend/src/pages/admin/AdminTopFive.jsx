import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function AdminTopFive() {
  const [listings, setListings] = useState([]);
  const [pinnedIds, setPinnedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [{ listings }, { listings: pinned }] = await Promise.all([adminApi.listings(), adminApi.topFive()]);
      setListings(listings);
      setPinnedIds(new Set(pinned.map((l) => l.id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id, isPinned) => {
    setError('');
    try {
      if (isPinned) {
        await adminApi.unpin(id);
      } else {
        await adminApi.pin(id);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Top 5</h1>
      <p className="page-sub">{pinnedIds.size} / 5 pinned. This is exactly what buyers see on their Home screen.</p>
      {error && <p className="msg error">{error}</p>}
      {loading && <p className="loading">Loading…</p>}

      <div className="listing-grid">
        {listings.map((l) => {
          const isPinned = pinnedIds.has(l.id);
          return (
            <div className="listing-card" key={l.id}>
              <div className="listing-body">
                <div className="listing-address">{l.address}</div>
                <div className="listing-price">{l.price_guide}</div>
                <p className="agent-meta">{l.type === 'off_market' ? 'Off-Market' : 'Connector Match'}</p>
                <div className="listing-actions" style={{ marginTop: '0.8rem' }}>
                  <button
                    className={`save-btn ${isPinned ? 'saved' : ''}`}
                    onClick={() => toggle(l.id, isPinned)}
                    disabled={!isPinned && pinnedIds.size >= 5}
                  >
                    {isPinned ? 'Unpin from Top 5' : 'Pin to Top 5'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
