// components/AnalyticsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
  Chip,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  AttachMoney as AttachMoney,
  ShowChart as ChartIcon,
  Lightbulb as UtilityIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Payments as PaymentsIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ErrorOutline as ErrorOutlineIcon,
  ArrowForward as ArrowForwardIcon,
  HourglassEmpty as PendingIcon,
  FilterList as FilterListIcon,
  Description as DescriptionIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import NetEarningsSection from './NetEarningsSection';
// Colors for charts
const COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#03a9f4',
  pie: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#9C27B0', '#3F51B5']
};

function AnalyticsPanel({ showNotification }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [apartmentMetrics, setApartmentMetrics] = useState([]);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState({
    overdueTenants: [],
    upcomingPayments: [],
    apartmentIssues: []
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'dueDate',
    direction: 'asc'
  });
  
  const navigate = useNavigate();

  // Fetch all analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch summary data
      const summaryResponse = await api.get('/analytics/summary');
      setSummaryData(summaryResponse.data);

      // Fetch payment trends
      const trendsResponse = await api.get('/analytics/payment-trends');
      setPaymentTrends(trendsResponse.data);

      // Fetch apartment metrics
      const apartmentResponse = await api.get('/analytics/apartment-metrics');
      setApartmentMetrics(apartmentResponse.data);

      // Fetch tenant payment analytics
      const tenantResponse = await api.get('/analytics/tenant-payments');
      setTenantPayments(tenantResponse.data);

      // Fetch expense analytics
      const expenseResponse = await api.get('/analytics/expenses');
      setExpenseData(expenseResponse.data);

      // Process data for actionable insights
      processActionableData(
        summaryResponse.data,
        apartmentResponse.data,
        tenantResponse.data
      );

      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data. Please try again.');
      showNotification('Error loading analytics data', 'error');
      setLoading(false);
    }
  };

  // Process data to get actionable insights
  const processActionableData = (summary, apartments, tenants) => {
    // Extract tenants with overdue payments
    const overdueTenants = [];
    tenants.forEach(tenant => {
      // Check payment history for unpaid amounts
      const unpaidPayments = tenant.payment_history.filter(payment => 
        payment.status === 'unpaid' || 
        (payment.status === 'partial' && payment.due > payment.paid)
      );
      
      if (unpaidPayments.length > 0) {
        // Add tenant with overdue details
        overdueTenants.push({
          tenantId: tenant.id || `tenant-${Math.random().toString(36).substr(2, 9)}`,
          name: tenant.name,
          totalOverdue: unpaidPayments.reduce((total, payment) => 
            total + (payment.due - payment.paid), 0),
          paymentRatio: tenant.payment_ratio,
          lastPaymentDate: tenant.payment_history
            .filter(payment => payment.status === 'paid' || payment.status === 'partial')
            .sort((a, b) => new Date(b.date || '2023-01-01') - new Date(a.date || '2023-01-01'))
            [0]?.date || 'Never',
          unpaidMonths: unpaidPayments.map(payment => payment.month).join(', '),
          apartment: apartments.find(apt => 
            apt.tenants && apt.tenants.some(t => t.name === tenant.name)
          )?.address || 'Unknown'
        });
      }
    });

    // Extract upcoming payments (next 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const upcomingPayments = apartments.map(apt => {
      // Calculate next payment date (assume 1st of next month)
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const daysUntilPayment = Math.ceil((nextMonth - today) / (1000 * 60 * 60 * 24));
      
      return {
        apartmentId: apt.id,
        address: apt.address,
        tenantCount: apt.tenant_count || 0,
        rent: apt.rent || 0,
        status: apt.payment_status || 'not_paid',
        dueDate: nextMonth.toISOString().split('T')[0],
        daysUntil: daysUntilPayment,
        isPastDue: daysUntilPayment < 0
      };
    });

    // Extract apartment issues (expiring contracts, maintenance needs)
    const apartmentIssues = apartments
      .filter(apt => 
        (apt.days_until_expiration !== null && apt.days_until_expiration < 90) || // Contract expiring soon
        apt.status === 'vacant' // Vacant apartment
      )
      .map(apt => ({
        apartmentId: apt.id,
        address: apt.address,
        issue: apt.days_until_expiration !== null && apt.days_until_expiration < 90 
          ? `Contract expires in ${apt.days_until_expiration} days` 
          : 'Vacant property',
        priority: apt.days_until_expiration !== null && apt.days_until_expiration < 30 
          ? 'high' 
          : apt.days_until_expiration !== null && apt.days_until_expiration < 60
            ? 'medium'
            : 'low',
        daysUntil: apt.days_until_expiration,
        status: apt.status
      }));

    // Set the processed data
    setFilteredData({
      overdueTenants,
      upcomingPayments,
      apartmentIssues
    });
  };

  // Initial data fetch
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Filter data based on search term
  useEffect(() => {
    if (!summaryData || loading) return;

    // Filter overdue tenants
    const filteredOverdueTenants = filterData(filteredData.overdueTenants);
    
    // Filter upcoming payments
    const filteredUpcomingPayments = filterData(filteredData.upcomingPayments);
    
    // Filter apartment issues
    const filteredApartmentIssues = filterData(filteredData.apartmentIssues);

    // Set filtered data
    setFilteredData({
      overdueTenants: filteredOverdueTenants,
      upcomingPayments: filteredUpcomingPayments,
      apartmentIssues: filteredApartmentIssues
    });
  }, [searchTerm, summaryData, loading]);

  // Helper function to filter data based on search term
  const filterData = (dataArray) => {
    if (!searchTerm.trim()) return dataArray;
    
    const term = searchTerm.toLowerCase();
    return dataArray.filter(item => {
      // Check all string properties of the item
      return Object.values(item).some(value => 
        typeof value === 'string' && value.toLowerCase().includes(term)
      );
    });
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
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

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return COLORS.error;
      case 'medium':
        return COLORS.warning;
      case 'low':
        return COLORS.info;
      default:
        return COLORS.info;
    }
  };

  // Get payment status color
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return COLORS.success;
      case 'partial':
        return COLORS.warning;
      case 'not_paid':
      default:
        return COLORS.error;
    }
  };

  // Get payment ratio color
  const getPaymentRatioColor = (ratio) => {
    if (ratio >= 90) return COLORS.success;
    if (ratio >= 75) return COLORS.info;
    if (ratio >= 50) return COLORS.warning;
    return COLORS.error;
  };

  // Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Get sorted data
  const getSortedData = (data) => {
    if (!sortConfig.key) return data;
    
    return [...data].sort((a, b) => {
      // Handle special sorting for dates
      if (sortConfig.key.includes('date') || sortConfig.key.includes('Date')) {
        const dateA = new Date(a[sortConfig.key] || '1970-01-01');
        const dateB = new Date(b[sortConfig.key] || '1970-01-01');
        
        return sortConfig.direction === 'asc' 
          ? dateA - dateB 
          : dateB - dateA;
      }
      
      // Handle numeric sorting
      if (typeof a[sortConfig.key] === 'number' && typeof b[sortConfig.key] === 'number') {
        return sortConfig.direction === 'asc' 
          ? a[sortConfig.key] - b[sortConfig.key] 
          : b[sortConfig.key] - a[sortConfig.key];
      }
      
      // Handle string sorting
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      
      return 0;
    });
  };

  // Render sort icon
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowDropUpIcon fontSize="small" /> 
      : <ArrowDropDownIcon fontSize="small" />;
  };

  // Navigate to payment page for specific apartment
  const goToPayments = (apartmentId) => {
    if (apartmentId) {
      navigate(`/payments/${apartmentId}`);
    } else {
      navigate('/payments');
    }
  };

  // Navigate to tenant details page
  const goToTenantDetails = (tenantId) => {
    navigate(`/tenants/${tenantId}`);
  };

  // Prepare data for payment status pie chart
  const getPaymentStatusPieData = () => {
    if (!summaryData) return [];

    return [
      { name: 'Paid', value: summaryData.payment_status.paid },
      { name: 'Partial', value: summaryData.payment_status.partial },
      { name: 'Not Paid', value: summaryData.payment_status.not_paid }
    ];
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
            <ChartIcon sx={{ mr: 1 }} /> Financial Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAnalytics}
            disabled={loading}
          >
            Refresh Data
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Loading analytics data...
            </Typography>
          </Box>
        ) : (
          <>
            {/* Summary Cards */}
            {summaryData && (
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} lg={3}>
                  <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Typography variant="h6" component="div" gutterBottom>
                            Apartments
                          </Typography>
                          <Typography variant="h3" component="div">
                            {summaryData.total_apartments}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {summaryData.occupied_apartments} occupied ({summaryData.occupancy_rate}%)
                          </Typography>
                        </div>
                        <ApartmentIcon fontSize="large" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Typography variant="h6" component="div" gutterBottom>
                            Total Revenue
                          </Typography>
                          <Typography variant="h3" component="div">
                            {formatCurrency(summaryData.total_expected_rent)}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {summaryData.payment_status.paid + summaryData.payment_status.partial} payments received
                          </Typography>
                        </div>
                        <MoneyIcon fontSize="large" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Typography variant="h6" component="div" gutterBottom>
                            Total Tenants
                          </Typography>
                          <Typography variant="h3" component="div">
                            {summaryData.total_tenants}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Across {summaryData.occupied_apartments} occupied apartments
                          </Typography>
                        </div>
                        <PersonIcon fontSize="large" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} lg={3}>
                  <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Typography variant="h6" component="div" gutterBottom>
                            Attention Needed
                          </Typography>
                          <Typography variant="h3" component="div">
                            {filteredData.overdueTenants.length + filteredData.apartmentIssues.length}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {filteredData.overdueTenants.length} payment issues, {filteredData.apartmentIssues.length} property issues
                          </Typography>
                        </div>
                        <WarningIcon fontSize="large" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Search box */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Search tenants, apartments, or issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <CancelIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            {/* Navigation Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={tabIndex}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="analytics tabs"
              >
                <Tab label="Overdue Payments" icon={<WarningIcon />} iconPosition="start" />
                <Tab label="Upcoming Payments" icon={<CalendarIcon />} iconPosition="start" />
                <Tab label="Property Alerts" icon={<ErrorOutlineIcon />} iconPosition="start" />
                <Tab label="Financial Overview" icon={<MoneyIcon />} iconPosition="start" />
                <Tab label="Net Earnings" icon={<AttachMoney />} iconPosition="start" /> {/* New tab */}
              </Tabs>
            </Box>

            {/* Overdue Payments Tab */}
            {tabIndex === 0 && (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">
                    Tenants with Overdue Payments
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      variant="outlined" 
                      startIcon={<FilterListIcon />}
                      size="small"
                    >
                      Filter
                    </Button>
                    <Button 
                      variant="contained"
                      startIcon={<MoneyIcon />}
                      size="small"
                      onClick={() => goToPayments()}
                    >
                      Payment Manager
                    </Button>
                  </Box>
                </Box>

                {filteredData.overdueTenants.length === 0 ? (
                  <Alert severity="success" sx={{ mb: 3 }}>
                    Great news! No tenants have overdue payments at the moment.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell 
                            onClick={() => handleSort('name')}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              Tenant {renderSortIcon('name')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('apartment')}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              Apartment {renderSortIcon('apartment')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('totalOverdue')}
                            align="right"
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              Amount Overdue {renderSortIcon('totalOverdue')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('unpaidMonths')}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              Unpaid Months {renderSortIcon('unpaidMonths')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('paymentRatio')}
                            align="center"
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              Payment History {renderSortIcon('paymentRatio')}
                            </Box>
                          </TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getSortedData(filteredData.overdueTenants).map((tenant, index) => (
                          <TableRow key={tenant.tenantId || index} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon color="primary" fontSize="small" />
                                <Typography variant="body2" fontWeight="medium">
                                  {tenant.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                icon={<ApartmentIcon />} 
                                label={tenant.apartment} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography 
                                variant="body2" 
                                fontWeight="bold" 
                                color="error.main"
                              >
                                {formatCurrency(tenant.totalOverdue)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {tenant.unpaidMonths}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={tenant.paymentRatio} 
                                  sx={{ 
                                    height: 8, 
                                    borderRadius: 5,
                                    flexGrow: 1,
                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor: getPaymentRatioColor(tenant.paymentRatio)
                                    }
                                  }}
                                />
                                <Typography variant="caption" fontWeight="medium">
                                  {tenant.paymentRatio}%
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => goToTenantDetails(tenant.tenantId)}
                                >
                                  Details
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<PaymentsIcon />}
                                  onClick={() => goToPayments(tenant.apartmentId)}
                                >
                                  Collect
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}

            {/* Upcoming Payments Tab */}
            {tabIndex === 1 && (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">
                    Upcoming Payments Schedule
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      variant="outlined" 
                      startIcon={<FilterListIcon />}
                      size="small"
                    >
                      Filter
                    </Button>
                    <Button 
                      variant="contained"
                      startIcon={<ReceiptIcon />}
                      size="small"
                      onClick={() => goToPayments()}
                    >
                      All Payments
                    </Button>
                  </Box>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell 
                          onClick={() => handleSort('address')}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Property {renderSortIcon('address')}
                          </Box>
                        </TableCell>
                        <TableCell 
                          onClick={() => handleSort('dueDate')}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Due Date {renderSortIcon('dueDate')}
                          </Box>
                        </TableCell>
                        <TableCell 
                          onClick={() => handleSort('daysUntil')}
                          align="center"
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Days Left {renderSortIcon('daysUntil')}
                          </Box>
                        </TableCell>
                        <TableCell 
                          onClick={() => handleSort('rent')}
                          align="right"
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            Amount {renderSortIcon('rent')}
                          </Box>
                        </TableCell>
                        <TableCell 
                          onClick={() => handleSort('status')}
                          align="center"
                          sx={{ cursor: 'pointer' }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Status {renderSortIcon('status')}
                          </Box>
                        </TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getSortedData(filteredData.upcomingPayments).map((payment) => (
                        <TableRow 
                          key={payment.apartmentId} 
                          hover
                          sx={{ 
                            bgcolor: payment.isPastDue ? 'rgba(244, 67, 54, 0.08)' : 'inherit'
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ApartmentIcon color="primary" fontSize="small" />
                              <Typography variant="body2" fontWeight="medium">
                                {payment.address}
                              </Typography>
                              {payment.tenantCount > 0 && (
                                <Chip
                                  size="small"
                                  label={`${payment.tenantCount} tenants`}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography 
                              variant="body2" 
                              fontWeight={payment.isPastDue ? "bold" : "regular"}
                              color={payment.isPastDue ? "error.main" : "inherit"}
                            >
                              {formatDate(payment.dueDate)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={payment.isPastDue ? `${Math.abs(payment.daysUntil)} days overdue` : `${payment.daysUntil} days left`}
                              color={payment.isPastDue ? "error" : payment.daysUntil <= 5 ? "warning" : "default"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(payment.rent)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              icon={
                                payment.status === 'paid' ? <CheckCircleIcon /> :
                                payment.status === 'partial' ? <PendingIcon /> :
                                <CancelIcon />
                              }
                              label={
                                payment.status === 'paid' ? 'Paid' :
                                payment.status === 'partial' ? 'Partial' :
                                'Unpaid'
                              }
                              color={
                                payment.status === 'paid' ? 'success' :
                                payment.status === 'partial' ? 'warning' :
                                'error'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PaymentsIcon />}
                              onClick={() => goToPayments(payment.apartmentId)}
                            >
                              Collect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {/* Property Alerts Tab */}
            {tabIndex === 2 && (
              <>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">
                    Property Issues & Contract Alerts
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      variant="outlined" 
                      startIcon={<FilterListIcon />}
                      size="small"
                    >
                      Filter
                    </Button>
                    <Button 
                      variant="contained"
                      startIcon={<DescriptionIcon />}
                      size="small"
                      onClick={() => navigate('/contracts')}
                    >
                      Contracts
                    </Button>
                  </Box>
                </Box>

                {filteredData.apartmentIssues.length === 0 ? (
                  <Alert severity="success" sx={{ mb: 3 }}>
                    All properties are in good standing with no imminent contract expirations.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell 
                            onClick={() => handleSort('address')}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              Property {renderSortIcon('address')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('issue')}
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              Issue {renderSortIcon('issue')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('priority')}
                            align="center"
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              Priority {renderSortIcon('priority')}
                            </Box>
                          </TableCell>
                          <TableCell 
                            onClick={() => handleSort('status')}
                            align="center"
                            sx={{ cursor: 'pointer' }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              Status {renderSortIcon('status')}
                            </Box>
                          </TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getSortedData(filteredData.apartmentIssues).map((issue) => (
                          <TableRow key={issue.apartmentId} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ApartmentIcon color="primary" fontSize="small" />
                                <Typography variant="body2" fontWeight="medium">
                                  {issue.address}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {issue.issue}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
                                color={
                                  issue.priority === 'high' ? 'error' :
                                  issue.priority === 'medium' ? 'warning' :
                                  'default'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={
                                  issue.status === 'vacant' ? 'Vacant' :
                                  issue.status === 'occupied' ? 'Occupied' :
                                  issue.status || 'Unknown'
                                }
                                variant="outlined"
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => navigate('/dashboard')}
                                >
                                  View
                                </Button>
                                {issue.issue.includes('Contract') && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<DescriptionIcon />}
                                    onClick={() => navigate('/contracts')}
                                  >
                                    Renew
                                  </Button>
                                )}
                                {issue.status === 'vacant' && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    onClick={() => navigate('/dashboard')}
                                  >
                                    Advertise
                                  </Button>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
            {tabIndex === 4 && (
              <NetEarningsSection
                paymentTrends={paymentTrends}
                expenseData={expenseData}
                apartments={apartmentMetrics}
                loading={loading}
                onRefresh={fetchAnalytics}
              />
            )}

            {/* Financial Overview Tab */}
            {tabIndex === 3 && (
              <Grid container spacing={3}>
                {/* Payment Status Distribution */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="h6" gutterBottom>
                      Payment Status Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={getPaymentStatusPieData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {getPaymentStatusPieData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [`${value} apartments`, 'Count']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>

                {/* Monthly Revenue Breakdown */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Monthly Revenue Trends
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={paymentTrends}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                        <Legend />
                        <Bar dataKey="expected" name="Expected" fill={COLORS.info} stackId="a" />
                        <Bar dataKey="collected" name="Collected" fill={COLORS.success} stackId="b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>

                {/* Top Performing Tenants */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Top 5 Performing Tenants
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Tenant</TableCell>
                            <TableCell align="right">Payment Ratio</TableCell>
                            <TableCell align="right">Total Paid</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tenantPayments
                            .sort((a, b) => b.payment_ratio - a.payment_ratio)
                            .slice(0, 5)
                            .map((tenant) => (
                              <TableRow key={tenant.name} hover>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PersonIcon fontSize="small" color="primary" />
                                    <Typography variant="body2">{tenant.name}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={`${tenant.payment_ratio}%`} 
                                    size="small"
                                    sx={{ 
                                      bgcolor: getPaymentRatioColor(tenant.payment_ratio),
                                      color: 'white' 
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(tenant.total_paid)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                {/* Tenants Requiring Attention */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                      Tenants Requiring Attention
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Tenant</TableCell>
                            <TableCell align="right">Payment Ratio</TableCell>
                            <TableCell align="right">Amount Due</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {tenantPayments
                            .sort((a, b) => a.payment_ratio - b.payment_ratio)
                            .slice(0, 5)
                            .map((tenant) => (
                              <TableRow key={tenant.name} hover>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PersonIcon fontSize="small" color="error" />
                                    <Typography variant="body2">{tenant.name}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <Chip 
                                    label={`${tenant.payment_ratio}%`} 
                                    size="small"
                                    sx={{ 
                                      bgcolor: getPaymentRatioColor(tenant.payment_ratio),
                                      color: 'white' 
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(tenant.total_due - tenant.total_paid)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>

                {/* Expense Trend */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Monthly Expenses
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={expenseData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                        <Legend />
                        <Bar dataKey="internet" name="Internet" fill={COLORS.info} stackId="a" />
                        <Bar dataKey="electricity" name="Electricity" fill={COLORS.warning} stackId="a" />
                        <Bar dataKey="other" name="Other" fill={COLORS.secondary} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              </Grid>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
}

export default AnalyticsPanel;
