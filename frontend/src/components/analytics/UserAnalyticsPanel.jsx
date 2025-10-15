import React, { useState, useEffect, useRef } from 'react';
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
  SwapHoriz as SwapIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api, { getUserData } from '../../utils/api';
import OutstandingPaymentsTab from './OutstandingPaymentsTab';

function UserAnalyticsPanel({ showNotification }) {
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Infinite scroll state
  const [apartmentPage, setApartmentPage] = useState(0);
  const [hasMoreApartments, setHasMoreApartments] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  // Outstanding Payments Tab State
  const [outstandingData, setOutstandingData] = useState(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingRowsPerPage, setOutstandingRowsPerPage] = useState(10);
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [outstandingSort, setOutstandingSort] = useState('outstanding_desc');

  const navigate = useNavigate();
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  // Fetch initial data on component mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch initial data (summary and first page of apartments)
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch summary statistics
      const summaryResponse = await api.get('/user-analytics/summary');
      setSummary(summaryResponse.data);

      // Fetch first page of apartments
      await fetchApartments(0, true);

      // Fetch tenants (lightweight)
      await fetchTenants();

    } catch (error) {
      console.error('Error fetching initial data:', error);
      showNotification && showNotification('Error loading analytics data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch apartments with pagination
  const fetchApartments = async (page = 0, reset = false) => {
    try {
      if (reset) {
        setLoadingMore(false);
      } else {
        setLoadingMore(true);
      }

      const params = {
        page,
        limit: 50,
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : ''
      };

      const response = await api.get('/user-analytics/apartments', { params });
      const newApartments = response.data.apartments || [];

      if (reset) {
        setApartments(newApartments);
        setFilteredApartments(newApartments);
        setApartmentPage(0);
      } else {
        setApartments(prev => [...prev, ...newApartments]);
        setFilteredApartments(prev => [...prev, ...newApartments]);
      }

      setHasMoreApartments(response.data.pagination?.has_next_page || false);
      setApartmentPage(page);

    } catch (error) {
      console.error('Error fetching apartments:', error);
      showNotification && showNotification('Error loading apartments', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      const params = { search: searchTerm };
      const response = await api.get('/user-analytics/tenants', { params });
      const tenantsData = response.data || [];
      setTenants(tenantsData);
      setFilteredTenants(tenantsData);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      showNotification && showNotification('Error loading tenants', 'error');
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMoreApartments && !loadingMore && tabIndex === 0) {
          fetchApartments(apartmentPage + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMoreApartments, loadingMore, apartmentPage, tabIndex]);

  // Handle search and filter changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (tabIndex === 0) {
        // Re-fetch apartments with new filters
        fetchApartments(0, true);
      } else if (tabIndex === 2) {
        // Re-fetch tenants with new search
        fetchTenants();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter]);

  // Fetch outstanding payments data
  const fetchOutstandingPayments = async () => {
    try {
      setOutstandingLoading(true);
      const params = {
        page: outstandingPage,
        limit: outstandingRowsPerPage,
        period_type: 'current_month',
        sort: outstandingSort
      };
      if (outstandingSearch) params.search = outstandingSearch;

      const response = await api.get('/analytics/outstanding-payments', { params });
      setOutstandingData(response.data);
    } catch (error) {
      console.error('Error fetching outstanding payments:', error);
      showNotification && showNotification('Error loading outstanding payments', 'error');
      setOutstandingData({
        apartments: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_items: 0,
          items_per_page: outstandingRowsPerPage,
          has_next_page: false,
          has_prev_page: false,
        },
        summary: {
          total_outstanding: 0,
          apartments_with_debt: 0,
        }
      });
    } finally {
      setOutstandingLoading(false);
    }
  };

  // Fetch outstanding data when tab changes
  useEffect(() => {
    if (tabIndex === 4) {
      fetchOutstandingPayments();
    }
  }, [tabIndex, outstandingPage, outstandingRowsPerPage, outstandingSearch, outstandingSort]);

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

  // Refresh all data
  const handleRefresh = () => {
    fetchInitialData();
    if (tabIndex === 4) {
      fetchOutstandingPayments();
    }
  };

  // Outstanding payments handlers
  const handleOutstandingPageChange = (newPage) => {
    setOutstandingPage(newPage);
  };

  const handleOutstandingRowsPerPageChange = (newRowsPerPage) => {
    setOutstandingRowsPerPage(newRowsPerPage);
    setOutstandingPage(1);
  };

  const handleOpenDetails = (apartment) => {
    navigate(`/dashboard?apartment=${apartment.apartment_id || apartment.id}`);
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
              <IconButton onClick={handleRefresh} disabled={loading}>
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
          {tabIndex === 0 && (
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
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Overview Cards */}
        {summary && (
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
                      <Typography variant="h4" fontWeight="bold">{summary.total_apartments}</Typography>
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
                      <Typography variant="h4" fontWeight="bold">{summary.total_apartments - summary.vacant.count}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Occupied Units</Typography>
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
                      <Typography variant="h4" fontWeight="bold">{summary.vacant.count}</Typography>
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
                      <Typography variant="h4" fontWeight="bold">{summary.expiring_contracts.count}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Contracts Expiring Soon</Typography>
                    </Box>
                    <RenewalIcon sx={{ fontSize: 48, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

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
            <Tab icon={<ReceiptIcon />} iconPosition="start" label="Outstanding Payments" sx={{ fontSize: '0.95rem' }} />
          </Tabs>
          <Divider />
        </Box>

        {/* Property Status Tab with Infinite Scroll */}
        {tabIndex === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <HomeIcon color="primary" fontSize="small" />
              Property Overview ({filteredApartments.length}+ properties)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>City</TableCell>
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
                    filteredApartments.map(apt => (
                      <TableRow key={apt.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">{apt.address}</Typography>
                        </TableCell>
                        <TableCell>{apt.city || 'N/A'}</TableCell>
                        <TableCell>{apt.rooms}</TableCell>
                        <TableCell>
                          <Chip
                            label={apt.status}
                            size="small"
                            color={apt.status === 'occupied' ? 'success' : 'default'}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>{apt.current_tenant_count || 0}</TableCell>
                        <TableCell align="right">
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => handleViewApartment(apt.id)}
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

            {/* Infinite scroll loading indicator */}
            {hasMoreApartments && (
              <Box ref={observerTarget} sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                {loadingMore ? (
                  <CircularProgress size={40} />
                ) : (
                  <Typography color="text.secondary">Scroll for more...</Typography>
                )}
              </Box>
            )}

            {!hasMoreApartments && filteredApartments.length > 0 && (
              <Box sx={{ py: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">All apartments loaded ({filteredApartments.length} total)</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Attention Needed Tab */}
        {tabIndex === 1 && summary && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <WarningIcon color="warning" fontSize="small" />
              Items Requiring Attention
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VacantIcon color="secondary" fontSize="small" />
                  Vacant Properties
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                  {summary.vacant.apartments.length === 0 ? (
                    <Alert severity="success">No vacant properties at the moment</Alert>
                  ) : (
                    summary.vacant.apartments.map(unit => (
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
                        <Typography variant="subtitle2">{unit.address}</Typography>
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
                  {summary.expiring_contracts.contracts.length === 0 ? (
                    <Alert severity="success">No contracts expiring in the next 30 days</Alert>
                  ) : (
                    summary.expiring_contracts.contracts.map(contract => (
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
                              label={`Expires in ${contract.daysUntil} days`}
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
                  Payment Status Overview
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  {summary.payments.overdue === 0 && summary.payments.pending === 0 ? (
                    <Alert severity="success">All payments appear to be up to date</Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {summary.payments.overdue > 0 && (
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                            <CardContent>
                              <Typography variant="h4" fontWeight="bold">{summary.payments.overdue}</Typography>
                              <Typography variant="body2">Properties with Overdue Payments</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      )}
                      {summary.payments.pending > 0 && (
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                            <CardContent>
                              <Typography variant="h4" fontWeight="bold">{summary.payments.pending}</Typography>
                              <Typography variant="body2">Pending Payments</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      )}
                      {summary.payments.paid > 0 && (
                        <Grid item xs={12} md={4}>
                          <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                            <CardContent>
                              <Typography variant="h4" fontWeight="bold">{summary.payments.paid}</Typography>
                              <Typography variant="body2">Paid This Month</Typography>
                            </CardContent>
                          </Card>
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
                    filteredTenants.map(tenant => (
                      <TableRow key={tenant.id} hover sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{tenant.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{tenant.email}</Typography>
                          <Typography variant="caption" color="text.secondary">{tenant.phone}</Typography>
                        </TableCell>
                        <TableCell>
                          {tenant.apartment_address ? (
                            <Box>
                              <Typography variant="body2">{tenant.apartment_address}</Typography>
                              <Chip label="Active" size="small" color="success" sx={{ mt: 0.5 }} />
                            </Box>
                          ) : (
                            <Chip label="No active contract" size="small" color="default" />
                          )}
                        </TableCell>
                        <TableCell>
                          {tenant.move_in_date ? formatDate(tenant.move_in_date) : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewTenant(tenant.id)}
                            endIcon={<ArrowForwardIcon />}
                          >
                            View
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

        {/* Contract Timeline Tab */}
        {tabIndex === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <CalendarIcon color="primary" fontSize="small" />
              Contract Timeline
            </Typography>
            {filteredApartments.filter(apt => apt.contractEndDate).length === 0 ? (
              <Alert severity="info">No contract end dates found for any properties</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>City</TableCell>
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
                        let statusLabel = 'Active';

                        if (daysLeft < 0) {
                          statusColor = 'error';
                          statusLabel = 'Expired';
                        } else if (daysLeft < 30) {
                          statusColor = 'warning';
                          statusLabel = `Expires in ${daysLeft} days`;
                        } else if (daysLeft < 60) {
                          statusColor = 'info';
                          statusLabel = `${daysLeft} days remaining`;
                        }

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
                            <TableCell>{apartment.city || 'N/A'}</TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(apartment.contractEndDate)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={statusLabel} size="small" color={statusColor} />
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

        {/* Outstanding Payments Tab */}
        {tabIndex === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <ReceiptIcon color="primary" fontSize="small" />
              Outstanding Payments Overview
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                This view shows properties with outstanding payment balances. Financial amounts are visible but detailed payment management requires admin access.
              </Typography>
            </Alert>

            <OutstandingPaymentsTab
              outstandingData={outstandingData}
              outstandingLoading={outstandingLoading}
              outstandingPage={outstandingPage}
              outstandingRowsPerPage={outstandingRowsPerPage}
              outstandingSearch={outstandingSearch}
              outstandingSort={outstandingSort}
              setOutstandingSearch={(search) => setOutstandingSearch(search)}
              setOutstandingSort={(sort) => setOutstandingSort(sort)}
              handleOutstandingPageChange={handleOutstandingPageChange}
              handleOutstandingRowsPerPageChange={handleOutstandingRowsPerPageChange}
              handleOpenDetails={handleOpenDetails}
            />
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default UserAnalyticsPanel;
