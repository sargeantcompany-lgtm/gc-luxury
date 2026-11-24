import React, { useEffect, useRef, useState } from 'react';
import { workingListApi } from '../services/api';
import { useToast } from '../components/Toast';
import './WorkingList.css';

const today = new Date().toISOString().slice(0, 10);

function personalise(message, name, link) {
  return message
    .replaceAll('{{name}}', String(name || '').split(' ')[0])
    .replaceAll('{{link}}', link);
}

function smsPhone(phone) {
  let digits = String(phone || '').replace(/[^+0-9]/g, '');
  if (digits.startsWith('0')) digits = '+61' + digits.slice(1);
  return digits;
}

export default function WorkingList() {
  const { show } = useToast();
  const [people, setPeople] = useState([]);
  const [total, setTotal] = useState(0);
  const [lists, setLists] = useState([]);
  const [selectedListName, setSelectedListName] = useState('Owners & Mobiles');
  const [groups, setGroups] = useState([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [offset, setOffset] = useState(0);
  const [summerAuctionLink, setSummerAuctionLink] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', suburb: '', address: '', details: '', listName: 'Owners & Mobiles' });
  const [editing, setEditing] = useState(null);
  const messageInput = useRef(null);
  const ownerFileInput = useRef(null);

  async function load(query = search, reset = true, group = selectedGroup, listName = selectedListName) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const data = await workingListApi.people({ search: query, group, listName, limit: 50, offset: nextOffset });
      setPeople((current) => reset ? data.people : [...current, ...data.people]);
      setTotal(data.total);
      setOffset(nextOffset + data.people.length);
    } catch (error) {
      show(error.message, 'error');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }

  async function loadGroups(listName = selectedListName) {
    try {
      const data = await workingListApi.groups(listName);
      setGroups(data.groups);
      setGroupTotal(data.total);
    } catch (error) {
      show(error.message, 'error');
    }
  }

  async function importOwnerFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await workingListApi.importContacts(file, selectedListName);
      setSelectedGroup('all');
      await Promise.all([
        loadGroups(selectedListName),
        load(search, true, 'all', selectedListName),
        workingListApi.lists().then((data) => setLists(data.lists)),
      ]);
      const duplicates = result.duplicates ? `; combined ${result.duplicates} repeated entries` : '';
      show(`Imported ${result.imported} contacts into ${result.listName}; skipped ${result.skipped} rows without a usable name and mobile${duplicates}.`, 'success');
    } catch (error) {
      show(error.message, 'error');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }

  useEffect(() => {
    Promise.all([
      workingListApi.people({ group: 'all', listName: 'Owners & Mobiles', limit: 50 }),
      workingListApi.template(today),
      workingListApi.groups('Owners & Mobiles'),
      workingListApi.lists(),
    ])
      .then(([peopleData, template, groupData, listData]) => {
        setPeople(peopleData.people);
        setTotal(peopleData.total);
        setOffset(peopleData.people.length);
        setGroups(groupData.groups);
        setGroupTotal(groupData.total);
        setLists(listData.lists);
        setMessage(template.message);
        setSavedMessage(template.message);
      })
      .catch((error) => show(error.message, 'error'))
      .finally(() => setLoading(false));
    workingListApi.summerAuctionLink()
      .then((data) => setSummerAuctionLink(data.url))
      .catch((error) => show(error.message, 'error'));
  }, []);

  async function saveTemplate() {
    try {
      await workingListApi.saveTemplate({ date: today, message });
      setSavedMessage(message);
      show("Today's text saved", 'success');
    } catch (error) {
      show(error.message, 'error');
    }
  }

  function openForm(person = null) {
    setEditing(person?.id || 'new');
    setForm(person
      ? { name: person.name || '', phone: person.phone || '', email: person.email || '', suburb: person.suburb || '', address: person.address || '', details: person.details || '', listName: person.list_name || selectedListName }
      : { name: '', phone: '', email: '', suburb: '', address: '', details: '', listName: selectedListName });
  }

  async function savePerson(event) {
    event.preventDefault();
    try {
      const listName = form.listName.trim();
      if (editing === 'new') await workingListApi.create(form);
      else await workingListApi.update(editing, form);
      setEditing(null);
      setSelectedListName(listName);
      setSelectedGroup('all');
      await Promise.all([
        workingListApi.lists().then((data) => setLists(data.lists)),
        loadGroups(listName),
        load(search, true, 'all', listName),
      ]);
      show('Contact saved', 'success');
    } catch (error) {
      show(error.message, 'error');
    }
  }

  async function deletePerson(person) {
    if (!window.confirm(`Delete ${person.name}?`)) return;
    try {
      await workingListApi.delete(person.id);
      await Promise.all([
        workingListApi.lists().then((data) => setLists(data.lists)),
        loadGroups(),
        load(search, true, selectedGroup),
      ]);
      show('Contact deleted', 'success');
    } catch (error) {
      show(error.message, 'error');
    }
  }

  async function sendText(person) {
    if (message.includes('{{link}}') && !summerAuctionLink) {
      show('The private page link is unavailable. Try again before sending this text.', 'error');
      return;
    }
    const text = personalise(message, person.name, summerAuctionLink);
    try {
      await workingListApi.logSend(person.id, text);
    } catch (error) {
      show(error.message, 'error');
    }
    const phone = smsPhone(person.phone);
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(text)}`;
  }

  function insertMessagePlaceholder(placeholder) {
    const input = messageInput.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    setMessage(`${message.slice(0, start)}${placeholder}${message.slice(end)}`);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  function insertSummerAuctionLink() {
    insertMessagePlaceholder('{{link}}');
  }

  async function copySummerAuctionLink() {
    try {
      await navigator.clipboard.writeText(summerAuctionLink);
      show('Private page link copied', 'success');
    } catch {
      show('Could not copy the link. Select and copy it manually.', 'error');
    }
  }

  async function rotateSummerAuctionLink() {
    if (!window.confirm('Create a new private link? The current link will stop working.')) return;
    try {
      const data = await workingListApi.rotateSummerAuctionLink();
      setSummerAuctionLink(data.url);
      show('Private page link replaced', 'success');
    } catch (error) {
      show(error.message, 'error');
    }
  }

  const searchPeople = (event) => {
    event.preventDefault();
    load(search, true, selectedGroup);
  };

  function selectGroup(group) {
    setSelectedGroup(group);
    load(search, true, group);
  };

  function selectList(listName) {
    setSelectedListName(listName);
    setSelectedGroup('all');
    loadGroups(listName);
    load(search, true, 'all', listName);
  }

  function createList() {
    const listName = window.prompt('Name the SMS list:');
    if (!listName?.trim()) return;
    selectList(listName.trim());
  }

  return (
    <div className="page working-list-page">
      <div className="page-header">
        <div>
          <h1>Working List</h1>
          <p className="page-subtitle">Daily GC Luxury text outreach</p>
        </div>
        <div className="working-list-header-actions">
          <input
            ref={ownerFileInput}
            type="file"
            accept=".csv,.xlsx"
            onChange={importOwnerFile}
            style={{ display: 'none' }}
          />
          <button className="btn btn-secondary" type="button" onClick={() => ownerFileInput.current?.click()} disabled={importing}>
            {importing ? 'Importing...' : 'Import CSV to selected list'}
          </button>
          <button className="btn btn-primary" type="button" onClick={() => openForm()}>Add contact</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Today's text</div>
            <div className="form-hint">Use {'{{name}}'} for their first name and {'{{link}}'} for the private page link.</div>
          </div>
          {message !== savedMessage && <span className="badge badge-yellow">Unsaved</span>}
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Summer Auction Experience Letter — private link</label>
            <div className="working-list-link-row">
              <input className="form-input" value={summerAuctionLink} readOnly aria-label="Private Summer Auction page link" />
              <button className="btn btn-secondary" type="button" onClick={copySummerAuctionLink} disabled={!summerAuctionLink}>Copy</button>
              <button className="btn btn-ghost" type="button" onClick={rotateSummerAuctionLink}>New link</button>
            </div>
            <div className="form-hint">Anyone with the URL can view it. Creating a new link invalidates the current one.</div>
          </div>
          <textarea
            className="form-textarea"
            rows="5"
            ref={messageInput}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the text you want to send today"
          />
          <div className="working-list-message-actions">
            <button className="btn btn-secondary" type="button" onClick={() => insertMessagePlaceholder('{{name}}')}>
              Insert first name
            </button>
            <button className="btn btn-ghost" type="button" onClick={insertSummerAuctionLink} disabled={!summerAuctionLink}>
              Insert private page link
            </button>
          </div>
          <button className="btn btn-secondary" type="button" onClick={saveTemplate} disabled={message === savedMessage}>
            Save today's text
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Owner SMS contacts</div>
            <div className="form-hint">{total.toLocaleString()} contacts · {selectedListName}</div>
          </div>
          <form onSubmit={searchPeople} className="working-list-search">
            <input
              className="form-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, suburb or address"
            />
            <button className="btn btn-secondary" type="submit">Search</button>
          </form>
        </div>

        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="working-list-list-tools">
            <div className="working-list-list-tabs" role="group" aria-label="SMS lists">
              {!lists.some((list) => list.name === selectedListName) && (
                <button
                  type="button"
                  aria-pressed="true"
                  className="working-list-list-tab active"
                  onClick={() => selectList(selectedListName)}
                >
                  <span>{selectedListName} (new)</span><b>0</b>
                </button>
              )}
              {lists.map((list) => (
                <button
                  key={list.name}
                  type="button"
                  aria-pressed={selectedListName === list.name}
                  className={`working-list-list-tab${selectedListName === list.name ? ' active' : ''}`}
                  onClick={() => selectList(list.name)}
                >
                  <span>{list.name}</span><b>{list.count.toLocaleString()}</b>
                </button>
              ))}
            </div>
            <button className="btn btn-secondary working-list-new-list" type="button" onClick={createList}>+ New SMS list</button>
          </div>
          <div className="form-hint working-list-category-hint">
            {selectedListName === 'Buyers'
              ? 'Buyer contacts stay together · tap a name to open a text'
              : 'Contact categories · tap a name to open a text'}
          </div>
          <div className="working-list-groups" role="group" aria-label="Contact categories">
            <button
              className={selectedGroup === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              type="button"
              onClick={() => selectGroup('all')}
            >
              All contacts ({groupTotal})
            </button>
            {groups.map((group) => (
              <button
                key={group.key}
                className={selectedGroup === group.key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                type="button"
                onClick={() => selectGroup(group.key)}
              >
                {group.label} ({group.count})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="card-body">Loading...</div>
        ) : (
          <div className="table-wrap working-list-people-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th>
                  {selectedListName === 'Buyers'
                    ? <th>Email</th>
                    : <><th>Suburb</th><th>Address</th></>}
                  <th>Details</th><th></th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => sendText(person)}
                        style={{ border: 0, background: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        {person.name}
                      </button>
                    </td>
                    <td>{person.phone}</td>
                    {selectedListName === 'Buyers'
                      ? <td>{person.email || ''}</td>
                      : <><td>{person.suburb || 'Other / unassigned'}</td><td>{person.address || ''}</td></>}
                    <td style={{ maxWidth: 480 }}>{person.details || ''}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openForm(person)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => deletePerson(person)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!people.length && <tr><td colSpan={selectedListName === 'Buyers' ? 5 : 6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No contacts found</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="working-list-people-mobile">
            {people.map((person) => (
              <article className="working-list-person-card" key={person.id}>
                <button
                  type="button"
                  className="working-list-send-button"
                  onClick={() => sendText(person)}
                  aria-label={`Text ${person.name} at ${person.phone}`}
                >
                  <span>{person.name}</span>
                  <small>Tap to text · {person.phone}</small>
                </button>
                <dl className="working-list-person-details">
                  {selectedListName !== 'Buyers' && <div><dt>Suburb</dt><dd>{person.suburb || 'Other / unassigned'}</dd></div>}
                  {person.address && <div><dt>Property</dt><dd>{person.address}</dd></div>}
                  {person.email && <div><dt>Email</dt><dd>{person.email}</dd></div>}
                  {person.details && <div><dt>Details</dt><dd>{person.details}</dd></div>}
                </dl>
                <div className="working-list-person-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => openForm(person)}>Edit</button>
                  <button className="btn btn-ghost" type="button" onClick={() => deletePerson(person)}>Delete</button>
                </div>
              </article>
            ))}
            {!people.length && <p className="working-list-empty">No contacts found</p>}
          </div>
        )}

        {!loading && (
          <div className="working-list-pagination-summary">
            Showing {people.length.toLocaleString()} of {total.toLocaleString()} contacts in this view
          </div>
        )}

        {people.length < total && (
          <div className="card-body" style={{ textAlign: 'center' }}>
            <button className="btn btn-secondary working-list-load-more" type="button" onClick={() => load(search, false, selectedGroup)} disabled={loading || loadingMore}>
              {loading || loadingMore ? 'Loading contacts…' : `Load next 50 contacts · ${(total - people.length).toLocaleString()} remaining`}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
          <form className="modal" onSubmit={savePerson} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>{editing === 'new' ? 'Add contact' : 'Edit contact'}</h2>
              <button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Suburb</label><input className="form-input" value={form.suburb} onChange={(event) => setForm({ ...form, suburb: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Property address</label><input className="form-input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">SMS list</label><input className="form-input" required maxLength="120" value={form.listName} onChange={(event) => setForm({ ...form, listName: event.target.value })} /></div>
              <div className="form-group"><label className="form-label">Details</label><textarea className="form-textarea" rows="5" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit">Save contact</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
