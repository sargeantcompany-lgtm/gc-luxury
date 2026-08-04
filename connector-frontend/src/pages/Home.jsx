import React, { useEffect, useState } from 'react';
import { connectorApi } from '../services/api';
import ListingCard from '../components/ListingCard';

const TABS = [
  { key: 'top-five', label: 'Top 5' },
  { key: 'off-market', label: 'Off-Market' },
  { key: 'matches', label: 'For You' },
  { key: 'saved', label: 'Saved' },
];

export default function Home() {
  const [tab, setTab] = useState('top-five');
  const [listings, setListings] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [valuations, setValuations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSavedIds = async () => {
    try {
      const { listings } = await connectorApi.saved();
      setSavedIds(new Set(listings.map((l) => l.id)));
    } catch {
      // ignore, non-critical for rendering
    }
  };

  const loadValuations = async () => {
    try {
      const { requests } = await connectorApi.myValuations();
      const map = {};
      requests.forEach((r) => { map[r.listing_id] = r; });
      setValuations(map);
    } catch {
      // ignore, non-critical for rendering
    }
  };

  const loadTab = async (key) => {
    setLoading(true);
    setError('');
    try {
      const fetcher = {
        'top-five': connectorApi.topFive,
        'off-market': connectorApi.offMarket,
        'matches': connectorApi.matches,
        'saved': connectorApi.saved,
      }[key];
      const { listings } = await fetcher();
      setListings(listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedIds();
    loadValuations();
  }, []);

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  const toggleSave = async (listingId, isSaved) => {
    try {
      if (isSaved) {
        await connectorApi.unsave(listingId);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
        if (tab === 'saved') setListings((prev) => prev.filter((l) => l.id !== listingId));
      } else {
        await connectorApi.save(listingId);
        setSavedIds((prev) => new Set(prev).add(listingId));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const requestValuation = async (listingId) => {
    try {
      const { request } = await connectorApi.requestValuation(listingId);
      setValuations((prev) => ({ ...prev, [listingId]: request }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Home</h1>
      <p className="page-sub">Hand-picked opportunities, curated for you.</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="loading">Loading…</p>}
      {error && <p className="msg error">{error}</p>}

      {!loading && !error && listings.length === 0 && (
        <div className="empty-state">
          {tab === 'top-five' && "Nothing pinned to your Top 5 yet — check back soon."}
          {tab === 'off-market' && "No off-market listings available right now."}
          {tab === 'matches' && "No matches assigned to you yet."}
          {tab === 'saved' && "You haven't saved anything yet."}
        </div>
      )}

      <div className="listing-grid">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            saved={savedIds.has(listing.id)}
            onToggleSave={toggleSave}
            onRequestValuation={tab === 'saved' ? requestValuation : undefined}
            valuationStatus={valuations[listing.id]?.status}
          />
        ))}
      </div>
    </div>
  );
}
