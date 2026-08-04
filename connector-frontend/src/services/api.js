import axios from 'axios';

const api = axios.create({
  baseURL: '/api/connector',
  timeout: 20000,
  withCredentials: true,
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);

export const connectorApi = {
  join: (data) => api.post('/join', data),
  me: () => api.get('/me'),
  getBrief: () => api.get('/brief'),
  saveBrief: (data) => api.put('/brief', data),
  topFive: () => api.get('/top-five'),
  offMarket: () => api.get('/off-market'),
  matches: () => api.get('/matches'),
  saved: () => api.get('/saved'),
  save: (listingId) => api.post(`/save/${listingId}`),
  unsave: (listingId) => api.delete(`/save/${listingId}`),
  agents: () => api.get('/agents'),
  myValuations: () => api.get('/valuations'),
  requestValuation: (listingId) => api.post(`/valuations/${listingId}`),
};

export default api;
