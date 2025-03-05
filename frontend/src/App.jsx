import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Snackbar, Alert } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage'; // Import RegisterPage
import AuthenticatedApp from './components/AuthenticatedApp';
import theme from './theme';
import { setAuthToken } from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('list'); // 'list', 'add', 'edit'
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [editingApartment, setEditingApartment] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false); // New state for handling register page
  const [userData, setUserData] = useState(null); // Store user data including role

  // Check for existing token and user data on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUserData = localStorage.getItem('userData');

    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);

      // Try to get stored user data
      if (storedUserData) {
        try {
          setUserData(JSON.parse(storedUserData));
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setUserData(user);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setUserData(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box dir="rtl" sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {isAuthenticated ? (
          <AuthenticatedApp
            user={userData}
            onLogout={handleLogout}
            activeView={activeView}
            setActiveView={setActiveView}
            showNotification={showNotification}
            editingApartment={editingApartment}
            setEditingApartment={setEditingApartment}
          />
        ) : isRegistering ? (
          <RegisterPage
            showNotification={showNotification}
            onSwitchToLogin={() => setIsRegistering(false)} // Allow switching back to login
          />
        ) : (
          <LoginPage
            onLogin={handleLogin}
            showNotification={showNotification}
            onSwitchToRegister={() => setIsRegistering(true)} // Switch to register
          />
        )}

        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification({ ...notification, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={notification.severity} variant="filled">
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
