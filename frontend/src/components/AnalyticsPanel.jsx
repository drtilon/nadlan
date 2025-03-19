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
  Divider,
  Avatar
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  CalendarToday as CalendarIcon,
  Payments as PaymentsIcon,
  Description as DescriptionIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
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
import api from '../utils/api';

const COLORS = {
  primary: '#3b82f6', // Blue
  secondary: '#ef4444', // Red
  success: '#22c55e', // Green
  warning: '#f97316', // Orange
  info: '#8b5cf6', // Purple
  muted: '#6b7280', // Gray
  pie: ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#10b981']
};

const MANAGEMENT_FEE_PERCENTAGE = 0.1; // 10% for management model

function AnalyticsPanel({ showNotification }) {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [paymentTrends, setPaymentTrends] = useState([]);
  const [apartmentMetrics, setApartmentMetrics] = useState([]);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, trendsResponse, apartmentResponse, tenantResponse] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/payment-trends'),
        api.get('/analytics/apartment-metrics'),
        api.get('/analytics/tenant-payments')
      ]);

      // Enhance apartment metrics with price per square meter and net profit
      const enhancedApartmentMetrics = apartmentResponse.data.map(apt => {
        const pricePerMeter = apt.rent && apt.size ? (apt.rent / apt.size).toFixed(2) : 0;
        let netProfit = 0;

        // Calculate net profit based on model
        if (apt.model === 'rental') {
          netProfit = apt.rent && apt.rentCost ? apt.rent - apt.rentCost : apt.rent || 0;
        } else if (apt.model === 'management') {
          netProfit = apt.rent ? apt.rent * MANAGEMENT_FEE_PERCENTAGE : 0;
        }

        return {
          ...apt,
          pricePerMeter,
          netProfit
        };
      });

      setSummaryData(summaryResponse.data);
      setPaymentTrends(trendsResponse.data);
      setApartmentMetrics(enhancedApartmentMetrics);
      setTenantPayments(tenantResponse.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
      showNotification('Error loading analytics data', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatCurrency = (amount) =>
    amount === undefined || amount === null
      ? '$0'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateString) =>
    !dateString
      ? 'N/A'
      : new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getPaymentStatusPieData = () => summaryData ? [
    { name: 'Paid', value: summaryData.payment_status.paid },
    { name: 'Partial', value: summaryData.payment_status.partial },
    { name: 'Not Paid', value: summaryData.payment_status.not_paid }
  ] : [];

  const filteredApartments = apartmentMetrics.filter(apt =>
    apt.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(apt.rent).includes(searchTerm) ||
    String(apt.pricePerMeter).includes(searchTerm)
  );

  const filteredTenants = tenantPayments.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.payment_history.some(p => p.month.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <TrendingUpIcon fontSize="large" /> Financial Dashboard
        </Typography>
        <IconButton
          onClick={fetchAnalytics}
          disabled={loading}
          sx={{ bgcolor: COLORS.primary, color: 'white', '&:hover': { bgcolor: '#2563eb' } }}
        >
          <RefreshIcon />
        </IconButton>
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
                        {formatCurrency(apartmentMetrics.reduce((sum, apt) => sum + apt.netProfit, 0))}
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
                        {formatCurrency(apartmentMetrics.reduce((sum, apt) => sum + Number(apt.pricePerMeter), 0) / (apartmentMetrics.length || 1))}
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

          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by apartment, tenant, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'white',
                  boxShadow: 1
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: COLORS.muted }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchTerm('')}>
                      <ArrowDownwardIcon sx={{ color: COLORS.muted }} />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
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
                        data={getPaymentStatusPieData()}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {getPaymentStatusPieData().map((entry, index) => (
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
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><Typography fontWeight={600}>Address</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Model</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Rent</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Rent Cost</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Size (m²)</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Price/m²</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Net Profit</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={600}>Status</Typography></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredApartments.map(apt => (
                      <TableRow key={apt.id} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell>{apt.address}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={apt.model === 'rental' ? 'Rental' : 'Management'}
                            color={apt.model === 'rental' ? 'primary' : 'info'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(apt.rent)}</TableCell>
                        <TableCell align="right">{apt.model === 'rental' ? formatCurrency(apt.rentCost) : 'N/A'}</TableCell>
                        <TableCell align="right">{apt.size || 'N/A'}</TableCell>
                        <TableCell align="right">{formatCurrency(apt.pricePerMeter)}</TableCell>
                        <TableCell align="right">{formatCurrency(apt.netProfit)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={apt.status === 'occupied' ? 'Occupied' : 'Vacant'}
                            color={apt.status === 'occupied' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
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
                <Table>
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
                    {filteredTenants.map(tenant => (
                      <TableRow key={tenant.name} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                        <TableCell>{tenant.name}</TableCell>
                        <TableCell>
                          {apartmentMetrics.find(apt => apt.tenants?.some(t => t.name === tenant.name))?.address || 'N/A'}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(tenant.total_paid)}</TableCell>
                        <TableCell align="right">{formatCurrency(tenant.total_due)}</TableCell>
                        <TableCell align="center">
                          <LinearProgress
                            variant="determinate"
                            value={tenant.payment_ratio}
                            sx={{
                              width: '80%',
                              height: 6,
                              borderRadius: 3,
                              bgcolor: '#e5e7eb',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: tenant.payment_ratio >= 90 ? COLORS.success : tenant.payment_ratio >= 50 ? COLORS.warning : COLORS.secondary
                              }
                            }}
                          />
                          <Typography variant="caption" sx={{ ml: 1 }}>{tenant.payment_ratio}%</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: COLORS.primary, color: COLORS.primary }}
                            onClick={() => navigate(`/tenants/${tenant.id || tenant.name}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                >
                  Manage Payments
                </Button>
              </Box>
              <TableContainer>
                <Table>
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
                    {filteredTenants.flatMap(tenant =>
                      tenant.payment_history.map((payment, index) => (
                        <TableRow key={`${tenant.name}-${index}`} hover sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                          <TableCell>{tenant.name}</TableCell>
                          <TableCell>{payment.month}</TableCell>
                          <TableCell align="right">{formatCurrency(payment.due)}</TableCell>
                          <TableCell align="right">{formatCurrency(payment.paid)}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={payment.status === 'paid' ? 'Paid' : payment.status === 'partial' ? 'Partial' : 'Unpaid'}
                              color={payment.status === 'paid' ? 'success' : payment.status === 'partial' ? 'warning' : 'secondary'}
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
        </>
      )}
    </Container>
  );
}

export default AnalyticsPanel;
