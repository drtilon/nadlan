// components/AuthenticatedApp.jsx
import React from 'react';
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
  // If you have the user role in localStorage or passed down as a prop, you could do:
  // const userRole = localStorage.getItem('role') || 'user'; // or pass as prop

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ניהול דירות להשכרה
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
          {/*
            If you only want to show this for admins:
            {userRole === 'admin' && (
              <IconButton color="inherit" onClick={() => setActiveView('admin')}>
                <AdminPanelSettingsIcon />
              </IconButton>
            )}
          */}
          <IconButton color="inherit" onClick={() => setActiveView('admin')}>
            <AdminPanelSettingsIcon />
          </IconButton>

          {/* Logout */}
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {activeView === 'list' && (
          <ApartmentList
            onEdit={(apartment) => {
              setEditingApartment(apartment);
              setActiveView('edit');
            }}
            showNotification={showNotification}
          />
        )}

        {activeView === 'add' && (
          <ApartmentForm
            onSuccess={() => {
              setActiveView('list');
              showNotification('דירה נוספה בהצלחה');
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
              showNotification('דירה עודכנה בהצלחה');
            }}
            showNotification={showNotification}
          />
        )}

        {activeView === 'payments' && (
          <PaymentScreen showNotification={showNotification} />
        )}

        {/* Render AdminPanel when activeView = 'admin' */}
        {activeView === 'admin' && (
          <AdminPanel showNotification={showNotification} />
        )}
      </Container>
    </>
  );
}

export default AuthenticatedApp;
