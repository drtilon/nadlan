// src/AppRouter.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Snackbar, Alert } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';

// Components
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ApartmentList from './components/ApartmentList';
import ApartmentForm from './components/ApartmentForm';
import PaymentScreen from './components/PaymentScreen';
import AdminPanel from './components/AdminPanel';
import AnalyticsPanel from './components/AnalyticsPanel';
import TenantsPanel from './components/TenantsPanel';
import ContractGenerator from './components/ContractGenerator';
import LogsViewer from './components/LogsViewer';
import MainLayout from './components/MainLayout';
import TenantDetails from './components/TenantDetails';

// Utils and theme
import theme from './theme';
import { setAuthToken, verifyToken, getUserData } from './utils/api';

// Protected Route wrapper component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      // Check if token exists and is valid
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      
      // Verify token with backend
      const isValid = await verifyToken();
      setIsAuthenticated(isValid);
      
      // Check authorization for admin routes
      if (isValid && adminOnly) {
        const userData = getUserData();
        const isAdmin = userData && userData.role === 'admin';
        setIsAuthorized(isAdmin);
      } else {
        setIsAuthorized(true);
      }
    };
    
    checkAuth();
  }, [adminOnly, location.pathname]);

  // Show loading while checking authentication
  if (isAuthenticated === null || isAuthorized === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} />;
  }
  
  // Redirect to dashboard if not authorized (e.g., non-admin trying to access admin route)
  if (!isAuthorized) {
    return <Navigate to="/dashboard" />;
  }

  // Render the protected component
  return children;
};

// App Router Container - This is a wrapper component that sets up context for navigation
const AppRouterContainer = () => {
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [editingApartment, setEditingApartment] = useState(null);
  const navigate = useNavigate();

  // Notification helper
  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  // Handler for logout
  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  };

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <LoginPage 
            showNotification={showNotification} 
          />
        } />
        
        <Route path="/register" element={
          <RegisterPage 
            showNotification={showNotification} 
          />
        } />
        
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        
        {/* Protected Routes inside MainLayout */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainLayout 
                onLogout={handleLogout} 
                showNotification={showNotification}
              />
            </ProtectedRoute>
          }
        >
          {/* Dashboard/Apartment List */}
          <Route path="dashboard" element={
            <ApartmentList 
              showNotification={showNotification}
              onEdit={(apartment) => {
                setEditingApartment(apartment);
                navigate(apartment ? '/apartments/edit' : '/apartments/add');
              }}
              onGoToPayments={(apartmentId) => {
                navigate(`/payments/${apartmentId}`);
              }}
            />
          } />
          
          {/* Tenants Routes */}
          <Route path="tenants" element={
            <TenantsPanel 
              showNotification={showNotification}
            />
          } />
          
          <Route path="tenants/:tenantId" element={
            <TenantDetails 
              showNotification={showNotification}
            />
          } />
          
          {/* Payments Route */}
          <Route path="payments" element={
            <PaymentScreen 
              showNotification={showNotification}
            />
          } />
          
          <Route path="payments/:apartmentId" element={
            <PaymentScreen 
              showNotification={showNotification}
            />
          } />
          
          {/* Admin Only Routes */}
          <Route path="apartments/add" element={
            <ProtectedRoute adminOnly={true}>
              <ApartmentForm 
                showNotification={showNotification}
                onSuccess={() => navigate('/dashboard')}
              />
            </ProtectedRoute>
          } />
          
          <Route path="apartments/edit" element={
            <ProtectedRoute adminOnly={true}>
              <ApartmentForm 
                isEdit={true}
                initialData={editingApartment}
                showNotification={showNotification}
                onSuccess={() => navigate('/dashboard')}
              />
            </ProtectedRoute>
          } />
          
          <Route path="analytics" element={
            <ProtectedRoute adminOnly={true}>
              <AnalyticsPanel 
                showNotification={showNotification}
              />
            </ProtectedRoute>
          } />
          
          <Route path="contracts" element={
            <ProtectedRoute adminOnly={true}>
              <ContractGenerator 
                showNotification={showNotification}
              />
            </ProtectedRoute>
          } />
          
          <Route path="admin" element={
            <ProtectedRoute adminOnly={true}>
              <AdminPanel 
                showNotification={showNotification}
              />
            </ProtectedRoute>
          } />
          
          <Route path="logs" element={
            <ProtectedRoute adminOnly={true}>
              <LogsViewer 
                showNotification={showNotification}
              />
            </ProtectedRoute>
          } />
        </Route>
        
        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
      
      {/* Global notification system */}
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
    </>
  );
};

// App Router Component - Main wrapper that provides the Router context
function AppRouter() {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <AppRouterContainer />
      </Router>
    </ThemeProvider>
  );
}

export default AppRouter;
