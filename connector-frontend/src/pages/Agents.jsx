import React, { useEffect, useState } from 'react';
import { connectorApi } from '../services/api';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    connectorApi.agents()
      .then(({ agents }) => setAgents(agents))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Agent Directory</h1>
      <p className="page-sub">Reach out directly, any time.</p>

      {loading && <p className="loading">Loading…</p>}
      {error && <p className="msg error">{error}</p>}

      {!loading && !error && agents.length === 0 && (
        <div className="empty-state">No agents listed yet.</div>
      )}

      {agents.length > 0 && (
        <div className="card">
          {agents.map((a) => (
            <div className="agent-row" key={a.id}>
              <div>
                <div className="agent-name">{a.name}</div>
                <div className="agent-meta">{a.agency}</div>
              </div>
              <div className="agent-meta">{a.phone}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
