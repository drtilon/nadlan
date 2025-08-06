// components/TenantDetails.jsx - FIXED VERSION with new payment system integration
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
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
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
  AccountBalance as BankIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const PAYMENT_TYPES = [
  { value: 'rent', label: 'Rent' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' }
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const currentYear = new Date().getFullYear();

  const [tenant, setTenant] = useState(null);
  const [apartment, setApartment] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: currentYear,
    notes: '',
    contract_period_id: null
  });

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

      // If tenant has an apartment, fetch apartment details and payment history
      if (tenantResponse.data.apartment_id) {
        await fetchApartmentData(tenantResponse.data.apartment_id, tenantResponse.data.name);
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      showNotification('Error loading tenant details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApartmentData = async (apartmentId, tenantName) => {
    try {
      // Fetch apartment details
      const apartmentResponse = await api.get(`/apartment/${apartmentId}`);
      setApartment(apartmentResponse.data);

      // Fetch contracts for this apartment
      const contractsResponse = await api.get(`/apartments/${apartmentId}/contracts`);
      setContracts(contractsResponse.data || []);

      // Fetch payment history for this apartment and filter for this tenant
      await fetchPaymentHistory(apartmentId, tenantName);

    } catch (error) {
      console.error('Error fetching apartment data:', error);
      showNotification('Error loading apartment data', 'error');
    }
  };

  const fetchPaymentHistory = async (apartmentId, tenantName) => {
    try {
      // Get payment history from the new API
      const historyResponse = await api.get(`/payment-history/${apartmentId}`);
      const allPayments = historyResponse.data || [];

      // Filter payments for this specific tenant
      const tenantPayments = allPayments.filter(payment => {
        // Check if this tenant is mentioned in the payment
        if (payment.tenant_name === tenantName) return true;
        if (payment.tenant_names && payment.tenant_names.includes(tenantName)) return true;

        // For legacy payments, check the paidBy field
        if (payment.paidBy === tenantName) return true;
        if (payment.paidFor && payment.paidFor.includes(tenantName)) return true;

        return false;
      });

      // Transform payment data to match the expected format
      const transformedPayments = tenantPayments.map(payment => ({
        id: payment.id,
        month: payment.month,
        year: payment.year,
        status: payment.status || (payment.amountPaid > 0 ? 'paid' : 'unpaid'),
        amountDue: payment.amountDue || payment.amountPaid || 0,
        amountPaid: payment.amountPaid || 0,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        paymentType: payment.paymentType || 'rent',
        notes: payment.notes || '',
        isIndividual: payment.isIndividual || false,
        contract_period_id: payment.contract_period_id,
        contract_info: payment.contract_info
      }));

      // Sort by payment date (most recent first)
      transformedPayments.sort((a, b) => {
        if (!a.paymentDate && !b.paymentDate) return 0;
        if (!a.paymentDate) return 1;
        if (!b.paymentDate) return -1;
        return new Date(b.paymentDate) - new Date(a.paymentDate);
      });

      setPaymentHistory(transformedPayments);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPaymentHistory([]);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      if (tenant && tenant.apartment_id) {
        await fetchApartmentData(tenant.apartment_id, tenant.name);
      }
      showNotification('Data refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showNotification('Error refreshing data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    navigate('/tenants');
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleGoToPaymentScreen = () => {
    if (apartment) {
      navigate(`/payments/${apartment.id}`);
    }
  };

  // Payment form handlers
  const handleAddPayment = () => {
    const currentContract = getCurrentContract();
    setPaymentForm({
      amount: '',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      payment_type: 'rent',
      month: MONTHS[new Date().getMonth()],
      year: currentYear,
      notes: '',
      contract_period_id: currentContract?.id || null
    });
    setEditingPayment(null);
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment) => {
    setPaymentForm({
      amount: payment.amountPaid?.toString() || '',
      payment_method: payment.paymentMethod || 'bank_transfer',
      payment_date: payment.paymentDate?.split('T')[0] || '',
      payment_type: payment.paymentType || 'rent',
      month: payment.month || MONTHS[new Date().getMonth()],
      year: payment.year || currentYear,
      notes: payment.notes || '',
      contract_period_id: payment.contract_period_id || null
    });
    setEditingPayment(payment);
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!paymentForm.amount || !tenant.apartment_id) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    setSubmittingPayment(true);
    try {
      const paymentData = {
        apartment_id: tenant.apartment_id,
        amount: parseFloat(paymentForm.amount),
        tenant_name: tenant.name,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        month: paymentForm.month,
        year: paymentForm.year,
        notes: paymentForm.notes,
        contract_period_id: paymentForm.contract_period_id
      };

      if (editingPayment) {
        await api.put(`/payment/${editingPayment.id}`, paymentData);
        showNotification('Payment updated successfully', 'success');
      } else {
        await api.post('/payment', paymentData);
        showNotification('Payment added successfully', 'success');
      }

      setPaymentDialogOpen(false);
      setEditingPayment(null);

      // Refresh payment history
      await fetchPaymentHistory(tenant.apartment_id, tenant.name);
    } catch (error) {
      console.error('Error saving payment:', error);
      showNotification('Error saving payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;

    try {
      await api.delete(`/payment/${paymentId}`);
      showNotification('Payment deleted successfully', 'success');

      // Refresh payment history
      await fetchPaymentHistory(tenant.apartment_id, tenant.name);
    } catch (error) {
      console.error('Error deleting payment:', error);
      showNotification('Error deleting payment', 'error');
    }
  };

  // Helper functions
  const getCurrentContract = () => {
    return contracts.find(c => c.is_current || c.status === 'active') || contracts[0];
  };

  const calculatePaymentStats = () => {
    if (!paymentHistory.length) return { paid: 0, partial: 0, unpaid: 0, total: 0, paymentRatio: 0 };

    const total = paymentHistory.length;
    const paid = paymentHistory.filter(p => p.status === 'paid' || p.amountPaid >= p.amountDue).length;
    const partial = paymentHistory.filter(p => p.status === 'partial' || (p.amountPaid > 0 && p.amountPaid < p.amountDue)).length;
    const unpaid = paymentHistory.filter(p => p.status === 'unpaid' || p.amountPaid === 0).length;

    return {
      paid,
      partial,
      unpaid,
      total,
      paymentRatio: total > 0 ? Math.round((paid / total) * 100) : 0
    };
  };

  const paymentStats = calculatePaymentStats();

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
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
  const renderPaymentStatusChip = (payment) => {
    let status = 'unpaid';
    if (payment.status === 'paid' || payment.amountPaid >= payment.amountDue) {
      status = 'paid';
    } else if (payment.amountPaid > 0) {
      status = 'partial';
    }

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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={refreshData}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Typography variant="h5" component="h1" sx={{ mx: 2 }}>
              Tenant Details
            </Typography>
          </Box>
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

                <Box sx={{ mb: 2 }}>
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
                    sx={{ height: 8, borderRadius: 1, mb: 1 }}
                  />
                </Box>

                {/* Quick Actions */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {apartment && (
                    <>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddPayment}
                        size="small"
                      >
                        Add Payment
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PaymentIcon />}
                        onClick={handleGoToPaymentScreen}
                        size="small"
                      >
                        Payment Screen
                      </Button>
                    </>
                  )}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Payment History ({paymentHistory.length} payments)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {apartment && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddPayment}
                  size="small"
                >
                  Add Payment
                </Button>
              )}
            </Box>
          </Box>

          {paymentHistory.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No payment history available for this tenant.
              {apartment && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddPayment}
                  >
                    Add First Payment
                  </Button>
                </Box>
              )}
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Contract</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CalendarIcon fontSize="small" color="action" />
                          <Typography>{formatDate(payment.paymentDate)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{payment.month} {payment.year}</TableCell>
                      <TableCell>{renderPaymentStatusChip(payment)}</TableCell>
                      <TableCell>
                        <Chip
                          label={payment.paymentType || 'rent'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(payment.amountPaid)}
                      </TableCell>
                      <TableCell>{payment.paymentMethod || 'bank_transfer'}</TableCell>
                      <TableCell>
                        {payment.contract_info ? (
                          <Chip
                            label={payment.contract_info.contract_number}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        ) : (
                          <Chip
                            label="Legacy"
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        )}
                      </TableCell>
                      <TableCell>{payment.notes || '-'}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleEditPayment(payment)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePayment(payment.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    {apartment.address}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<BusinessIcon />}
                    onClick={handleGoToPaymentScreen}
                  >
                    Manage Property
                  </Button>
                </Box>
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

                {/* Contract Information */}
                {contracts.length > 0 && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="h6" gutterBottom>
                      Contracts ({contracts.length})
                    </Typography>
                    <Grid container spacing={2}>
                      {contracts.map((contract) => (
                        <Grid item xs={12} sm={6} md={4} key={contract.id}>
                          <Card variant="outlined" sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {contract.contract_number}
                              </Typography>
                              <Chip
                                label={contract.is_current || contract.status === 'active' ? 'CURRENT' : 'PAST'}
                                size="small"
                                color={contract.is_current || contract.status === 'active' ? 'success' : 'default'}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {formatDate(contract.start_date)} - {formatDate(contract.end_date) || 'Ongoing'}
                            </Typography>
                            <Typography variant="body2" color="primary" sx={{ fontWeight: 500, mt: 1 }}>
                              {formatCurrency(contract.monthly_rent || 0)}/month
                            </Typography>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </>
                )}
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
                              paymentHistory
                                .filter(payment => payment.year === currentYear)
                                .reduce((sum, payment) => sum + payment.amountPaid, 0)
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

      {/* Add/Edit Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingPayment ? 'Edit Payment' : 'Add Payment'} for {tenant.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Type</InputLabel>
                <Select
                  value={paymentForm.payment_type}
                  label="Payment Type"
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                >
                  {PAYMENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentForm.payment_method}
                  label="Payment Method"
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method.value} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Payment Date"
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={paymentForm.month}
                  label="Month"
                  onChange={(e) => setPaymentForm({ ...paymentForm, month: e.target.value })}
                >
                  {MONTHS.map((month) => (
                    <MenuItem key={month} value={month}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={paymentForm.year}
                onChange={(e) => setPaymentForm({ ...paymentForm, year: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={3}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </Grid>
            {/* Contract Info */}
            {contracts.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Payment will be associated with: <strong>{getCurrentContract()?.contract_number || 'No active contract'}</strong>
                  {apartment && (
                    <> for apartment <strong>{apartment.address}</strong></>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setPaymentDialogOpen(false)}
            disabled={submittingPayment}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitPayment}
            disabled={submittingPayment || !paymentForm.amount}
            startIcon={submittingPayment ? <CircularProgress size={20} /> : null}
          >
            {submittingPayment ? 'Saving...' : (editingPayment ? 'Update' : 'Add')} Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TenantDetails;
