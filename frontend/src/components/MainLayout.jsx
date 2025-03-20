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
  Collapse
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

import { getUserData } from '../utils/api';

function MainLayout({ onLogout }) {
  const drawerWidth = 240;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contractsMenuOpen, setContractsMenuOpen] = useState(false);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Get user data
  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';
  const [userName, setUserName] = useState('User');

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
    { id: 7, title: 'Analytics', icon: <InsightsIcon />, path: 'analytics', adminOnly: true },
    { id: 8, title: 'Admin Panel', icon: <AdminPanelSettingsIcon />, path: 'admin', adminOnly: true },
    { id: 9, title: 'System Logs', icon: <AssessmentIcon />, path: 'logs', adminOnly: true },
  ];

  // Navigate to a path
  const navigateTo = (path) => {
    // Correct redirect for properties
    const targetPath = path === 'properties' ? 'dashboard' : path;
    navigate(`/${targetPath}`);
    setMobileOpen(false);
    setContractsMenuOpen(false);
  };

  // Toggle contracts submenu
  const handleContractsToggle = () => {
    setContractsMenuOpen(!contractsMenuOpen);
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

  // Drawer content
  const drawerContent = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ cursor: 'pointer' }} onClick={() => navigateTo('dashboard')}>
          Shefa UG
        </Typography>
      </Toolbar>
      <Divider />

      <List>
        {navItems
          .filter(item => !item.adminOnly || userIsAdmin)
          .map((item) =>
            item.hasChildren ? (
              <React.Fragment key={item.id}>
                <ListItem disablePadding>
                  <ListItemButton onClick={handleContractsToggle}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.title} />
                    {contractsMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                </ListItem>

                <Collapse in={contractsMenuOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.children.map(child => (
                      <ListItem key={child.id} disablePadding sx={{ pl: 4 }}>
                        <ListItemButton onClick={() => navigateTo(child.path)}>
                          <ListItemIcon>{child.icon}</ListItemIcon>
                          <ListItemText primary={child.title} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ) : (
              <ListItem key={item.id} disablePadding>
                <ListItemButton onClick={() => navigateTo(item.path)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.title} />
                </ListItemButton>
              </ListItem>
            )
          )}
      </List>

      <Divider />

      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={onLogout}>
            <ListItemIcon><LogoutIcon color="error" /></ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
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
              flexGrow: 1,
              display: { xs: 'block', md: 'block' },
              cursor: 'pointer'
            }}
            onClick={() => navigateTo('dashboard')}
          >
            Shefa UG
          </Typography>

          <IconButton
            size="large"
            edge="end"
            color="inherit"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleUserMenuOpen}
          >
            <Avatar sx={{ bgcolor: 'primary.dark' }}>
              {userName.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu
            id="menu-appbar"
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
          >
            <MenuItem>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <Typography variant="inherit">Profile</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              <Typography variant="inherit" color="error">Logout</Typography>
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
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
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
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: '#f8f9fb'
        }}
      >
        <Toolbar /> {/* This creates space for the fixed app bar */}
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

export default MainLayout;
