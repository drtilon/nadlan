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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  HolidayVillage as VacantIcon,
  BrowserUpdated as RenewalIcon,
  ErrorOutline as OverdueIcon,
  HourglassEmpty as PendingIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api, { getUserData } from '../../utils/api';

function UserAnalyticsPanel({ showNotification }) {
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [vacantUnits, setVacantUnits] = useState([]);
  const [expiringContracts, setExpiringContracts] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState({
    paid: [],
    pending: [],
    overdue: []
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
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

      // Process vacant units
      const vacant = apartmentsData.filter(apt =>
        apt.status === 'vacant' || apt.status === 'פנוי' || apt.status === 'Available'
      );
      setVacantUnits(vacant);

      // Process expiring contracts
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const expiring = apartmentsData.filter(apt => {
        if (!apt.contractEndDate) return false;
        const endDate = new Date(apt.contractEndDate);
        return endDate > today && endDate <= thirtyDaysFromNow;
      });
      setExpiringContracts(expiring);

      // Fetch payment information
      try {
        const paymentPromises = apartmentsData
          .filter(apt => apt.status === 'occupied' || apt.status === 'משוכר' || apt.status === 'Rented')
          .map(apt => api.get(`/payments/${apt.id}`));

        const paymentResponses = await Promise.allSettled(paymentPromises);
        const paid = [];
        const pending = [];
        const overdue = [];

        paymentResponses.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const apartment = apartmentsData.filter(apt =>
              apt.status === 'occupied' || apt.status === 'משוכר' || apt.status === 'Rented'
            )[index];
            const paymentData = result.value.data;

            if (paymentData?.status === 'paid') {
              paid.push(apartment);
            } else if (paymentData?.status === 'pending' || paymentData?.status === 'partial') {
              pending.push(apartment);
            } else if (paymentData?.status === 'overdue' ||
                      (new Date().getDate() > 5 && !paymentData?.status)) {
              overdue.push(apartment);
            } else {
              pending.push(apartment);
            }
          }
        });

        setPaymentStatus({ paid, pending, overdue });
      } catch (error) {
        console.error('Error fetching payment data:', error);
        setPaymentStatus({ paid: [], pending: [], overdue: [] });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search term and status filter
  useEffect(() => {
    let filtered = apartments;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.address.toLowerCase().includes(term) ||
        (apt.notes && apt.notes.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    setFilteredApartments(filtered);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const filteredTnts = tenants.filter(tenant =>
        tenant.name.toLowerCase().includes(term) ||
        (tenant.email && tenant.email.toLowerCase().includes(term)) ||
        (tenant.phone && tenant.phone.toLowerCase().includes(term))
      );
      setFilteredTenants(filteredTnts);
    } else {
      setFilteredTenants(tenants);
    }
  }, [searchTerm, apartments, tenants, statusFilter]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

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

  // Get payment status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': case 'partial': return 'warning';
      case 'overdue': case 'not_paid': return 'error';
      default: return 'default';
    }
  };

  // Handle tab change
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
          <Typography variant="h6" sx={{ mt: 3, color: 'text.secondary' }}>
            Loading analytics data...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4, borderRadius: 2, boxShadow: 3 }}>
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
                  '&:hover': { boxShadow: 4, bgcolor: 'primary.dark' }
                }}
              >
                Admin Analytics
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
              sx: { borderRadius: 1 }
            }}
            sx={{ maxWidth: 600 }}
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
              <MenuItem value="משוכר">משוכר</MenuItem>
              <MenuItem value="פנוי">פנוי</MenuItem>
              <MenuItem value="contract_sent">Contract Sent</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              boxShadow: 3
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">{apartments.length}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Properties</Typography>
                  </Box>
                  <ApartmentIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              bgcolor: 'success.main',
              color: 'white',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
              boxShadow: 3
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {apartments.filter(apt => apt.status === 'occupied' || apt.status === 'משוכר' || apt.status === 'Rented').length}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Occupied Properties</Typography>
                  </Box>
                  <HomeIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              bgcolor: 'warning.main',
              color: 'white',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)',
              boxShadow: 3
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">{vacantUnits.length}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Vacant Units</Typography>
                  </Box>
                  <VacantIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              bgcolor: 'error.main',
              color: 'white',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
              boxShadow: 3
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">{expiringContracts.length}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Contracts Expiring Soon</Typography>
                  </Box>
                  <RenewalIcon sx={{ fontSize: 48, opacity: 0.8 }} />
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
                minHeight: 56
              }
            }}
          >
            <Tab icon={<HomeIcon />} iconPosition="start" label="Property Status" sx={{ fontSize: '0.95rem' }} />
            <Tab icon={<WarningIcon />} iconPosition="start" label="Attention Needed" sx={{ fontSize: '0.95rem' }} />
            <Tab icon={<PersonIcon />} iconPosition="start" label="Tenant Overview" sx={{ fontSize: '0.95rem' }} />
            <Tab icon={<CalendarIcon />} iconPosition="start" label="Contract Timeline" sx={{ fontSize: '0.95rem' }} />
          </Tabs>
          <Divider />
        </Box>

        {/* Property Status Tab */}
        {tabIndex === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <HomeIcon color="primary" fontSize="small" />
              Property Overview ({filteredApartments.length} properties)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Rooms</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tenants</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredApartments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Alert severity="info">No properties match your search criteria</Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApartments.map(apartment => (
                      <TableRow key={apartment.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ApartmentIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight="medium">
                              {apartment.address}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {apartment.size ? `${apartment.size} m²` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {apartment.rooms ? `${apartment.rooms} rooms` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={apartment.status === 'occupied' ? 'Occupied' :
                                  apartment.status === 'vacant' ? 'Vacant' :
                                  apartment.status === 'משוכר' ? 'משוכר' :
                                  apartment.status === 'פנוי' ? 'פנוי' :
                                  apartment.status === 'contract_sent' ? 'Contract Sent' :
                                  apartment.status}
                            size="small"
                            color={apartment.status === 'occupied' || apartment.status === 'משוכר' ? 'success' :
                                  apartment.status === 'vacant' || apartment.status === 'פנוי' ? 'primary' :
                                  apartment.status === 'contract_sent' ? 'warning' :
                                  'default'}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {Array.isArray(apartment.tenants) ?
                              apartment.tenants.map(tenant =>
                                typeof tenant === 'object' ?
                                  (tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()) :
                                  tenant
                              ).join(', ') :
                              apartment.tenants || 'None'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => handleViewApartment(apartment.id)}
                            sx={{ textTransform: 'none', fontWeight: 500 }}
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

        {/* Attention Needed Tab */}
        {tabIndex === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <WarningIcon color="primary" fontSize="small" />
              Attention Needed
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VacantIcon color="primary" fontSize="small" />
                  Vacant Properties
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  {vacantUnits.length === 0 ? (
                    <Alert severity="success">No vacant properties at the moment</Alert>
                  ) : (
                    vacantUnits.map(unit => (
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
                            {unit.rooms ? `${unit.rooms} rooms • ` : ''}{unit.size ? `${unit.size} m²` : 'N/A'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewApartment(unit.id)}
                          sx={{ textTransform: 'none' }}
                        >
                          View
                        </Button>
                      </Box>
                    ))
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RenewalIcon color="error" fontSize="small" />
                  Contracts Expiring Soon
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  {expiringContracts.length === 0 ? (
                    <Alert severity="success">No contracts expiring in the next 30 days</Alert>
                  ) : (
                    expiringContracts.map(contract => (
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
                          sx={{ textTransform: 'none' }}
                        >
                          View
                        </Button>
                      </Box>
                    ))
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <OverdueIcon color="error" fontSize="small" />
                  Payment Status
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  {paymentStatus.overdue.length === 0 && paymentStatus.pending.length === 0 ? (
                    <Alert severity="success">All payments are up to date</Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {paymentStatus.overdue.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Overdue Payments</Typography>
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
                      {paymentStatus.pending.length > 0 && (
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" gutterBottom>Pending Payments</Typography>
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

        {/* Tenant Overview Tab */}
        {tabIndex === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <PersonIcon color="primary" fontSize="small" />
              Tenant Overview ({filteredTenants.length} tenants)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Tenant Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Contact Information</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Assigned Property</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Move-in Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Alert severity="info">No tenants match your search criteria</Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map(tenant => {
                      const tenantApartment = apartments.find(apt =>
                        apt.id === tenant.apartment_id ||
                        (Array.isArray(apt.tenants) && apt.tenants.some(t =>
                          (typeof t === 'object' && t.id === tenant.id) ||
                          (typeof t === 'string' && t === tenant.name)
                        ))
                      );

                      return (
                        <TableRow key={tenant.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PersonIcon color="primary" fontSize="small" />
                              <Typography variant="body2" fontWeight="medium">
                                {tenant.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              {tenant.email && (
                                <Typography variant="body2">{tenant.email}</Typography>
                              )}
                              {tenant.phone && (
                                <Typography variant="body2">{tenant.phone}</Typography>
                              )}
                              {!tenant.email && !tenant.phone && (
                                <Typography variant="body2" color="text.secondary">
                                  No contact information
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {tenantApartment ? (
                              <Chip
                                icon={<HomeIcon />}
                                label={tenantApartment.address}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="Not Assigned"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {tenantApartment?.moveInDate ? formatDate(tenantApartment.moveInDate) : 'Not specified'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="outlined"
                              size="small"
                              endIcon={<ArrowForwardIcon />}
                              onClick={() => handleViewTenant(tenant.id)}
                              sx={{ textTransform: 'none', fontWeight: 500 }}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Contract Timeline Tab */}
        {tabIndex === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <CalendarIcon color="primary" fontSize="small" />
              Contract Timeline
            </Typography>
            {apartments.filter(apt => apt.contractEndDate).length === 0 ? (
              <Alert severity="info">No contract end dates found for any properties</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Tenant(s)</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Move-in Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Contract End Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
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
                          <TableRow key={apartment.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ApartmentIcon color="primary" fontSize="small" />
                                <Typography variant="body2" fontWeight="medium">
                                  {apartment.address}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {Array.isArray(apartment.tenants) ?
                                  apartment.tenants.map(tenant =>
                                    typeof tenant === 'object' ?
                                      (tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()) :
                                      tenant
                                  ).join(', ') :
                                  apartment.tenants || 'None'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(apartment.moveInDate)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(apartment.contractEndDate)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {daysLeft < 0 ? (
                                <Chip label="Expired" size="small" color="error" />
                              ) : daysLeft < 30 ? (
                                <Chip label={`Expires in ${daysLeft} days`} size="small" color="warning" />
                              ) : (
                                <Chip label="Active" size="small" color="success" />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                variant="outlined"
                                size="small"
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => handleViewApartment(apartment.id)}
                                sx={{ textTransform: 'none', fontWeight: 500 }}
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
