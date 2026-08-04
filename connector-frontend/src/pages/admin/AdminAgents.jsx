import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ name: '', agency: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { agents } = await adminApi.agents();
      setAgents(agents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminApi.addAgent(form);
      setForm({ name: '', agency: '', phone: '', email: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.deleteAgent(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Agent Directory</h1>
      {error && <p className="msg error">{error}</p>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Agency</label>
            <input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add Agent'}
          </button>
        </form>
      </div>

      {loading && <p className="loading">Loading…</p>}
      <div className="card" style={{ padding: 0 }}>
        {agents.map((a) => (
          <div className="agent-row" key={a.id}>
            <div>
              <div className="agent-name">{a.name}</div>
              <div className="agent-meta">{a.agency} · {a.phone}</div>
            </div>
            <button className="save-btn" onClick={() => handleDelete(a.id)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
