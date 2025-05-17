// src/axiosConfig.js
import axios from 'axios';

// Configure axios defaults
const axiosInstance = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true
});

// Attach auth token if present
const token = localStorage.getItem('token');
if (token) {
  axiosInstance.defaults.headers.common['Authorization'] = `Token ${token}`;
}

// Add request interceptor for debugging
axiosInstance.interceptors.request.use(
  config => {
    console.log('API Request:', config.method.toUpperCase(), config.url, config.data);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axiosInstance.interceptors.response.use(
  response => {
    console.log('API Response:', response.status, response.data);
    return response;
  },
  error => {
    if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('tokenExpiry');
        delete axiosInstance.defaults.headers.common['Authorization'];
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      console.error('API Error Request:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Summarize a node by nodeId.
 * Returns the summary text from the backend.
 */
export const summarizeNode = async (nodeId) => {
  const response = await axiosInstance.post(`/nodes/${nodeId}/summarize/`);
  return response.data.summary;
};

export default axiosInstance;

// Special axios instance for registration and login (no credentials/cookies sent)
export const registerOrLogin = async (endpoint, data) => {
  const instance = axios.create({
    baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: false // Do NOT send cookies/credentials for auth endpoints
  });
  return instance.post(endpoint, data);
};