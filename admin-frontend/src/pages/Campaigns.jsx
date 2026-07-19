import React, { useState, useEffect, useCallback } from 'react';
import { campaignsApi, brandsApi, templatesApi, contactsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const STAGES = ['New', 'Contacted', 'Warm', 'Meeting Booked', 'Listed'];
const MERGE_TAGS = ['{{first_name}}', '{{last_name}}', '{{email}}', '{{phone}}', '{{city}}', '{{state}}', '{{brand_name}}'];

const emptyForm = {
  name: '', brand_id: '', type: 'email', subject: '', body: '',
  filter_stage: '',
};

function StatusBadge({ status }) {
  const map = { draft: 'badge-gray', sending: 'badge-yellow', sent: 'badge-green', failed: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Campaigns() {
  const { show } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [brandFilter, setBrandFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [viewCampaign, setViewCampaign] = useState(null);
  const [smsLinksData, setSmsLinksData] = useState(null);
  const [results, setResults] = useState([]);

  // Form
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [recipientCount, setRecipientCount] = useState(null);
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (brandFilter) params.brand_id = brandFilter;
      if (typeFilter) params.type = typeFilter;
      const [campData, brandsData, templData] = await Promise.all([
        campaignsApi.list(params),
        brandsApi.list(),
        templatesApi.list(),
      ]);
      setCampaigns(campData.campaigns || []);
      setTotal(campData.total || 0);
      setBrands(brandsData);
      setTemplates(templData);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, brandFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [brandFilter, typeFilter]);

  // Preview recipient count
  useEffect(() => {
    if (!showCreate && !editCampaign) return;
    async function preview() {
      if (!form.brand_id) { setRecipientCount(null); return; }
      try {
        // Build a temporary campaign to preview
        const tempId = (editCampaign || viewCampaign)?.id;
        if (tempId) {
          const data = await campaignsApi.preview(tempId);
          setRecipientCount(data.recipient_count);
        }
      } catch { setRecipientCount(null); }
    }
    const t = setTimeout(preview, 500);
    return () => clearTimeout(t);
  }, [form.brand_id, form.filter_stage, editCampaign]);

  function openCreate() {
    setForm(emptyForm);
    setSelectedTemplate('');
    setRecipientCount(null);
    setShowCreate(true);
  }

  function openEdit(c) {
    setEditCampaign(c);
    setForm({
      name: c.name, brand_id: c.brand_id || '',
      type: c.type, subject: c.subject || '', body: c.body,
      filter_stage: c.filters?.stage || '',
    });
  }

  async function openView(c) {
    setViewCampaign(c);
    try {
      const data = await campaignsApi.results(c.id);
      setResults(data);
    } catch { setResults([]); }
  }

  function applyTemplate(id) {
    const t = templates.find(t => String(t.id) === String(id));
    if (!t) return;
    setForm(p => ({ ...p, subject: t.subject || p.subject, body: t.body, type: t.type }));
    setSelectedTemplate(id);
  }

  function insertMergeTag(tag) {
    setForm(p => ({ ...p, body: (p.body || '') + tag }));
  }

  async function saveCampaign(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        filters: form.filter_stage ? { stage: form.filter_stage } : {},
      };
      if (editCampaign) {
        await campaignsApi.update(editCampaign.id, payload);
        show('Campaign updated', 'success');
        setEditCampaign(null);
      } else {
        await campaignsApi.create(payload);
        show('Campaign created', 'success');
        setShowCreate(false);
      }
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(id) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await campaignsApi.delete(id);
      show('Deleted', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  async function sendCampaign(id) {
    if (!confirm('Send this email campaign now? This cannot be undone.')) return;
    setSending(true);
    try {
      const result = await campaignsApi.send(id);
      show(result.message || 'Sending started!', 'success');
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function generateSmsLinks(id) {
    try {
      const result = await campaignsApi.smsLinks(id);
      setSmsLinksData(result);
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  const CampaignForm = () => (
    <div>
      {/* Template picker */}
      <div className="form-group mb-4">
        <label className="form-label">Load from Template (optional)</label>
        <select className="form-select" value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}>
          <option value="">— Select template —</option>
          {templates.map(t => <option key={t.id} value={t.id}>[{t.type.toUpperCase()}] {t.name}</option>)}
        </select>
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Campaign Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(p => ({...p,name:e.target.value}))} required />
        </div>
        <div className="form-group">
          <label className="form-label">Type *</label>
          <select className="form-select" value={form.type} onChange={e => setForm(p => ({...p,type:e.target.value}))}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Brand *</label>
          <select className="form-select" value={form.brand_id} onChange={e => setForm(p => ({...p,brand_id:e.target.value}))}>
            <option value="">— Select brand —</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Filter by Stage (optional)</label>
          <select className="form-select" value={form.filter_stage} onChange={e => setForm(p => ({...p,filter_stage:e.target.value}))}>
            <option value="">All stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {form.type === 'email' && (
        <div className="form-group mt-3">
          <label className="form-label">Subject *</label>
          <input className="form-input" value={form.subject} onChange={e => setForm(p => ({...p,subject:e.target.value}))} />
        </div>
      )}

      <div className="form-group mt-3">
        <label className="form-label">
          Message Body *
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
            Merge tags: {MERGE_TAGS.slice(0, 4).join(', ')}
          </span>
        </label>
        <textarea
          className="form-textarea"
          style={{ minHeight: 140 }}
          value={form.body}
          onChange={e => setForm(p => ({...p,body:e.target.value}))}
        />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {MERGE_TAGS.map(tag => (
            <button key={tag} type="button" className="chip" onClick={() => insertMergeTag(tag)}>{tag}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Campaigns <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>({total})</span></h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Campaign</button>
      </div>

      <div className="page-content">
        <div className="toolbar">
          <div className="toolbar-left">
            <select className="form-select" style={{ width: 160 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="form-select" style={{ width: 130 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Created</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No campaigns yet</td></tr>
                ) : campaigns.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ fontWeight: 500 }}>{c.name}</span></td>
                    <td><span className={`badge ${c.type === 'email' ? 'badge-blue' : 'badge-purple'}`}>{c.type.toUpperCase()}</span></td>
                    <td>
                      {c.brand_name ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.brand_color }} />
                          {c.brand_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.total_recipients || 0}</td>
                    <td style={{ color: 'var(--success)' }}>{c.sent_count || 0}</td>
                    <td style={{ color: c.failed_count > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{c.failed_count || 0}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(c.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" title="View Results" onClick={() => openView(c)}>📊</button>
                        {c.status === 'draft' && (
                          <>
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEdit(c)}>✏️</button>
                            {c.type === 'email' && (
                              <button className="btn btn-sm btn-primary" onClick={() => sendCampaign(c.id)} disabled={sending}>
                                Send
                              </button>
                            )}
                            {c.type === 'sms' && (
                              <button className="btn btn-sm btn-success" onClick={() => generateSmsLinks(c.id)}>
                                SMS Links
                              </button>
                            )}
                          </>
                        )}
                        {c.status === 'sent' && c.type === 'sms' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => generateSmsLinks(c.id)}>
                            Re-gen Links
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => deleteCampaign(c.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Campaign" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCampaign} disabled={saving || !form.name || !form.body}>
              {saving ? 'Creating...' : 'Create Campaign'}
            </button>
          </>
        }
      >
        <CampaignForm />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editCampaign} onClose={() => setEditCampaign(null)} title="Edit Campaign" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditCampaign(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCampaign} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <CampaignForm />
      </Modal>

      {/* View Results Modal */}
      <Modal open={!!viewCampaign} onClose={() => { setViewCampaign(null); setResults([]); }} title={`Results — ${viewCampaign?.name}`} size="xl">
        {viewCampaign && (
          <div>
            <div className="grid-4 mb-4">
              <div className="stat-card">
                <div className="stat-value">{viewCampaign.total_recipients || 0}</div>
                <div className="stat-label">Recipients</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>{viewCampaign.sent_count || 0}</div>
                <div className="stat-label">Delivered</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{viewCampaign.failed_count || 0}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value"><StatusBadge status={viewCampaign.status} /></div>
                <div className="stat-label">Status</div>
              </div>
            </div>
            {results.length > 0 && (
              <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Name</th><th>Email/Phone</th><th>Status</th><th>Sent At</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id}>
                        <td>{r.first_name} {r.last_name}</td>
                        <td style={{ fontSize: 12 }}>{r.email || r.phone}</td>
                        <td><span className={`badge ${r.status === 'sent' ? 'badge-green' : r.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>{r.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.sent_at)}</td>
                        <td style={{ fontSize: 12, color: 'var(--danger)' }}>{r.error_message || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* SMS Links Modal */}
      <Modal open={!!smsLinksData} onClose={() => setSmsLinksData(null)} title={`SMS Links (${smsLinksData?.total || 0} contacts)`} size="lg">
        {smsLinksData && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Click each link to open your Messages app with the pre-filled message. Works on mobile.
            </p>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {smsLinksData.links.map((link, i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{link.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{link.phone}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{link.message.substring(0, 80)}...</div>
                    </div>
                    <a
                      href={link.sms_link}
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                    >
                      Open SMS
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSmsLinksData(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
