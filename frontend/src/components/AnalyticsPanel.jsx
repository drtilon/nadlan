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
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  AttachMoney as MoneyIcon,
  ShowChart as ChartIcon,
  Lightbulb as UtilityIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Payments as PaymentsIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import api from '../utils/api';

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

      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data. Please try again.');
      showNotification('Error loading analytics data', 'error');
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  // Prepare data for occupancy rate pie chart
  const getOccupancyPieData = () => {
    if (!summaryData) return [];

    return [
      { name: 'Occupied', value: summaryData.occupied_apartments },
      { name: 'Vacant', value: summaryData.total_apartments - summaryData.occupied_apartments }
    ];
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
            <ChartIcon sx={{ mr: 1 }} /> Analytics Dashboard
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
                            Total Apartments
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
                            Expected Revenue
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
                            Contracts Expiring
                          </Typography>
                          <Typography variant="h3" component="div">
                            {summaryData.expiring_soon}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Within the next 30 days
                          </Typography>
                        </div>
                        <CalendarIcon fontSize="large" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Navigation Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={tabIndex}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="analytics tabs"
              >
                <Tab label="Overview" />
                <Tab label="Financials" />
                <Tab label="Apartments" />
                <Tab label="Tenants" />
                <Tab label="Expenses" />
              </Tabs>
            </Box>

            {/* Overview Tab */}
            {tabIndex === 0 && (
              <>
                <Grid container spacing={3}>
                  {/* Payment Status Charts */}
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
                          <Tooltip formatter={(value) => [`${value} apartments`, 'Count']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Occupancy Chart */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                      <Typography variant="h6" gutterBottom>
                        Occupancy Overview
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={getOccupancyPieData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            <Cell fill={COLORS.success} />
                            <Cell fill={COLORS.error} />
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} apartments`, 'Count']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Payment Trends Chart */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Monthly Payment Trends
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart
                          data={paymentTrends}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                          <Legend />
                          <Line type="monotone" dataKey="expected" stroke={COLORS.error} name="Expected Rent" />
                          <Line type="monotone" dataKey="collected" stroke={COLORS.success} name="Collected Rent" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Financials Tab */}
            {tabIndex === 1 && (
              <>
                <Grid container spacing={3}>
                  {/* Monthly Revenue Breakdown */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Monthly Revenue Breakdown
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={paymentTrends}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                          <Legend />
                          <Bar dataKey="expected" name="Expected" fill={COLORS.info} stackId="a" />
                          <Bar dataKey="collected" name="Collected" fill={COLORS.success} stackId="b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Payment Status by Month */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Payment Status by Month
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={paymentTrends}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="paid" name="Paid" fill={COLORS.success} stackId="a" />
                          <Bar dataKey="partial" name="Partial" fill={COLORS.warning} stackId="a" />
                          <Bar dataKey="not_paid" name="Not Paid" fill={COLORS.error} stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Collection Efficiency */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Rent Collection Efficiency
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Percentage of expected rent actually collected each month
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={paymentTrends.map(month => ({
                            ...month,
                            efficiency: month.expected > 0
                              ? (month.collected / month.expected * 100).toFixed(1)
                              : 0
                          }))}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                          <Tooltip formatter={(value) => [`${value}%`, 'Collection Rate']} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="efficiency"
                            stroke={COLORS.primary}
                            name="Collection Rate"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Apartments Tab */}
            {tabIndex === 2 && (
              <>
                <Grid container spacing={3}>
                  {/* Apartment Status Summary */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Apartment Performance Overview
                      </Typography>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Address</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="right">Rent</TableCell>
                              <TableCell align="right">Collected</TableCell>
                              <TableCell>Payment Status</TableCell>
                              <TableCell align="right">Tenants</TableCell>
                              <TableCell align="right">Days Until Expiration</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {apartmentMetrics.map((apt) => (
                              <TableRow key={apt.id} hover>
                                <TableCell>{apt.address}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={apt.status || 'Unknown'}
                                    color={apt.status === 'occupied' ? 'success' : 'default'}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell align="right">{formatCurrency(apt.rent)}</TableCell>
                                <TableCell align="right">{formatCurrency(apt.collected)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={apt.payment_status}
                                    color={
                                      apt.payment_status === 'paid' ? 'success' :
                                        apt.payment_status === 'partial' ? 'warning' : 'error'
                                    }
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell align="right">{apt.tenant_count}</TableCell>
                                <TableCell align="right">
                                  {apt.days_until_expiration !== null ? (
                                    <Chip
                                      label={`${apt.days_until_expiration} days`}
                                      color={
                                        apt.days_until_expiration < 0 ? 'error' :
                                          apt.days_until_expiration < 30 ? 'warning' : 'default'
                                      }
                                      size="small"
                                    />
                                  ) : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Apartment Size Distribution */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Apartment Size Distribution
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Number of apartments by size category (sq meters)
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={(() => {
                            // Group apartments by size range
                            const sizeRanges = {
                              'Small (<50m²)': 0,
                              'Medium (50-100m²)': 0,
                              'Large (>100m²)': 0
                            };

                            apartmentMetrics.forEach(apt => {
                              const size = parseInt(apt.size || 0);
                              if (size < 50) sizeRanges['Small (<50m²)']++;
                              else if (size <= 100) sizeRanges['Medium (50-100m²)']++;
                              else sizeRanges['Large (>100m²)']++;
                            });

                            return Object.entries(sizeRanges).map(([range, count]) => ({
                              range,
                              count
                            }));
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Apartments" fill={COLORS.primary} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Contract Expiration Timeline */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Contract Expiration Timeline
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Number of contracts expiring in coming months
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={(() => {
                            // Group apartments by expiration timeframe
                            const expiryRanges = {
                              'Expired': 0,
                              '< 30 days': 0,
                              '1-3 months': 0,
                              '3-6 months': 0,
                              '6-12 months': 0,
                              '> 1 year': 0
                            };

                            apartmentMetrics.forEach(apt => {
                              const days = apt.days_until_expiration;
                              if (days === null) return; // Skip if no expiration date

                              if (days < 0) expiryRanges['Expired']++;
                              else if (days < 30) expiryRanges['< 30 days']++;
                              else if (days < 90) expiryRanges['1-3 months']++;
                              else if (days < 180) expiryRanges['3-6 months']++;
                              else if (days < 365) expiryRanges['6-12 months']++;
                              else expiryRanges['> 1 year']++;
                            });

                            return Object.entries(expiryRanges).map(([range, count]) => ({
                              range,
                              count
                            }));
                          })()}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Apartments" fill={COLORS.warning} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Tenants Tab */}
            {tabIndex === 3 && (
              <>
                <Grid container spacing={3}>
                  {/* Tenant Payment Overview */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Tenant Payment Performance
                      </Typography>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Tenant Name</TableCell>
                              <TableCell align="right">Total Due</TableCell>
                              <TableCell align="right">Total Paid</TableCell>
                              <TableCell align="right">Payment Ratio</TableCell>
                              <TableCell align="center">Payment History</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tenantPayments.map((tenant, index) => (
                              <TableRow key={index} hover>
                                <TableCell>{tenant.name}</TableCell>
                                <TableCell align="right">{formatCurrency(tenant.total_due)}</TableCell>
                                <TableCell align="right">{formatCurrency(tenant.total_paid)}</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Box sx={{ width: '100%', mr: 1 }}>
                                      <LinearProgress
                                        variant="determinate"
                                        value={tenant.payment_ratio}
                                        color={
                                          tenant.payment_ratio >= 95 ? 'success' :
                                            tenant.payment_ratio >= 75 ? 'info' :
                                              tenant.payment_ratio >= 50 ? 'warning' : 'error'
                                        }
                                        sx={{ height: 8, borderRadius: 1 }}
                                      />
                                    </Box>
                                    <Box sx={{ minWidth: 35 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {tenant.payment_ratio}%
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                                    {tenant.payment_history.slice(0, 6).map((payment, idx) => (
                                      <Tooltip
                                        key={idx}
                                        title={`${payment.month}: ${formatCurrency(payment.paid)} / ${formatCurrency(payment.due)}`}
                                        arrow
                                      >
                                        <Chip
                                          label={payment.month.substring(0, 3)}
                                          size="small"
                                          color={
                                            payment.status === 'paid' ? 'success' :
                                              payment.status === 'partial' ? 'warning' : 'error'
                                          }
                                          sx={{ fontSize: '0.7rem' }}
                                        />
                                      </Tooltip>
                                    ))}
                                    {tenant.payment_history.length > 6 && (
                                      <Chip
                                        label={`+${tenant.payment_history.length - 6}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.7rem' }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Tenant Payment Statistics */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Tenant Payment Behavior
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={(() => {
                              // Calculate payment behavior categories
                              const paymentBehavior = {
                                'Excellent (95-100%)': 0,
                                'Good (80-95%)': 0,
                                'Average (65-80%)': 0,
                                'Poor (50-65%)': 0,
                                'Problematic (<50%)': 0
                              };

                              tenantPayments.forEach(tenant => {
                                const ratio = tenant.payment_ratio;
                                if (ratio >= 95) paymentBehavior['Excellent (95-100%)']++;
                                else if (ratio >= 80) paymentBehavior['Good (80-95%)']++;
                                else if (ratio >= 65) paymentBehavior['Average (65-80%)']++;
                                else if (ratio >= 50) paymentBehavior['Poor (50-65%)']++;
                                else paymentBehavior['Problematic (<50%)']++;
                              });

                              return Object.entries(paymentBehavior).map(([category, count]) => ({
                                name: category,
                                value: count
                              }));
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) =>
                              percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : null
                            }
                          >
                            {getPaymentStatusPieData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} tenants`, 'Count']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Top/Bottom Tenants */}
                  <Grid item xs={12} md={6}>
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="h6" gutterBottom>
                            Most Reliable Tenants
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell align="right">Payment Ratio</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[...tenantPayments]
                                  .sort((a, b) => b.payment_ratio - a.payment_ratio)
                                  .slice(0, 5)
                                  .map((tenant, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{tenant.name}</TableCell>
                                      <TableCell align="right">
                                        <Chip
                                          label={`${tenant.payment_ratio}%`}
                                          color="success"
                                          size="small"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Paper>
                      </Grid>
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="h6" gutterBottom color="error">
                            Tenants Requiring Attention
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell align="right">Payment Ratio</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {[...tenantPayments]
                                  .sort((a, b) => a.payment_ratio - b.payment_ratio)
                                  .slice(0, 5)
                                  .map((tenant, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{tenant.name}</TableCell>
                                      <TableCell align="right">
                                        <Chip
                                          label={`${tenant.payment_ratio}%`}
                                          color="error"
                                          size="small"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </>
            )}

            {/* Expenses Tab */}
            {tabIndex === 4 && (
              <>
                <Grid container spacing={3}>
                  {/* Monthly Expenses Overview */}
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Monthly Expenses Breakdown
                      </Typography>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart
                          data={expenseData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                          <Legend />
                          <Bar dataKey="internet" name="Internet" fill={COLORS.info} stackId="a" />
                          <Bar dataKey="electricity" name="Electricity" fill={COLORS.warning} stackId="a" />
                          <Bar dataKey="other" name="Other" fill={COLORS.secondary} stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Expense Category Distribution */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Expense Category Distribution
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Breakdown of expenses by category
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={(() => {
                              // Calculate totals for each expense category
                              const totalInternet = expenseData.reduce((sum, month) => sum + month.internet, 0);
                              const totalElectricity = expenseData.reduce((sum, month) => sum + month.electricity, 0);
                              const totalOther = expenseData.reduce((sum, month) => sum + month.other, 0);

                              return [
                                { name: 'Internet', value: totalInternet },
                                { name: 'Electricity', value: totalElectricity },
                                { name: 'Other', value: totalOther }
                              ];
                            })()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) =>
                              percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : null
                            }
                          >
                            <Cell fill={COLORS.info} />
                            <Cell fill={COLORS.warning} />
                            <Cell fill={COLORS.secondary} />
                          </Pie>
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Expense Trend */}
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Total Expense Trend
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Monthly total expense trend
                        </Typography>
                      </Box>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={expenseData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [formatCurrency(value), 'Total Expenses']} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke={COLORS.error}
                            name="Total Expenses"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
}

export default AnalyticsPanel;
