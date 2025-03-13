// src/components/MainLayout.jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
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
  Container
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

import { getUserData } from '../utils/api';

function MainLayout({ onLogout, showNotification }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get user data from localStorage
  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';

  // Current active path for highlighting
  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  // Toggle drawer for mobile
  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  // Navigation items configuration
  const navItems = [
    { title: 'Apartments', icon: <HomeIcon />, path: 'dashboard', adminOnly: false },
    { title: 'Tenants', icon: <PersonIcon />, path: 'tenants', adminOnly: false },
    { title: 'Payments', icon: <AttachMoneyIcon />, path: 'payments', adminOnly: false },
    { title: 'Contracts', icon: <DescriptionIcon />, path: 'contracts', adminOnly: true },
    { title: 'Analytics', icon: <InsightsIcon />, path: 'analytics', adminOnly: true },
    { title: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: 'admin', adminOnly: true },
    { title: 'System Logs', icon: <AssessmentIcon />, path: 'logs', adminOnly: true },
  ];

  // Navigate to a path and close the drawer
  const navigateTo = (path) => {
    navigate(`/${path}`);
    setDrawerOpen(false);
  };

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
              key={item.path}
              onClick={() => navigateTo(item.path)}
              selected={currentPath === item.path ||
                (item.path === 'dashboard' && currentPath === '')}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.light,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light,
                  }
                }
              }}
            >
              <ListItemIcon>
                {item.path === currentPath || (item.path === 'dashboard' && currentPath === '') ? (
                  <Badge color="primary" variant="dot">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
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
              {navItems
                .filter(item => !item.adminOnly || userIsAdmin)
                .map((item) => (
                  <Tooltip key={item.path} title={item.title}>
                    <IconButton
                      color={currentPath === item.path || (item.path === 'dashboard' && currentPath === '') ? "secondary" : "inherit"}
                      onClick={() => navigateTo(item.path)}
                    >
                      {item.path === currentPath || (item.path === 'dashboard' && currentPath === '') ? (
                        <Badge color="secondary" variant="dot">
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </IconButton>
                  </Tooltip>
                ))}

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

      {/* Main content - renders the active route via outlet */}
      <Container component="main" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export default MainLayout;
