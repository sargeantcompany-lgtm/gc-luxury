import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getAdminKey } from '../../services/adminApi';

export default function AdminBuyers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    adminApi.buyers()
      .then(({ buyers }) => setBuyers(buyers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this buyer? This removes their account, brief, saved listings, and valuation requests.')) return;
    setError('');
    try {
      await adminApi.deleteBuyer(id);
      setBuyers((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const response = await fetch(adminApi.exportCsvUrl(), {
        headers: { 'x-admin-key': getAdminKey() },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'connector-buyers.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Buyers</h1>
          <p className="page-sub">{buyers.length} registered. Export to import into Zoho Campaigns.</p>
        </div>
        <button className="btn btn-ghost" style={{ width: 'auto', padding: '0.7rem 1.2rem' }} onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error && <p className="msg error">{error}</p>}
      {loading && <p className="loading">Loading…</p>}

      <div className="card" style={{ padding: 0 }}>
        {buyers.map((b) => (
          <div className="agent-row" key={b.id} style={{ flexDirection: 'column', alignItems: 'stretch', padding: '1.1rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Link to={`/admin/buyers/${b.id}`} style={{ textDecoration: 'none' }}>
                <div className="agent-name">{b.name}</div>
                <div className="agent-meta">{b.email} · {b.phone}</div>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div className="agent-meta">via {b.joined_via || 'direct'}</div>
                <Link to={`/admin/buyers/${b.id}`} className="save-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>View</Link>
                <button className="save-btn" onClick={() => handleDelete(b.id)}>Delete</button>
              </div>
            </div>
            <div className="agent-meta" style={{ marginTop: '0.4rem' }}>
              {b.property_type || 'No brief set'}{b.areas ? ` · ${b.areas}` : ''} · {b.saved_count} saved
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
