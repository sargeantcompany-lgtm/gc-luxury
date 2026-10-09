import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingChecklistsApi } from '../services/api';
import { useToast } from '../components/Toast';

// Property Listing & Sales Checklist, one per property listed. The checklist
// itself comes from the server (server/listingChecklists.js) and is shared
// with /adam/admin's Listings tab - both read and write the same rows.

const itemsOf = (section) => section.items.filter((i) => i.key);
const isDone = (listing, key) => !!listing.items?.[key]?.done;
const countDone = (listing, keys) => keys.filter((k) => isDone(listing, k)).length;
const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const longDate = (iso) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// Sections with `weeks` repeat their list per campaign week. Week 1 uses the
// plain item key, week n uses `${key}-w${n}` (must match the server).
const weekKey = (key, week) => (week === 1 ? key : `${key}-w${week}`);
const weekKeys = (section, week) => itemsOf(section).map((i) => weekKey(i.key, week));

// Weeks that count towards progress: week 1 up to the latest week with any
// tick or note, so a property that sells in week 2 can still reach 100%.
function weeksUsed(listing, section) {
  if (!section.weeks) return 1;
  let used = 1;
  for (const w of range(section.weeks)) {
    if (weekKeys(section, w).some((k) => listing.items?.[k]?.done || listing.items?.[k]?.note)) used = w;
  }
  return used;
}
const sectionKeys = (listing, section) => range(weeksUsed(listing, section)).flatMap((w) => weekKeys(section, w));
const allKeys = (listing, template) => template.flatMap((s) => sectionKeys(listing, s));

function nextStep(listing, template) {
  for (const section of template) {
    for (const w of range(weeksUsed(listing, section))) {
      const next = itemsOf(section).find((i) => !isDone(listing, weekKey(i.key, w)));
      if (next) return `${section.title}${section.weeks ? ` · Week ${w}` : ''} · Next: ${next.text}`;
    }
  }
  return 'All done ✓';
}

