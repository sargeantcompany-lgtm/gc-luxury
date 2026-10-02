import React, { useState, useEffect, useCallback } from 'react';
import { gcBlogApi } from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

const emptyForm = {
  title: '', slug: '', excerpt: '', cover_image: '', body: '', status: 'draft',
};

const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
};

function toForm(post) {
  return {
    title: post.title,
    slug: post.slug || '',
    excerpt: post.excerpt || '',
    cover_image: post.cover_image || '',
    body: post.body || '',
    status: post.status,
  };
}

export default function GcBlog() {
  const { show } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gcBlogApi.list();
      setPosts(data);
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditPost(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(post) {
    setEditPost(post);
    setForm(toForm(post));
    setShowForm(true);
  }

  async function savePost(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editPost) {
        await gcBlogApi.update(editPost.id, form);
        show('Post updated', 'success');
      } else {
        await gcBlogApi.create(form);
        show('Post created', 'success');
      }
      setShowForm(false);
      setEditPost(null);
      load();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
      await gcBlogApi.delete(id);
      show('Post deleted', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  }

  const visible = statusFilter ? posts.filter((p) => p.status === statusFilter) : posts;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">GC Luxury Blog</h1>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Post</button>
      </div>

      <div className="page-content">
        <div className="toolbar mb-4">
          <div style={{ display: 'flex', gap: 6 }}>
            {['', 'published', 'draft'].map((s) => (
              <button key={s} className={`chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === '' ? 'All' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading posts...</div>
        ) : visible.length === 0 ? (
          <div className="empty-state card card-body" style={{ padding: 30 }}>
            <p>No posts yet — publish one to have it appear on the public site's Blog.</p>
          </div>
        ) : (
          visible.map((post) => (
            <div className="card" key={post.id} style={{ marginBottom: 12 }}>
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{post.title}</span>
                    <span className="badge">{STATUS_LABELS[post.status]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    /post.html?slug={post.slug}
                    {post.published_at && <> &middot; Published {new Date(post.published_at).toLocaleDateString('en-AU')}</>}
                  </div>
                  {post.excerpt && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', maxHeight: 36,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {post.excerpt}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                  {post.status === 'published' && (
                    <a className="btn btn-ghost btn-sm btn-icon" title="View on site" href={`/post.html?slug=${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer">👁️</a>
                  )}
                  <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => openEdit(post)}>✏️</button>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Delete" onClick={() => deletePost(post.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditPost(null); }}
        title={editPost ? 'Edit Post' : 'New Post'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditPost(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={savePost} disabled={saving || !form.title}>
              {saving ? 'Saving...' : editPost ? 'Save Changes' : 'Create Post'}
            </button>
          </>
        }
      >
        <div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Why waterfront holds its value" required />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              URL Slug
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Optional - generated from the title if left blank</span>
            </label>
            <input className="form-input" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="why-waterfront-holds-its-value" />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              Excerpt
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Short summary shown on the article card</span>
            </label>
            <textarea className="form-textarea" style={{ minHeight: 60 }} value={form.excerpt} onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))} />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">Cover Image URL</label>
            <input className="form-input" value={form.cover_image} onChange={(e) => setForm((p) => ({ ...p, cover_image: e.target.value }))} placeholder="https://..." />
          </div>

          <div className="form-group mt-3">
            <label className="form-label">
              Article
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Leave a blank line between paragraphs. Start a line with "## " for a subheading.</span>
            </label>
            <textarea className="form-textarea" style={{ minHeight: 280 }} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
