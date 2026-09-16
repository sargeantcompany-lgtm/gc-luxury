import React, { useState, useEffect, useCallback } from 'react';
import { gcListingsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const emptyForm = {
  title: '', suburb: '', price_guide: '', description: '',
  photos: '', video_url: '', status: 'active', display_order: 0,
};

const STATUS_LABELS = {
  active: 'Active',
  under_offer: 'Under Offer',
  sold: 'Sold',
  archived: 'Archived',
};

function toForm(listing) {
  return {
    title: listing.title,
    suburb: listing.suburb || '',
    price_guide: listing.price_guide || '',
    description: listing.description || '',
    photos: Array.isArray(listing.photos) ? listing.photos.join('\n') : '',
    video_url: listing.video_url || '',
    status: listing.status,
    display_order: listing.display_order || 0,
  };
}

function toPayload(form) {
  return {
    ...form,
    display_order: Number(form.display_order) || 0,
    photos: form.photos.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

export default function GcListings() {
  const { show } = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editListing, setEditListing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await gcListingsApi.list(params);
      setListings(data);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditListing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(listing) {
    setEditListing(listing);
    setForm(toForm(listing));
    setShowForm(true);
  }

  async function saveListing(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editListing) {
        await gcListingsApi.update(editListing.id, payload);
        show('Listing updated', 'success');
      } else {
        await gcListingsApi.create(payload);
        show('Listing created', 'success');
      }
      setShowForm(false);
      setEditListing(null);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteListing(id) {
    if (!confirm('Delete this listing?')) return;
    try {
      await gcListingsApi.delete(id);
      show('Listing deleted', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">GC Luxury Listings</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Listing</button>
      </div>

      <div className="page-content">
        <div className="toolbar mb-4">
          <div style={{ display: 'flex', gap: 6 }}>
            {['', 'active', 'under_offer', 'sold', 'archived'].map((s) => (
              <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === '' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading listings...</div>
        ) : listings.length === 0 ? (
          <div className="empty-state card card-body" style={{ padding: 30 }}>
            <p>No listings yet — add one to have it appear on the public site.</p>
          </div>
        ) : (
          listings.map((listing) => (
            <div className="card" key={listing.id} style={{ marginBottom: 12 }}>
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{listing.title}</span>
                    <span className="badge">{STATUS_LABELS[listing.status]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {listing.suburb || 'No suburb set'} &middot; {listing.price_guide || 'Price on application'}
                  </div>
                  {listing.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', maxHeight: 36,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {listing.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(listing)}>✏️</button>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={() => deleteListing(listing.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditListing(null); }}
        title={editListing ? 'Edit Listing' : 'New Listing'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditListing(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveListing} disabled={saving || !form.title}>
              {saving ? 'Saving...' : editListing ? 'Save Changes' : 'Create Listing'}
            </button>
          </>
        }
      >
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. 5-bed waterfront, Sovereign Islands" required />
            </div>
            <div className="form-group">
              <label className="form-label">Suburb</label>
              <input className="form-input" value={form.suburb} onChange={(e) => setForm((p) => ({ ...p, suburb: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Price Guide</label>
              <input className="form-input" value={form.price_guide} onChange={(e) => setForm((p) => ({ ...p, price_guide: e.target.value }))} placeholder="e.g. $8.5M+" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group mt-3">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" style={{ minHeight: 100 }} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              Photo URLs
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>One per line - first one is used as the card image</span>
            </label>
            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.photos} onChange={(e) => setForm((p) => ({ ...p, photos: e.target.value }))} placeholder="https://..." />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              Video URL
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Optional - a YouTube/Vimeo link or a direct video file URL</span>
            </label>
            <input className="form-input" value={form.video_url} onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))} placeholder="https://youtube.com/watch?v=... or https://.../video.mp4" />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              Display Order
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Lower numbers show first on the public site</span>
            </label>
            <input type="number" className="form-input" style={{ width: 120 }} value={form.display_order} onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
