import axios from 'axios';

// API service
const api = axios.create({
  baseURL: 'http://207.154.221.54:5001/api',
});

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

// Load token from localStorage on startup
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;
