import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

// ── Brands ──────────────────────────────────────────────────────
export const brandsApi = {
  list: () => api.get('/brands'),
  get: (id) => api.get(`/brands/${id}`),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  delete: (id) => api.delete(`/brands/${id}`),
  stats: (id) => api.get(`/brands/${id}/stats`),
};

// ── Contacts ─────────────────────────────────────────────────────
export const contactsApi = {
  list: (params) => api.get('/contacts', { params }),
  get: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  bulkDelete: (ids) => api.post('/contacts/bulk-delete', { ids }),
  bulkStage: (ids, stage) => api.post('/contacts/bulk-stage', { ids, stage }),
  updateStage: (id, stage) => api.patch(`/contacts/${id}/stage`, { stage }),
  pipelineCounts: (params) => api.get('/contacts/pipeline-counts', { params }),
  export: (params) => {
    const query = new URLSearchParams(params).toString();
    window.location.href = `/api/contacts/export?${query}`;
  },
  import: (formData) => api.post('/contacts/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  // Notes
  getNotes: (id) => api.get(`/contacts/${id}/notes`),
  addNote: (id, data) => api.post(`/contacts/${id}/notes`, data),
  deleteNote: (id, noteId) => api.delete(`/contacts/${id}/notes/${noteId}`),
  // DNC
  addDnc: (id, reason) => api.post(`/contacts/${id}/dnc`, { reason }),
  removeDnc: (id) => api.delete(`/contacts/${id}/dnc`),
};

// ── Campaigns ────────────────────────────────────────────────────
export const campaignsApi = {
  list: (params) => api.get('/campaigns', { params }),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  preview: (id) => api.post(`/campaigns/${id}/preview`),
  send: (id) => api.post(`/campaigns/${id}/send`),
  smsLinks: (id) => api.post(`/campaigns/${id}/sms-links`),
  results: (id) => api.get(`/campaigns/${id}/results`),
};

// ── Templates ────────────────────────────────────────────────────
export const templatesApi = {
  list: (params) => api.get('/templates', { params }),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

// ── Activity ─────────────────────────────────────────────────────
export const activityApi = {
  list: (params) => api.get('/activity', { params }),
  types: () => api.get('/activity/types'),
  log: (data) => api.post('/activity', data),
};

// ── Settings ─────────────────────────────────────────────────────
export const settingsApi = {
  getSmtp: (brandId) => api.get(`/settings/smtp/${brandId}`),
  getAllSmtp: () => api.get('/settings/smtp'),
  saveSmtp: (data) => api.post('/settings/smtp', data),
  testSmtp: (brandId, toEmail) => api.post('/settings/smtp/test', { brand_id: brandId, to_email: toEmail }),
  deleteSmtp: (brandId) => api.delete(`/settings/smtp/${brandId}`),
};

export default api;
