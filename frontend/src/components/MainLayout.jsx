import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  IconButton,
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
  Container,
  CssBaseline,
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

import { getUserData } from '../utils/api';

function MainLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [contractsMenuOpen, setContractsMenuOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const colors = {
    primary: '#1976d2',
    primaryDark: '#1565c0',
    secondary: '#2196f3',
    textPrimary: '#ffffff',
    divider: 'rgba(255,255,255,0.2)',
    background: '#f5f5f5',
  };

  const userData = getUserData();
  const userIsAdmin = userData && userData.role === 'admin';
  const currentPath = location.pathname.split('/')[1] || 'dashboard';
  const contractsPath = location.pathname.includes('contracts');

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
    if (contractsMenuOpen) setContractsMenuOpen(false);
  };

  const navItems = [
    { title: 'Apartments', icon: <HomeIcon />, path: 'dashboard', adminOnly: false },
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
    navigate(`/${path}`);
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
  const drawerWidth = drawerOpen ? 240 : 60;

  const sidebarNav = (
    <Box
      sx={{
        width: drawerWidth,
        height: '100vh',
        bgcolor: colors.primary,
        color: colors.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: drawerOpen ? 'space-between' : 'center',
        }}
      >
        {drawerOpen && (
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 'bold',
              cursor: 'pointer',
              '&:hover': { opacity: 0.85 },
            }}
            onClick={handleTitleClick}
          >
           Shefa UG 
          </Typography>
        )}
        <IconButton onClick={toggleDrawer} sx={{ color: colors.textPrimary }}>
          {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <Divider sx={{ bgcolor: colors.divider }} />

      <List sx={{ flexGrow: 1 }}>
        {navItems
          .filter((item) => !item.adminOnly || userIsAdmin)
          .map((item) =>
            item.children ? (
              <React.Fragment key={item.title}>
                <ListItem
                  button
                  onClick={handleContractsMenuToggle}
                  sx={{
                    py: 1.5,
                    cursor: 'pointer',
                    bgcolor: contractsMenuOpen || contractsPath ? colors.primaryDark : 'transparent',
                    '&:hover': { bgcolor: colors.primaryDark },
                    transition: 'background-color 0.2s',
                  }}
                >
                  <ListItemIcon sx={{ color: colors.textPrimary, minWidth: 40 }}>
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
                      <ListItemText primary={item.title} />
                      <ExpandMoreIcon
                        sx={{
                          transform: contractsMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    </>
                  )}
                </ListItem>
                {contractsMenuOpen && drawerOpen && (
                  <List component="div" disablePadding sx={{ bgcolor: 'rgba(0,0,0,0.1)' }}>
                    {item.children.map((child) => (
                      <ListItem
                        button
                        key={child.path}
                        onClick={() => navigateTo(child.path)}
                        sx={{
                          pl: 4,
                          py: 1,
                          cursor: 'pointer',
                          bgcolor: location.pathname.includes(child.path) ? colors.primaryDark : 'rgba(255,255,255,0.1)',
                          '&:hover': { bgcolor: colors.primaryDark },
                        }}
                      >
                        <ListItemIcon sx={{ color: 'rgba(255,255,255,0.9)' }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.title} sx={{ '& .MuiListItemText-primary': { color: 'rgba(255,255,255,0.9)' } }} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </React.Fragment>
            ) : (
              <ListItem
                button
                key={item.path}
                onClick={() => navigateTo(item.path)}
                sx={{
                  py: 1.5,
                  cursor: 'pointer',
                  bgcolor: currentPath === item.path ? colors.primaryDark : 'transparent',
                  '&:hover': { bgcolor: colors.primaryDark },
                  transition: 'background-color 0.2s',
                }}
              >
                <ListItemIcon sx={{ color: colors.textPrimary, minWidth: 40 }}>
                  {item.path === currentPath || (item.path === 'dashboard' && currentPath === '') ? (
                    <Badge color="secondary" variant="dot">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                {drawerOpen && <ListItemText primary={item.title} />}
              </ListItem>
            )
          )}
      </List>

      <Divider sx={{ bgcolor: colors.divider }} />
      <ListItem
        button
        onClick={onLogout}
        sx={{
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: colors.primaryDark },
        }}
      >
        <ListItemIcon sx={{ color: colors.textPrimary, minWidth: 40 }}>
          <LogoutIcon />
        </ListItemIcon>
        {drawerOpen && <ListItemText primary="Logout" />}
      </ListItem>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: colors.background, minHeight: '100vh' }}>
      <CssBaseline />

      {/* Mobile drawer toggle button */}
      {isMobile && !drawerOpen && (
        <IconButton
          sx={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            zIndex: theme.zIndex.drawer + 2,
            bgcolor: colors.primary,
            color: colors.textPrimary,
            '&:hover': { bgcolor: colors.primaryDark },
          }}
          onClick={toggleDrawer}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? drawerOpen : true}
        onClose={toggleDrawer}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: 'width 0.3s ease',
            overflowX: 'hidden',
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
          p: 3,
          transition: 'margin-left 0.3s ease',
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          ml: { xs: 0, md: 0 }, // No left margin on mobile, drawer will overlay content
        }}
      >
        {/* App title for mobile when drawer is closed */}
        {isMobile && !drawerOpen && (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mb: 2,
              pt: 2 
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
              onClick={handleTitleClick}
            >
              Apartment Rental Management
            </Typography>
          </Box>
        )}
        
        <Container 
          maxWidth="xl" 
          sx={{ 
            mt: { xs: 4, sm: 2 },
            px: { xs: 1, sm: 2, md: 3 }, // Responsive padding
          }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

export default MainLayout;
