import axios from 'axios';

const ADMIN_KEY_STORAGE = 'connector_admin_key';

const api = axios.create({
  baseURL: '/api/connector/admin',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const key = localStorage.getItem(ADMIN_KEY_STORAGE);
  if (key) config.headers['x-admin-key'] = key;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || '';
}

export function setAdminKey(key) {
  localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
}

export const adminApi = {
  listings: () => api.get('/listings'),
  addOffMarket: (data) => api.post('/listings/off-market', data),
  fetchPreview: (url) => api.post('/listings/fetch-preview', { url }),
  addConnectorMatch: (data) => api.post('/listings/connector-match', data),
  updateListing: (id, data) => api.put(`/listings/${id}`, data),
  deleteListing: (id) => api.delete(`/listings/${id}`),

  valuations: () => api.get('/valuations'),
  fulfilValuation: (id, reportUrl) => api.post(`/valuations/${id}/fulfil`, { reportUrl }),

  buyers: () => api.get('/buyers'),
  buyer: (id) => api.get(`/buyers/${id}`),
  deleteBuyer: (id) => api.delete(`/buyers/${id}`),
  availableListingsForBuyer: (id) => api.get(`/buyers/${id}/available-listings`),
  assignListing: (buyerId, listingId, note) => api.post(`/buyers/${buyerId}/assign/${listingId}`, { note }),
  unassignListing: (buyerId, listingId) => api.delete(`/buyers/${buyerId}/assign/${listingId}`),
  availableForTopFive: (buyerId) => api.get(`/buyers/${buyerId}/available-for-top-five`),
  pinToTopFive: (buyerId, listingId) => api.post(`/buyers/${buyerId}/top-five/${listingId}`),
  unpinFromTopFive: (buyerId, listingId) => api.delete(`/buyers/${buyerId}/top-five/${listingId}`),
  exportCsvUrl: () => `/api/connector/admin/buyers/export.csv`,

  agents: () => api.get('/agents'),
  addAgent: (data) => api.post('/agents', data),
  deleteAgent: (id) => api.delete(`/agents/${id}`),
};

export default api;
