// src/utils/api.js
import axios from 'axios';
import sessionManager from './SessionManager';

// Define base URL with protocol and host detection
const getBaseUrl = () => {
  // Check if running in production (on the digital ocean server)
  const hostname = window.location.hostname;

  // Production domains
  if (hostname === '207.154.221.54' || hostname === 'shefaug.com' || hostname === 'www.shefaug.com') {
    return 'https://www.shefaug.com/api'; // Use HTTPS and your domain
  }
  // Local development
  return 'http://localhost:5001/api';
};

// API service with dynamic base URL configuration
const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies/credentials
});

// Track if we are currently handling a session expiration
let isHandlingSessionExpiration = false;
// Debounce the expiration handling to prevent multiple expiry alerts
let expirationDebounceTimer = null;

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
    // Successful response handler - reset the flag after successful calls
    isHandlingSessionExpiration = false;
    return response;
  },
  async (error) => {
    // Network errors should not trigger session expiration
    if (!error.response) {
      return Promise.reject(error);
    }

    // If the error is because of an expired token (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      // Clear any pending debounce timers
      if (expirationDebounceTimer) {
        clearTimeout(expirationDebounceTimer);
      }

      // Use debounce to prevent multiple rapid expiration handlers
      expirationDebounceTimer = setTimeout(() => {
        if (!isHandlingSessionExpiration) {
          // Set the flag to prevent multiple expiration handlers from running
          isHandlingSessionExpiration = true;

          try {
            // Let the session manager handle the expiration
            sessionManager.handleSessionExpired();
          } catch (e) {
            console.error('Error handling session expiration:', e);
          }
        }
      }, 1000); // 1 second debounce

      // Return a rejected promise with a clear message
      return Promise.reject(new Error('Your session has expired. Please log in again.'));
    }

    // For all other errors, just return the error
    return Promise.reject(error);
  }
);

// Set auth token for API requests safely
export const setAuthToken = (token) => {
  try {
    if (token) {
      // Store token securely
      localStorage.setItem('token', token);

      // Set in axios defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Reset session timers when token is set
      sessionManager.resetSessionTimers();

      // Reset the expiration handling flags
      isHandlingSessionExpiration = false;
      if (expirationDebounceTimer) {
        clearTimeout(expirationDebounceTimer);
        expirationDebounceTimer = null;
      }
    } else {
      // Token is null/undefined/empty - clear it
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('userData'); // Also clear user data when token is removed
    }
  } catch (error) {
    console.error('Error setting auth token:', error);
    // If localStorage is not available or throws an error, we'll just continue without storing the token
  }
};

// Store user data
export const setUserData = (userData) => {
  try {
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
    } else {
      localStorage.removeItem('userData');
    }
  } catch (error) {
    console.error('Error setting user data:', error);
  }
};

// Get user data
export const getUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Check if user is admin
export const isAdmin = () => {
  const userData = getUserData();
  return userData && userData.role === 'admin';
};

// Check if token is valid by making a verification request with a longer timeout
export const verifyToken = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return false;
    }

    // Important: Log the token for debugging (remove in production)
    console.log("Verifying token:", token.substring(0, 10) + "...");

    const response = await api.get('/auth/verify', { timeout: 5000 });
    console.log("Token verification response:", response.status);

    // Reset expiration flag on successful verification
    isHandlingSessionExpiration = false;
    return true;
  } catch (error) {
    console.error("Token verification failed:", error);
    if (error.response && error.response.status === 401) {
      // Token is invalid, clear it
      setAuthToken(null);
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

// Safely load token from localStorage on startup
try {
  const token = localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Don't initialize session manager here - it will be done elsewhere
  }
} catch (error) {
  console.error('Error loading token from localStorage:', error);
}

export default api;
