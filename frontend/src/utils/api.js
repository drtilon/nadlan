// src/utils/api.js
import axios from 'axios';

// API service with base URL configuration
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

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
  (error) => {
    // Handle 401 Unauthorized errors (expired token)
    if (error.response && error.response.status === 401) {
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('userData');
      
      // Redirect to login page if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Optional: Redirect to login with a message
        window.location.href = '/?expired=true';
      }
    }
    
    return Promise.reject(error);
  }
);

// Set auth token for API requests
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
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

export default api;
