import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function AdminValuations() {
  const [requests, setRequests] = useState([]);
  const [reportUrls, setReportUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fulfillingId, setFulfillingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { requests } = await adminApi.valuations();
      setRequests(requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFulfil = async (id) => {
    const url = reportUrls[id];
    if (!url) return;
    setFulfillingId(id);
    setError('');
    try {
      await adminApi.fulfilValuation(id, url);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setFulfillingId(null);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Valuation Queue</h1>
      <p className="page-sub">Run each in RP Data Professional, upload the PDF somewhere accessible, and paste the link here.</p>
      {error && <p className="msg error">{error}</p>}
      {loading && <p className="loading">Loading…</p>}

      {!loading && requests.length === 0 && <div className="empty-state">No valuation requests yet.</div>}

      <div className="card" style={{ padding: 0 }}>
        {requests.map((r) => (
          <div className="agent-row" key={r.id} style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1.2rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div>
                <div className="agent-name">{r.listing_address}</div>
                <div className="agent-meta">{r.buyer_name} · {r.buyer_email}</div>
              </div>
              <div className="agent-meta">{r.status === 'fulfilled' ? 'Fulfilled' : 'Requested'}</div>
            </div>
            {r.status === 'fulfilled' ? (
              <a className="agent-meta" href={r.report_url} target="_blank" rel="noreferrer">{r.report_url}</a>
            ) : (
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <input
                  placeholder="Report PDF URL"
                  value={reportUrls[r.id] || ''}
                  onChange={(e) => setReportUrls({ ...reportUrls, [r.id]: e.target.value })}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid rgba(201,162,75,0.22)', borderRadius: '6px', padding: '0.6rem 0.8rem', color: 'var(--ivory)' }}
                />
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', padding: '0.6rem 1.1rem' }}
                  onClick={() => handleFulfil(r.id)}
                  disabled={fulfillingId === r.id || !reportUrls[r.id]}
                >
                  {fulfillingId === r.id ? 'Saving…' : 'Fulfil'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
