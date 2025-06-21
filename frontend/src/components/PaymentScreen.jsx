import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  Box,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import api from '../utils/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

function PaymentScreen({ showNotification }) {
  const { apartmentId } = useParams();
  const currentYear = new Date().getFullYear();

  // State management
  const [selectedApartment, setSelectedApartment] = useState(apartmentId || '');
  const [apartments, setApartments] = useState([]);
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState('current');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentMode, setPaymentMode] = useState(1); // Default to individual mode

  // Form state for individual payment
  const [individualPaymentForm, setIndividualPaymentForm] = useState({
    amount: '',
    tenant_name: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: currentYear,
    notes: ''
  });

  // Form state for batch payment (legacy)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paidBy: '',
    paidFor: [],
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: currentYear,
    notes: ''
  });

  // Form state for new payment period dialog
  const [periodForm, setPeriodForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    rent: '',
    tenants: []
  });

  // Initialize data on component mount
  useEffect(() => {
    fetchApartments();
  }, []);

  // Load apartment data when selection changes
  useEffect(() => {
    if (selectedApartment) {
      loadApartmentData();
    }
  }, [selectedApartment]);

  // API calls
  const fetchApartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/list');
      setApartments(response.data || []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      showNotification?.('Error fetching apartments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadApartmentData = async () => {
    try {
      setLoading(true);

      // Fetch apartment details
      const apartmentResponse = await api.get(`/apartment/${selectedApartment}`);
      setApartmentDetails(apartmentResponse.data);

      // Fetch payment history from the payment-history endpoint
      const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
      const historyPayments = historyResponse.data || [];

      // Transform payment data for display
      const paymentsList = historyPayments.map(payment => ({
        id: payment.id,
        month: payment.month,
        year: payment.year,
        amountPaid: payment.amountPaid,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod || 'bank_transfer',
        paymentType: payment.paymentType || 'rent',
        paidBy: payment.tenant_name || '',
        paidFor: payment.tenant_names || (payment.tenant_name ? [payment.tenant_name] : []),
        notes: payment.notes || '',
        status: payment.status,
        isIndividual: payment.isIndividual || false
      }));

      // Sort payments by date (newest first)
      paymentsList.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      setPayments(paymentsList);

      // Fetch contracts/payment periods
      try {
        const contractsResponse = await api.get(`/apartment/${selectedApartment}/contracts`);
        setContracts(contractsResponse.data || []);
      } catch (contractError) {
        console.log('Contracts endpoint not available, using fallback');
        if (apartmentResponse.data?.moveInDate) {
          const fallbackContract = {
            id: 'current',
            startDate: apartmentResponse.data.moveInDate,
            endDate: apartmentResponse.data.contractEndDate || null,
            rent: apartmentResponse.data.rent
          };
          setContracts([fallbackContract]);
        } else {
          setContracts([]);
        }
      }

    } catch (error) {
      console.error('Error loading apartment data:', error);
      showNotification?.('Error loading apartment data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getCurrentTenants = () => {
    if (!apartmentDetails?.tenants) return [];
    if (Array.isArray(apartmentDetails.tenants)) {
      return apartmentDetails.tenants.map(t => t.name || t);
    }
    if (typeof apartmentDetails.tenants === 'string') {
      return apartmentDetails.tenants.split(',').map(t => t.trim()).filter(t => t);
    }
    return [];
  };

  const getCurrentContract = () => {
    if (!contracts || contracts.length === 0) return null;

    const now = new Date();
    const activeContract = contracts.find(contract => {
      const startDate = new Date(contract.startDate);
      const endDate = contract.endDate ? new Date(contract.endDate) : null;
      return now >= startDate && (!endDate || now <= endDate);
    });

    return activeContract || contracts[contracts.length - 1]; // Latest if none active
  };

  const getContractPayments = (contract) => {
    if (!contract || !payments) return [];

    const startDate = new Date(contract.startDate);
    const endDate = contract.endDate ? new Date(contract.endDate) : new Date();

    return payments.filter(payment => {
      if (!payment.paymentDate) return false;
      const paymentDate = new Date(payment.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });
  };

  const getFilteredPayments = () => {
    if (!payments) return [];
    if (selectedContract === 'all') return payments;
    if (selectedContract === 'current') {
      const currentContract = getCurrentContract();
      return currentContract ? getContractPayments(currentContract) : [];
    }

    const contract = contracts.find(c => c.id === selectedContract);
    return contract ? getContractPayments(contract) : [];
  };

  const getContractInfo = () => {
    const targetContract = getCurrentContract();
    if (!targetContract || !apartmentDetails) {
      return {
        totalDue: 0,
        totalPaid: 0,
        remaining: 0,
        monthsTotal: 0,
        isActive: false,
        isExpired: false,
        contract: null
      };
    }

    const contractStartDate = new Date(targetContract.startDate);
    const contractEndDate = targetContract.endDate ? new Date(targetContract.endDate) : null;
    const monthlyRent = targetContract.rent || apartmentDetails?.rent || 0;
    const now = new Date();

    const isActive = now >= contractStartDate && (!contractEndDate || now <= contractEndDate);
    const isExpired = contractEndDate && now > contractEndDate;

    const effectiveEndDate = contractEndDate || now;
    const monthsDiff = Math.max(0,
      (effectiveEndDate.getFullYear() - contractStartDate.getFullYear()) * 12 +
      (effectiveEndDate.getMonth() - contractStartDate.getMonth()) + 1
    );

    const totalDue = monthlyRent * monthsDiff;
    const contractPayments = getContractPayments(targetContract);
    const totalPaid = contractPayments.reduce((sum, p) => sum + (parseFloat(p.amountPaid) || 0), 0);
    const remaining = Math.max(0, totalDue - totalPaid);

    return {
      totalDue,
      totalPaid,
      remaining,
      monthsTotal: monthsDiff,
      isActive,
      isExpired,
      contract: targetContract
    };
  };

  // Form handlers
  const resetIndividualPaymentForm = () => {
    const tenants = getCurrentTenants();
    setIndividualPaymentForm({
      amount: '',
      tenant_name: tenants[0] || '',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      payment_type: 'rent',
      month: MONTHS[new Date().getMonth()],
      year: currentYear,
      notes: ''
    });
  };

  const resetPaymentForm = () => {
    const tenants = getCurrentTenants();
    setPaymentForm({
      amount: '',
      paidBy: tenants[0] || '',
      paidFor: [],
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentType: 'rent',
      month: MONTHS[new Date().getMonth()],
      year: currentYear,
      notes: ''
    });
  };

  const handleAddPayment = () => {
    resetIndividualPaymentForm();
    resetPaymentForm();
    setEditingPayment(null);
    setPaymentMode(1); // Default to individual mode
    setDialogOpen(true);
  };

  const handleEditPayment = (payment) => {
    if (payment.isIndividual) {
      // Edit individual payment
      setIndividualPaymentForm({
        amount: payment.amountPaid?.toString() || '',
        tenant_name: payment.paidBy || '',
        payment_method: payment.paymentMethod || 'bank_transfer',
        payment_date: payment.paymentDate?.split('T')[0] || '',
        payment_type: payment.paymentType || 'rent',
        month: payment.month || MONTHS[new Date().getMonth()],
        year: payment.year || currentYear,
        notes: payment.notes || ''
      });
      setPaymentMode(1);
    } else {
      // Edit batch payment
      setPaymentForm({
        amount: payment.amountPaid?.toString() || '',
        paidBy: payment.paidBy || '',
        paidFor: payment.paidFor || [],
        paymentMethod: payment.paymentMethod || 'bank_transfer',
        paymentDate: payment.paymentDate?.split('T')[0] || '',
        paymentType: payment.paymentType || 'rent',
        month: payment.month || MONTHS[new Date().getMonth()],
        year: payment.year || currentYear,
        notes: payment.notes || ''
      });
      setPaymentMode(0);
    }
    setEditingPayment(payment);
    setDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (paymentMode === 1) {
      // Individual payment submission
      if (!individualPaymentForm.amount || !individualPaymentForm.tenant_name || !individualPaymentForm.month) {
        showNotification?.('Please fill in all required fields', 'error');
        return;
      }

      try {
        setLoading(true);
        const paymentData = {
          apartment_id: parseInt(selectedApartment),
          amount: parseFloat(individualPaymentForm.amount),
          tenant_name: individualPaymentForm.tenant_name,
          payment_method: individualPaymentForm.payment_method,
          payment_date: individualPaymentForm.payment_date,
          payment_type: individualPaymentForm.payment_type,
          month: individualPaymentForm.month,
          year: individualPaymentForm.year,
          notes: individualPaymentForm.notes
        };

        if (editingPayment && editingPayment.isIndividual) {
          await api.put(`/payment/${editingPayment.id}`, paymentData);
          showNotification?.('Payment updated successfully', 'success');
        } else {
          await api.post('/payment', paymentData);
          showNotification?.('Payment added successfully', 'success');
        }

        setDialogOpen(false);
        setEditingPayment(null);
        await loadApartmentData();
      } catch (error) {
        console.error('Error saving individual payment:', error);
        const errorMessage = error.response?.data?.message || 'Error saving payment';
        showNotification?.(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Batch payment submission (legacy)
      if (!paymentForm.amount || !paymentForm.paidBy || paymentForm.paidFor.length === 0) {
        showNotification?.('Please fill in all required fields', 'error');
        return;
      }

      try {
        setLoading(true);

        // Get current payments for the year
        const currentPaymentsResponse = await api.get(`/payments/${selectedApartment}?year=${paymentForm.year}`);
        const currentPayments = currentPaymentsResponse.data?.payments || {};

        const totalAmount = parseFloat(paymentForm.amount);
        const amountPerTenant = totalAmount / paymentForm.paidFor.length;

        const tenantData = paymentForm.paidFor.map(tenantName => ({
          name: tenantName,
          amountDue: amountPerTenant,
          amountPaid: amountPerTenant,
          paid: true
        }));

        const updatedPayments = {
          ...currentPayments,
          [paymentForm.month]: {
            ...currentPayments[paymentForm.month],
            status: 'paid',
            tenants: tenantData,
            extraPayments: {
              internet: 0,
              electricity: 0,
              other: 0
            },
            paymentDate: paymentForm.paymentDate,
            paymentMethod: paymentForm.paymentMethod,
            notes: paymentForm.notes || ''
          }
        };

        const updateData = {
          payments: updatedPayments,
          year: parseInt(paymentForm.year)
        };

        await api.post(`/payments/${selectedApartment}`, updateData);

        showNotification?.('Batch payment saved successfully', 'success');
        setDialogOpen(false);
        setEditingPayment(null);
        await loadApartmentData();

      } catch (error) {
        console.error('Error saving batch payment:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Error saving payment';
        showNotification?.(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;

    try {
      setLoading(true);
      await api.delete(`/payment/${paymentId}`);
      showNotification?.('Payment deleted successfully', 'success');
      await loadApartmentData();
    } catch (error) {
      console.error('Error deleting payment:', error);
      showNotification?.('Error deleting payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPaymentPeriod = () => {
    const currentTenants = getCurrentTenants();
    setPeriodForm({
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      rent: apartmentDetails?.rent?.toString() || '',
      tenants: currentTenants
    });
    setPeriodDialogOpen(true);
  };

  const handleCreatePaymentPeriod = async () => {
    if (!periodForm.startDate || !periodForm.rent) {
      showNotification?.('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/apartment/${selectedApartment}/new-payment-period`, {
        start_date: periodForm.startDate,
        end_date: periodForm.endDate || null,
        rent: parseFloat(periodForm.rent),
        tenants: periodForm.tenants
      });

      showNotification?.('New payment period created successfully', 'success');
      setPeriodDialogOpen(false);
      await loadApartmentData();
    } catch (error) {
      console.error('Error creating payment period:', error);
      showNotification?.('Error creating new payment period', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Get contract info for display
  const contractInfo = getContractInfo();
  const filteredPayments = getFilteredPayments();
  const tenants = getCurrentTenants();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Payment Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track and manage apartment payments
        </Typography>
      </Box>

      {/* Apartment Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Apartment</InputLabel>
                <Select
                  value={selectedApartment}
                  label="Select Apartment"
                  onChange={(e) => setSelectedApartment(e.target.value)}
                >
                  {apartments.map((apt) => (
                    <MenuItem key={apt.id} value={apt.id}>
                      {apt.address}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {selectedApartment && (
              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddPayment}
                    size="large"
                  >
                    Add Payment
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {selectedApartment && !loading && apartmentDetails && (
        <>
          {/* Apartment Info Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Typography variant="h6" gutterBottom>
                    {apartmentDetails.address}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip label={`${tenants.length} tenants`} />
                    <Chip label={`${formatCurrency(apartmentDetails.rent)}/month`} />
                    <Chip label={`${apartmentDetails.rooms || 'N/A'} rooms`} />
                  </Stack>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Tenants: {tenants.join(', ') || 'No tenants assigned'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Period
                      </Typography>
                      <Chip
                        label={contractInfo.isExpired ? 'Expired' : contractInfo.isActive ? 'Active' : 'Inactive'}
                        color={contractInfo.isExpired ? 'error' : contractInfo.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                      {formatCurrency(contractInfo.totalPaid)} / {formatCurrency(contractInfo.totalDue)}
                    </Typography>
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                      Remaining: {formatCurrency(contractInfo.remaining)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {contractInfo.monthsTotal} months total
                    </Typography>
                    {(contractInfo.isExpired || contractInfo.remaining === 0) && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleNewPaymentPeriod}
                        sx={{ mt: 1 }}
                      >
                        New Payment Period
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ReceiptIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Payment History</Typography>
                </Box>

                {contracts.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Payment Period</InputLabel>
                    <Select
                      value={selectedContract}
                      label="Payment Period"
                      onChange={(e) => setSelectedContract(e.target.value)}
                    >
                      <MenuItem value="current">Current Period</MenuItem>
                      <MenuItem value="all">All Periods</MenuItem>
                      {contracts.map((contract, index) => (
                        <MenuItem key={contract.id} value={contract.id}>
                          Period {contracts.length - index}: {formatDate(contract.startDate)} - {contract.endDate ? formatDate(contract.endDate) : 'Ongoing'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              {/* Contract Summary */}
              {selectedContract !== 'all' && contractInfo.contract && (
                <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <Typography variant="subtitle2" gutterBottom>
                          {selectedContract === 'current' ? 'Current Payment Period' : 'Selected Payment Period'} Summary
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <Chip
                            label={`${formatDate(contractInfo.contract.startDate)} - ${contractInfo.contract.endDate ? formatDate(contractInfo.contract.endDate) : 'Ongoing'}`}
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={`${formatCurrency(contractInfo.contract.rent || 0)}/month`}
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={contractInfo.isExpired ? 'Expired' : contractInfo.isActive ? 'Active' : 'Inactive'}
                            color={contractInfo.isExpired ? 'error' : contractInfo.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                          <Typography variant="body2" color="text.secondary">
                            Period Progress
                          </Typography>
                          <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                            {formatCurrency(contractInfo.totalPaid)} / {formatCurrency(contractInfo.totalDue)}
                          </Typography>
                          <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                            Remaining: {formatCurrency(contractInfo.remaining)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Payments Table */}
              {filteredPayments.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="h6" color="text.secondary">
                    No payments recorded
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddPayment}
                    sx={{ mt: 2 }}
                  >
                    Add First Payment
                  </Button>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Paid By</TableCell>
                        <TableCell>Paid For</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id} hover>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>{payment.month} {payment.year}</TableCell>
                          <TableCell>{payment.paidBy || 'N/A'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(payment.paidFor || []).map((tenant, idx) => (
                                <Chip
                                  key={idx}
                                  label={tenant}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              ))}
                            </Box>
                          </TableCell>
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
                            <Chip
                              label={payment.isIndividual ? 'Individual' : 'Batch'}
                              size="small"
                              color={payment.isIndividual ? 'primary' : 'default'}
                              icon={payment.isIndividual ? <PersonIcon /> : <PaymentIcon />}
                            />
                          </TableCell>
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
            </CardContent>
          </Card>
        </>
      )}

      {/* Add/Edit Payment Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingPayment ? 'Edit Payment' : 'Add Payment'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={paymentMode} onChange={(e, newValue) => setPaymentMode(newValue)}>
              <Tab label="Batch Payment" icon={<PaymentIcon />} />
              <Tab label="Individual Payment" icon={<PersonIcon />} />
            </Tabs>
          </Box>

          {paymentMode === 1 ? (
            // Individual Payment Form
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={individualPaymentForm.amount}
                  onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, amount: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Tenant</InputLabel>
                  <Select
                    value={individualPaymentForm.tenant_name}
                    label="Tenant"
                    onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, tenant_name: e.target.value })}
                  >
                    {tenants.map((tenant) => (
                      <MenuItem key={tenant} value={tenant}>
                        {tenant}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Paid By</InputLabel>
                  <Select
                    value={paymentForm.paidBy}
                    label="Paid By"
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidBy: e.target.value })}
                  >
                    {tenants.map((tenant) => (
                      <MenuItem key={tenant} value={tenant}>
                        {tenant}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Paid For</InputLabel>
                  <Select
                    multiple
                    value={paymentForm.paidFor}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidFor: e.target.value })}
                    input={<OutlinedInput label="Paid For" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {tenants.map((tenant) => (
                      <MenuItem key={tenant} value={tenant}>
                        <Checkbox checked={paymentForm.paidFor.indexOf(tenant) > -1} />
                        <ListItemText primary={tenant} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Type</InputLabel>
                  <Select
                    value={paymentForm.paymentType}
                    label="Payment Type"
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
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
                    value={paymentForm.paymentMethod}
                    label="Payment Method"
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
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
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Grid container spacing={1}>
                  <Grid item xs={8}>
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
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Year"
                      type="number"
                      value={paymentForm.year}
                      onChange={(e) => setPaymentForm({ ...paymentForm, year: parseInt(e.target.value) })}
                    />
                  </Grid>
                </Grid>
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
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitPayment}
            disabled={loading || 
              (paymentMode === 0 && (!paymentForm.amount || !paymentForm.paidBy || paymentForm.paidFor.length === 0)) ||
              (paymentMode === 1 && (!individualPaymentForm.amount || !individualPaymentForm.tenant_name))
            }
          >
            {editingPayment ? 'Update' : 'Add'} Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Payment Period Dialog */}
      <Dialog
        open={periodDialogOpen}
        onClose={() => setPeriodDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Payment Period</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Starting a new payment period will update the apartment's contract information with the current tenants.
          </Typography>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Period Start Date"
                type="date"
                value={periodForm.startDate}
                onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Period End Date"
                type="date"
                value={periodForm.endDate}
                onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText="Leave empty for open-ended period"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Monthly Rent"
                type="number"
                value={periodForm.rent}
                onChange={(e) => setPeriodForm({ ...periodForm, rent: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Tenants</InputLabel>
                <Select
                  multiple
                  value={periodForm.tenants}
                  onChange={(e) => setPeriodForm({ ...periodForm, tenants: e.target.value })}
                  input={<OutlinedInput label="Tenants" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {tenants.map((tenant) => (
                    <MenuItem key={tenant} value={tenant}>
                      <Checkbox checked={periodForm.tenants.indexOf(tenant) > -1} />
                      <ListItemText primary={tenant} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setPeriodDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreatePaymentPeriod}
            disabled={loading || !periodForm.startDate || !periodForm.rent}
          >
            Create Payment Period
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading indicator */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {/* No apartment selected state */}
      {!selectedApartment && !loading && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select an Apartment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose an apartment from the dropdown above to manage its payments
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {selectedApartment && !loading && !apartmentDetails && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load apartment data. Please try selecting the apartment again.
        </Alert>
      )}
    </Box>
  );
}

export default PaymentScreen;
