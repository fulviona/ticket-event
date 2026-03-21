import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// Users
export const getMe = () => api.get('/users/me');
export const updateProfile = (data) => api.patch('/users/me', data);
export const getLeaderboard = () => api.get('/users/leaderboard');
export const getAllUsers = () => api.get('/users/all');

// Admin - Users
export const updateUserAlias = (id, alias) => api.patch(`/users/${id}/alias`, { alias });
export const toggleBlockUser = (id) => api.patch(`/users/${id}/block`);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const sendTempPassword = (id) => api.patch(`/users/${id}/temp-password`);
export const exportUsersExcel = () => api.get('/users/export/excel', { responseType: 'blob' });

// Tickets
export const uploadTicket = (formData) =>
  api.post('/tickets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getMyTickets = () => api.get('/tickets/my');
export const getSharedTickets = () => api.get('/tickets/shared');
export const toggleShareTicket = (id) => api.patch(`/tickets/${id}/share`);
export const getBachecaUsers = () => api.get('/tickets/bacheca/users');
export const getBachecaUserTickets = (userId) => api.get(`/tickets/bacheca/user/${userId}`);
export const getAllTickets = () => api.get('/tickets/all');
export const updateTicketStatus = (id, status) => api.patch(`/tickets/${id}/status`, { status });
export const editTicket = (id, data) => api.patch(`/tickets/${id}/edit`, data);
export const deleteTicket = (id) => api.delete(`/tickets/${id}`);
export const reparseTicket = (id) => api.patch(`/tickets/${id}/reparse`);
export const importTicketUrl = (url) => api.post('/tickets/import-url', { url });
export const importTicketText = (text, sourceUrl) => api.post('/tickets/import-text', { text, sourceUrl });

// Events
export const getEvents = () => api.get('/events');
export const createEvent = (data) => api.post('/events', data);
export const updateEvent = (id, data) => api.put(`/events/${id}`, data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const importEvents = (events) => api.post('/events/import', { events });

// Analytics
export const getAnalytics = (date) => api.get('/analytics', { params: { date } });

export default api;
