// src/utils/api.js
import axios from 'axios';
import sessionManager from './SessionManager';

// API service with base URL configuration
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Track failed requests that should be retried after token refresh
const failedQueue = [];

// Process all requests from the failed queue
const processQueue = (error = null) => {
  // If there was an error refreshing the token, reject all requests
  if (error) {
    failedQueue.forEach(promise => {
      promise.reject(error);
    });
  } else {
    // Otherwise, retry each request with the new token
    failedQueue.forEach(promise => {
      promise.resolve();
    });
  }

  // Clear the queue
  failedQueue.length = 0;
};

// Request interceptor - runs before each request
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');

    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - runs after each response
api.interceptors.response.use(
  (response) => {
    // Successful response handler
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error is because of an expired token (401 Unauthorized)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Only proceed with session expiry once regardless of how many requests fail
      // The sessionManager will handle the redirection
      sessionManager.handleSessionExpired();

      // Reject the original request
      return Promise.reject(new Error('Session expired'));
    }

    // For all other errors, just return the error
    return Promise.reject(error);
  }
);

// Set auth token for API requests
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
    // Reset session timers when token is set
    sessionManager.resetSessionTimers();
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
    localStorage.removeItem('userData'); // Also clear user data when token is removed
  }
};

// Store user data
export const setUserData = (userData) => {
  if (userData) {
    localStorage.setItem('userData', JSON.stringify(userData));
  } else {
    localStorage.removeItem('userData');
  }
};

// Get user data
export const getUserData = () => {
  const userData = localStorage.getItem('userData');
  return userData ? JSON.parse(userData) : null;
};

// Check if user is admin
export const isAdmin = () => {
  const userData = getUserData();
  return userData && userData.role === 'admin';
};

// Check if token is valid by making a verification request
export const verifyToken = async () => {
  try {
    await api.get('/auth/verify');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token is invalid, clear it
      setAuthToken(null);
      // Let the session manager handle the expired session
      sessionManager.handleSessionExpired();
    }
    return false;
  }
};

// Helper functions for common API operations
export const apiHelpers = {
  // Fetch data with error handling
  async fetchData(url, options = {}) {
    try {
      const response = await api.get(url, options);
      return { data: response.data, error: null };
    } catch (error) {
      console.error(`Error fetching data from ${url}:`, error);
      return {
        data: null,
        error: error.response?.data?.message || error.message || 'An error occurred'
      };
    }
  },

  // Submit data with error handling
  async submitData(url, data, method = 'post', options = {}) {
    try {
      const response = await api[method.toLowerCase()](url, data, options);
      return { data: response.data, error: null };
    } catch (error) {
      console.error(`Error submitting data to ${url}:`, error);
      return {
        data: null,
        error: error.response?.data?.message || error.message || 'An error occurred'
      };
    }
  }
};

// Load token from localStorage on startup
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Initialize session manager
sessionManager.initialize();

export default api;
