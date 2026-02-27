import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for AI calls
});

// Hotels
export const hotelsApi = {
  list: () => api.get('/hotels').then(r => r.data),
  get: (id: string) => api.get(`/hotels/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/hotels', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/hotels/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/hotels/${id}`).then(r => r.data),
  scrape: (id: string) => api.post(`/hotels/${id}/scrape`).then(r => r.data),
};

// Photos
export const photosApi = {
  list: (hotelId: string) => api.get(`/hotels/${hotelId}/photos`).then(r => r.data),
  upload: (hotelId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));
    return api.post(`/hotels/${hotelId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  analyze: (hotelId: string, photoId: string) =>
    api.post(`/hotels/${hotelId}/photos/${photoId}/analyze`).then(r => r.data),
  delete: (hotelId: string, photoId: string) =>
    api.delete(`/hotels/${hotelId}/photos/${photoId}`).then(r => r.data),
};

// Posts
export const postsApi = {
  list: (params?: { status?: string; hotel_id?: string }) =>
    api.get('/posts', { params }).then(r => r.data),
  get: (id: string) => api.get(`/posts/${id}`).then(r => r.data),
  generateBatch: (data: { hotel_ids: string[]; platform: string }) =>
    api.post('/posts/generate/batch', data).then(r => r.data),
  generateManual: (data: Record<string, unknown>) =>
    api.post('/posts/generate/manual', data).then(r => r.data),
  generateIdea: (data: Record<string, unknown>) =>
    api.post('/posts/generate/idea', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/posts/${id}`, data).then(r => r.data),
  approve: (id: string) => api.post(`/posts/${id}/approve`).then(r => r.data),
  unapprove: (id: string) => api.post(`/posts/${id}/unapprove`).then(r => r.data),
  translate: (id: string) => api.post(`/posts/${id}/translate`).then(r => r.data),
  toggleBilingual: (id: string) => api.post(`/posts/${id}/toggle-bilingual`).then(r => r.data),
  delete: (id: string) => api.delete(`/posts/${id}`).then(r => r.data),
};

// Stock images
export const imagesApi = {
  search: (q: string, per_page = 12) =>
    api.get('/images/search', { params: { q, per_page } }).then(r => r.data),
};

// Health
export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
};

export default api;
