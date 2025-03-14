// src/AppRouter.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
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
import ContractManager from './components/ContractManager'; // Import the new ContractManager component
import LogsViewer from './components/LogsViewer';
import MainLayout from './components/MainLayout';
import TenantDetails from './components/TenantDetails';

// Utils and theme
import theme from './theme';
import { setAuthToken, verifyToken, getUserData } from './utils/api';
import sessionManager from './utils/SessionManager';

// Protected Route wrapper component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // Add this state to track checking process
  const navigate = useNavigate();
  const location = useLocation();
  const authCheckInProgress = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (authCheckInProgress.current) return;
      authCheckInProgress.current = true;
      setIsChecking(true); // Start checking

      try {
        // Check if token exists
        const token = localStorage.getItem('token');
        console.log("Protected route check - token exists:", !!token);

        if (!token) {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          authCheckInProgress.current = false;
          setIsChecking(false);
          return;
        }

        // Verify token with backend
        console.log("Verifying token with backend");
        const isValid = await verifyToken();
        console.log("Token verification result:", isValid);

        setIsAuthenticated(isValid);

        // Check authorization for admin routes
        if (isValid && adminOnly) {
          const userData = getUserData();
          console.log("User data for admin check:", userData);
          const isAdmin = userData && userData.role === 'admin';
          setIsAuthorized(isAdmin);
          console.log("Is user authorized as admin:", isAdmin);
        } else {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        setIsAuthenticated(false);
        setIsAuthorized(false);
      } finally {
        authCheckInProgress.current = false;
        setIsChecking(false); // Finished checking
      }
    };

    checkAuth();
  }, [adminOnly]);

  // Show loading only while actively checking auth
  if (isChecking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  console.log("Protected route state - authenticated:", isAuthenticated, "authorized:", isAuthorized);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log("Redirecting to login");
    return <Navigate to="/login" state={{ from: location.pathname }} />;
  }

  // Redirect to dashboard if not authorized
  if (!isAuthorized) {
    console.log("Redirecting to dashboard - not authorized");
    return <Navigate to="/dashboard" />;
  }

  // Render the protected component
  console.log("Rendering protected component");
  return children;
};

// Session Timeout Warning component
const SessionTimeoutWarning = ({ open, onExtend, onLogout, remainingTime }) => {
  return (
    <Dialog open={open} onClose={onExtend}>
      <DialogTitle>Session About to Expire</DialogTitle>
      <DialogContent>
        Your session will expire in {remainingTime} minute(s).
        Would you like to extend your session or logout now?
      </DialogContent>
      <DialogActions>
        <Button onClick={onLogout} color="secondary">Logout</Button>
        <Button onClick={onExtend} color="primary" variant="contained">Extend Session</Button>
      </DialogActions>
    </Dialog>
  );
};

// App Router Container - This is a wrapper component that sets up context for navigation
const AppRouterContainer = () => {
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [editingApartment, setEditingApartment] = useState(null);
  const [sessionWarning, setSessionWarning] = useState({ open: false, remainingTime: 5 });
  const navigate = useNavigate();
  const location = useLocation();
  const sessionHandlersSetup = useRef(false);

  // Setup session management - only run once
  useEffect(() => {
    // Avoid setting up multiple times
    if (sessionHandlersSetup.current) return;
    sessionHandlersSetup.current = true;

    // Configure session manager to handle expiration
    sessionManager.onSessionExpired(() => {
      // Clear data
      setAuthToken(null);

      // Show notification if not already on the login page
      if (location.pathname !== '/login') {
        setNotification({
          open: true,
          message: 'Your session has expired. Please log in again.',
          severity: 'warning'
        });

        // Redirect to login with expired flag
        navigate('/login?expired=true', { replace: true });
      }
    });

    // Configure session warning
    sessionManager.onSessionWarning((remainingMinutes) => {
      setSessionWarning({
        open: true,
        remainingTime: Math.ceil(remainingMinutes)
      });
    });

    // Initialize session manager
    sessionManager.initialize();

    // Clean up on unmount
    return () => {
      // Any cleanup needed
    };
  }, []);

  // Notification helper
  const showNotification = useCallback((message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  }, []);

  // Handler for logout
  const handleLogout = useCallback(() => {
    setAuthToken(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Handle extension of session
  const handleExtendSession = useCallback(async () => {
    setSessionWarning({ ...sessionWarning, open: false });

    // Try to refresh session with a token verification
    const isValid = await verifyToken();

    if (!isValid) {
      // If verification fails, handle as session expired
      handleLogout();
    }
  }, [sessionWarning, handleLogout]);

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
        <Route path="/" element={
          <Navigate to={localStorage.getItem('token') ? "/dashboard" : "/login"} />
        } />

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
            <ProtectedRoute >
              <ApartmentForm
                showNotification={showNotification}
                onSuccess={() => navigate('/dashboard')}
              />
            </ProtectedRoute>
          } />

          <Route path="apartments/edit" element={
            <ProtectedRoute >
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

          {/* Contract Generator Route */}
          <Route path="contracts/generate" element={
            <ProtectedRoute adminOnly={true}>
              <ContractGenerator
                showNotification={showNotification}
              />
            </ProtectedRoute>
          } />

          {/* Contract Manager Route */}
          <Route path="contracts/manage" element={
            <ProtectedRoute adminOnly={true}>
              <ContractManager
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

      {/* Session timeout warning dialog */}
      <SessionTimeoutWarning
        open={sessionWarning.open}
        remainingTime={sessionWarning.remainingTime}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
      />

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
