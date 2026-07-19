import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contactsApi, brandsApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const STAGES = ['New', 'Contacted', 'Warm', 'Meeting Booked', 'Listed'];
const STAGE_CLASS = {
  'New': 'stage-new', 'Contacted': 'stage-contacted', 'Warm': 'stage-warm',
  'Meeting Booked': 'stage-meeting', 'Listed': 'stage-listed'
};

const emptyForm = {
  brand_id: '', first_name: '', last_name: '', email: '', phone: '',
  address: '', city: '', state: '', zip: '', pipeline_stage: 'New', source: '',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Contacts() {
  const { show } = useToast();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState(searchParams.get('brand_id') || '');
  const [stageFilter, setStageFilter] = useState('');
  const [dncFilter, setDncFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showNotes, setShowNotes] = useState(null);
  const [showDnc, setShowDnc] = useState(null);
  const [showBulkStage, setShowBulkStage] = useState(false);

  // Forms
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState([]);
  const [dncReason, setDncReason] = useState('');
  const [bulkStageVal, setBulkStageVal] = useState('New');

  // Import
  const [importFile, setImportFile] = useState(null);
  const [importBrand, setImportBrand] = useState('');
  const [importSkip, setImportSkip] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, sort: 'created_at', order: 'DESC' };
      if (search) params.search = search;
      if (brandFilter) params.brand_id = brandFilter;
      if (stageFilter) params.stage = stageFilter;
      if (dncFilter) params.dnc = dncFilter;
      const [contactsData, brandsData] = await Promise.all([
        contactsApi.list(params),
        brandsApi.list(),
      ]);
      setContacts(contactsData.contacts || []);
      setTotal(contactsData.total || 0);
      setBrands(brandsData);
      setSelected(new Set());
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, brandFilter, stageFilter, dncFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, brandFilter, stageFilter, dncFilter]);

  // ── Add / Edit ──────────────────────────────────────────────────
  function openAdd() { setForm(emptyForm); setShowAdd(true); }
  function openEdit(c) {
    setEditContact(c);
    setForm({
      brand_id: c.brand_id || '', first_name: c.first_name || '',
      last_name: c.last_name || '', email: c.email || '',
      phone: c.phone || '', address: c.address || '',
      city: c.city || '', state: c.state || '', zip: c.zip || '',
      pipeline_stage: c.pipeline_stage || 'New', source: c.source || '',
    });
  }

  async function saveContact(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editContact) {
        await contactsApi.update(editContact.id, form);
        show('Contact updated', 'success');
        setEditContact(null);
      } else {
        await contactsApi.create(form);
        show('Contact created', 'success');
        setShowAdd(false);
      }
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────
  async function deleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
      await contactsApi.delete(id);
      show('Contact deleted', 'success');
      load();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} contacts?`)) return;
    try {
      await contactsApi.bulkDelete([...selected]);
      show(`${selected.size} contacts deleted`, 'success');
      load();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  async function bulkUpdateStage() {
    try {
      await contactsApi.bulkStage([...selected], bulkStageVal);
      show(`${selected.size} contacts moved to ${bulkStageVal}`, 'success');
      setShowBulkStage(false);
      load();
    } catch (err) {
      show(err.message, 'error');
    }
  }

  // ── Notes ───────────────────────────────────────────────────────
  async function openNotes(contact) {
    setShowNotes(contact);
    setNoteText('');
    try {
      const data = await contactsApi.getNotes(contact.id);
      setNotes(data);
    } catch { setNotes([]); }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      const note = await contactsApi.addNote(showNotes.id, { note: noteText });
      setNotes(prev => [note, ...prev]);
      setNoteText('');
      show('Note added', 'success');
    } catch (err) { show(err.message, 'error'); }
  }

  async function deleteNote(noteId) {
    try {
      await contactsApi.deleteNote(showNotes.id, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) { show(err.message, 'error'); }
  }

  // ── DNC ─────────────────────────────────────────────────────────
  async function toggleDnc(contact) {
    if (contact.do_not_contact) {
      if (!confirm('Remove from Do Not Contact list?')) return;
      try {
        await contactsApi.removeDnc(contact.id);
        show('Removed from DNC', 'success');
        load();
      } catch (err) { show(err.message, 'error'); }
    } else {
      setShowDnc(contact);
      setDncReason('');
    }
  }

  async function confirmDnc() {
    try {
      await contactsApi.addDnc(showDnc.id, dncReason);
      show('Added to Do Not Contact', 'success');
      setShowDnc(null);
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  // ── Import ──────────────────────────────────────────────────────
  async function doImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      if (importBrand) fd.append('brand_id', importBrand);
      fd.append('skip_duplicates', String(importSkip));
      const result = await contactsApi.import(fd);
      setImportResult(result);
      show(`Imported ${result.imported} contacts`, 'success');
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  // ── Selection ───────────────────────────────────────────────────
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map(c => c.id)));
  };

  const pages = Math.ceil(total / limit);

  const ContactForm = ({ onSubmit }) => (
    <form onSubmit={onSubmit}>
      <div className="grid-2">
        {[['first_name','First Name'],['last_name','Last Name'],['email','Email'],['phone','Phone'],
          ['address','Address'],['city','City'],['state','State'],['zip','ZIP'],['source','Source']].map(([key,label]) => (
          <div className={`form-group ${key === 'address' ? '' : ''}`} key={key}
            style={key === 'address' ? { gridColumn: '1/-1' } : {}}>
            <label className="form-label">{label}</label>
            <input className="form-input" value={form[key] || ''} onChange={e => setForm(p => ({...p,[key]:e.target.value}))} />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">Brand</label>
          <select className="form-select" value={form.brand_id} onChange={e => setForm(p => ({...p,brand_id:e.target.value}))}>
            <option value="">No Brand</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Pipeline Stage</label>
          <select className="form-select" value={form.pipeline_stage} onChange={e => setForm(p => ({...p,pipeline_stage:e.target.value}))}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </form>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Contacts <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>({total.toLocaleString()})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>↑ Import</button>
          <button className="btn btn-secondary btn-sm" onClick={() => contactsApi.export({ brand_id: brandFilter, stage: stageFilter, dnc: dncFilter, search })}>↓ Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Contact</button>
        </div>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="toolbar">
          <div className="toolbar-left">
            <input
              className="search-input"
              placeholder="Search name, email, phone, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="form-select" style={{ width: 150 }} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="form-select" style={{ width: 160 }} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 140 }} value={dncFilter} onChange={e => setDncFilter(e.target.value)}>
              <option value="">All Contacts</option>
              <option value="false">Active Only</option>
              <option value="true">DNC Only</option>
            </select>
          </div>
          <div className="toolbar-right">
            {(search || brandFilter || stageFilter || dncFilter) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setBrandFilter(''); setStageFilter(''); setDncFilter(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>{selected.size} selected</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowBulkStage(true)}>Move Stage</button>
            <button className="btn btn-sm btn-danger" onClick={bulkDelete}>Delete</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Deselect</button>
          </div>
        )}

        {/* Table */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Brand</th>
                  <th>Stage</th>
                  <th>City</th>
                  <th>Added</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</td></tr>
                ) : contacts.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No contacts found</td></tr>
                ) : contacts.map(c => (
                  <tr key={c.id} className={selected.has(c.id) ? 'selected' : ''}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{c.first_name} {c.last_name}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                    <td>
                      {c.brand_name ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.brand_color }} />
                          {c.brand_name}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span className={`badge ${STAGE_CLASS[c.pipeline_stage] || 'badge-gray'}`}>{c.pipeline_stage}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.city || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(c.created_at)}</td>
                    <td>
                      {c.do_not_contact ? (
                        <span className="badge badge-red">DNC</span>
                      ) : (
                        <span className="badge badge-green">Active</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Notes" onClick={() => openNotes(c)}>📝</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title={c.do_not_contact ? 'Remove DNC' : 'Add DNC'} onClick={() => toggleDnc(c)}>
                          {c.do_not_contact ? '✅' : '🚫'}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={() => deleteContact(c.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                {Array.from({ length: Math.min(pages, 8) }, (_, i) => {
                  const p = i + 1;
                  return <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
                })}
                {pages > 8 && <span style={{ padding: '5px 4px', color: 'var(--text-muted)' }}>...</span>}
                <button className="page-btn" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {((page-1)*limit)+1}–{Math.min(page*limit, total)} of {total}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Contact" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveContact} disabled={saving}>{saving ? 'Saving...' : 'Add Contact'}</button>
          </>
        }
      >
        <ContactForm onSubmit={saveContact} />
      </Modal>

      {/* Edit Contact Modal */}
      <Modal open={!!editContact} onClose={() => setEditContact(null)} title="Edit Contact" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditContact(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveContact} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </>
        }
      >
        <ContactForm onSubmit={saveContact} />
      </Modal>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportFile(null); setImportResult(null); }} title="Import Contacts" size="md">
        <div>
          <div className="form-group mb-4">
            <label className="form-label">File (CSV or Excel)</label>
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls"
              onChange={e => setImportFile(e.target.files[0])}
              style={{ fontSize: 13 }}
            />
            <span className="form-hint">Expected columns: first_name, last_name, email, phone, address, city, state, zip, pipeline_stage, source</span>
          </div>
          <div className="form-group mb-4">
            <label className="form-label">Assign to Brand (optional)</label>
            <select className="form-select" value={importBrand} onChange={e => setImportBrand(e.target.value)}>
              <option value="">No Brand</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={importSkip} onChange={e => setImportSkip(e.target.checked)} />
            Skip duplicate emails
          </label>

          {importResult && (
            <div style={{ padding: 12, background: 'var(--success-light)', borderRadius: 8, marginBottom: 12 }}>
              <strong>Import complete!</strong>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <span style={{ color: 'var(--success)' }}>✓ {importResult.imported} imported</span>
                <span style={{ color: 'var(--text-muted)' }}>{importResult.skipped} skipped</span>
                {importResult.errors > 0 && <span style={{ color: 'var(--danger)' }}>✕ {importResult.errors} errors</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null); }}>Close</button>
            <button className="btn btn-primary" onClick={doImport} disabled={!importFile || importing}>
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Notes Drawer */}
      <Modal open={!!showNotes} onClose={() => setShowNotes(null)} title={`Notes — ${showNotes?.first_name} ${showNotes?.last_name}`} size="md">
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <textarea
              className="form-textarea"
              style={{ minHeight: 60 }}
              placeholder="Add a note..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <button className="btn btn-primary" style={{ alignSelf: 'flex-end', flexShrink: 0 }} onClick={addNote}>Add</button>
          </div>
          {notes.length === 0 ? (
            <div className="empty-state"><p>No notes yet</p></div>
          ) : notes.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 8, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{n.note}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {n.created_by} · {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteNote(n.id)}>✕</button>
            </div>
          ))}
        </div>
      </Modal>

      {/* DNC Modal */}
      <Modal open={!!showDnc} onClose={() => setShowDnc(null)} title="Add to Do Not Contact" size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDnc(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDnc}>Add to DNC</button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
            This will prevent <strong>{showDnc?.first_name} {showDnc?.last_name}</strong> from receiving any future outreach.
          </p>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input className="form-input" placeholder="e.g. Requested removal" value={dncReason} onChange={e => setDncReason(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Bulk Stage Modal */}
      <Modal open={showBulkStage} onClose={() => setShowBulkStage(false)} title="Move Selected to Stage" size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowBulkStage(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={bulkUpdateStage}>Move {selected.size} Contacts</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Target Stage</label>
          <select className="form-select" value={bulkStageVal} onChange={e => setBulkStageVal(e.target.value)}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}
