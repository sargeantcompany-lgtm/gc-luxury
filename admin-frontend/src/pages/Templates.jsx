import React, { useState, useEffect, useCallback } from 'react';
import { templatesApi, brandsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const MERGE_TAGS = [
  '{{first_name}}', '{{last_name}}', '{{email}}', '{{phone}}',
  '{{city}}', '{{state}}', '{{zip}}', '{{address}}', '{{brand_name}}'
];

const emptyForm = { brand_id: '', name: '', type: 'email', subject: '', body: '' };

export default function Templates() {
  const { show } = useToast();
  const [templates, setTemplates] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (brandFilter) params.brand_id = brandFilter;
      const [templData, brandsData] = await Promise.all([
        templatesApi.list(params),
        brandsApi.list(),
      ]);
      setTemplates(templData);
      setBrands(brandsData);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, brandFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTemplate(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(t) {
    setEditTemplate(t);
    setForm({ brand_id: t.brand_id || '', name: t.name, type: t.type, subject: t.subject || '', body: t.body });
    setShowForm(true);
  }

  function insertTag(tag) {
    setForm(p => ({ ...p, body: (p.body || '') + tag }));
  }

  async function saveTemplate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTemplate) {
        await templatesApi.update(editTemplate.id, form);
        show('Template updated', 'success');
      } else {
        await templatesApi.create(form);
        show('Template created', 'success');
      }
      setShowForm(false);
      setEditTemplate(null);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    try {
      await templatesApi.delete(id);
      show('Template deleted', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  const emailTemplates = templates.filter(t => t.type === 'email');
  const smsTemplates = templates.filter(t => t.type === 'sms');

  const TemplateCard = ({ t }) => (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              {t.brand_name && (
                <span style={{ fontSize: 11, color: t.brand_color, fontWeight: 500 }}>● {t.brand_name}</span>
              )}
            </div>
            {t.subject && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <strong>Subject:</strong> {t.subject}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', maxHeight: 42,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {t.body}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            <button className="btn btn-ghost btn-sm btn-icon" title="Preview" onClick={() => setPreview(t)}>👁️</button>
            <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(t)}>✏️</button>
            <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={() => deleteTemplate(t.id)}>🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Templates</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Template</button>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="toolbar mb-4">
          <div className="toolbar-left">
            <select className="form-select" style={{ width: 150 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['', 'email', 'sms'].map(t => (
              <button key={t} className={`chip ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>
                {t === '' ? 'All' : t === 'email' ? '📧 Email' : '💬 SMS'}
              </button>
            ))}
          </div>
        </div>

        {/* Merge tag reference */}
        <div className="card mb-4">
          <div style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Available Merge Tags: </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {MERGE_TAGS.join('  ')}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading templates...</div>
        ) : (
          <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                📧 Email Templates ({emailTemplates.length})
              </h2>
              {emailTemplates.length === 0 ? (
                <div className="empty-state card card-body" style={{ padding: 30 }}>
                  <p>No email templates</p>
                </div>
              ) : emailTemplates.map(t => <TemplateCard key={t.id} t={t} />)}
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                💬 SMS Templates ({smsTemplates.length})
              </h2>
              {smsTemplates.length === 0 ? (
                <div className="empty-state card card-body" style={{ padding: 30 }}>
                  <p>No SMS templates</p>
                </div>
              ) : smsTemplates.map(t => <TemplateCard key={t.id} t={t} />)}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTemplate(null); }}
        title={editTemplate ? 'Edit Template' : 'New Template'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditTemplate(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTemplate} disabled={saving || !form.name || !form.body}>
              {saving ? 'Saving...' : editTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </>
        }
      >
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Template Name *</label>
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
              <label className="form-label">Brand (optional)</label>
              <select className="form-select" value={form.brand_id} onChange={e => setForm(p => ({...p,brand_id:e.target.value}))}>
                <option value="">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {form.type === 'email' && (
            <div className="form-group mt-3">
              <label className="form-label">Subject</label>
              <input className="form-input" value={form.subject} onChange={e => setForm(p => ({...p,subject:e.target.value}))} />
            </div>
          )}

          <div className="form-group mt-3">
            <label className="form-label">
              Body *
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Click tags to insert</span>
            </label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {MERGE_TAGS.map(tag => (
                <button key={tag} type="button" className="chip" onClick={() => insertTag(tag)}>{tag}</button>
              ))}
            </div>
            <textarea
              className="form-textarea"
              style={{ minHeight: 160 }}
              value={form.body}
              onChange={e => setForm(p => ({...p,body:e.target.value}))}
            />
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Preview — ${preview?.name}`} size="md">
        {preview && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span className={`badge ${preview.type === 'email' ? 'badge-blue' : 'badge-purple'}`}>{preview.type.toUpperCase()}</span>
              {preview.brand_name && <span style={{ marginLeft: 8, fontSize: 12, color: preview.brand_color }}>● {preview.brand_name}</span>}
            </div>
            {preview.subject && (
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg)', borderRadius: 6 }}>
                <strong style={{ fontSize: 12 }}>Subject:</strong>
                <div style={{ marginTop: 4, fontSize: 13 }}>{preview.subject}</div>
              </div>
            )}
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 6, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {preview.body}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
