// components/AuthenticatedApp.jsx
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container,
  Tooltip,
  Badge
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InsightsIcon from '@mui/icons-material/Insights';

import ApartmentList from './ApartmentList';
import ApartmentForm from './ApartmentForm';
import PaymentScreen from './PaymentScreen';
import AdminPanel from './AdminPanel';
import AnalyticsPanel from './AnalyticsPanel'; // Import the new Analytics panel

function AuthenticatedApp({
  onLogout,
  activeView,
  setActiveView,
  showNotification,
  editingApartment,
  setEditingApartment
}) {
  // New state to hold the default apartment for payments
  const [defaultPaymentApartment, setDefaultPaymentApartment] = useState(null);

  // Callback for navigating to the payment screen from ApartmentList
  const handleGoToPayments = (apartmentId) => {
    setDefaultPaymentApartment(apartmentId);
    setActiveView('payments');
  };

  return (
    <div dir="ltr">
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, direction: 'ltr' }}>
            Apartment Rental Management
          </Typography>

          {/* List view */}
          <Tooltip title="Apartments">
            <IconButton color="inherit" onClick={() => setActiveView('list')}>
              <HomeIcon />
            </IconButton>
          </Tooltip>

          {/* Add apartment */}
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

          {/* Payment screen */}
          <Tooltip title="Payments">
            <IconButton color="inherit" onClick={() => setActiveView('payments')}>
              <AttachMoneyIcon />
            </IconButton>
          </Tooltip>

          {/* Analytics panel icon */}
          <Tooltip title="Analytics Dashboard">
            <IconButton color="inherit" onClick={() => setActiveView('analytics')}>
              <Badge color="secondary" variant="dot">
                <InsightsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Admin panel icon */}
          <Tooltip title="Admin Panel">
            <IconButton color="inherit" onClick={() => setActiveView('admin')}>
              <AdminPanelSettingsIcon />
            </IconButton>
          </Tooltip>

          {/* Logout */}
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
            onEdit={(apartment) => {
              setEditingApartment(apartment);
              setActiveView('edit');
            }}
            // Pass the new callback to navigate to payments
            onGoToPayments={handleGoToPayments}
            showNotification={showNotification}
          />
        )}

        {activeView === 'add' && (
          <ApartmentForm
            onSuccess={() => {
              setActiveView('list');
              showNotification('Apartment added successfully');
            }}
            showNotification={showNotification}
          />
        )}

        {activeView === 'edit' && editingApartment && (
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
          // Pass the defaultPaymentApartment to PaymentScreen as initialApartment
          <PaymentScreen
            showNotification={showNotification}
            initialApartment={defaultPaymentApartment}
          />
        )}

        {/* Render AdminPanel when activeView = 'admin' */}
        {activeView === 'admin' && (
          <AdminPanel showNotification={showNotification} />
        )}

        {/* Render AnalyticsPanel when activeView = 'analytics' */}
        {activeView === 'analytics' && (
          <AnalyticsPanel showNotification={showNotification} />
        )}
      </Container>
    </div>
  );
}

export default AuthenticatedApp;
