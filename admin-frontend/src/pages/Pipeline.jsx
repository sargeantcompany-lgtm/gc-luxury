import React, { useState, useEffect, useCallback } from 'react';
import { contactsApi, brandsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const STAGES = ['New', 'Contacted', 'Warm', 'Meeting Booked', 'Listed'];
const STAGE_COLORS = {
  'New': { bg: '#f1f5f9', text: '#475569', header: '#e2e8f0' },
  'Contacted': { bg: '#eff6ff', text: '#2563eb', header: '#dbeafe' },
  'Warm': { bg: '#fffbeb', text: '#92400e', header: '#fef3c7' },
  'Meeting Booked': { bg: '#f5f3ff', text: '#6d28d9', header: '#ede9fe' },
  'Listed': { bg: '#ecfdf5', text: '#065f46', header: '#d1fae5' },
};

const emptyForm = {
  brand_id: '', first_name: '', last_name: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '', source: '',
};

export default function Pipeline() {
  const { show } = useToast();
  const [contacts, setContacts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState('');
  const [editContact, setEditContact] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [brandsData, contactsData] = await Promise.all([
        brandsApi.list(),
        contactsApi.list({ limit: 1000, brand_id: brandFilter || undefined }),
      ]);
      setBrands(brandsData);
      setContacts(contactsData.contacts || []);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [brandFilter]);

  useEffect(() => { load(); }, [load]);

  const grouped = STAGES.reduce((acc, s) => {
    acc[s] = contacts.filter(c => c.pipeline_stage === s);
    return acc;
  }, {});

  async function moveStage(contactId, newStage) {
    try {
      await contactsApi.updateStage(contactId, newStage);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipeline_stage: newStage } : c));
      show(`Moved to ${newStage}`, 'success');
    } catch (err) {
      show(err.message, 'error');
    }
  }

  function openEdit(contact) {
    setEditContact(contact);
    setForm({
      brand_id: contact.brand_id || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      city: contact.city || '',
      state: contact.state || '',
      zip: contact.zip || '',
      source: contact.source || '',
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await contactsApi.update(editContact.id, { ...form, pipeline_stage: editContact.pipeline_stage });
      show('Contact updated', 'success');
      setEditContact(null);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const stageIdx = (stage) => STAGES.indexOf(stage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div className="page-header">
        <h1 className="page-title">Pipeline</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 160 }}
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 60 }}>Loading pipeline...</div>
        ) : (
          <div className="kanban-board">
            {STAGES.map(stage => {
              const stageContacts = grouped[stage] || [];
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} className="kanban-col">
                  <div className="kanban-col-header" style={{ background: colors.header, color: colors.text }}>
                    <span>{stage}</span>
                    <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>
                      {stageContacts.length}
                    </span>
                  </div>

                  {stageContacts.map(contact => (
                    <div key={contact.id} className="kanban-contact-card" onClick={() => openEdit(contact)}>
                      <div className="kanban-name">
                        {contact.first_name} {contact.last_name}
                      </div>
                      {contact.email && <div className="kanban-email">{contact.email}</div>}
                      {contact.phone && <div className="kanban-email">{contact.phone}</div>}
                      {contact.city && <div className="kanban-email">{contact.city}{contact.state ? `, ${contact.state}` : ''}</div>}
                      {contact.brand_name && (
                        <div className="kanban-brand">
                          <span style={{ color: contact.brand_color, fontSize: 10, fontWeight: 600 }}>
                            ● {contact.brand_name}
                          </span>
                        </div>
                      )}
                      {/* Stage buttons */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {stageIdx(stage) > 0 && (
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: 10, padding: '2px 6px' }}
                            onClick={e => { e.stopPropagation(); moveStage(contact.id, STAGES[stageIdx(stage) - 1]); }}
                          >← Back</button>
                        )}
                        {stageIdx(stage) < STAGES.length - 1 && (
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: 10, padding: '2px 6px' }}
                            onClick={e => { e.stopPropagation(); moveStage(contact.id, STAGES[stageIdx(stage) + 1]); }}
                          >Forward →</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageContacts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 12, border: '2px dashed var(--border)', borderRadius: 8 }}>
                      No contacts
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editContact} onClose={() => setEditContact(null)} title="Edit Contact" size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditContact(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        {editContact && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-blue">{editContact.pipeline_stage}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {STAGES.map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${editContact.pipeline_stage === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setEditContact(prev => ({ ...prev, pipeline_stage: s }))}
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone'],
                ['city','City'],['state','State'],['zip','ZIP'],['source','Source']].map(([key,label]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" value={form[key]} onChange={e => setForm(p => ({...p,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div className="form-group mt-3">
              <label className="form-label">Brand</label>
              <select className="form-select" value={form.brand_id} onChange={e => setForm(p => ({...p,brand_id:e.target.value}))}>
                <option value="">No Brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
