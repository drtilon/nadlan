import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Snackbar, Alert } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import LoginPage from './components/LoginPage';
import AuthenticatedApp from './components/AuthenticatedApp';
import theme from './theme';
import { setAuthToken } from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('list'); // 'list', 'add', 'edit'
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [editingApartment, setEditingApartment] = useState(null);

  // Check for existing token on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
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
            onLogout={handleLogout} 
            activeView={activeView}
            setActiveView={setActiveView}
            showNotification={showNotification}
            editingApartment={editingApartment}
            setEditingApartment={setEditingApartment}
          />
        ) : (
          <LoginPage onLogin={() => setIsAuthenticated(true)} showNotification={showNotification} />
        )}
        
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={() => setNotification({...notification, open: false})}
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
