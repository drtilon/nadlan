// components/TenantDetails.jsx - Complete implementation with all tabs
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  Box,
  Chip,
  LinearProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Person as PersonIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Receipt as ReceiptIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as PaidIcon,
  Cancel as UnpaidIcon,
  Error as PartialIcon,
  Cake as BirthdayIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';
import api from '../../utils/api';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function TenantDetails({ showNotification }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [apartment, setApartment] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
    }
  }, [tenantId]);

  const fetchTenantData = async () => {
    setLoading(true);
    try {
      // Fetch tenant details
      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      setTenant(tenantResponse.data);

      // If tenant has an apartment, fetch apartment details
      if (tenantResponse.data.apartment_id) {
        const apartmentResponse = await api.get(`/apartment/${tenantResponse.data.apartment_id}`);
        setApartment(apartmentResponse.data);

        // Fetch payment data for this tenant
        const paymentsResponse = await api.get(`/payments/${tenantResponse.data.apartment_id}`);

        // Process payment data to extract this tenant's payments
        const tenantPayments = [];
        const months = Object.keys(paymentsResponse.data);

        months.forEach(month => {
          const monthData = paymentsResponse.data[month];
          if (monthData.tenants && Array.isArray(monthData.tenants)) {
            const tenantData = monthData.tenants.find(t =>
              t.name === tenantResponse.data.name || t.id === tenantId
            );

            if (tenantData) {
              tenantPayments.push({
                month,
                year: new Date().getFullYear(),
                status: tenantData.paid ? 'paid' :
                  (parseFloat(tenantData.amountPaid) > 0 ? 'partial' : 'unpaid'),
                amountDue: parseFloat(tenantData.amountDue) || 0,
                amountPaid: parseFloat(tenantData.amountPaid) || 0,
                paymentDate: tenantData.paymentDate || null,
                paymentMethod: tenantData.paymentMethod || null,
                notes: tenantData.notes || null
              });
            }
          }
        });

        // Sort payments by month
        const monthOrder = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];

        tenantPayments.sort((a, b) => {
          return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
        });

        setPaymentHistory(tenantPayments);
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      showNotification('Error loading tenant details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/tenants');
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Calculate payment statistics
  const calculatePaymentStats = () => {
    if (!paymentHistory.length) return { paid: 0, partial: 0, unpaid: 0, total: 0, paymentRatio: 0 };

    const total = paymentHistory.length;
    const paid = paymentHistory.filter(p => p.status === 'paid').length;
    const partial = paymentHistory.filter(p => p.status === 'partial').length;
    const unpaid = paymentHistory.filter(p => p.status === 'unpaid').length;

    return {
      paid,
      partial,
      unpaid,
      total,
      paymentRatio: Math.round((paid / total) * 100)
    };
  };

  const paymentStats = calculatePaymentStats();

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  };

  // Render payment status chip
  const renderPaymentStatusChip = (status) => {
    switch (status) {
      case 'paid':
        return <Chip icon={<PaidIcon />} label="Paid" size="small" color="success" />;
      case 'partial':
        return <Chip icon={<PartialIcon />} label="Partial" size="small" color="warning" />;
      case 'unpaid':
        return <Chip icon={<UnpaidIcon />} label="Unpaid" size="small" color="error" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
            Loading tenant details...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Alert severity="error">
            Tenant not found or error loading data
          </Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ mt: 2 }}
          >
            Back to Tenants
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header with back button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Back to Tenants List
          </Button>
          <Typography variant="h5" component="h1">
            Tenant Details
          </Typography>
        </Box>

        {/* Tenant Profile Card */}
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    bgcolor: 'primary.main',
                    fontSize: '2.5rem'
                  }}
                >
                  {tenant.name ? tenant.name.charAt(0).toUpperCase() : <PersonIcon fontSize="large" />}
                </Avatar>
              </Grid>
              <Grid item xs={12} md={5}>
                <Typography variant="h5" gutterBottom>
                  {tenant.name}
                </Typography>
                <Stack spacing={1.5}>
                  {tenant.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon color="action" />
                      <Typography variant="body1">{tenant.email}</Typography>
                    </Box>
                  )}
                  {tenant.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon color="action" />
                      <Typography variant="body1">{tenant.phone}</Typography>
                    </Box>
                  )}
                  {tenant.bornOn && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BirthdayIcon color="action" />
                      <Typography variant="body1">Born: {formatDate(tenant.bornOn)}</Typography>
                    </Box>
                  )}
                  {tenant.refundIban && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BankIcon color="action" />
                      <Typography variant="body1">IBAN: {tenant.refundIban}</Typography>
                    </Box>
                  )}
                  {apartment && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HomeIcon color="action" />
                      <Typography variant="body1">{apartment.address}</Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>

              <Grid item xs={12} md={5}>
                <Typography variant="h6" gutterBottom>
                  Payment Summary
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {paymentStats.paid}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Paid
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {paymentStats.partial}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Partial
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="error.main">
                        {paymentStats.unpaid}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Unpaid
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Payment Reliability: {paymentStats.paymentRatio}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={paymentStats.paymentRatio}
                    color={
                      paymentStats.paymentRatio >= 80 ? "success" :
                        paymentStats.paymentRatio >= 50 ? "warning" : "error"
                    }
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs for different sections */}
        <Box sx={{ width: '100%', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<ReceiptIcon />} label="Payment History" />
            <Tab icon={<HomeIcon />} label="Property Details" />
            <Tab icon={<PersonIcon />} label="Personal Details" />
            <Tab icon={<MoneyIcon />} label="Financial Summary" />
          </Tabs>
        </Box>

        {/* Payment History Tab */}
        <TabPanel value={activeTab} index={0}>
          {paymentHistory.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No payment history available for this tenant.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount Due</TableCell>
                    <TableCell align="right">Amount Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentHistory.map((payment, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography>{payment.month} {payment.year}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{renderPaymentStatusChip(payment.status)}</TableCell>
                      <TableCell align="right">{formatCurrency(payment.amountDue)}</TableCell>
                      <TableCell align="right">{formatCurrency(payment.amountPaid)}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={payment.amountPaid >= payment.amountDue ? 'success.main' : 'error.main'}
                          fontWeight="medium"
                        >
                          {formatCurrency(payment.amountPaid - payment.amountDue)}
                        </Typography>
                      </TableCell>
                      <TableCell>{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Property Details Tab */}
        <TabPanel value={activeTab} index={1}>
          {!apartment ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No property is currently assigned to this tenant.
            </Alert>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {apartment.address}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Property Details
                        </Typography>
                        <Typography variant="body1">
                          {apartment.rooms} Rooms • {apartment.size} sq meters
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Status
                        </Typography>
                        <Chip
                          label={apartment.status || 'Not specified'}
                          color={apartment.status === 'occupied' ? 'success' : 'default'}
                        />
                      </Box>
                      {apartment.notes && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Notes
                          </Typography>
                          <Typography variant="body1">
                            {apartment.notes}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Contract Period
                        </Typography>
                        <Typography variant="body1">
                          {apartment.moveInDate ? formatDate(apartment.moveInDate) : 'Not set'} - {apartment.contractEndDate ? formatDate(apartment.contractEndDate) : 'Not set'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Monthly Rent
                        </Typography>
                        <Typography variant="h6" color="primary.main">
                          {formatCurrency(apartment.rent || 0)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Security Deposit
                        </Typography>
                        <Typography variant="body1">
                          {formatCurrency(apartment.deposit || 0)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* Personal Details Tab */}
        <TabPanel value={activeTab} index={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Full Name
                      </Typography>
                      <Typography variant="body1">
                        {tenant.name || 'Not provided'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Email Address
                      </Typography>
                      <Typography variant="body1">
                        {tenant.email || 'Not provided'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Phone Number
                      </Typography>
                      <Typography variant="body1">
                        {tenant.phone || 'Not provided'}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Date of Birth
                      </Typography>
                      <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BirthdayIcon fontSize="small" color="action" />
                        {formatDate(tenant.bornOn) || 'Not provided'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Refund Bank Account (IBAN)
                      </Typography>
                      <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BankIcon fontSize="small" color="action" />
                        {tenant.refundIban || 'Not provided'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Tenant ID
                      </Typography>
                      <Chip
                        label={tenant.id}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Financial Summary Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payment Overview
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Paid This Year
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {formatCurrency(
                              paymentHistory.reduce((sum, payment) => sum + payment.amountPaid, 0)
                            )}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total Outstanding
                          </Typography>
                          <Typography variant="h4" color="error.main">
                            {formatCurrency(
                              paymentHistory.reduce((sum, payment) =>
                                sum + Math.max(0, payment.amountDue - payment.amountPaid), 0)
                            )}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Monthly Average
                          </Typography>
                          <Typography variant="h5">
                            {formatCurrency(
                              paymentHistory.length > 0 ?
                                paymentHistory.reduce((sum, payment) => sum + payment.amountDue, 0) / paymentHistory.length : 0
                            )}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Payment Reliability
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        On-Time Payment Rate
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={paymentStats.paymentRatio}
                        color={
                          paymentStats.paymentRatio >= 80 ? "success" :
                            paymentStats.paymentRatio >= 50 ? "warning" : "error"
                        }
                        sx={{ height: 15, borderRadius: 1, mb: 1 }}
                      />
                      <Typography variant="h5" align="center">
                        {paymentStats.paymentRatio}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Payment Status Distribution
                      </Typography>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                            <Typography variant="h5">{paymentStats.paid}</Typography>
                            <Typography variant="body2">Paid</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                            <Typography variant="h5">{paymentStats.partial}</Typography>
                            <Typography variant="body2">Partial</Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
                            <Typography variant="h5">{paymentStats.unpaid}</Typography>
                            <Typography variant="body2">Unpaid</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default TenantDetails;
