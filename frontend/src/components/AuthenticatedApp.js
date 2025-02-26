// components/AuthenticatedApp.js
import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Container } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ApartmentList from './ApartmentList';
import ApartmentForm from './ApartmentForm';
import PaymentScreen from './PaymentScreen';

function AuthenticatedApp({
  onLogout,
  activeView,
  setActiveView,
  showNotification,
  editingApartment,
  setEditingApartment
}) {
  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ניהול דירות להשכרה
          </Typography>
          <IconButton color="inherit" onClick={() => setActiveView('list')}>
            <HomeIcon />
          </IconButton>
          <IconButton
            color="inherit"
            onClick={() => {
              setEditingApartment(null);
              setActiveView('add');
            }}
          >
            <AddCircleIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setActiveView('payments')}>
            <AttachMoneyIcon />
          </IconButton>
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
      </Container>
    </>
  );
}

export default AuthenticatedApp;

