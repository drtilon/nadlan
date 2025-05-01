// Fixed MainLayout.jsx with error handling for path checks
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  useMediaQuery,
  useTheme,
  Container,
  Avatar,
  Menu,
  MenuItem,
  Collapse,
  Badge,
  Tooltip,
  alpha
} from '@mui/material';

// Icons
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import InsightsIcon from '@mui/icons-material/Insights';
import PersonIcon from '@mui/icons-material/Person';
import DescriptionIcon from '@mui/icons-material/Description';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import BusinessIcon from '@mui/icons-material/Business';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import BarChartIcon from '@mui/icons-material/BarChart';

import { getUserData } from '../utils/api';

function MainLayout({ onLogout }) {
  const drawerWidth = 280;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contractsMenuOpen, setContractsMenuOpen] = useState(false);
  const [analyticsMenuOpen, setAnalyticsMenuOpen] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Get user data
  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';
  const [userName, setUserName] = useState('User');
  const [notifications, setNotifications] = useState(3);

  // Current path for highlighting active link
  const currentPath = location.pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    if (userData && userData.username) {
      setUserName(userData.username);
    }
  }, [userData]);

  // Handle drawer toggle
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Navigation items with simplified structure for non-admin users
  const navItems = [
    { id: 1, title: 'Dashboard', icon: <DashboardIcon />, path: 'dashboard', adminOnly: false },
    { id: 2, title: 'Properties', icon: <HomeIcon />, path: 'properties', adminOnly: false },
    { id: 3, title: 'Tenants', icon: <PersonIcon />, path: 'tenants', adminOnly: false },
    { id: 4, title: 'Landlords', icon: <BusinessIcon />, path: 'landlords', adminOnly: false },
    { id: 5, title: 'Payments', icon: <AttachMoneyIcon />, path: 'payments', adminOnly: false },
    {
      id: 6,
      title: 'Contracts',
      icon: <DescriptionIcon />,
      hasChildren: true,
      adminOnly: true,
      children: [
        { id: 61, title: 'Generate Contract', icon: <DriveFileRenameOutlineIcon />, path: 'contracts/generate' },
        { id: 62, title: 'Contract Manager', icon: <FileOpenIcon />, path: 'contracts/manage' },
      ]
    },
    // Different analytics item based on user role
    userIsAdmin ? {
      id: 7,
      title: 'Analytics',
      icon: <InsightsIcon />,
      hasChildren: true,
      adminOnly: false,
      children: [
        { id: 71, title: 'Admin Analytics', icon: <BarChartIcon />, path: 'analytics' },
        { id: 72, title: 'Property Dashboard', icon: <DashboardIcon />, path: 'user-analytics' }
      ]
    } : {
      id: 7,
      title: 'Analytics',
      icon: <InsightsIcon />,
      path: 'user-analytics', 
      hasChildren: false,
      adminOnly: false
    },
    { id: 8, title: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: 'admin', adminOnly: true },
    { id: 9, title: 'System Logs', icon: <AssessmentIcon />, path: 'logs', adminOnly: true },
  ];

  // Navigate to a path
  const navigateTo = (path) => {
    // Correct redirect for properties
    const targetPath = path === 'properties' ? 'dashboard' : path;
    navigate(`/${targetPath}`);
    setMobileOpen(false);
  };

  // Toggle contracts submenu
  const handleContractsToggle = () => {
    setContractsMenuOpen(!contractsMenuOpen);
  };

  // Toggle analytics submenu
  const handleAnalyticsToggle = () => {
    setAnalyticsMenuOpen(!analyticsMenuOpen);
  };

  // User menu handlers
  const handleUserMenuOpen = (event) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const handleLogout = () => {
    setUserMenuAnchorEl(null);
    onLogout();
  };

  // Check if a path is active - with safety checks
  const isActivePath = (path) => {
    if (!path) return false; // Add this check to handle undefined path
    
    if (path === 'properties') return currentPath === 'dashboard' || currentPath === '';
    if (path.includes('/')) {
      return location.pathname.includes(path);
    }
    return currentPath === path;
  };

  // Check if analytics paths are active
  const isAnalyticsActive = () => {
    return location.pathname.includes('analytics') || location.pathname.includes('user-analytics');
  };

  // Drawer content
  const drawerContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.palette.mode === 'light' ? '#fff' : '#1A202C'
    }}>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid',
          borderColor: theme.palette.divider,
          backgroundColor: theme.palette.primary.main,
          color: 'white'
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            textAlign: 'center',
            letterSpacing: '0.5px',
            cursor: 'pointer'
          }}
          onClick={() => navigateTo('dashboard')}
        >
          Shefa UG
        </Typography>
      </Box>

      {/* User profile section */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: theme.palette.divider,
          backgroundColor: theme.palette.mode === 'light'
            ? alpha(theme.palette.primary.light, 0.1)
            : alpha(theme.palette.primary.dark, 0.2)
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: theme.palette.primary.main,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ ml: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">{userName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {userIsAdmin ? 'Administrator' : 'User'}
          </Typography>
        </Box>
      </Box>

      {/* Navigation menu */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 1, py: 2 }}>
        <List component="nav" sx={{ px: 1 }}>
          {navItems
            .filter(item => !item.adminOnly || userIsAdmin)
            .map((item) =>
              item.hasChildren ? (
                <React.Fragment key={item.id}>
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={item.title === 'Contracts' ? handleContractsToggle : handleAnalyticsToggle}
                      sx={{
                        borderRadius: 1.5,
                        py: 1,
                        backgroundColor: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                                         (item.title === 'Analytics' && isAnalyticsActive())
                          ? alpha(theme.palette.primary.main, 0.12)
                          : 'transparent',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.08)
                        }
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: 40,
                        color: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                              (item.title === 'Analytics' && isAnalyticsActive())
                          ? theme.palette.primary.main
                          : theme.palette.text.primary
                      }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        primaryTypographyProps={{
                          fontWeight: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                                      (item.title === 'Analytics' && isAnalyticsActive())
                            ? 600 : 400,
                          fontSize: '0.95rem'
                        }}
                      />
                      {(item.title === 'Contracts' && contractsMenuOpen) || (item.title === 'Analytics' && analyticsMenuOpen) 
                        ? <ExpandLessIcon /> 
                        : <ExpandMoreIcon />
                      }
                    </ListItemButton>
                  </ListItem>

                  <Collapse 
                    in={item.title === 'Contracts' ? contractsMenuOpen : analyticsMenuOpen} 
                    timeout="auto" 
                    unmountOnExit
                  >
                    <List component="div" disablePadding sx={{ pl: 2 }}>
                      {item.children && item.children.map(child => (
                        <ListItem key={child.id} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            onClick={() => navigateTo(child.path)}
                            sx={{
                              borderRadius: 1.5,
                              py: 0.75,
                              backgroundColor: location.pathname.includes(child.path)
                                ? alpha(theme.palette.primary.main, 0.12)
                                : 'transparent',
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.08)
                              }
                            }}
                          >
                            <ListItemIcon sx={{
                              minWidth: 36,
                              color: location.pathname.includes(child.path)
                                ? theme.palette.primary.main
                                : theme.palette.text.secondary
                            }}>
                              {child.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={child.title}
                              primaryTypographyProps={{
                                fontWeight: location.pathname.includes(child.path) ? 600 : 400,
                                fontSize: '0.875rem'
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                </React.Fragment>
              ) : (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigateTo(item.path)}
                    sx={{
                      borderRadius: 1.5,
                      py: 1,
                      backgroundColor: isActivePath(item.path)
                        ? alpha(theme.palette.primary.main, 0.12)
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08)
                      }
                    }}
                  >
                    <ListItemIcon sx={{
                      minWidth: 40,
                      color: isActivePath(item.path)
                        ? theme.palette.primary.main
                        : theme.palette.text.primary
                    }}>
                      {isActivePath(item.path) ? (
                        <Badge color="secondary" variant="dot" overlap="circular">
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontWeight: isActivePath(item.path) ? 600 : 400,
                        fontSize: '0.95rem'
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            )}
        </List>
      </Box>

      {/* Bottom actions */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: theme.palette.divider }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          sx={{
            py: 1,
            borderRadius: 1.5,
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontWeight: 500
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              display: { xs: 'block', md: 'none' },
              fontWeight: 'bold',
              color: theme.palette.primary.main
            }}
          >
            Shefa UG
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Help">
              <IconButton color="inherit" sx={{ borderRadius: 1.5 }}>
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Dark Mode">
              <IconButton color="inherit" sx={{ borderRadius: 1.5 }}>
                <NightsStayIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton color="inherit" sx={{ borderRadius: 1.5 }}>
                <Badge badgeContent={notifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Account">
              <IconButton
                onClick={handleUserMenuOpen}
                sx={{
                  ml: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 0.75
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          <Menu
            id="user-menu"
            anchorEl={userMenuAnchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(userMenuAnchorEl)}
            onClose={handleUserMenuClose}
            PaperProps={{
              sx: {
                width: 220,
                mt: 1.5,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }
            }}
          >
            <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  mx: 'auto',
                  mb: 1,
                  bgcolor: theme.palette.primary.main,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="subtitle1" fontWeight="bold">{userName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {userIsAdmin ? 'Administrator' : 'User'}
              </Typography>
            </Box>

            <Divider />

            <MenuItem onClick={handleUserMenuClose} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="My Profile" />
            </MenuItem>

            <MenuItem onClick={handleUserMenuClose} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primary="Logout" primaryTypographyProps={{ color: 'error' }} />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Navigation drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: { xs: 2, md: 3 },
          px: { xs: 2, md: 3 },
          pb: 4,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.mode === 'light' ? '#f8f9fb' : '#121212'
        }}
      >
        <Toolbar /> {/* This creates space for the fixed app bar */}
        <Container maxWidth="xl" sx={{ mx: 'auto' }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

export default MainLayout;
