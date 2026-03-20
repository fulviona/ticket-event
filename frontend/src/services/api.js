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
export const getLeaderboard = () => api.get('/users/leaderboard');
export const getAllUsers = () => api.get('/users/all');

// Tickets
export const uploadTicket = (formData) =>
  api.post('/tickets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getMyTickets = () => api.get('/tickets/my');
export const getAllTickets = () => api.get('/tickets/all');
export const updateTicketStatus = (id, status) => api.patch(`/tickets/${id}/status`, { status });

// Events
export const getEvents = () => api.get('/events');
export const createEvent = (data) => api.post('/events', data);
export const updateEvent = (id, data) => api.put(`/events/${id}`, data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const importEvents = (events) => api.post('/events/import', { events });

export default api;
