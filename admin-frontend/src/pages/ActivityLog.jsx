import React, { useState, useEffect, useCallback } from 'react';
import { activityApi, brandsApi } from '../services/api';
import { useToast } from '../components/Toast';

const TYPE_ICONS = {
  contact_created: { icon: '👤', bg: '#eff6ff', label: 'Contact Created' },
  stage_changed: { icon: '🔄', bg: '#f5f3ff', label: 'Stage Changed' },
  note_added: { icon: '📝', bg: '#fffbeb', label: 'Note Added' },
  dnc_added: { icon: '🚫', bg: '#fef2f2', label: 'DNC Added' },
  dnc_removed: { icon: '✅', bg: '#ecfdf5', label: 'DNC Removed' },
  import: { icon: '📥', bg: '#f0fdf4', label: 'Import' },
  campaign_sent: { icon: '📧', bg: '#eff6ff', label: 'Email Sent' },
  sms_links_generated: { icon: '💬', bg: '#f5f3ff', label: 'SMS Links' },
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLog() {
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: (page - 1) * limit };
      if (brandFilter) params.brand_id = brandFilter;
      if (typeFilter) params.type = typeFilter;
      const [data, brandsData] = await Promise.all([
        activityApi.list(params),
        brandsApi.list(),
      ]);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setBrands(brandsData);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, brandFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [brandFilter, typeFilter]);

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total.toLocaleString()} events</span>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="toolbar mb-4">
          <div className="toolbar-left">
            <select
              className="form-select"
              style={{ width: 160 }}
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
            >
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <select
              className="form-select"
              style={{ width: 180 }}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Event Types</option>
              {Object.entries(TYPE_ICONS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-right">
            {(brandFilter || typeFilter) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setBrandFilter(''); setTypeFilter(''); }}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading activity...</div>
        ) : items.length === 0 ? (
          <div className="empty-state card card-body">
            <h3>No activity yet</h3>
            <p>Activity will appear here as you use the CRM.</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: '0 20px' }}>
              <div className="activity-list">
                {items.map(item => {
                  const meta = TYPE_ICONS[item.type] || { icon: '📋', bg: '#f1f5f9' };
                  return (
                    <div key={item.id} className="activity-item">
                      <div className="activity-icon" style={{ background: meta.bg }}>
                        {meta.icon}
                      </div>
                      <div className="activity-content">
                        <div className="activity-desc">{item.description}</div>
                        <div className="activity-meta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {item.brand_name && (
                            <span style={{ color: item.brand_color, fontWeight: 500 }}>● {item.brand_name}</span>
                          )}
                          {item.contact_name?.trim() && (
                            <span>Contact: {item.contact_name}</span>
                          )}
                          {item.campaign_name && (
                            <span>Campaign: {item.campaign_name}</span>
                          )}
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(item.metadata).map(([k, v]) => (
                              <span key={k} className="chip" style={{ cursor: 'default' }}>
                                {k}: <strong>{String(v)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="pagination mt-3">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              );
            })}
            <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
