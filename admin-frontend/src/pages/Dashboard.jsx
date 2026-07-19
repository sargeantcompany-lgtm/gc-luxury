import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brandsApi, contactsApi, campaignsApi, activityApi } from '../services/api';

const STAGES = ['New', 'Contacted', 'Warm', 'Meeting Booked', 'Listed'];
const STAGE_COLORS = {
  'New': '#64748b', 'Contacted': '#2563eb', 'Warm': '#f59e0b',
  'Meeting Booked': '#8b5cf6', 'Listed': '#10b981'
};

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function activityIcon(type) {
  const map = {
    contact_created: '👤', stage_changed: '🔄', note_added: '📝', dnc_added: '🚫',
    dnc_removed: '✅', import: '📥', campaign_sent: '📧', sms_links_generated: '💬',
  };
  return map[type] || '📋';
}

export default function Dashboard() {
  const [brands, setBrands] = useState([]);
  const [stageCounts, setStageCounts] = useState({});
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalDnc, setTotalDnc] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [brandsData, countsData, contactsData, dncData, actData, campData] = await Promise.all([
          brandsApi.list(),
          contactsApi.pipelineCounts({}),
          contactsApi.list({ limit: 1 }),
          contactsApi.list({ limit: 1, dnc: 'true' }),
          activityApi.list({ limit: 8 }),
          campaignsApi.list({ limit: 5 }),
        ]);
        setBrands(brandsData);
        setStageCounts(countsData);
        setTotalContacts(contactsData.total || 0);
        setTotalDnc(dncData.total || 0);
        setRecentActivity(actData.items || []);
        setCampaigns(campData.campaigns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>
    </div>
  );

  const totalStageContacts = Object.values(stageCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/contacts" className="btn btn-secondary btn-sm">Add Contact</Link>
          <Link to="/campaigns" className="btn btn-primary btn-sm">New Campaign</Link>
        </div>
      </div>

      <div className="page-content">
        {/* Stat Cards */}
        <div className="grid-4 mb-4">
          <div className="stat-card">
            <div className="stat-value">{totalContacts.toLocaleString()}</div>
            <div className="stat-label">Total Contacts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stageCounts['Listed'] || 0}</div>
            <div className="stat-label">Listed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{stageCounts['Meeting Booked'] || 0}</div>
            <div className="stat-label">Meetings Booked</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{totalDnc}</div>
            <div className="stat-label">Do Not Contact</div>
          </div>
        </div>

        <div className="grid-2 gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Pipeline Overview */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pipeline Overview</span>
              <Link to="/pipeline" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>View Board →</Link>
            </div>
            <div className="card-body">
              {STAGES.map(stage => {
                const count = stageCounts[stage] || 0;
                const pct = totalStageContacts > 0 ? (count / totalStageContacts) * 100 : 0;
                return (
                  <div key={stage} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{stage}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: STAGE_COLORS[stage], borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brands */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Brands</span>
              <Link to="/settings" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>Manage →</Link>
            </div>
            <div className="card-body">
              {brands.length === 0 ? (
                <div className="empty-state"><p>No brands configured</p></div>
              ) : (
                brands.map(brand => (
                  <div key={brand.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: brand.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{brand.name}</span>
                    <Link to={`/contacts?brand_id=${brand.id}`} style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
                      View contacts →
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid-2 gap-4" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Recent Activity */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Activity</span>
              <Link to="/activity" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>View all →</Link>
            </div>
            <div className="card-body" style={{ padding: '0 20px' }}>
              {recentActivity.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}><p>No activity yet</p></div>
              ) : (
                <div className="activity-list">
                  {recentActivity.map(item => (
                    <div key={item.id} className="activity-item">
                      <div className="activity-icon" style={{ background: 'var(--bg)', fontSize: 14 }}>
                        {activityIcon(item.type)}
                      </div>
                      <div className="activity-content">
                        <div className="activity-desc">{item.description}</div>
                        <div className="activity-meta">
                          {item.brand_name && <span style={{ color: item.brand_color }}>{item.brand_name} · </span>}
                          {formatDate(item.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Campaigns</span>
              <Link to="/campaigns" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>View all →</Link>
            </div>
            <div className="card-body">
              {campaigns.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 0' }}><p>No campaigns yet</p></div>
              ) : (
                campaigns.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {c.type.toUpperCase()} · {c.brand_name || 'All'} · {c.sent_count || 0} sent
                      </div>
                    </div>
                    <span className={`badge ${c.status === 'sent' ? 'badge-green' : c.status === 'sending' ? 'badge-yellow' : 'badge-gray'}`}>
                      {c.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
