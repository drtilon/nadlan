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
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
  Button
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InsightsIcon from '@mui/icons-material/Insights';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import AssessmentIcon from '@mui/icons-material/Assessment';

import ApartmentList from './ApartmentList';
import ApartmentForm from './ApartmentForm';
import PaymentScreen from './PaymentScreen';
import AdminPanel from './AdminPanel';
import AnalyticsPanel from './AnalyticsPanel';
import TenantsPanel from './TenantsPanel';
import ContractGenerator from './ContractGenerator';
import LogsViewer from './LogsViewer';

function AuthenticatedApp({
  onLogout,
  activeView,
  setActiveView,
  showNotification,
  editingApartment,
  setEditingApartment,
  user // User data including role
}) {
  // For mobile responsive navigation
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // New state to hold the default apartment for payments
  const [defaultPaymentApartment, setDefaultPaymentApartment] = useState(null);

  // For development, force admin role if user data is missing
  // REMOVE THIS LINE IN PRODUCTION
  const userIsAdmin = (user && user.role === 'admin') || true;

  console.log('Current user:', user);
  console.log('Is admin?', userIsAdmin);

  // If non-admin user tries to access admin-only views, redirect to list view
  useEffect(() => {
    const adminOnlyViews = [ 'admin', 'analytics', 'contracts', 'logs'];
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

  // Toggle drawer for mobile
  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  // Navigation items for sidebar/toolbar
  const navItems = [
    { title: 'Apartments', icon: <HomeIcon />, view: 'list', adminOnly: false },
    { title: 'Add Apartment', icon: <AddCircleIcon />, view: 'add', adminOnly: true },
    { title: 'Tenants', icon: <PersonIcon />, view: 'tenants', adminOnly: false },
    { title: 'Payments', icon: <AttachMoneyIcon />, view: 'payments', adminOnly: false },
    { title: 'Contracts', icon: <DescriptionIcon />, view: 'contracts', adminOnly: true },
    { title: 'Analytics', icon: <InsightsIcon />, view: 'analytics', adminOnly: true },
    { title: 'Admin Panel', icon: <AdminPanelSettingsIcon />, view: 'admin', adminOnly: true },
    { title: 'System Logs', icon: <AssessmentIcon />, view: 'logs', adminOnly: true },
  ];

  // Sidebar navigation for mobile
  const sidebarNav = (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
    >
      <List>
        {navItems
          .filter(item => !item.adminOnly || userIsAdmin)
          .map((item) => (
            <ListItem 
              button 
              key={item.view}
              onClick={() => {
                if (item.view === 'add') {
                  setEditingApartment(null);
                }
                setActiveView(item.view);
              }}
              selected={activeView === item.view}
            >
              <ListItemIcon>
                {item.view === activeView ? 
                  <Badge color="primary" variant="dot">
                    {item.icon}
                  </Badge> : 
                  item.icon
                }
              </ListItemIcon>
              <ListItemText primary={item.title} />
            </ListItem>
          ))}
        <Divider />
        <ListItem button onClick={onLogout}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <div dir="ltr">
      <AppBar position="static" color="primary">
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={toggleDrawer(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" sx={{ flexGrow: 1, direction: 'ltr' }}>
            Apartment Rental Management
          </Typography>

          {/* Desktop navigation */}
          {!isMobile && (
            <>
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
                      <InsightsIcon />
                    </IconButton>
                  </Tooltip>

                  {/* Admin panel icon - admin only */}
                  <Tooltip title="Admin Panel">
                    <IconButton color="inherit" onClick={() => setActiveView('admin')}>
                      <AdminPanelSettingsIcon />
                    </IconButton>
                  </Tooltip>
                  
                  {/* Logs panel icon - admin only */}
                  <Tooltip title="System Logs">
                    <IconButton color="inherit" onClick={() => setActiveView('logs')}>
                      <AssessmentIcon />
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
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile navigation drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
      >
        {sidebarNav}
      </Drawer>

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

        {userIsAdmin && activeView === 'logs' && (
          <LogsViewer showNotification={showNotification} />
        )}
      </Container>
    </div>
  );
}

export default AuthenticatedApp;
