import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  IconButton,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
  Container,
  CssBaseline,
  AppBar,
  Toolbar,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Collapse,
  ListItemButton,
  Divider,
  Button
} from '@mui/material';
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpIcon from '@mui/icons-material/Help';

import { getUserData } from '../utils/api';

function MainLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [contractsMenuOpen, setContractsMenuOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState(3); // Example notification count
  const [userName, setUserName] = useState('');

  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';

  // Get current path segment
  const pathSegment = location.pathname.split('/')[1] || 'dashboard';
  const currentPath = pathSegment;
  // Flag to check if we're on the dashboard or root path
  const isDashboardPath = pathSegment === 'dashboard' || pathSegment === '';

  const contractsPath = location.pathname.includes('contracts');

  useEffect(() => {
    // Set userName from userData or use default
    if (userData) {
      setUserName(userData.username || 'User');
    }

    // Close drawer on mobile when path changes
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [userData, location.pathname, isMobile]);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
    if (contractsMenuOpen) setContractsMenuOpen(false);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    // Navigate to profile page or open profile dialog
  };

  const handleSettingsClick = () => {
    handleMenuClose();
    // Navigate to settings page
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout();
  };

  const navItems = [
    { title: 'Dashboard', icon: <DashboardIcon />, path: 'dashboard', adminOnly: false },
    { title: 'Properties', icon: <HomeIcon />, path: 'properties', adminOnly: false }, // Changed from 'dashboard' to 'properties'
    { title: 'Tenants', icon: <PersonIcon />, path: 'tenants', adminOnly: false },
    { title: 'Landlords', icon: <BusinessIcon />, path: 'landlords', adminOnly: false },
    { title: 'Payments', icon: <AttachMoneyIcon />, path: 'payments', adminOnly: false },
    {
      title: 'Contracts',
      icon: <DescriptionIcon />,
      children: [
        { title: 'Generate Contract', icon: <DriveFileRenameOutlineIcon />, path: 'contracts/generate' },
        { title: 'Contract Manager', icon: <FileOpenIcon />, path: 'contracts/manage' },
      ],
      adminOnly: true,
    },
    { title: 'Analytics', icon: <InsightsIcon />, path: 'analytics', adminOnly: true },
    { title: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: 'admin', adminOnly: true },
    { title: 'System Logs', icon: <AssessmentIcon />, path: 'logs', adminOnly: true },
  ];

  const navigateTo = (path) => {
    // Special case for 'properties' - redirect to dashboard
    const targetPath = path === 'properties' ? 'dashboard' : path;
    navigate(`/${targetPath}`);
    if (isMobile) setDrawerOpen(false);
    setContractsMenuOpen(false);
  };

  const handleTitleClick = () => {
    navigate('/dashboard');
  };

  const handleContractsMenuToggle = () => {
    setContractsMenuOpen(!contractsMenuOpen);
  };

  // Calculate drawer width
  const drawerWidth = drawerOpen ? 260 : 72;

  const menuId = 'primary-account-menu';
  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      id={menuId}
      keepMounted
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ width: 60, height: 60, mb: 1, bgcolor: 'primary.main' }}>
          {userName.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="subtitle1" fontWeight="bold">{userName}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {userIsAdmin ? 'Administrator' : 'User'}
        </Typography>
      </Box>
      <Divider />
      <MenuItem onClick={handleProfileClick}>
        <ListItemIcon>
          <AccountCircleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleSettingsClick}>
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Settings</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleLogout}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText primary="Logout" primaryTypographyProps={{ color: 'error' }} />
      </MenuItem>
    </Menu>
  );

  const sidebarNav = (
    <Box
      sx={{
        height: '100vh', // Full viewport height
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        boxShadow: '0 0 10px rgba(0,0,0,0.05)',
        transition: theme.transitions.create(['width'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        overflowY: 'auto', // Scroll within sidebar if content overflows
        overflowX: 'hidden',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: drawerOpen ? 'space-between' : 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {drawerOpen && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              cursor: 'pointer',
              color: 'primary.main',
              '&:hover': { opacity: 0.85 },
            }}
            onClick={handleTitleClick}
          >
            Shefa UG
          </Typography>
        )}
        <IconButton onClick={toggleDrawer} sx={{ color: 'primary.main' }}>
          {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <List component="nav" sx={{ flexGrow: 1, px: 1 }}>
        {navItems
          .filter((item) => !item.adminOnly || userIsAdmin)
          .map((item) =>
            item.children ? (
              <React.Fragment key={item.title}>
                <ListItem
                  disablePadding
                  button
                  onClick={handleContractsMenuToggle}
                  sx={{
                    mb: 0.5,
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <ListItemButton
                    sx={{
                      py: 1,
                      borderRadius: 1,
                      bgcolor: contractsMenuOpen || contractsPath ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: contractsPath || contractsMenuOpen ? 'primary.main' : 'text.primary' }}>
                      {contractsPath || contractsMenuOpen ? (
                        <Badge color="secondary" variant="dot">
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </ListItemIcon>
                    {drawerOpen && (
                      <>
                        <ListItemText
                          primary={item.title}
                          primaryTypographyProps={{
                            fontSize: 14,
                            fontWeight: contractsPath || contractsMenuOpen ? 600 : 400
                          }}
                        />
                        {contractsMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </>
                    )}
                  </ListItemButton>
                </ListItem>
                <Collapse in={contractsMenuOpen && drawerOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map((child) => (
                      <ListItem
                        key={child.path}
                        disablePadding
                        sx={{ pl: 2 }}
                      >
                        <ListItemButton
                          onClick={() => navigateTo(child.path)}
                          sx={{
                            borderRadius: 1,
                            py: 0.75,
                            mb: 0.5,
                            bgcolor: location.pathname.includes(child.path) ? 'action.selected' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 36,
                              color: location.pathname.includes(child.path) ? 'primary.main' : 'text.secondary'
                            }}
                          >
                            {child.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={child.title}
                            primaryTypographyProps={{
                              fontSize: 13,
                              fontWeight: location.pathname.includes(child.path) ? 600 : 400,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ) : (
              <ListItem
                key={item.path}
                disablePadding
                sx={{
                  mb: 0.5,
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <ListItemButton
                  onClick={() => navigateTo(item.path)}
                  sx={{
                    py: 1,
                    borderRadius: 1,
                    bgcolor:
                      // Special case for properties button to be highlighted when on dashboard
                      item.path === 'properties'
                        ? (isDashboardPath ? 'action.selected' : 'transparent')
                        : (currentPath === item.path ? 'action.selected' : 'transparent'),
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: 40,
                    color:
                      (item.path === 'properties' && isDashboardPath) ||
                        (currentPath === item.path)
                        ? 'primary.main'
                        : 'text.primary'
                  }}>
                    {(item.path === 'properties' && isDashboardPath) ||
                      (currentPath === item.path) ? (
                      <Badge color="secondary" variant="dot">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  {drawerOpen && (
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontSize: 14,
                        fontWeight:
                          (item.path === 'properties' && isDashboardPath) ||
                            (currentPath === item.path)
                            ? 600
                            : 400
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            )
          )}
      </List>

      {drawerOpen && (
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={onLogout}
            sx={{
              justifyContent: 'flex-start',
              py: 0.8,
              textTransform: 'none',
              fontWeight: 500
            }}
          >
            Logout
          </Button>
        </Box>
      )}

      {!drawerOpen && (
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>
          <IconButton
            color="error"
            onClick={onLogout}
            size="small"
            sx={{ borderRadius: 1 }}
          >
            <LogoutIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f8f9fb', minHeight: '100vh' }}>
      <CssBaseline />

      <AppBar
        position="fixed" // Top bar remains fixed
        color="default"
        elevation={0}
        sx={{
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          ml: { xs: 0, md: `${drawerWidth}px` },
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="open drawer"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {isMobile && (
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 'bold',
                cursor: 'pointer',
                color: 'primary.main',
                display: { xs: 'block', md: 'none' }
              }}
              onClick={handleTitleClick}
            >
              Shefa UG
            </Typography>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Help">
              <IconButton size="large" color="inherit">
                <HelpIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton size="large" color="inherit">
                <Badge badgeContent={notifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Account settings">
              <IconButton
                size="large"
                edge="end"
                aria-label="account of current user"
                aria-controls={menuId}
                aria-haspopup="true"
                onClick={handleProfileMenuOpen}
                color="inherit"
                sx={{ ml: 1 }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'primary.main',
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                  }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      {renderMenu}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? drawerOpen : true}
        onClose={toggleDrawer}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          '& .MuiDrawer-paper': {
            position: 'fixed', // Fix the sidebar in place
            top: 0,
            left: 0,
            height: '100vh', // Full height of viewport
            width: drawerWidth,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            boxSizing: 'border-box',
          },
        }}
      >
        {sidebarNav}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          pt: { xs: 8, sm: 9 }, // Space for the fixed AppBar
          px: { xs: 2, sm: 3 },
          ml: { xs: 0, md: `${drawerWidth}px` }, // Offset by sidebar width on desktop
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

export default MainLayout;
