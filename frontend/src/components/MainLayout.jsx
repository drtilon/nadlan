// Professional MainLayout.jsx with sophisticated design
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
  alpha,
  Stack,
  Chip,
  Paper,
  InputBase
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
import SearchIcon from '@mui/icons-material/Search';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { getUserData } from '../utils/api';

function MainLayout({ onLogout }) {
  const drawerWidth = 260;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contractsMenuOpen, setContractsMenuOpen] = useState(false);
  const [analyticsMenuOpen, setAnalyticsMenuOpen] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [notificationMenuAnchorEl, setNotificationMenuAnchorEl] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Get user data
  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';
  const [userName, setUserName] = useState('User');
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Contract Expiring', message: '3 contracts expire this month', time: '2m ago' },
    { id: 2, title: 'Payment Received', message: 'Rent payment for Apt 205', time: '1h ago' },
    { id: 3, title: 'New Tenant', message: 'John Doe signed lease', time: '3h ago' }
  ]);

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

  // Navigation items
  const navItems = [
    { id: 1, title: 'Properties', icon: <HomeIcon />, path: 'dashboard', adminOnly: false },
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
    userIsAdmin ? {
      id: 7,
      title: 'Analytics',
      icon: <InsightsIcon />,
      hasChildren: true,
      adminOnly: false,
      children: [
        { id: 71, title: 'Admin Analytics', icon: <BarChartIcon />, path: 'analytics' },
        { id: 72, title: 'Property Dashboard', icon: <TrendingUpIcon />, path: 'user-analytics' }
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
    navigate(`/${path}`);
    setMobileOpen(false);
  };

  // Toggle submenus
  const handleContractsToggle = () => {
    setContractsMenuOpen(!contractsMenuOpen);
  };

  const handleAnalyticsToggle = () => {
    setAnalyticsMenuOpen(!analyticsMenuOpen);
  };

  // Menu handlers
  const handleUserMenuOpen = (event) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const handleNotificationMenuOpen = (event) => {
    setNotificationMenuAnchorEl(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationMenuAnchorEl(null);
  };

  const handleLogout = () => {
    setUserMenuAnchorEl(null);
    onLogout();
  };

  // Check if a path is active
  const isActivePath = (path) => {
    if (!path) return false;
    if (path.includes('/')) {
      return location.pathname.includes(path);
    }
    return currentPath === path;
  };

  const isAnalyticsActive = () => {
    return location.pathname.includes('analytics') || location.pathname.includes('user-analytics');
  };

  // Professional drawer content
  const drawerContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fafafa',
      borderRight: '1px solid #e0e0e0'
    }}>
      {/* Clean Logo Section */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0'
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: '#1a1a1a',
            letterSpacing: '0.5px',
            cursor: 'pointer'
          }}
          onClick={() => navigateTo('properties')}
        >
          Shefa UG
        </Typography>
      </Box>

      {/* User Profile Section */}
      <Box
        sx={{
          p: 2.5,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              backgroundColor: '#2563eb',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ ml: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} color="#1a1a1a">
              {userName}
            </Typography>
            <Typography variant="caption" color="#6b7280">
              {userIsAdmin ? 'Administrator' : 'User'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
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
                        borderRadius: 1,
                        py: 1.25,
                        px: 1.5,
                        backgroundColor: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                                         (item.title === 'Analytics' && isAnalyticsActive())
                          ? '#f3f4f6'
                          : 'transparent',
                        '&:hover': {
                          backgroundColor: '#f9fafb'
                        }
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: 40,
                        color: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                              (item.title === 'Analytics' && isAnalyticsActive())
                          ? '#2563eb'
                          : '#6b7280'
                      }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        primaryTypographyProps={{
                          fontWeight: (item.title === 'Contracts' && location.pathname.includes('contracts')) || 
                                      (item.title === 'Analytics' && isAnalyticsActive())
                            ? 600 : 500,
                          fontSize: '0.9rem',
                          color: '#374151'
                        }}
                      />
                      <ExpandMoreIcon 
                        sx={{ 
                          fontSize: '1.2rem',
                          color: '#9ca3af',
                          transform: (item.title === 'Contracts' && contractsMenuOpen) || 
                                    (item.title === 'Analytics' && analyticsMenuOpen) 
                            ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }}
                      />
                    </ListItemButton>
                  </ListItem>

                  <Collapse 
                    in={item.title === 'Contracts' ? contractsMenuOpen : analyticsMenuOpen} 
                    timeout={200}
                    unmountOnExit
                  >
                    <List component="div" disablePadding sx={{ pl: 2 }}>
                      {item.children && item.children.map(child => (
                        <ListItem key={child.id} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            onClick={() => navigateTo(child.path)}
                            sx={{
                              borderRadius: 1,
                              py: 1,
                              px: 1.5,
                              backgroundColor: location.pathname.includes(child.path)
                                ? '#eff6ff'
                                : 'transparent',
                              '&:hover': {
                                backgroundColor: '#f9fafb'
                              }
                            }}
                          >
                            <ListItemIcon sx={{
                              minWidth: 36,
                              color: location.pathname.includes(child.path)
                                ? '#2563eb'
                                : '#9ca3af'
                            }}>
                              {child.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={child.title}
                              primaryTypographyProps={{
                                fontWeight: location.pathname.includes(child.path) ? 600 : 400,
                                fontSize: '0.85rem',
                                color: '#4b5563'
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
                      borderRadius: 1,
                      py: 1.25,
                      px: 1.5,
                      backgroundColor: isActivePath(item.path)
                        ? '#eff6ff'
                        : 'transparent',
                      borderLeft: isActivePath(item.path) ? '3px solid #2563eb' : '3px solid transparent',
                      '&:hover': {
                        backgroundColor: '#f9fafb'
                      }
                    }}
                  >
                    <ListItemIcon sx={{
                      minWidth: 40,
                      color: isActivePath(item.path)
                        ? '#2563eb'
                        : '#6b7280'
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontWeight: isActivePath(item.path) ? 600 : 500,
                        fontSize: '0.9rem',
                        color: '#374151'
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            )}
        </List>
      </Box>

      {/* Clean Logout Section */}
      <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', backgroundColor: '#ffffff' }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          sx={{
            py: 1.25,
            borderColor: '#d1d5db',
            color: '#6b7280',
            textTransform: 'none',
            fontWeight: 500,
            '&:hover': {
              borderColor: '#9ca3af',
              backgroundColor: '#f9fafb'
            }
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

      {/* Clean App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          color: '#1a1a1a',
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important', px: 3 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { lg: 'none' },
              color: '#6b7280'
            }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              display: { xs: 'block', lg: 'none' },
              fontWeight: 600,
              color: '#1a1a1a'
            }}
          >
            Shefa UG
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Professional Action Buttons */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              onClick={handleUserMenuOpen}
              sx={{
                ml: 2,
                p: 1,
                borderRadius: 1,
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                color: '#374151',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#f9fafb',
                  borderColor: '#d1d5db'
                }
              }}
              startIcon={
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    backgroundColor: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
              }
              endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.2 }}>
                  {userName}
                </Typography>
                <Typography variant="caption" color="#6b7280" sx={{ lineHeight: 1 }}>
                  {userIsAdmin ? 'Admin' : 'User'}
                </Typography>
              </Box>
            </Button>
          </Stack>

          {/* Professional Notification Menu */}
          <Menu
            anchorEl={notificationMenuAnchorEl}
            open={Boolean(notificationMenuAnchorEl)}
            onClose={handleNotificationMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: 320,
                mt: 1,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e5e7eb'
              }
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Notifications
              </Typography>
              <Typography variant="body2" color="#6b7280">
                {notifications.length} new updates
              </Typography>
            </Box>
            
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {notifications.map((notification, index) => (
                <MenuItem 
                  key={notification.id}
                  onClick={handleNotificationMenuClose}
                  sx={{ 
                    p: 2, 
                    borderBottom: index < notifications.length - 1 ? '1px solid #f3f4f6' : 'none',
                    '&:hover': { backgroundColor: '#f9fafb' }
                  }}
                >
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="#6b7280" sx={{ mb: 0.5 }}>
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="#9ca3af">
                          {notification.time}
                        </Typography>
                      </Box>
                    }
                    primaryTypographyProps={{ fontWeight: 500, fontSize: '0.875rem' }}
                  />
                </MenuItem>
              ))}
            </Box>
          </Menu>

          {/* Professional User Menu */}
          <Menu
            anchorEl={userMenuAnchorEl}
            open={Boolean(userMenuAnchorEl)}
            onClose={handleUserMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: 240,
                mt: 1,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e5e7eb'
              }
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid #f3f4f6' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: '#2563eb',
                    mr: 2
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {userName}
                  </Typography>
                  <Typography variant="caption" color="#6b7280">
                    {userIsAdmin ? 'Administrator' : 'User'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <MenuItem 
              onClick={handleUserMenuClose} 
              sx={{ py: 1.5, '&:hover': { backgroundColor: '#f9fafb' } }}
            >
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" sx={{ color: '#6b7280' }} />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </MenuItem>

            <MenuItem 
              onClick={handleUserMenuClose} 
              sx={{ py: 1.5, '&:hover': { backgroundColor: '#f9fafb' } }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" sx={{ color: '#6b7280' }} />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </MenuItem>

            <Divider />

            <MenuItem 
              onClick={handleLogout} 
              sx={{ 
                py: 1.5, 
                color: '#dc2626',
                '&:hover': { backgroundColor: '#fef2f2' }
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#dc2626' }} />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              border: 'none',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              border: 'none'
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Clean Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 3,
          px: 3,
          pb: 4,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: '#f8fafc'
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }} />
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

export default MainLayout;
