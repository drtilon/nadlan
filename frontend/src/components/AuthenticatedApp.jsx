// components/AuthenticatedApp.jsx
import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Tooltip,
  Badge,
  Divider
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InsightsIcon from '@mui/icons-material/Insights';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';

import ApartmentList from './ApartmentList';
import ApartmentForm from './ApartmentForm';
import PaymentScreen from './PaymentScreen';
import AdminPanel from './AdminPanel';
import AnalyticsPanel from './AnalyticsPanel';
import TenantsPanel from './TenantsPanel';
import ContractGenerator from './ContractGenerator';

function AuthenticatedApp({
  onLogout,
  activeView,
  setActiveView,
  showNotification,
  editingApartment,
  setEditingApartment,
  user // User data including role
}) {
  // New state to hold the default apartment for payments
  const [defaultPaymentApartment, setDefaultPaymentApartment] = useState(null);

  // For development, force admin role if user data is missing
  // REMOVE THIS LINE IN PRODUCTION
  const userIsAdmin = (user && user.role === 'admin') || true;

  console.log('Current user:', user);
  console.log('Is admin?', userIsAdmin);

  // If non-admin user tries to access admin-only views, redirect to list view
  useEffect(() => {
    const adminOnlyViews = ['add', 'edit', 'admin', 'analytics', 'contracts'];
    if (!userIsAdmin && adminOnlyViews.includes(activeView)) {
      setActiveView('list');
      showNotification('You do not have permission to access this area', 'error');
    }
  }, [activeView, userIsAdmin, setActiveView, showNotification]);

  // Callback for navigating to the payment screen from ApartmentList
  const handleGoToPayments = (apartmentId) => {
    setDefaultPaymentApartment(apartmentId);
    setActiveView('payments');
  };

  // Callback for edit button - only admins can edit
  const handleEditApartment = (apartment) => {
    if (userIsAdmin) {
      setEditingApartment(apartment);
      setActiveView('edit');
    } else {
      showNotification('You do not have permission to edit apartments', 'error');
    }
  };

  return (
    <div dir="ltr">
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, direction: 'ltr' }}>
            Apartment Rental Management
          </Typography>

          {/* List view - accessible to all users */}
          <Tooltip title="Apartments">
            <IconButton color="inherit" onClick={() => setActiveView('list')}>
              <HomeIcon />
            </IconButton>
          </Tooltip>

          {/* Add apartment - admin only */}
          {userIsAdmin && (
            <Tooltip title="Add Apartment">
              <IconButton
                color="inherit"
                onClick={() => {
                  setEditingApartment(null);
                  setActiveView('add');
                }}
              >
                <AddCircleIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Tenants panel - accessible to all users */}
          <Tooltip title="Tenant Management">
            <IconButton color="inherit" onClick={() => setActiveView('tenants')}>
              <PersonIcon />
            </IconButton>
          </Tooltip>

          {/* Payment screen - accessible to all users */}
          <Tooltip title="Payments">
            <IconButton color="inherit" onClick={() => setActiveView('payments')}>
              <AttachMoneyIcon />
            </IconButton>
          </Tooltip>

          {userIsAdmin && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.3)' }} />

              {/* Contract Generator - admin only */}
              <Tooltip title="Generate Contracts">
                <IconButton color="inherit" onClick={() => setActiveView('contracts')}>
                  <DescriptionIcon />
                </IconButton>
              </Tooltip>

              {/* Analytics panel icon - admin only */}
              <Tooltip title="Analytics Dashboard">
                <IconButton color="inherit" onClick={() => setActiveView('analytics')}>
                  <Badge color="secondary" variant="dot">
                    <InsightsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Admin panel icon - admin only */}
              <Tooltip title="Admin Panel">
                <IconButton color="inherit" onClick={() => setActiveView('admin')}>
                  <AdminPanelSettingsIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.3)' }} />

          {/* Logout - accessible to all users */}
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={onLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1, direction: 'ltr' }}>
        {activeView === 'list' && (
          <ApartmentList
            onEdit={handleEditApartment}
            onGoToPayments={handleGoToPayments}
            showNotification={showNotification}
            isAdmin={userIsAdmin} // Pass isAdmin to control edit buttons in the list
          />
        )}

        {userIsAdmin && activeView === 'add' && (
          <ApartmentForm
            onSuccess={() => {
              setActiveView('list');
              showNotification('Apartment added successfully');
            }}
            showNotification={showNotification}
          />
        )}

        {userIsAdmin && activeView === 'edit' && editingApartment && (
          <ApartmentForm
            isEdit={true}
            initialData={editingApartment}
            onSuccess={() => {
              setActiveView('list');
              showNotification('Apartment updated successfully');
            }}
            showNotification={showNotification}
          />
        )}

        {activeView === 'payments' && (
          <PaymentScreen
            showNotification={showNotification}
            initialApartment={defaultPaymentApartment}
            isAdmin={userIsAdmin} // Pass isAdmin to control editable fields
          />
        )}

        {activeView === 'tenants' && (
          <TenantsPanel
            showNotification={showNotification}
            isAdmin={userIsAdmin} // Pass isAdmin to control editable fields
          />
        )}

        {userIsAdmin && activeView === 'admin' && (
          <AdminPanel showNotification={showNotification} />
        )}

        {userIsAdmin && activeView === 'analytics' && (
          <AnalyticsPanel showNotification={showNotification} />
        )}

        {userIsAdmin && activeView === 'contracts' && (
          <ContractGenerator showNotification={showNotification} />
        )}
      </Container>
    </div>
  );
}

export default AuthenticatedApp;
