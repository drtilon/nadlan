// components/AuthenticatedApp.jsx
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Container
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import ApartmentList from './ApartmentList';
import ApartmentForm from './ApartmentForm';
import PaymentScreen from './PaymentScreen';
import AdminPanel from './AdminPanel'; // <-- Import your Admin Panel

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
          <IconButton color="inherit" onClick={() => setActiveView('list')}>
            <HomeIcon />
          </IconButton>

          {/* Add apartment */}
          <IconButton
            color="inherit"
            onClick={() => {
              setEditingApartment(null);
              setActiveView('add');
            }}
          >
            <AddCircleIcon />
          </IconButton>

          {/* Payment screen */}
          <IconButton color="inherit" onClick={() => setActiveView('payments')}>
            <AttachMoneyIcon />
          </IconButton>

          {/* Admin panel icon */}
          <IconButton color="inherit" onClick={() => setActiveView('admin')}>
            <AdminPanelSettingsIcon />
          </IconButton>

          {/* Logout */}
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
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
      </Container>
    </div>
  );
}

export default AuthenticatedApp;
