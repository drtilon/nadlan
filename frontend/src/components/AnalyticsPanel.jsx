// components/AnalyticsPanel.jsx - Updated with navigation to UserAnalyticsPanel
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
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
  CardContent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Payments as PaymentsIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Dashboard as DashboardIcon,
  SwapHoriz as SwapIcon
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
  const navigate = useNavigate();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, trendsResponse, apartmentResponse, tenantResponse] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/payment-trends'),
        api.get('/analytics/apartment-metrics'),
        api.get('/analytics/tenant-payments')
      ]);

      setSummaryData(summaryResponse.data);
      setPaymentTrends(trendsResponse.data || []);
      setApartmentMetrics(apartmentResponse.data || []);
      setTenantPayments(tenantResponse.data || []);
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

  const formatDate = (dateString) =>
    !dateString
      ? 'N/A'
      : new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

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

  const tenantApartmentMap = useMemo(() => {
    const map = {};
    apartmentMetrics.forEach(apt => {
      if (apt.tenants) {
        apt.tenants.forEach(tenant => {
          map[tenant.name] = apt.address;
        });
      }
    });
    return map;
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

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
  };

  const filteredTenants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tenantPayments.filter(tenant =>
      (tenant.name || '').toLowerCase().includes(term) ||
      tenant.payment_history?.some(p => (p.month || '').toLowerCase().includes(term))
    );
  }, [tenantPayments, searchTerm]);

  // Navigate to user analytics view
  const handleGoToUserAnalytics = () => {
    navigate('/user-analytics');
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
        
        {/* Added button to navigate to User Analytics */}
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
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Total Tenants</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600 }}>{summaryData?.total_tenants || 0}</Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>Active leases</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <PersonIcon fontSize="large" />
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
              placeholder="Search by apartment, tenant, or amount..."
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
            <Tab label="Tenants" icon={<PersonIcon />} iconPosition="start" />
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
                            {getSortIcon(key)}
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

          {/* Tenants Tab */}
          {tabIndex === 2 && (
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: COLORS.primary }}>
                Tenant Payment Overview
              </Typography>
              <TableContainer>
                <Table aria-label="tenant payment overview table">
                  <TableHead>
                    <TableRow>
                      <TableCell><Typography fontWeight={600}>Tenant</Typography></TableCell>
                      <TableCell><Typography fontWeight={600}>Apartment</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Total Paid</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Total Due</Typography></TableCell>
                      <TableCell align="center"><Typography fontWeight={600}>Payment Ratio</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Actions</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Alert severity="info">No tenants match your search criteria</Alert>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTenants.map(tenant => (
                        <TableRow key={tenant.id || tenant.name} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                          <TableCell>{tenant.name || 'Unknown'}</TableCell>
                          <TableCell>{tenantApartmentMap[tenant.name] || 'N/A'}</TableCell>
                          <TableCell align="right">{formatCurrency(tenant.total_paid)}</TableCell>
                          <TableCell align="right">{formatCurrency(tenant.total_due)}</TableCell>
                          <TableCell align="center">
                            <LinearProgress
                              variant="determinate"
                              value={tenant.payment_ratio || 0}
                              sx={{
                                width: '80%',
                                height: 6,
                                borderRadius: 3,
                                bgcolor: '#e5e7eb',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: (tenant.payment_ratio || 0) >= 90 ? COLORS.success :
                                          (tenant.payment_ratio || 0) >= 50 ? COLORS.warning : COLORS.secondary
                                }
                              }}
                            />
                            <Typography variant="caption" sx={{ ml: 1 }}>{tenant.payment_ratio || 0}%</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: COLORS.primary, color: COLORS.primary }}
                              onClick={() => tenant.id && navigate(`/tenants/${tenant.id}`)}
                              disabled={!tenant.id}
                              aria-label={`View details for ${tenant.name}`}
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
            </Paper>
          )}

          {/* Payments Tab */}
          {tabIndex === 3 && (
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: COLORS.primary }}>
                  Payment History
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PaymentsIcon />}
                  sx={{ bgcolor: COLORS.primary, '&:hover': { bgcolor: '#2563eb' } }}
                  onClick={() => navigate('/payments')}
                  aria-label="Manage payments"
                >
                  Manage Payments
                </Button>
              </Box>
              <TableContainer>
                <Table aria-label="payment history table">
                  <TableHead>
                    <TableRow>
                      <TableCell><Typography fontWeight={600}>Tenant</Typography></TableCell>
                      <TableCell><Typography fontWeight={600}>Month</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Amount Due</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Amount Paid</Typography></TableCell>
                      <TableCell align="center"><Typography fontWeight={600}>Status</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Alert severity="info">No payment history matches your search criteria</Alert>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTenants.flatMap(tenant =>
                        (tenant.payment_history || []).map((payment, index) => (
                          <TableRow key={`${tenant.id || tenant.name}-${index}`} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                            <TableCell>{tenant.name || 'Unknown'}</TableCell>
                            <TableCell>{payment.month || 'N/A'}</TableCell>
                            <TableCell align="right">{formatCurrency(payment.due)}</TableCell>
                            <TableCell align="right">{formatCurrency(payment.paid)}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={payment.status === 'paid' ? 'Paid' :
                                      payment.status === 'partial' ? 'Partial' :
                                      payment.status === 'unpaid' ? 'Unpaid' : 'Unknown'}
                                color={payment.status === 'paid' ? 'success' :
                                      payment.status === 'partial' ? 'warning' :
                                      payment.status === 'unpaid' ? 'error' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
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
