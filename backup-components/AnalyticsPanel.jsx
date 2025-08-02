import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  Button,
  Alert,
  TextField,
  InputAdornment,
  Tooltip,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Apartment as ApartmentIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Payments as PaymentsIcon,
  SwapHoriz as SwapIcon,
  DoneAll as DoneAllIcon,
  Warning as WarningIcon,
  HourglassEmpty as PendingIcon
} from '@mui/icons-material';
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
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import api from '../utils/api';

const COLORS = {
  primary: '#3b82f6',
  secondary: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#8b5cf6',
  muted: '#6b7280',
  pie: ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#10b981']
};

function AnalyticsPanel({ showNotification }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [apartmentMetrics, setApartmentMetrics] = useState([]);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('address');
  const [sortDirection, setSortDirection] = useState('asc');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const navigate = useNavigate();

  const handleGoToUserAnalytics = useCallback(() => {
    navigate('/user-analytics');
  }, [navigate]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, trendsResponse, apartmentResponse, tenantPaymentsResponse] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/payment-trends'),
        api.get('/analytics/apartment-metrics'),
        api.get('/analytics/tenant-payments')
      ]);

      setSummaryData(summaryResponse.data);
      setPaymentTrends(trendsResponse.data || []);
      setApartmentMetrics(apartmentResponse.data || []);
      setTenantPayments(tenantPaymentsResponse.data || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
      showNotification('Error loading analytics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (amount) =>
    amount == null
      ? '$0'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const getPaymentStatusPieData = useMemo(() => {
    if (!summaryData?.payment_status) return [];
    return [
      { name: 'Paid', value: summaryData.payment_status.paid || 0 },
      { name: 'Partial', value: summaryData.payment_status.partial || 0 },
      { name: 'Not Paid', value: summaryData.payment_status.not_paid || 0 }
    ];
  }, [summaryData]);

  const calculateTotalNetProfit = useMemo(() => {
    if (!apartmentMetrics?.length) return 0;
    return apartmentMetrics.reduce((sum, apt) => sum + (apt.netProfit || 0), 0);
  }, [apartmentMetrics]);

  const getFilteredSortedApartments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = apartmentMetrics || [];

    if (term) {
      filtered = filtered.filter(apt =>
        (apt.address || '').toLowerCase().includes(term) ||
        String(apt.rent || '').includes(term) ||
        String(apt.pricePerMeter || '').includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField] ?? '';
      const bValue = b[sortField] ?? '';

      if (['rent', 'pricePerMeter', 'netProfit', 'size'].includes(sortField)) {
        const aNum = parseFloat(aValue) || 0;
        const bNum = parseFloat(bValue) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [apartmentMetrics, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = useCallback((field) => {
    setSortField(field);
    setSortDirection(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
  }, [sortField]);

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

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: COLORS.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <TrendingUpIcon fontSize="large" /> Admin Analytics Dashboard
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<SwapIcon />}
          onClick={handleGoToUserAnalytics}
          sx={{ 
            fontWeight: 'medium',
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
              bgcolor: 'primary.dark'
            }
          }}
        >
          View Property Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 12 }}>
          <CircularProgress size={80} sx={{ color: COLORS.primary }} />
          <Typography variant="h6" sx={{ mt: 3, color: COLORS.muted }}>Loading financial insights...</Typography>
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 6 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: COLORS.primary, color: 'white', borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Total Apartments</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>{summaryData?.total_apartments || 0}</Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {summaryData?.occupied_apartments || 0} occupied ({summaryData?.occupancy_rate || 0}%)
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <ApartmentIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: COLORS.success, color: 'white', borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Net Profit</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {formatCurrency(calculateTotalNetProfit)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Across all units
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <MoneyIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: COLORS.info, color: 'white', borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Avg Price/m²</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {formatCurrency(
                          apartmentMetrics.length
                            ? apartmentMetrics.reduce((sum, apt) => sum + (apt.pricePerMeter || 0), 0) / apartmentMetrics.length
                            : 0
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>Across units</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <TrendingUpIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: COLORS.warning, color: 'white', borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Total Revenue</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>
                        {formatCurrency(
                          paymentTrends.reduce((sum, month) => sum + (month.collected || 0), 0)
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>Year to date</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <MoneyIcon fontSize="large" />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Search and Filters */}
          <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              variant="outlined"
              placeholder="Search by apartment or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'white',
                  flexGrow: 1,
                  maxWidth: '480px'
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: COLORS.muted }} />
                  </InputAdornment>
                )
              }}
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
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={fetchAnalytics}
                disabled={loading}
                sx={{ bgcolor: 'white', boxShadow: 1, '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' } }}
                aria-label="refresh analytics data"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Tabs */}
          <Tabs
            value={tabIndex}
            onChange={(e, newValue) => setTabIndex(newValue)}
            sx={{
              bgcolor: 'white',
              borderRadius: 2,
              boxShadow: 1,
              mb: 4,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                color: COLORS.muted,
                '&.Mui-selected': { color: COLORS.primary }
              },
              '& .MuiTabs-indicator': { bgcolor: COLORS.primary }
            }}
          >
            <Tab label="Overview" icon={<TrendingUpIcon />} iconPosition="start" />
            <Tab label="Apartments" icon={<ApartmentIcon />} iconPosition="start" />
            <Tab label="Payments" icon={<PaymentsIcon />} iconPosition="start" />
          </Tabs>

          {/* Overview Tab */}
          {tabIndex === 0 && (
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: COLORS.primary }}>
                    Payment Status
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getPaymentStatusPieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {getPaymentStatusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => [`${value} units`, 'Count']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: COLORS.primary }}>
                    Revenue Trends
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={paymentTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.muted} />
                      <XAxis dataKey="month" stroke={COLORS.muted} />
                      <YAxis stroke={COLORS.muted} />
                      <RechartsTooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                      <Legend />
                      <Line type="monotone" dataKey="expected" name="Expected" stroke={COLORS.info} strokeWidth={2} />
                      <Line type="monotone" dataKey="collected" name="Collected" stroke={COLORS.success} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Apartments Tab */}
          {tabIndex === 1 && (
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: COLORS.primary }}>
                Apartment Performance
              </Typography>
              <TableContainer>
                <Table aria-label="apartment performance table">
                  <TableHead>
                    <TableRow>
                      {[
                        { key: 'address', label: 'Address' },
                        { key: 'model', label: 'Model' },
                        { key: 'rent', label: 'Rent', align: 'right' },
                        { key: 'size', label: 'Size (m²)', align: 'right' },
                        { key: 'pricePerMeter', label: 'Price/m²', align: 'right' },
                        { key: 'netProfit', label: 'Net Profit', align: 'right' },
                        { key: 'status', label: 'Status' }
                      ].map(({ key, label, align }) => (
                        <TableCell
                          key={key}
                          align={align}
                          onClick={() => handleSort(key)}
                          sx={{ cursor: 'pointer' }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleSort(key)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
                            <Typography fontWeight={600}>{label}</Typography>
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getFilteredSortedApartments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Alert severity="info">No apartments match your search criteria</Alert>
                        </TableCell>
                      </TableRow>
                    ) : (
                      getFilteredSortedApartments.map((apt) => (
                        <TableRow key={apt.id} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                          <TableCell>{apt.address || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              label={apt.model === 'rental' ? 'Rental' : 'Management'}
                              color={apt.model === 'rental' ? 'primary' : 'info'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(apt.rent)}</TableCell>
                          <TableCell align="right">{apt.size || 'N/A'}</TableCell>
                          <TableCell align="right">{formatCurrency(apt.pricePerMeter)}</TableCell>
                          <TableCell align="right">{formatCurrency(apt.netProfit)}</TableCell>
                          <TableCell>
                            <Chip
                              label={apt.status === 'occupied' ? 'Occupied' :
                                    apt.status === 'vacant' ? 'Vacant' :
                                    apt.status === 'contract_sent' ? 'Contract Sent' : apt.status || 'Unknown'}
                              color={apt.status === 'occupied' ? 'success' :
                                    apt.status === 'vacant' ? 'primary' :
                                    'warning'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Payments Tab */}
          {tabIndex === 2 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600, color: COLORS.primary }}>
                  <PaymentsIcon /> Payment Management
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={paymentMonthFilter}
                      onChange={(e) => setPaymentMonthFilter(e.target.value)}
                      label="Month"
                    >
                      <MenuItem value="all">All Months</MenuItem>
                      {["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"
                      ].map(month => (
                        <MenuItem key={month} value={month}>{month}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Payment Status</InputLabel>
                    <Select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      label="Payment Status"
                    >
                      <MenuItem value="all">All Statuses</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
                      <MenuItem value="partial">Partial</MenuItem>
                      <MenuItem value="unpaid">Unpaid</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              
              <Grid container spacing={3}>
                {/* Payment Overview Chart */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: COLORS.primary }}>
                      Monthly Payment Overview
                    </Typography>
                    <Box sx={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getMonthlyPaymentChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <RechartsTooltip formatter={(value) => [formatCurrency(value), '']} />
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
                
                {/* Payment Stats */}
                <Grid item xs={12}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: COLORS.success, color: 'white', borderRadius: 2, height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2">Paid Payments</Typography>
                              <Typography variant="h4" sx={{ mt: 1, fontWeight: 600 }}>
                                {formatCurrency(
                                  getMonthlyPaymentChartData().reduce((sum, item) => sum + item.paid, 0)
                                )}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                                {tenantPayments.filter(tenant => 
                                  tenant.payment_history?.some(p => p.status === 'paid')
                                ).length} tenants
                              </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                              <DoneAllIcon fontSize="large" />
                            </Avatar>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: COLORS.warning, color: 'white', borderRadius: 2, height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2">Partial Payments</Typography>
                              <Typography variant="h4" sx={{ mt: 1, fontWeight: 600 }}>
                                {formatCurrency(
                                  getMonthlyPaymentChartData().reduce((sum, item) => sum + item.partial, 0)
                                )}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                                {tenantPayments.filter(tenant => 
                                  tenant.payment_history?.some(p => p.status === 'partial')
                                ).length} tenants
                              </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                              <PendingIcon fontSize="large" />
                            </Avatar>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: COLORS.secondary, color: 'white', borderRadius: 2, height: '100%' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2">Unpaid Amount</Typography>
                              <Typography variant="h4" sx={{ mt: 1, fontWeight: 600 }}>
                                {formatCurrency(
                                  getMonthlyPaymentChartData().reduce((sum, item) => sum + item.unpaid, 0)
                                )}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                                {tenantPayments.filter(tenant => 
                                  tenant.payment_history?.some(p => p.status === 'unpaid')
                                ).length} tenants
                              </Typography>
                            </Box>
                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                              <WarningIcon fontSize="large" />
                            </Avatar>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

AnalyticsPanel.propTypes = {
  showNotification: PropTypes.func.isRequired
};

export default AnalyticsPanel;
