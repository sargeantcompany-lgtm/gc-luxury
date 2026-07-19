import React, { useState, useEffect, useCallback } from 'react';
import { brandsApi, settingsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const emptyBrand = { name: '', color: '#2563eb', logo_url: '' };
const emptySmtp = { host: '', port: 587, secure: false, username: '', password: '', from_name: '', from_email: '' };

export default function Settings() {
  const { show } = useToast();
  const [brands, setBrands] = useState([]);
  const [smtpList, setSmtpList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Brand modal
  const [showBrand, setShowBrand] = useState(false);
  const [editBrand, setEditBrand] = useState(null);
  const [brandForm, setBrandForm] = useState(emptyBrand);
  const [savingBrand, setSavingBrand] = useState(false);

  // SMTP modal
  const [showSmtp, setShowSmtp] = useState(false);
  const [smtpBrand, setSmtpBrand] = useState(null);
  const [smtpForm, setSmtpForm] = useState(emptySmtp);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [brandsData, smtpData] = await Promise.all([
        brandsApi.list(),
        settingsApi.getAllSmtp(),
      ]);
      setBrands(brandsData);
      setSmtpList(smtpData);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Brands ──────────────────────────────────────────────────────
  function openAddBrand() {
    setEditBrand(null);
    setBrandForm(emptyBrand);
    setShowBrand(true);
  }

  function openEditBrand(b) {
    setEditBrand(b);
    setBrandForm({ name: b.name, color: b.color, logo_url: b.logo_url || '' });
    setShowBrand(true);
  }

  async function saveBrand(e) {
    e.preventDefault();
    setSavingBrand(true);
    try {
      if (editBrand) {
        await brandsApi.update(editBrand.id, brandForm);
        show('Brand updated', 'success');
      } else {
        await brandsApi.create(brandForm);
        show('Brand created', 'success');
      }
      setShowBrand(false);
      setEditBrand(null);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSavingBrand(false);
    }
  }

  async function deleteBrand(id) {
    if (!confirm('Delete this brand? All associated contacts will have their brand cleared.')) return;
    try {
      await brandsApi.delete(id);
      show('Brand deleted', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  // ── SMTP ────────────────────────────────────────────────────────
  async function openSmtp(brand) {
    setSmtpBrand(brand);
    setTestEmail('');
    try {
      const existing = await settingsApi.getSmtp(brand.id);
      if (existing) {
        setSmtpForm({
          host: existing.host, port: existing.port, secure: existing.secure,
          username: existing.username, password: '',
          from_name: existing.from_name || '', from_email: existing.from_email,
        });
      } else {
        setSmtpForm(emptySmtp);
      }
    } catch {
      setSmtpForm(emptySmtp);
    }
    setShowSmtp(true);
  }

  async function saveSmtp(e) {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      await settingsApi.saveSmtp({ ...smtpForm, brand_id: smtpBrand.id });
      show('SMTP settings saved', 'success');
      setShowSmtp(false);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSavingSmtp(false);
    }
  }

  async function testSmtp() {
    setTestingSmtp(true);
    try {
      const result = await settingsApi.testSmtp(smtpBrand.id, testEmail || undefined);
      show(result.message, 'success');
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setTestingSmtp(false);
    }
  }

  async function deleteSmtp(brandId) {
    if (!confirm('Remove SMTP settings for this brand?')) return;
    try {
      await settingsApi.deleteSmtp(brandId);
      show('SMTP settings removed', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  const smtpForBrand = (brandId) => smtpList.find(s => s.brand_id === brandId);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="page-content">
        {/* ── Brands Section ── */}
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title">Brands</span>
            <button className="btn btn-primary btn-sm" onClick={openAddBrand}>+ Add Brand</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
            ) : brands.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <p>No brands yet. Add your first brand to get started.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Color</th>
                      <th>SMTP</th>
                      <th>Created</th>
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map(b => {
                      const smtp = smtpForBrand(b.id);
                      return (
                        <tr key={b.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: b.color, flexShrink: 0 }} />
                              <span style={{ fontWeight: 600 }}>{b.name}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, background: b.color, border: '1px solid var(--border)' }} />
                              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.color}</span>
                            </div>
                          </td>
                          <td>
                            {smtp ? (
                              <span className="badge badge-green">✓ Configured ({smtp.from_email})</span>
                            ) : (
                              <span className="badge badge-gray">Not configured</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {new Date(b.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => openSmtp(b)}>SMTP</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditBrand(b)}>✏️</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteBrand(b.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Info Section ── */}
        <div className="card">
          <div className="card-header"><span className="card-title">About Outreach HQ</span></div>
          <div className="card-body">
            <div className="grid-3">
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>MERGE TAGS</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 2, color: 'var(--text-secondary)' }}>
                  {['{{first_name}}','{{last_name}}','{{email}}','{{phone}}',
                    '{{city}}','{{state}}','{{zip}}','{{brand_name}}'].map(t => (
                    <div key={t}>{t}</div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>PIPELINE STAGES</div>
                {['New','Contacted','Warm','Meeting Booked','Listed'].map(s => (
                  <div key={s} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>→ {s}</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>CSV IMPORT COLUMNS</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 2, color: 'var(--text-secondary)' }}>
                  {['first_name','last_name','email','phone','address','city','state','zip','pipeline_stage','source'].map(c => (
                    <div key={c}>{c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Modal */}
      <Modal
        open={showBrand}
        onClose={() => { setShowBrand(false); setEditBrand(null); }}
        title={editBrand ? 'Edit Brand' : 'Add Brand'}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowBrand(false); setEditBrand(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveBrand} disabled={savingBrand || !brandForm.name}>
              {savingBrand ? 'Saving...' : editBrand ? 'Save Changes' : 'Add Brand'}
            </button>
          </>
        }
      >
        <div>
          <div className="form-group mb-4">
            <label className="form-label">Brand Name *</label>
            <input className="form-input" value={brandForm.name} onChange={e => setBrandForm(p => ({...p,name:e.target.value}))} required />
          </div>
          <div className="form-group mb-4">
            <label className="form-label">Brand Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={brandForm.color}
                onChange={e => setBrandForm(p => ({...p,color:e.target.value}))}
                style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
              />
              <input
                className="form-input"
                style={{ fontFamily: 'monospace' }}
                value={brandForm.color}
                onChange={e => setBrandForm(p => ({...p,color:e.target.value}))}
                placeholder="#2563eb"
              />
            </div>
          </div>
          <div style={{ padding: 12, background: brandForm.color + '22', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: brandForm.color }} />
            <span style={{ fontWeight: 600, color: brandForm.color }}>{brandForm.name || 'Brand Preview'}</span>
          </div>
        </div>
      </Modal>

      {/* SMTP Modal */}
      <Modal
        open={showSmtp}
        onClose={() => setShowSmtp(false)}
        title={`SMTP Settings — ${smtpBrand?.name}`}
        size="md"
        footer={
          <>
            {smtpForBrand(smtpBrand?.id) && (
              <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }}
                onClick={() => { setShowSmtp(false); deleteSmtp(smtpBrand.id); }}>
                Remove SMTP
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowSmtp(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSmtp} disabled={savingSmtp}>
              {savingSmtp ? 'Saving...' : 'Save SMTP'}
            </button>
          </>
        }
      >
        {smtpBrand && (
          <div>
            <div className="grid-2">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">SMTP Host *</label>
                <input className="form-input" placeholder="smtp.gmail.com" value={smtpForm.host}
                  onChange={e => setSmtpForm(p => ({...p,host:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Port</label>
                <input className="form-input" type="number" value={smtpForm.port}
                  onChange={e => setSmtpForm(p => ({...p,port:parseInt(e.target.value)}))} />
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <label className="form-label">Security</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={smtpForm.secure}
                    onChange={e => setSmtpForm(p => ({...p,secure:e.target.checked}))} />
                  Use SSL/TLS (port 465)
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Username / Email *</label>
                <input className="form-input" type="email" placeholder="you@example.com" value={smtpForm.username}
                  onChange={e => setSmtpForm(p => ({...p,username:e.target.value}))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Password {smtpForBrand(smtpBrand.id) ? '(leave blank to keep existing)' : '*'}</label>
                <input className="form-input" type="password" value={smtpForm.password}
                  onChange={e => setSmtpForm(p => ({...p,password:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">From Name</label>
                <input className="form-input" placeholder={smtpBrand.name} value={smtpForm.from_name}
                  onChange={e => setSmtpForm(p => ({...p,from_name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">From Email *</label>
                <input className="form-input" type="email" value={smtpForm.from_email}
                  onChange={e => setSmtpForm(p => ({...p,from_email:e.target.value}))} />
              </div>
            </div>

            <hr className="divider" />

            {/* Test Email */}
            {smtpForBrand(smtpBrand.id) && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Test Connection</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" type="email" placeholder="Send test to (optional)" value={testEmail}
                    onChange={e => setTestEmail(e.target.value)} />
                  <button className="btn btn-secondary" onClick={testSmtp} disabled={testingSmtp} style={{ flexShrink: 0 }}>
                    {testingSmtp ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
                <div className="form-hint mt-2">Sends a test email using the saved SMTP settings.</div>
              </div>
            )}

            <div style={{ marginTop: 12, padding: 10, background: 'var(--warning-light)', borderRadius: 6, fontSize: 12 }}>
              💡 <strong>Gmail users:</strong> Use an App Password (not your account password). Enable 2FA first, then generate at myaccount.google.com → Security → App passwords.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
