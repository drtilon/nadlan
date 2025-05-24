// src/components/UserAnalyticsPanel.jsx - Fixed tab indexing and removed payment status from contract timeline
import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Divider,
  Tabs,
  Tab,
  Alert,
  Chip,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  CardActions,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  SquareFoot as SquareFootIcon,
  BrowserUpdated as RenewalIcon,
  HolidayVillage as VacantIcon,
  ErrorOutline as OverdueIcon,
  HourglassEmpty as PendingIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  SwapHoriz as SwapIcon,
  Payments as PaymentsIcon,
  LocalAtm as MoneyIcon,
  Receipt as ReceiptIcon,
  AccountBalance as BankIcon,
  AccountCircle as AccountIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Visibility as VisibilityIcon,
  Sort as SortIcon,
  DoneAll as DoneAllIcon,
  Schedule as ScheduleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api, { getUserData } from '../utils/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = {
  primary: '#3b82f6',
  secondary: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#8b5cf6',
  muted: '#6b7280',
  pie: ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#10b981']
};

function UserAnalyticsPanel({ showNotification }) {
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [vacantUnits, setVacantUnits] = useState([]);
  const [expiringContracts, setExpiringContracts] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState({
    paid: [],
    pending: [],
    overdue: []
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState('all');
  const [tenantSortField, setTenantSortField] = useState('name');
  const [tenantSortDirection, setTenantSortDirection] = useState('asc');
  const [paymentFilter, setPaymentFilter] = useState('all');
  
  const navigate = useNavigate();
  
  // Check if user is admin
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Get apartments
      const apartmentsResponse = await api.get('/list');
      const apartmentsData = apartmentsResponse.data || [];
      setApartments(apartmentsData);
      setFilteredApartments(apartmentsData);

      // Get tenants
      const tenantsResponse = await api.get('/tenants/list');
      const tenantsData = tenantsResponse.data || [];
      setTenants(tenantsData);
      setFilteredTenants(tenantsData);
      
      // Get tenant payments data
      const tenantPaymentsResponse = await api.get('/analytics/tenant-payments');
      setTenantPayments(tenantPaymentsResponse.data || []);

      // Process vacant units
      const vacant = apartmentsData.filter(apt => apt.status === 'vacant');
      setVacantUnits(vacant);

      // Process expiring contracts (contracts expiring in the next 30 days)
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const expiring = apartmentsData.filter(apt => {
        if (!apt.contractEndDate) return false;
        const endDate = new Date(apt.contractEndDate);
        return endDate > today && endDate <= thirtyDaysFromNow;
      });
      setExpiringContracts(expiring);

      // Get payment information for the current month
      try {
        // This would ideally come from a dedicated endpoint
        // For now, we'll simulate payment statuses based on apartment data
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"];
        
        // Fetch payment data for all apartments
        const paymentPromises = apartmentsData
          .filter(apt => apt.status === 'occupied')
          .map(apt => api.get(`/payments/${apt.id}`));
        
        const paymentResponses = await Promise.allSettled(paymentPromises);
        
        const paid = [];
        const pending = [];
        const overdue = [];
        
        paymentResponses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const apartment = apartmentsData.filter(apt => apt.status === 'occupied')[index];
            const monthData = result.value.data[monthNames[currentMonth]];
            
            if (monthData) {
              if (monthData.status === 'paid') {
                paid.push(apartment);
              } else if (monthData.status === 'partial') {
                pending.push(apartment);
              } else {
                // If it's the current month and after the 5th day, consider it overdue
                if (currentDate.getDate() > 5) {
                  overdue.push(apartment);
                } else {
                  pending.push(apartment);
                }
              }
            } else {
              // No data for current month - consider it pending
              pending.push(apartment);
            }
          }
        });
        
        setPaymentStatus({
          paid,
          pending,
          overdue
        });
      } catch (error) {
        console.error('Error fetching payment data:', error);
        // Set default empty arrays if there's an error
        setPaymentStatus({
          paid: [],
          pending: [],
          overdue: []
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Format currency for display
  const formatCurrency = (amount) =>
    amount == null
      ? '$0'
      : new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD', 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 0 
        }).format(amount);

  // Calculate days until contract expiration
  const getDaysUntilExpiration = (dateString) => {
    if (!dateString) return null;
    try {
      const endDate = new Date(dateString);
      const today = new Date();
      const diffTime = endDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return null;
    }
  };

  // Filter data based on search term and status filter
  useEffect(() => {
    // Filter apartments based on search and status
    let filtered = apartments;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => 
        (apt.address?.toLowerCase() || '').includes(term) ||
        (apt.notes?.toLowerCase() || '').includes(term)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }
    
    setFilteredApartments(filtered);
    
    // Filter tenants
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const filteredTnts = tenants.filter(tenant => 
        (tenant.name?.toLowerCase() || '').includes(term) ||
        (tenant.email?.toLowerCase() || '').includes(term) ||
        (tenant.phone?.toLowerCase() || '').includes(term)
      );
      setFilteredTenants(filteredTnts);
    } else {
      setFilteredTenants(tenants);
    }
  }, [searchTerm, apartments, tenants, statusFilter]);

  // Sort tenants based on selected field and direction
  const getSortedTenants = () => {
    return [...filteredTenants].sort((a, b) => {
      let aValue = a[tenantSortField] || '';
      let bValue = b[tenantSortField] || '';
      
      // Special case for payment_ratio which is numeric
      if (tenantSortField === 'payment_ratio') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
        return tenantSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // String comparison for other fields
      return tenantSortDirection === 'asc' 
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  };

  // Handle tenant sort
  const handleTenantSort = (field) => {
    if (field === tenantSortField) {
      setTenantSortDirection(tenantSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTenantSortField(field);
      setTenantSortDirection('asc');
    }
  };
  
  // Get sort icon for tenants table
  const getTenantSortIcon = (field) => {
    if (field !== tenantSortField) return null;
    return tenantSortDirection === 'asc' 
      ? <ArrowUpwardIcon fontSize="small" /> 
      : <ArrowDownwardIcon fontSize="small" />;
  };

  // Filter payments based on status
  const getFilteredPayments = () => {
    // Start with all tenant payments
    let result = tenantPayments;
    
    // Filter by month if needed
    if (paymentMonthFilter !== 'all') {
      result = result.filter(tenant => 
        tenant.payment_history?.some(p => p.month === paymentMonthFilter)
      );
    }
    
    // Filter by payment status if needed
    if (paymentFilter !== 'all') {
      result = result.filter(tenant =>
        tenant.payment_history?.some(p => p.status === paymentFilter)
      );
    }
    
    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(tenant =>
        (tenant.name?.toLowerCase() || '').includes(term)
      );
    }
    
    return result;
  };

  // Generate monthly payment chart data
  const getMonthlyPaymentChartData = () => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    // Initialize data with zeros
    const data = monthNames.map(month => ({
      month,
      paid: 0,
      partial: 0,
      unpaid: 0
    }));
    
    // Populate with actual data
    tenantPayments.forEach(tenant => {
      if (tenant.payment_history) {
        tenant.payment_history.forEach(payment => {
          const monthIndex = monthNames.indexOf(payment.month);
          if (monthIndex >= 0) {
            if (payment.status === 'paid') {
              data[monthIndex].paid += payment.paid || 0;
            } else if (payment.status === 'partial') {
              data[monthIndex].partial += payment.paid || 0;
              data[monthIndex].unpaid += (payment.due - payment.paid) || 0;
            } else {
              data[monthIndex].unpaid += payment.due || 0;
            }
          }
        });
      }
    });
    
    return data;
  };

  // Get payment status color
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';
      case 'partial': return 'warning';
      case 'unpaid': return 'error';
      default: return 'default';
    }
  };

  // Tab change handler
  const handleTabChange = (event, newIndex) => {
    setTabIndex(newIndex);
  };

  // Navigate to tenant details
  const handleViewTenant = (tenantId) => {
    navigate(`/tenants/${tenantId}`);
  };

  // Navigate to apartment details 
  const handleViewApartment = (apartmentId) => {
    navigate(`/dashboard?apartment=${apartmentId}`);
  };

  // Navigate to admin analytics
  const handleGoToAdminAnalytics = () => {
    navigate('/analytics');
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12 }}>
          <CircularProgress size={80} />
          <Typography variant="h6" sx={{ mt: 3, color: 'text.secondary' }}>Loading analytics data...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="primary" /> Property Dashboard
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            {isAdmin && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SwapIcon />}
                onClick={handleGoToAdminAnalytics}
                sx={{ 
                  fontWeight: 'medium',
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                    bgcolor: 'primary.dark'
                  }
                }}
              >
                View Admin Analytics
              </Button>
            )}
          </Box>
        </Box>

        {/* Search and Filter Box */}
        <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            fullWidth
            placeholder="Search apartments, tenants, addresses..."
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 1,
                height: '48px',
                backgroundColor: 'background.paper',
                '& fieldset': {
                  borderColor: 'divider'
                }
              }
            }}
            sx={{ flexGrow: 1 }}
          />
          
          <FormControl variant="outlined" sx={{ minWidth: 180 }}>
            <InputLabel>Property Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Property Status"
            >
              <MenuItem value="all">All Properties</MenuItem>
              <MenuItem value="occupied">Occupied</MenuItem>
              <MenuItem value="vacant">Vacant</MenuItem>
              <MenuItem value="contract_sent">Contract Sent</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: COLORS.primary, color: 'white', borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">{apartments.length}</Typography>
                    <Typography variant="body2">Total Properties</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <ApartmentIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: COLORS.success, color: 'white', borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">{apartments.filter(apt => apt.status === 'occupied').length}</Typography>
                    <Typography variant="body2">Occupied Properties</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <HomeIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: COLORS.warning, color: 'white', borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">{vacantUnits.length}</Typography>
                    <Typography variant="body2">Vacant Units</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <VacantIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: COLORS.info, color: 'white', borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">{tenants.length}</Typography>
                    <Typography variant="body2">Active Tenants</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <PersonIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs for different data views */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
              }
            }}
          >
            <Tab icon={<HomeIcon />} iconPosition="start" label="Property Status" />
            <Tab icon={<PersonIcon />} iconPosition="start" label="Tenant Overview" />
            <Tab icon={<PaymentsIcon />} iconPosition="start" label="Payment Tracking" />
            <Tab icon={<WarningIcon />} iconPosition="start" label="Attention Needed" />
            <Tab icon={<CalendarIcon />} iconPosition="start" label="Contract Timeline" />
          </Tabs>
          <Divider />
        </Box>

        {/* Tab Content */}
        {/* Property Status Tab */}
        {tabIndex === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HomeIcon color="primary" fontSize="small" />
              Property Overview
            </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Address</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Rooms</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tenants</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredApartments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Alert severity="info">No properties match your search criteria</Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApartments.map(apartment => (
                      <TableRow key={apartment.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ApartmentIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight="medium">
                              {apartment.address}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{apartment.size} m²</TableCell>
                        <TableCell>{apartment.rooms} rooms</TableCell>
                        <TableCell>
                          <Chip 
                            label={apartment.status === 'occupied' ? 'Occupied' : 
                                  apartment.status === 'vacant' ? 'Vacant' : 
                                  apartment.status === 'contract_sent' ? 'Contract Sent' : 
                                  apartment.status}
                            size="small"
                            color={apartment.status === 'occupied' ? 'success' : 
                                  apartment.status === 'vacant' ? 'primary' : 
                                  apartment.status === 'contract_sent' ? 'warning' : 
                                  'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {Array.isArray(apartment.tenants) ? 
                            apartment.tenants.map(tenant => 
                              typeof tenant === 'object' ? 
                                (tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()) : 
                                tenant
                            ).join(', ') : 
                            apartment.tenants || 'None'}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => handleViewApartment(apartment.id)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Enhanced Tenant Overview Tab */}
        {tabIndex === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon color="primary" fontSize="small" />
                Tenant Overview
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={tenantSortField}
                    onChange={(e) => handleTenantSort(e.target.value)}
                    label="Sort By"
                    startAdornment={<SortIcon fontSize="small" sx={{ mr: 1 }} />}
                  >
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="moveInDate">Move-in Date</MenuItem>
                    <MenuItem value="payment_ratio">Payment Ratio</MenuItem>
                  </Select>
                </FormControl>
                
                <Tooltip title={tenantSortDirection === 'asc' ? 'Sort Ascending' : 'Sort Descending'}>
                  <IconButton 
                    onClick={() => setTenantSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    color="primary"
                    size="small"
                  >
                    {tenantSortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            {filteredTenants.length === 0 ? (
              <Alert severity="info">No tenants match your search criteria</Alert>
            ) : (
              <Grid container spacing={2}>
                {getSortedTenants().map(tenant => {
                  // Find tenant's apartment
                  const tenantApartment = apartments.find(apt => 
                    apt.id === tenant.apartment_id ||
                    (Array.isArray(apt.tenants) && apt.tenants.some(t => 
                      (typeof t === 'object' && t.id === tenant.id) || 
                      (typeof t === 'string' && t === tenant.name)
                    ))
                  );
                  
                  // Find tenant's payment history
                  const tenantPaymentData = tenantPayments.find(tp => tp.id === tenant.id || tp.name === tenant.name);
                  const paymentRatio = tenantPaymentData?.payment_ratio || 0;
                  
                  return (
                    <Grid item xs={12} md={6} lg={4} key={tenant.id}>
                      <Card variant="outlined" sx={{ 
                        borderRadius: 2, 
                        transition: 'all 0.2s',
                        '&:hover': { boxShadow: 3 }
                      }}>
                        <CardHeader
                          avatar={
                            <Avatar sx={{ bgcolor: COLORS.primary }}>
                              <PersonIcon />
                            </Avatar>
                          }
                          title={
                            <Typography variant="subtitle1" fontWeight="medium">
                              {tenant.name}
                            </Typography>
                          }
                          subheader={
                            tenantApartment ? tenantApartment.address : 'No apartment assigned'
                          }
                        />
                        <Divider />
                        <CardContent sx={{ pt: 2, pb: 1 }}>
                          <List dense disablePadding>
                            {tenant.email && (
                              <ListItem disablePadding sx={{ pb: 1 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={tenant.phone}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            )}
                            <ListItem disablePadding sx={{ pb: 1 }}>
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                <CalendarIcon fontSize="small" color="action" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={`Move In: ${formatDate(tenantApartment?.moveInDate || tenant.moveInDate)}`}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                            {tenantPaymentData && (
                              <ListItem disablePadding>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <MoneyIcon fontSize="small" color="action" />
                                </ListItemIcon>
                                <ListItemText 
                                  primary={`Payment: ${formatCurrency(tenantPaymentData.total_paid || 0)} / ${formatCurrency(tenantPaymentData.total_due || 0)}`}
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                              </ListItem>
                            )}
                          </List>
                          
                          {tenantPaymentData && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Payment Ratio
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={paymentRatio}
                                  sx={{
                                    flexGrow: 1,
                                    height: 8,
                                    borderRadius: 4,
                                    mr: 2,
                                    bgcolor: 'rgba(0,0,0,0.08)',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: paymentRatio >= 90 ? COLORS.success : 
                                              paymentRatio >= 75 ? COLORS.warning :
                                              COLORS.secondary
                                    }
                                  }}
                                />
                                <Typography variant="body2" fontWeight="medium">
                                  {paymentRatio}%
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </CardContent>
                        <Divider />
                        <CardActions>
                          <Button 
                            size="small" 
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleViewTenant(tenant.id)}
                            sx={{ ml: 'auto' }}
                          >
                            View Details
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}

        {/* Redesigned Payment Tracking Tab */}
        {tabIndex === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentsIcon color="primary" fontSize="small" />
                Payment Tracking
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={paymentMonthFilter}
                    onChange={(e) => setPaymentMonthFilter(e.target.value)}
                    label="Month"
                  >
                    <MenuItem value="current">Current Month</MenuItem>
                    <MenuItem value="January">January</MenuItem>
                    <MenuItem value="February">February</MenuItem>
                    <MenuItem value="March">March</MenuItem>
                    <MenuItem value="April">April</MenuItem>
                    <MenuItem value="May">May</MenuItem>
                    <MenuItem value="June">June</MenuItem>
                    <MenuItem value="July">July</MenuItem>
                    <MenuItem value="August">August</MenuItem>
                    <MenuItem value="September">September</MenuItem>
                    <MenuItem value="October">October</MenuItem>
                    <MenuItem value="November">November</MenuItem>
                    <MenuItem value="December">December</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Grid container spacing={3}>
              {/* Current Month Summary Cards */}
              <Grid item xs={12}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Card sx={{ bgcolor: COLORS.success, color: 'white', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {paymentStatus.paid.length}
                            </Typography>
                            <Typography variant="body2">Paid This Month</Typography>
                          </Box>
                          <DoneAllIcon />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card sx={{ bgcolor: COLORS.warning, color: 'white', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {paymentStatus.pending.length}
                            </Typography>
                            <Typography variant="body2">Pending</Typography>
                          </Box>
                          <ScheduleIcon />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card sx={{ bgcolor: COLORS.secondary, color: 'white', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {paymentStatus.overdue.length}
                            </Typography>
                            <Typography variant="body2">Overdue</Typography>
                          </Box>
                          <WarningIcon />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card sx={{ bgcolor: COLORS.info, color: 'white', borderRadius: 2 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(
                                apartments
                                  .filter(apt => apt.status === 'occupied')
                                  .reduce((total, apt) => total + (parseFloat(apt.rent) || 0), 0)
                              )}
                            </Typography>
                            <Typography variant="body2">Expected</Typography>
                          </Box>
                          <MoneyIcon />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>

              {/* Property Payment Status - Compact View */}
              <Grid item xs={12}>
                <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      Property Payment Status - {paymentMonthFilter === 'current' ? 
                        new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 
                        paymentMonthFilter}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p: 2 }}>
                    {apartments.filter(apt => apt.status === 'occupied').length === 0 ? (
                      <Alert severity="info">No occupied properties found</Alert>
                    ) : (
                      <Grid container spacing={2}>
                        {apartments
                          .filter(apt => apt.status === 'occupied')
                          .map(apartment => {
                            // Determine payment status for this apartment
                            let status = 'pending';
                            let statusColor = 'warning';
                            
                            if (paymentStatus.paid.some(apt => apt.id === apartment.id)) {
                              status = 'paid';
                              statusColor = 'success';
                            } else if (paymentStatus.overdue.some(apt => apt.id === apartment.id)) {
                              status = 'overdue';
                              statusColor = 'error';
                            }

                            return (
                              <Grid item xs={12} sm={6} md={4} lg={3} key={apartment.id}>
                                <Card 
                                  variant="outlined" 
                                  sx={{ 
                                    borderRadius: 2,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': { 
                                      boxShadow: 3,
                                      transform: 'translateY(-2px)'
                                    }
                                  }}
                                  onClick={() => handleViewApartment(apartment.id)}
                                >
                                  <CardContent sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                                        {apartment.address}
                                      </Typography>
                                      <Chip 
                                        label={status}
                                        size="small"
                                        color={statusColor}
                                        sx={{ fontSize: '0.75rem' }}
                                      />
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                      {Array.isArray(apartment.tenants) ? 
                                        apartment.tenants.map(tenant => 
                                          typeof tenant === 'object' ? 
                                            (tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()) : 
                                            tenant
                                        ).join(', ') : 
                                        apartment.tenants || 'No tenants'}
                                    </Typography>
                                    
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Typography variant="body2" fontWeight="medium">
                                        {formatCurrency(apartment.rent)}
                                      </Typography>
                                      <ArrowForwardIcon fontSize="small" color="action" />
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          })}
                      </Grid>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Monthly Trends Chart */}
              <Grid item xs={12}>
                <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, bgcolor: COLORS.primary, color: 'white' }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      Payment Trends - Last 6 Months
                    </Typography>
                  </Box>
                  <Divider />
                  
                  <Box sx={{ height: 300, p: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getMonthlyPaymentChartData().slice(-6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `${value}`} />
                        <RechartsTooltip formatter={(value) => [`${value}`, '']} />
                        <Legend />
                        <Bar 
                          dataKey="paid" 
                          name="Paid" 
                          stackId="a" 
                          fill={COLORS.success}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                          dataKey="partial" 
                          name="Partial" 
                          stackId="a" 
                          fill={COLORS.warning}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                          dataKey="unpaid" 
                          name="Unpaid" 
                          stackId="a" 
                          fill={COLORS.secondary}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Attention Needed Tab */}
        {tabIndex === 3 && (
          <Box>
            <Grid container spacing={3}>
              {/* Vacant Units */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VacantIcon color="primary" fontSize="small" />
                  Vacant Properties
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  {vacantUnits.length === 0 ? (
                    <Alert severity="success">No vacant properties at the moment</Alert>
                  ) : (
                    <Box>
                      {vacantUnits.map(unit => (
                        <Box key={unit.id} sx={{ 
                          p: 2, 
                          mb: 1, 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': { bgcolor: 'action.hover' },
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Box>
                            <Typography variant="subtitle2">{unit.address}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {unit.rooms} rooms • {unit.size} m²
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewApartment(unit.id)}
                          >
                            View
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Expiring Contracts */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RenewalIcon color="error" fontSize="small" />
                  Contracts Expiring Soon
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  {expiringContracts.length === 0 ? (
                    <Alert severity="success">No contracts expiring in the next 30 days</Alert>
                  ) : (
                    <Box>
                      {expiringContracts.map(contract => (
                        <Box key={contract.id} sx={{ 
                          p: 2, 
                          mb: 1, 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': { bgcolor: 'action.hover' },
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Box>
                            <Typography variant="subtitle2">{contract.address}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={`Expires in ${getDaysUntilExpiration(contract.contractEndDate)} days`}
                                size="small"
                                color="error"
                              />
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(contract.contractEndDate)}
                              </Typography>
                            </Box>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewApartment(contract.id)}
                          >
                            View
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Payment Status - Moved to Attention Needed */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OverdueIcon color="error" fontSize="small" />
                  Payment Status
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  {paymentStatus.overdue.length === 0 && paymentStatus.pending.length === 0 ? (
                    <Alert severity="success">All payments are up to date</Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {/* Overdue Payments */}
                      {paymentStatus.overdue.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Overdue Payments
                          </Typography>
                          {paymentStatus.overdue.map(apt => (
                            <Box key={apt.id} sx={{ 
                              p: 2, 
                              mb: 1, 
                              borderRadius: 1, 
                              border: '1px solid',
                              borderColor: 'error.light',
                              bgcolor: 'error.light',
                              color: 'error.contrastText',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography>{apt.address}</Typography>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => handleViewApartment(apt.id)}
                              >
                                View
                              </Button>
                            </Box>
                          ))}
                        </Grid>
                      )}
                      
                      {/* Pending Payments */}
                      {paymentStatus.pending.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>
                            Pending Payments
                          </Typography>
                          {paymentStatus.pending.map(apt => (
                            <Box key={apt.id} sx={{ 
                              p: 2, 
                              mb: 1, 
                              borderRadius: 1, 
                              border: '1px solid',
                              borderColor: 'warning.light',
                              bgcolor: 'warning.light',
                              color: 'warning.contrastText',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <Typography>{apt.address}</Typography>
                              <Button
                                size="small"
                                variant="contained"
                                color="warning"
                                onClick={() => handleViewApartment(apt.id)}
                              >
                                View
                              </Button>
                            </Box>
                          ))}
                        </Grid>
                      )}
                    </Grid>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Contract Timeline Tab - Cleaned up without Payment Status */}
        {tabIndex === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon color="primary" fontSize="small" />
              Contract Timeline
            </Typography>

            {apartments.filter(apt => apt.contractEndDate).length === 0 ? (
              <Alert severity="info">No contract end dates found for any properties</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.03)' }}>
                      <TableCell>Property</TableCell>
                      <TableCell>Tenant(s)</TableCell>
                      <TableCell>Move-in Date</TableCell>
                      <TableCell>Contract End Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredApartments
                      .filter(apt => apt.contractEndDate)
                      .sort((a, b) => new Date(a.contractEndDate) - new Date(b.contractEndDate))
                      .map(apartment => {
                        const daysLeft = getDaysUntilExpiration(apartment.contractEndDate);
                        let statusColor = 'success';
                        if (daysLeft < 0) statusColor = 'error';
                        else if (daysLeft < 30) statusColor = 'warning';
                        
                        return (
                          <TableRow key={apartment.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ApartmentIcon color="primary" fontSize="small" />
                                <Typography variant="body2" fontWeight="medium">
                                  {apartment.address}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(apartment.tenants) ? 
                                apartment.tenants.map(tenant => 
                                  typeof tenant === 'object' ? 
                                    (tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()) : 
                                    tenant
                                ).join(', ') : 
                                apartment.tenants || 'None'}
                            </TableCell>
                            <TableCell>{formatDate(apartment.moveInDate)}</TableCell>
                            <TableCell>{formatDate(apartment.contractEndDate)}</TableCell>
                            <TableCell>
                              {daysLeft < 0 ? (
                                <Chip 
                                  label="Expired"
                                  size="small"
                                  color="error"
                                />
                              ) : daysLeft < 30 ? (
                                <Chip 
                                  label={`Expires in ${daysLeft} days`}
                                  size="small"
                                  color="warning"
                                />
                              ) : (
                                <Chip 
                                  label="Active"
                                  size="small"
                                  color="success"
                                />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                variant="outlined"
                                size="small"
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => handleViewApartment(apartment.id)}
                              >
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default UserAnalyticsPanel;