function ProgressBar({ value }) {
  return (
    <div className={`lc-bar${value === 100 ? ' complete' : ''}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export default function ListingChecklists() {
  const { id: openId } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [template, setTemplate] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ address: '', seller: '' });
  const [creating, setCreating] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ text: '', error: false });
  // Chosen week tab per weekly section, keyed `${listingId}|${sectionTitle}`
  const [weekTab, setWeekTab] = useState({});

  // Changes not yet on the server: { listingId: { itemKey: { done?, note? } } }
  const pending = useRef({});
  const saveTimer = useRef(null);
  const saveChain = useRef(Promise.resolve());

  const load = useCallback(async () => {
    try {
      const data = await listingChecklistsApi.list();
      setTemplate(data.template);
      setListings(data.listings);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  // Sends every queued change, one request at a time so an older note can
  // never land after a newer one. Failed changes go back in the queue.
  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const batch = pending.current;
    pending.current = {};
    if (!Object.keys(batch).length) return;
    saveChain.current = saveChain.current.then(async () => {
      for (const [id, items] of Object.entries(batch)) {
        try {
          await listingChecklistsApi.update(id, { items });
        } catch (err) {
          if (err.message === 'Listing not found') continue;
          const newer = pending.current[id] || {};
          pending.current[id] = items;
          for (const [k, v] of Object.entries(newer)) pending.current[id][k] = { ...pending.current[id][k], ...v };
          setSaveStatus({ text: 'Couldn’t save — check your connection.', error: true });
          return;
        }
      }
      if (!Object.keys(pending.current).length) setSaveStatus({ text: 'All changes saved ✓', error: false });
    });
  }, []);

  // Save before leaving the page or switching apps on a phone.
  useEffect(() => {
    const onHide = () => { if (document.hidden) flush(); };
    const onUnload = (e) => {
      if (!Object.keys(pending.current).length) return;
      flush();
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      flush();
    };
  }, [flush]);

  function changeItem(listingId, key, patch, delay) {
    setListings((prev) => prev.map((l) => {
      if (l.id !== listingId) return l;
      const item = { done: false, note: '', doneAt: null, ...l.items?.[key] };
      if (patch.done !== undefined && patch.done !== item.done) item.doneAt = patch.done ? new Date().toISOString() : null;
      return { ...l, updated_at: new Date().toISOString(), items: { ...l.items, [key]: { ...item, ...patch } } };
    }));
    const forListing = (pending.current[listingId] = pending.current[listingId] || {});
    forListing[key] = { ...forListing[key], ...patch };
    setSaveStatus({ text: 'Saving…', error: false });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, delay);
  }

  async function createListing(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await listingChecklistsApi.create(form);
      setListings((prev) => [created, ...prev]);
      setForm({ address: '', seller: '' });
      navigate(`/listing-checklists/${created.id}`);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function editDetails(listing) {
    const address = prompt('Property address', listing.address);
    if (address === null) return;
    if (!address.trim()) return show('The address can’t be blank', 'error');
    const seller = prompt('Seller name', listing.seller || '');
    if (seller === null) return;
    try {
      const saved = await listingChecklistsApi.update(listing.id, { address, seller });
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, address: saved.address, seller: saved.seller } : l)));
      show('Details updated', 'success');
    } catch (err) { show(err.message, 'error'); }
  }

  async function deleteListing(listing) {
    if (!confirm(`Delete the checklist for ${listing.address}, including all ticks and notes?\n\nThis cannot be undone.`)) return;
    try {
      await listingChecklistsApi.delete(listing.id);
      delete pending.current[listing.id];
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      navigate('/listing-checklists');
      show('Checklist deleted', 'success');
    } catch (err) { show(err.message, 'error'); }
  }

  const open = openId ? listings.find((l) => String(l.id) === openId) : null;

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">Listing Checklists</h1></div>
        <div className="page-content"><div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>Loading...</div></div>
      </div>
    );
  }

  if (open) {
    const keys = allKeys(open, template);
    const done = countDone(open, keys);
    const percent = pct(done, keys.length);
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Listing Checklist</h1>
          <button className="btn btn-secondary btn-sm" onClick={() => { flush(); navigate('/listing-checklists'); }}>← All listings</button>
        </div>
        <div className="page-content">
          <div className="lc-wrap">
            <h2 className="lc-address">{open.address}</h2>
            <div className="lc-meta">
              {open.seller && <span>Seller: {open.seller}</span>}
              <span>Added {longDate(open.created_at)}</span>
              <span className="lc-meta-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => editDetails(open)}>Edit details</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteListing(open)}>Delete</button>
              </span>
            </div>

            <div className="lc-progress">
              <div className="lc-progress-text"><span>{done} of {keys.length} done</span><span>{percent}%</span></div>
              <ProgressBar value={percent} />
              <div className={`lc-save${saveStatus.error ? ' error' : ''}`}>
                {saveStatus.text}
                {saveStatus.error && <button className="btn btn-ghost btn-sm" onClick={flush}>Try again</button>}
              </div>
            </div>

            {template.map((section) => {
              const secKeys = sectionKeys(open, section);
              const n = countDone(open, secKeys);
              const complete = n === secKeys.length;
              const tabId = `${open.id}|${section.title}`;
              const week = section.weeks ? (weekTab[tabId] || weeksUsed(open, section)) : 1;
              return (
                // Keyed by listing so sections re-open fresh when switching listings
                <details key={`${open.id}-${section.title}`} className={`lc-section card${complete ? ' complete' : ''}`} open={section.weeks ? true : !complete}>
                  <summary>
                    <span className="lc-section-title">{section.title}</span>
                    <span className={`badge ${complete ? 'badge-green' : 'badge-gray'}`}>{n}/{secKeys.length}</span>
                  </summary>
                  {section.weeks && (
                    <div className="lc-weeks" role="tablist" aria-label={`${section.title} week`}>
                      {range(section.weeks).map((w) => {
                        const wk = weekKeys(section, w);
                        const wDone = countDone(open, wk) === wk.length;
                        return (
                          <button
                            key={w}
                            type="button"
                            role="tab"
                            aria-selected={w === week}
                            className={`lc-week${w === week ? ' active' : ''}${wDone ? ' done' : ''}`}
                            onClick={() => setWeekTab((prev) => ({ ...prev, [tabId]: w }))}
                          >
                            Week {w}{wDone ? ' ✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {section.items.map((item) => {
                    if (item.sub) return <div key={item.sub} className="lc-sub">{item.sub}</div>;
                    const key = weekKey(item.key, week);
                    const st = open.items?.[key] || {};
                    return (
                      <div key={key} className={`lc-item${st.done ? ' done' : ''}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!st.done}
                            onChange={(e) => changeItem(open.id, key, { done: e.target.checked }, 0)}
                          />
                          <span>
                            <span className="lc-text">{item.text}</span>
                            {st.done && st.doneAt && <span className="lc-ticked">Ticked {shortDate(st.doneAt)}</span>}
                          </span>
                        </label>
                        <textarea
                          className="form-textarea"
                          rows={1}
                          placeholder={section.weeks ? `Week ${week} notes` : 'Notes'}
                          aria-label={`Notes: ${item.text}${section.weeks ? `, week ${week}` : ''}`}
                          value={st.note || ''}
                          onChange={(e) => changeItem(open.id, key, { note: e.target.value }, 800)}
                          onBlur={flush}
                        />
                      </div>
                    );
                  })}
                  {section.tip && <div className="lc-tip"><strong>Tip:</strong> {section.tip}</div>}
                </details>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Unfinished listings first, most recently worked on at the top.
  const isFinished = (l) => { const k = allKeys(l, template); return countDone(l, k) === k.length; };
  const sorted = [...listings].sort((a, b) => {
    const fa = isFinished(a);
    const fb = isFinished(b);
    if (fa !== fb) return fa ? 1 : -1;
    return a.updated_at < b.updated_at ? 1 : -1;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Listing Checklists</h1>
      </div>
      <div className="page-content">
        <div className="lc-wrap">
          <form className="card card-body lc-add" onSubmit={createListing}>
            <div className="form-group" style={{ flex: '2 1 260px' }}>
              <label className="form-label">Property address *</label>
              <input className="form-input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="e.g. 8 Jindivick Street, Worongary" required />
            </div>
            <div className="form-group" style={{ flex: '1 1 180px' }}>
              <label className="form-label">Seller name</label>
              <input className="form-input" value={form.seller} onChange={(e) => setForm((p) => ({ ...p, seller: e.target.value }))} placeholder="Optional" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating || !form.address.trim()}>
              {creating ? 'Adding...' : '+ Add listing'}
            </button>
          </form>
          <p className="form-hint" style={{ margin: '8px 2px 20px' }}>
            Each listing gets the full Property Listing &amp; Sales Checklist, from appraisal to settlement. Tick items off and add notes as you go; everything saves automatically.
          </p>

          {sorted.length === 0 ? (
            <div className="empty-state card card-body" style={{ padding: 30 }}>
              <p>No listings yet. Add your first one above.</p>
            </div>
          ) : (
            sorted.map((l) => {
              const k = allKeys(l, template);
              const d = countDone(l, k);
              const p = pct(d, k.length);
              return (
                <button key={l.id} className="card lc-card" onClick={() => navigate(`/listing-checklists/${l.id}`)}>
                  <div className="lc-card-row">
                    <span className="lc-card-address">{l.address}</span>
                    <span className="lc-card-pct">{p}%</span>
                  </div>
                  <div className="text-sm text-muted">
                    {l.seller ? `${l.seller} · ` : ''}{d} of {k.length} done · added {shortDate(l.created_at)}
                  </div>
                  <div className="text-sm" style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{nextStep(l, template)}</div>
                  <ProgressBar value={p} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
