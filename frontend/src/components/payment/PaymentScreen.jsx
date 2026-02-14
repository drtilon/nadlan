// Fixed PaymentScreen.jsx with Contract Management and History
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Autocomplete,
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
  Divider,
  Tooltip,
  Badge,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  History as HistoryIcon,
  Business as BusinessIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import api from '../../utils/api';
import ContractManagementDialog from '../contract/ContractManagementDialog';

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
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  // State management
  const [selectedApartment, setSelectedApartment] = useState(apartmentId || '');
  const [apartments, setApartments] = useState([]); // Initialize as empty array
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState('current'); // Default to current
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentMode, setPaymentMode] = useState(1); // Default to individual mode
  const [contractsStats, setContractsStats] = useState({});

  // Form state for individual payment
  const [individualPaymentForm, setIndividualPaymentForm] = useState({
    amount: '',
    tenant_name: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: currentYear,
    notes: '',
    contract_period_id: null
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
    notes: '',
    contract_period_id: null
  });

  const [searchQuery, setSearchQuery] = useState("");

  // Initialize data on component mount
  useEffect(() => {
    fetchApartments();
  }, []);

  // Load apartment data when selection changes
  useEffect(() => {
    if (selectedApartment) {
      loadApartmentData();
      loadContracts();
    }
  }, [selectedApartment]);

  // API calls
  const fetchApartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/list');
      const apartmentsData = response.data?.apartments || response.data || [];
      setApartments(Array.isArray(apartmentsData) ? apartmentsData : []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setApartments([]); // Ensure it's always an array
      showNotification?.('Error fetching apartments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    if (!selectedApartment) return;

    try {
      const response = await api.get(`/apartments/${selectedApartment}/contracts`);
      const contractsData = response.data || [];
      setContracts(contractsData);

      // Calculate stats for each contract
      const stats = {};
      for (const contract of contractsData) {
        try {
          // Get payments for this specific contract
          const paymentsResponse = await api.get(`/payment-history/${selectedApartment}`);
          const allPayments = paymentsResponse.data || [];

          // Filter payments for this contract
          const contractPayments = allPayments.filter(payment => {
            // If payment has contract_period_id, use that for matching
            if (payment.contract_period_id) {
              return payment.contract_period_id === contract.id;
            }

            // Otherwise, check if payment date falls within contract period
            if (payment.paymentDate && contract.start_date) {
              const paymentDate = new Date(payment.paymentDate);
              const startDate = new Date(contract.start_date);
              const endDate = contract.end_date ? new Date(contract.end_date) : new Date();
              return paymentDate >= startDate && paymentDate <= endDate;
            }

            return false;
          });

          const totalPaid = contractPayments.reduce((sum, p) => sum + (parseFloat(p.amountPaid) || 0), 0);

          stats[contract.id] = {
            totalPaid,
            paymentsCount: contractPayments.length,
            lastPayment: contractPayments.length > 0 ? contractPayments[contractPayments.length - 1] : null
          };
        } catch (error) {
          console.error(`Error loading stats for contract ${contract.id}:`, error);
          stats[contract.id] = { totalPaid: 0, paymentsCount: 0, lastPayment: null };
        }
      }
      setContractsStats(stats);

      // Auto-select current contract if available
      const currentContract = contractsData.find(c => c.is_current || c.status === 'active');
      if (currentContract) {
        setSelectedContract(currentContract.id.toString());
      } else {
        // If no current contract, select the most recent one or keep 'current'
        if (contractsData.length > 0) {
          const mostRecent = contractsData.sort((a, b) =>
            new Date(b.start_date) - new Date(a.start_date)
          )[0];
          setSelectedContract(mostRecent.id.toString());
        }
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
      setContracts([]);
      setContractsStats({});
    }
  };

  const loadApartmentData = async () => {
    try {
      setLoading(true);

      // Fetch apartment details
      const apartmentResponse = await api.get(`/apartment/${selectedApartment}`);
      setApartmentDetails(apartmentResponse.data);

      // Fetch payment history
      await loadPaymentHistory();

    } catch (error) {
      console.error('Error loading apartment data:', error);
      showNotification?.('Error loading apartment data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      // Always load all payments first
      const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
      const allPayments = transformPaymentsData(historyResponse.data || []);

      if (selectedContract === 'all') {
        // Show all payments for the apartment
        setPayments(allPayments);
      } else if (selectedContract === 'current') {
        // Filter to current contract
        const currentContract = contracts.find(c => c.is_current || c.status === 'active');
        if (currentContract) {
          const filtered = allPayments.filter(payment => {
            // First check if payment has contract_period_id
            if (payment.contract_period_id) {
              return payment.contract_period_id === currentContract.id;
            }

            // Otherwise, check if payment date falls within contract period
            return isPaymentInDateRange(payment, currentContract);
          });
          setPayments(filtered);
        } else {
          setPayments(allPayments);
        }
      } else {
        // Filter to specific contract
        const targetContract = contracts.find(c => c.id.toString() === selectedContract);
        if (targetContract) {
          const filtered = allPayments.filter(payment => {
            // First check if payment has contract_period_id
            if (payment.contract_period_id) {
              return payment.contract_period_id === targetContract.id;
            }

            // Otherwise, check if payment date falls within contract period
            return isPaymentInDateRange(payment, targetContract);
          });
          setPayments(filtered);
        } else {
          setPayments([]);
        }
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
      setPayments([]);
    }
  };

  const transformPaymentsData = (paymentsData) => {
    return paymentsData.map(payment => ({
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
      isIndividual: payment.isIndividual || false,
      contract_period_id: payment.contract_period_id,
      contract_info: payment.contract_info
    }));
  };

  const isPaymentInDateRange = (payment, contract) => {
    if (!payment.paymentDate || !contract.start_date) return false;

    const paymentDate = new Date(payment.paymentDate);
    const startDate = new Date(contract.start_date);
    const endDate = contract.end_date ? new Date(contract.end_date) : new Date();

    return paymentDate >= startDate && paymentDate <= endDate;
  };

  // Update payments when contract selection changes
  useEffect(() => {
    if (selectedApartment && contracts.length > 0) {
      loadPaymentHistory();
    }
  }, [selectedContract, contracts]);

  // Helper functions
  const getCurrentTenants = () => {
    const currentContract = getCurrentContractData();
    if (currentContract && currentContract.tenants) {
      return currentContract.tenants.map(ct => ({
        id: ct.tenant?.id,
        name: ct.tenant?.name || 'Unknown'
      })).filter(tenant => tenant.name !== 'Unknown');
    }

    // Fallback to apartment tenants
    if (!apartmentDetails?.tenants) return [];
    if (Array.isArray(apartmentDetails.tenants)) {
      return apartmentDetails.tenants.map(t => ({
        id: t.id,
        name: t.name || t
      }));
    }
    if (typeof apartmentDetails.tenants === 'string') {
      return apartmentDetails.tenants.split(',').map((t, index) => ({
        id: `legacy-${index}`,
        name: t.trim()
      })).filter(t => t.name);
    }
    return [];
  };

  const getCurrentContractData = () => {
    if (selectedContract === 'current') {
      return contracts.find(c => c.is_current || c.status === 'active');
    }
    if (selectedContract === 'all') {
      return null; // No specific contract when viewing all
    }
    return contracts.find(c => c.id.toString() === selectedContract);
  };

  const getContractInfo = () => {
    const targetContract = getCurrentContractData();
    if (!targetContract) {
      // For 'all' view or no contract, calculate totals across all payments
      const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amountPaid) || 0), 0);
      return {
        totalDue: 0,
        totalPaid,
        remaining: 0,
        monthsTotal: 0,
        isActive: false,
        isExpired: false,
        contract: null
      };
    }

    const contractStartDate = new Date(targetContract.start_date);
    const contractEndDate = targetContract.end_date ? new Date(targetContract.end_date) : null;
    const monthlyRent = targetContract.monthly_rent || 0;
    const now = new Date();

    const isActive = targetContract.is_current || targetContract.status === 'active';
    const isExpired = contractEndDate && now > contractEndDate;

    const effectiveEndDate = contractEndDate || now;
    const monthsDiff = Math.max(0,
      (effectiveEndDate.getFullYear() - contractStartDate.getFullYear()) * 12 +
      (effectiveEndDate.getMonth() - contractStartDate.getMonth()) + 1
    );

    const totalDue = monthlyRent * monthsDiff;
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amountPaid) || 0), 0);
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

  // Navigate to tenant details
  const navigateToTenant = (tenantId) => {
    if (tenantId && !tenantId.toString().startsWith('legacy-')) {
      navigate(`/tenants/${tenantId}`);
    }
  };

  // Form handlers
  const resetIndividualPaymentForm = () => {
    const tenants = getCurrentTenants();
    const currentContract = getCurrentContractData();
    setIndividualPaymentForm({
      amount: '',
      tenant_name: tenants[0]?.name || '',
      payment_method: 'bank_transfer',
      payment_date: new Date().toISOString().split('T')[0],
      payment_type: 'rent',
      month: MONTHS[new Date().getMonth()],
      year: currentYear,
      notes: '',
      contract_period_id: currentContract?.id || null
    });
  };

  const resetPaymentForm = () => {
    const tenants = getCurrentTenants();
    const currentContract = getCurrentContractData();
    setPaymentForm({
      amount: '',
      paidBy: tenants[0]?.name || '',
      paidFor: [],
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentType: 'rent',
      month: MONTHS[new Date().getMonth()],
      year: currentYear,
      notes: '',
      contract_period_id: currentContract?.id || null
    });
  };

  const handleAddPayment = () => {
    resetIndividualPaymentForm();
    resetPaymentForm();
    setEditingPayment(null);
    setPaymentMode(1);
    setDialogOpen(true);
  };

  const handleEditPayment = (payment) => {
    if (payment.isIndividual) {
      setIndividualPaymentForm({
        amount: payment.amountPaid?.toString() || '',
        tenant_name: payment.paidBy || '',
        payment_method: payment.paymentMethod || 'bank_transfer',
        payment_date: payment.paymentDate?.split('T')[0] || '',
        payment_type: payment.paymentType || 'rent',
        month: payment.month || MONTHS[new Date().getMonth()],
        year: payment.year || currentYear,
        notes: payment.notes || '',
        contract_period_id: payment.contract_period_id || null
      });
      setPaymentMode(1);
    } else {
      setPaymentForm({
        amount: payment.amountPaid?.toString() || '',
        paidBy: payment.paidBy || '',
        paidFor: payment.paidFor || [],
        paymentMethod: payment.paymentMethod || 'bank_transfer',
        paymentDate: payment.paymentDate?.split('T')[0] || '',
        paymentType: payment.paymentType || 'rent',
        month: payment.month || MONTHS[new Date().getMonth()],
        year: payment.year || currentYear,
        notes: payment.notes || '',
        contract_period_id: payment.contract_period_id || null
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

      // FIXED: Find the tenant_id based on tenant_name
      const tenants = getCurrentTenants();
      const selectedTenant = tenants.find(t => t.name === individualPaymentForm.tenant_name);

      const paymentData = {
        apartment_id: parseInt(selectedApartment),
        tenant_id: selectedTenant?.id, // FIXED: Include tenant_id
        tenant_name: individualPaymentForm.tenant_name,
        amount: parseFloat(individualPaymentForm.amount),
        payment_method: individualPaymentForm.payment_method,
        payment_date: individualPaymentForm.payment_date,
        payment_type: individualPaymentForm.payment_type,
        month: individualPaymentForm.month,
        year: individualPaymentForm.year,
        notes: individualPaymentForm.notes,
        contract_period_id: individualPaymentForm.contract_period_id
      };

      if (editingPayment && editingPayment.isIndividual) {
        await api.put(`/payment/${editingPayment.id}`, paymentData);
        showNotification?.('Payment updated successfully', 'success');
      } else {
        // FIXED: Use the /payment/individual endpoint instead of /payment
        await api.post('/payment/individual', paymentData);
        showNotification?.('Payment added successfully', 'success');
      }

      setDialogOpen(false);
      setEditingPayment(null);
      await loadPaymentHistory();
      await loadContracts(); // Refresh stats
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
            extraPayments: { internet: 0, electricity: 0, other: 0 },
            paymentDate: paymentForm.paymentDate,
            paymentMethod: paymentForm.paymentMethod,
            notes: paymentForm.notes || '',
            contract_period_id: paymentForm.contract_period_id
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
        await loadPaymentHistory();
        await loadContracts(); // Refresh stats

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
      await loadPaymentHistory();
      await loadContracts(); // Refresh stats
    } catch (error) {
      console.error('Error deleting payment:', error);
      showNotification?.('Error deleting payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContractChange = () => {
    // Refresh contracts and payments when contracts are modified
    loadContracts();
    loadPaymentHistory();
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

  const getContractStatusColor = (contract) => {
    if (contract.is_current || contract.status === 'active') return 'success';
    const now = new Date();
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    if (endDate && now > endDate) return 'default';
    return 'info';
  };

  const getContractProgress = (contract) => {
    if (!contract.end_date) return 100;
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    const now = new Date();

    const total = end - start;
    const elapsed = now - start;

    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  // Get contract info for display
  const contractInfo = getContractInfo();
  const filteredPayments = payments.filter(p =>
    (p.paidBy || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (Array.isArray(p.paidFor) && p.paidFor.some(name => name.toLowerCase().includes(searchQuery.toLowerCase())))
  );
  const tenants = getCurrentTenants();
  const currentContract = getCurrentContractData();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Payment Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track and manage apartment payments by contract period
        </Typography>
      </Box>

      {/* Apartment Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={apartments}
                getOptionLabel={(option) => option.address}
                value={apartments.find(a => a.id === selectedApartment) || null}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setSelectedApartment(newValue.id);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Apartment"
                    variant="outlined"
                    fullWidth
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            </Grid>

            {selectedApartment && contracts.length > 0 && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Contract Period</InputLabel>
                  <Select
                    value={selectedContract}
                    label="Contract Period"
                    onChange={(e) => setSelectedContract(e.target.value)}
                  >
                    <MenuItem value="current">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        Current Contract
                      </Box>
                    </MenuItem>
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon fontSize="small" />
                        All Payments
                      </Box>
                    </MenuItem>
                    <Divider />
                    {contracts.map((contract) => {
                      const stats = contractsStats[contract.id] || {};
                      const progress = getContractProgress(contract);
                      return (
                        <MenuItem key={contract.id} value={contract.id.toString()}>
                          <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {contract.contract_number}
                              </Typography>
                              <Chip
                                label={contract.is_current || contract.status === 'active' ? 'CURRENT' : contract.end_date && new Date(contract.end_date) < new Date() ? 'ENDED' : 'ACTIVE'}
                                size="small"
                                color={getContractStatusColor(contract)}
                              />
                              <Badge
                                badgeContent={stats.paymentsCount || 0}
                                color="primary"
                                sx={{ ml: 'auto' }}
                              >
                                <PaymentIcon fontSize="small" />
                              </Badge>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(contract.start_date)} - {formatDate(contract.end_date) || 'Ongoing'}
                              </Typography>
                              <Typography variant="caption" color="primary" sx={{ ml: 'auto' }}>
                                {formatCurrency(stats.totalPaid || 0)}
                              </Typography>
                            </Box>
                            {contract.end_date && (
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{ height: 2, borderRadius: 1 }}
                                color={progress >= 100 ? 'success' : 'primary'}
                              />
                            )}
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {selectedApartment && (
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                  <Button
                    variant="outlined"
                    startIcon={<BusinessIcon />}
                    onClick={() => setContractDialogOpen(true)}
                    size="medium"
                  >
                    Manage Contracts
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddPayment}
                    size="medium"
                    disabled={selectedContract === 'all'}
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
          {/* Apartment & Contract Info Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Typography variant="h6" gutterBottom>
                    {apartmentDetails.address}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
                    <Chip label={`${tenants.length} tenants`} />
                    <Chip label={`${formatCurrency(currentContract?.monthly_rent || apartmentDetails.rent)}/month`} />
                    <Chip label={`${apartmentDetails.rooms || 'N/A'} rooms`} />
                    {currentContract && (
                      <Chip
                        label={currentContract.contract_number}
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Stack>

                  {/* Contract Details */}
                  {currentContract && selectedContract !== 'all' && (
                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        {selectedContract === 'current' ? 'Current Contract' : 'Selected Contract'}: {currentContract.contract_number}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EventIcon fontSize="small" color="action" />
                            <Typography variant="body2">
                              {formatDate(currentContract.start_date)} - {formatDate(currentContract.end_date) || 'Ongoing'}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <PersonIcon fontSize="small" color="action" />
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {tenants.map((tenant, idx) => (
                                <Tooltip key={idx} title="View tenant details">
                                  <Chip
                                    label={tenant.name}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => navigateToTenant(tenant.id)}
                                    onDelete={tenant.id && !tenant.id.toString().startsWith('legacy-') ?
                                      () => navigateToTenant(tenant.id) : undefined
                                    }
                                    deleteIcon={<VisibilityIcon />}
                                    sx={{
                                      cursor: tenant.id && !tenant.id.toString().startsWith('legacy-') ? 'pointer' : 'default',
                                      '&:hover': {
                                        backgroundColor: tenant.id && !tenant.id.toString().startsWith('legacy-') ? 'primary.light' : 'inherit'
                                      }
                                    }}
                                  />
                                </Tooltip>
                              ))}
                              {tenants.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                  No tenants assigned
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Tenants: {tenants.map(t => t.name).join(', ') || 'No tenants'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {selectedContract === 'all' ? 'Total Progress' : 'Contract Progress'}
                      </Typography>
                      <Chip
                        label={
                          selectedContract === 'all' ? 'All Contracts' :
                          contractInfo.isExpired ? 'Expired' :
                          contractInfo.isActive ? 'Active' : 'Inactive'
                        }
                        color={
                          selectedContract === 'all' ? 'info' :
                          contractInfo.isExpired ? 'error' :
                          contractInfo.isActive ? 'success' : 'default'
                        }
                        size="small"
                      />
                    </Box>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                      {formatCurrency(contractInfo.totalPaid)} {contractInfo.totalDue > 0 && `/ ${formatCurrency(contractInfo.totalDue)}`}
                    </Typography>
                    {contractInfo.remaining > 0 && (
                      <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                        Remaining: {formatCurrency(contractInfo.remaining)}
                      </Typography>
                    )}
                    {contractInfo.monthsTotal > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {contractInfo.monthsTotal} months total
                      </Typography>
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
                  <TextField
                    size="small"
                    label="Search by name"
                    variant="outlined"
                    sx={{ mr: 2 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <ReceiptIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Payment History
                    {selectedContract === 'all' ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        All Contracts ({payments.length} payments)
                      </Typography>
                    ) : currentContract ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Contract: {currentContract.contract_number} ({payments.length} payments)
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Current Contract ({payments.length} payments)
                      </Typography>
                    )}
                  </Typography>
                </Box>
              </Box>

              {/* Contract Summary */}
              {selectedContract !== 'all' && contractInfo.contract && (
                <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <Typography variant="subtitle2" gutterBottom>
                          Contract Period Summary
                        </Typography>
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <Chip
                            label={`${formatDate(contractInfo.contract.start_date)} - ${contractInfo.contract.end_date ? formatDate(contractInfo.contract.end_date) : 'Ongoing'}`}
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={`${formatCurrency(contractInfo.contract.monthly_rent || 0)}/month`}
                            variant="outlined"
                            size="small"
                          />
                          <Chip
                            label={contractInfo.isExpired ? 'Expired' : contractInfo.isActive ? 'Active' : 'Inactive'}
                            color={contractInfo.isExpired ? 'error' : contractInfo.isActive ? 'success' : 'default'}
                            size="small"
                          />
                          <Chip
                            label={`${payments.length} payments`}
                            variant="outlined"
                            size="small"
                            icon={<PaymentIcon />}
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
                          {contractInfo.contract.end_date && (
                            <Box sx={{ mt: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (contractInfo.totalPaid / contractInfo.totalDue) * 100)}
                                sx={{ height: 6, borderRadius: 3 }}
                                color={contractInfo.totalPaid >= contractInfo.totalDue ? 'success' : 'primary'}
                              />
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                {Math.round((contractInfo.totalPaid / contractInfo.totalDue) * 100)}% collected
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* All Contracts Overview for 'all' view */}
              {selectedContract === 'all' && contracts.length > 1 && (
                <Card sx={{ mb: 3, bgcolor: 'grey.50' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      All Contracts Overview
                    </Typography>
                    <Grid container spacing={2}>
                      {contracts.map((contract) => {
                        const stats = contractsStats[contract.id] || {};
                        const contractPayments = payments.filter(p => p.contract_period_id === contract.id);
                        return (
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
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                                <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                                  {formatCurrency(stats.totalPaid || 0)}
                                </Typography>
                                <Chip
                                  label={`${contractPayments.length} payments`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                              {/* Tenants for this contract with navigation */}
                              {contract.tenants && contract.tenants.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {contract.tenants.map((ct, idx) => (
                                    <Tooltip key={idx} title="View tenant details">
                                      <Chip
                                        label={ct.tenant?.name || 'Unknown'}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => navigateToTenant(ct.tenant?.id)}
                                        onDelete={ct.tenant?.id ? () => navigateToTenant(ct.tenant.id) : undefined}
                                        deleteIcon={<VisibilityIcon />}
                                        sx={{
                                          cursor: ct.tenant?.id ? 'pointer' : 'default',
                                          '&:hover': {
                                            backgroundColor: ct.tenant?.id ? 'primary.light' : 'inherit'
                                          }
                                        }}
                                      />
                                    </Tooltip>
                                  ))}
                                </Box>
                              )}
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Payments Table */}
              {filteredPayments.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="h6" color="text.secondary">
                    {selectedContract === 'all' ? 'No payments recorded across all contracts' : 'No payments recorded for this contract'}
                  </Typography>
                  {selectedContract !== 'all' && (
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddPayment}
                      sx={{ mt: 2 }}
                    >
                      Add First Payment
                    </Button>
                  )}
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
                        <TableCell>Contract</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments
                        .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0)) // Sort by date descending
                        .map((payment) => (
                        <TableRow key={payment.id} hover>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>{payment.month} {payment.year}</TableCell>
                          <TableCell>
                            {payment.paidBy ? (
                              <Tooltip title="View tenant details">
                                <Chip
                                  label={payment.paidBy}
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    const tenant = tenants.find(t => t.name === payment.paidBy);
                                    if (tenant && tenant.id) {
                                      navigateToTenant(tenant.id);
                                    }
                                  }}
                                  sx={{ cursor: 'pointer' }}
                                />
                              </Tooltip>
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(payment.paidFor || []).map((tenantName, idx) => (
                                <Tooltip key={idx} title="View tenant details">
                                  <Chip
                                    label={tenantName}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      const tenant = tenants.find(t => t.name === tenantName);
                                      if (tenant && tenant.id) {
                                        navigateToTenant(tenant.id);
                                      }
                                    }}
                                    sx={{
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        backgroundColor: 'primary.light'
                                      }
                                    }}
                                  />
                                </Tooltip>
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
                            {payment.contract_info ? (
                              <Tooltip title={`${payment.contract_info.start_date} - ${payment.contract_info.end_date || 'Ongoing'}`}>
                                <Chip
                                  label={payment.contract_info.contract_number}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              </Tooltip>
                            ) : (
                              <Chip
                                label="Legacy"
                                size="small"
                                variant="outlined"
                                color="default"
                              />
                            )}
                          </TableCell>
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
                              disabled={selectedContract === 'all'}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeletePayment(payment.id)}
                              color="error"
                              disabled={selectedContract === 'all'}
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

          {/* Contract Selection for Payment */}
          {contracts.length > 0 && currentContract && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Alert severity="info">
                  This payment will be associated with: <strong>{currentContract?.contract_number || 'No contract selected'}</strong>
                </Alert>
              </Grid>
            </Grid>
          )}

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
                      <MenuItem key={tenant.id} value={tenant.name}>
                        {tenant.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Type</InputLabel>
                  <Select
                    value={individualPaymentForm.payment_type}
                    label="Payment Type"
                    onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, payment_type: e.target.value })}
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
                    value={individualPaymentForm.payment_method}
                    label="Payment Method"
                    onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, payment_method: e.target.value })}
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
                  value={individualPaymentForm.payment_date}
                  onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, payment_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Grid container spacing={1}>
                  <Grid item xs={8}>
                    <FormControl fullWidth>
                      <InputLabel>Month</InputLabel>
                      <Select
                        value={individualPaymentForm.month}
                        label="Month"
                        onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, month: e.target.value })}
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
                      value={individualPaymentForm.year}
                      onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, year: parseInt(e.target.value) })}
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
                  value={individualPaymentForm.notes}
                  onChange={(e) => setIndividualPaymentForm({ ...individualPaymentForm, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          ) : (
            // Batch Payment Form
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={7}>
                <FormControl fullWidth>
                  <InputLabel>Paid By</InputLabel>
                  <Select
                    value={paymentForm.paidBy}
                    label="Paid By"
                    onChange={(e) => setPaymentForm({ ...paymentForm, paidBy: e.target.value })}
                  >
                    {tenants.map((tenant) => (
                      <MenuItem key={tenant.id} value={tenant.name}>
                        {tenant.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
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
                      <MenuItem key={tenant.id} value={tenant.name}>
                        <Checkbox checked={paymentForm.paidFor.indexOf(tenant.name) > -1} />
                        <ListItemText primary={tenant.name} />
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
        <DialogActions sx={{ p: 2 }}>
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

      {/* Contract Management Dialog */}
      <ContractManagementDialog
        open={contractDialogOpen}
        onClose={() => setContractDialogOpen(false)}
        apartment={apartmentDetails}
        showNotification={showNotification}
        onContractChange={handleContractChange}
      />

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
              Choose an apartment from the dropdown above to manage its payments and contracts
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {selectedApartment && !loading && !apartmentDetails && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Failed to load apartment data. Please try selecting the apartment again.
        </Alert>
      )}
    </Box>
  );
}

export default PaymentScreen;
