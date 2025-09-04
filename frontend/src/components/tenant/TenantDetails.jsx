// components/tenant/TenantDetails.jsx - FIXED: Property Details + EUR currency
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  Stack,
  IconButton,
  Alert,
  CircularProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Cake as BirthdayIcon,
  Wc as GenderIcon,
  Schedule as ContractIcon,
  AttachMoney as MoneyIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  SwapHoriz as TransferIcon,
  ExitToApp as MoveOutIcon,
  LocationOn as LocationIcon,
  ContactPage as PassportIcon,
  Edit as EditIcon,
  Apartment as ApartmentIcon,
  CalendarToday as CalendarIcon,
  Euro as EuroIcon,
  Business as BusinessIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { green, red, orange, blue, grey } from '@mui/material/colors';
import api from '../../utils/api';

const TenantDetails = ({ showNotification }) => {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  // State
  const [tenant, setTenant] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialogs state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [moveOutDialogOpen, setMoveOutDialogOpen] = useState(false);

  // Form states
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    passport_id: '',
    refund_iban: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    description: 'Rent Payment',
    method: 'bank_transfer'
  });

  const [transferForm, setTransferForm] = useState({
    new_apartment_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [moveOutForm, setMoveOutForm] = useState({
    move_out_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Transfer search states
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [apartmentSearchValue, setApartmentSearchValue] = useState('');
  const [apartmentSearchResults, setApartmentSearchResults] = useState([]);
  const [isSearchingApartments, setIsSearchingApartments] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Computed values - FIXED to handle different data structures
  const currentContract = tenant?.current_contracts?.[0];
  let currentApartment = currentContract?.apartment || tenant?.current_apartment;

  // If no current apartment from contracts, try to get it from move history
  if (!currentApartment && moveHistory.length > 0) {
    const currentMove = moveHistory.find(move => move.is_current);
    if (currentMove) {
      currentApartment = {
        id: currentMove.apartment_id,
        address: currentMove.apartment_address,
        monthly_rent: currentMove.monthly_rent || 0,
        rent: currentMove.monthly_rent || 0
      };
    }
  }

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'paid':
        return 'success';
      case 'pending':
      case 'outstanding':
        return 'warning';
      case 'overdue':
      case 'terminated':
        return 'error';
      default:
        return 'default';
    }
  };

  // Search apartments on server side as user types
  const searchApartments = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setApartmentSearchResults([]);
      return;
    }

    setIsSearchingApartments(true);
    try {
      console.log('Searching apartments with query:', searchQuery);

      // Use the search parameter from the backend API
      const response = await api.get(`/list?search=${encodeURIComponent(searchQuery)}&limit=20`);
      console.log('Search response:', response.data);

      let apartmentData = response.data;

      // Based on backend code, the response structure is { apartments: [...] }
      if (apartmentData && apartmentData.apartments) {
        apartmentData = apartmentData.apartments;
      }

      console.log('Search results:', apartmentData?.length, 'apartments');

      if (Array.isArray(apartmentData)) {
        setApartmentSearchResults(apartmentData);
      } else {
        setApartmentSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching apartments:', error);
      setApartmentSearchResults([]);

      if (showNotification) {
        showNotification('Failed to search apartments', 'error');
      }
    } finally {
      setIsSearchingApartments(false);
    }
  };

  // Debounce the search function
  const [searchTimeout, setSearchTimeout] = useState(null);

  const debouncedSearchApartments = (query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchApartments(query);
    }, 500); // Wait 500ms after user stops typing

    setSearchTimeout(timeout);
  };

  // Data fetching
  const fetchTenantData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch tenant details
      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      let tenantData = tenantResponse.data;

      // Handle different response structures
      if (tenantData.success) {
        tenantData = tenantData.tenant;
      }

      setTenant(tenantData);

      // Set edit form data
      setEditFormData({
        name: tenantData.name || '',
        email: tenantData.email || '',
        phone: tenantData.phone || '',
        date_of_birth: tenantData.date_of_birth || '',
        gender: tenantData.gender || '',
        passport_id: tenantData.passport_id || '',
        refund_iban: tenantData.refund_iban || ''
      });

      // Fetch payment history
      try {
        const paymentResponse = await api.get(`/tenants/${tenantId}/payment-history`);
        if (paymentResponse.data) {
          setPaymentHistory(paymentResponse.data.payments || paymentResponse.data.payment_history || []);
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
        setPaymentHistory([]);
      }

      // Fetch move history
      try {
        const moveResponse = await api.get(`/tenants/${tenantId}/move-history`);
        if (moveResponse.data) {
          setMoveHistory(moveResponse.data.move_history || []);
        }
      } catch (error) {
        console.error('Error fetching move history:', error);
        setMoveHistory([]);
      }

    } catch (error) {
      console.error('Error fetching tenant data:', error);
      setError('Failed to load tenant data');
      if (showNotification) {
        showNotification('Error loading tenant data', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
    }
  }, [tenantId]);

  // Event handlers
  const handleEditSubmit = async () => {
    if (!editFormData.name.trim()) {
      showNotification('Tenant name is required', 'error');
      return;
    }

    if (!editFormData.email.trim()) {
      showNotification('Email is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.put(`/tenants/${tenantId}`, editFormData);
      showNotification('Tenant updated successfully', 'success');
      setEditDialogOpen(false);
      fetchTenantData();
    } catch (error) {
      console.error('Error updating tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error updating tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      showNotification('Valid payment amount is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.post(`/tenants/${tenantId}/payments`, paymentForm);
      showNotification('Payment added successfully', 'success');
      setPaymentDialogOpen(false);
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        description: 'Rent Payment',
        method: 'bank_transfer'
      });
      fetchTenantData();
    } catch (error) {
      console.error('Error adding payment:', error);
      const errorMessage = error.response?.data?.message || 'Error adding payment';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Transfer handler for searchable apartments
  const handleTransferTenant = async () => {
    if (!selectedApartment) {
      showNotification('Please select a new apartment', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const transferData = {
        ...transferForm,
        new_apartment_id: selectedApartment.id
      };
      await api.post(`/tenants/${tenantId}/transfer`, transferData);
      showNotification('Tenant transferred successfully', 'success');
      setTransferDialogOpen(false);
      setTransferForm({
        new_apartment_id: '',
        transfer_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setSelectedApartment(null);
      setApartmentSearchValue('');
      fetchTenantData();
    } catch (error) {
      console.error('Error transferring tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error transferring tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleMoveOut = async () => {
    if (!moveOutForm.move_out_date) {
      showNotification('Please select a move-out date', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.post(`/tenants/${tenantId}/move-out`, moveOutForm);
      showNotification('Tenant moved out successfully', 'success');
      setMoveOutDialogOpen(false);
      setMoveOutForm({
        move_out_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchTenantData();
    } catch (error) {
      console.error('Error moving out tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error moving out tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Transfer dialog handlers
  const openTransferDialog = () => {
    setTransferDialogOpen(true);
    // No need to fetch all apartments anymore - we search as user types
  };

  const handleCloseTransferDialog = () => {
    setTransferDialogOpen(false);
    setSelectedApartment(null);
    setApartmentSearchValue('');
    setApartmentSearchResults([]);
    setTransferForm({
      new_apartment_id: '',
      transfer_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    // Clear any pending search timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !tenant) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Tenant not found'}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/tenants')}
          variant="outlined"
        >
          Back to Tenants
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header with Back Button and Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/tenants')}>
            <BackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {tenant.name}
            </Typography>
            <Chip
              label={currentContract || currentApartment ? 'Active Tenant' : 'Inactive'}
              color={currentContract || currentApartment ? 'success' : 'default'}
              icon={currentContract || currentApartment ? <CheckCircleIcon /> : <ErrorIcon />}
            />
          </Box>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            startIcon={<PaymentIcon />}
            onClick={() => setPaymentDialogOpen(true)}
            disabled={!currentContract && !currentApartment}
          >
            Add Payment
          </Button>
          <Button
            variant="outlined"
            startIcon={<TransferIcon />}
            onClick={openTransferDialog}
            disabled={!currentContract && !currentApartment}
          >
            Transfer
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<MoveOutIcon />}
            onClick={() => setMoveOutDialogOpen(true)}
            disabled={!currentContract && !currentApartment}
          >
            Move Out
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom color="primary">
              Personal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <GenderIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Gender</Typography>
                  <Typography variant="body1">{tenant.gender || 'N/A'}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BirthdayIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Date of Birth</Typography>
                  <Typography variant="body1">{formatDate(tenant.date_of_birth)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PassportIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Tenant ID (Passport)</Typography>
                  <Typography variant="body1">{tenant.passport_id || 'N/A'}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PhoneIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Phone Number</Typography>
                  <Typography variant="body1">{tenant.phone || 'N/A'}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EmailIcon color="action" />
                <Box>
                  <Typography variant="body2" color="text.secondary">Email Address</Typography>
                  <Typography variant="body1">{tenant.email}</Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Property Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              Property Details
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {currentApartment ? (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LocationIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Address</Typography>
                        <Typography variant="body1">{currentApartment.address}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <ApartmentIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Property ID</Typography>
                        <Typography variant="body1">#{currentApartment.id}</Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CalendarIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Contract Period</Typography>
                        <Typography variant="body1">
                          {currentContract ?
                            `${formatDate(currentContract.start_date)} - ${formatDate(currentContract.end_date) || 'Ongoing'}` :
                            moveHistory.find(move => move.is_current) ?
                              `${formatDate(moveHistory.find(move => move.is_current).move_in_date)} - Present` :
                              'N/A'
                          }
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <EuroIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">Monthly Rent</Typography>
                        <Typography variant="body1">
                          {formatCurrency(currentApartment.monthly_rent || currentApartment.rent)}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info">No active property assignment</Alert>
            )}
          </Paper>

          {/* Payment History */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              Payment History
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {paymentHistory.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Method</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentHistory.map((payment, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(payment.paymentDate || payment.payment_date || payment.date)}</TableCell>
                        <TableCell>{payment.description || payment.paymentDescription || 'Payment'}</TableCell>
                        <TableCell align="right">{formatCurrency(payment.amountPaid || payment.amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={payment.status || payment.paymentStatus || 'Completed'}
                            color={getStatusColor(payment.status || payment.paymentStatus)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{payment.method || payment.paymentMethod || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No payment history available</Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Move History */}
      {moveHistory.length > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom color="primary">
            Move History
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <List>
            {moveHistory.map((history, index) => (
              <ListItem key={index} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                <ListItemIcon>
                  <HistoryIcon color={history.is_current ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body1">
                        {history.apartment_address}
                      </Typography>
                      {history.is_current && (
                        <Chip label="Current" color="primary" size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(history.move_in_date)} - {history.move_out_date ?
                        formatDate(history.move_out_date) : 'Present'}
                      {history.monthly_rent && ` • ${formatCurrency(history.monthly_rent)}/month`}
                      {history.is_primary && ' • Primary Tenant'}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tenant Information</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <TextField
              label="Name"
              fullWidth
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
            <TextField
              label="Phone"
              fullWidth
              value={editFormData.phone}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
            />
            <TextField
              label="Date of Birth"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={editFormData.date_of_birth}
              onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={editFormData.gender}
                onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                label="Gender"
              >
                <MenuItem value="">Select Gender</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Passport ID"
              fullWidth
              value={editFormData.passport_id}
              onChange={(e) => setEditFormData({ ...editFormData, passport_id: e.target.value })}
            />
            <TextField
              label="Refund IBAN"
              fullWidth
              value={editFormData.refund_iban}
              onChange={(e) => setEditFormData({ ...editFormData, refund_iban: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={formSubmitting}>
            {formSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <TextField
              label="Amount"
              type="number"
              fullWidth
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              InputProps={{ startAdornment: '€' }}
              required
            />
            <TextField
              label="Payment Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={paymentForm.payment_date}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              required
            />
            <TextField
              label="Description"
              fullWidth
              value={paymentForm.description}
              onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                label="Payment Method"
              >
                <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="credit_card">Credit Card</MenuItem>
                <MenuItem value="check">Check</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddPayment} variant="contained" disabled={formSubmitting}>
            {formSubmitting ? 'Adding...' : 'Add Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog with Searchable Autocomplete */}
      <Dialog open={transferDialogOpen} onClose={handleCloseTransferDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer Tenant</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <Autocomplete
              options={apartmentSearchResults}
              getOptionLabel={(option) => {
                return option.address ||
                       `${option.street_name || ''} ${option.house_number || ''}`.trim() ||
                       `Apartment ${option.id}`;
              }}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.address ||
                       `${option.street_name || ''} ${option.house_number || ''}`.trim() ||
                       `Apartment ${option.id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.city && `${option.city} • `}
                      Rent: €{option.rent || 0}/month
                      {option.tenants && option.tenants.length > 0 && (
                        ` • Current tenants: ${option.tenants.map(t => t.name || t).join(', ')}`
                      )}
                      {option.rooms && ` • ${option.rooms} rooms`}
                    </Typography>
                  </Box>
                </Box>
              )}
              value={selectedApartment}
              onChange={(event, newValue) => {
                console.log('Selected apartment:', newValue);
                setSelectedApartment(newValue);
              }}
              inputValue={apartmentSearchValue}
              onInputChange={(event, newInputValue) => {
                console.log('Search input changed:', newInputValue);
                setApartmentSearchValue(newInputValue);

                // Trigger search when user types (debounced)
                if (newInputValue.trim().length >= 2) {
                  debouncedSearchApartments(newInputValue.trim());
                } else {
                  setApartmentSearchResults([]);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Apartment"
                  placeholder="Type at least 2 characters to search..."
                  fullWidth
                  required
                  helperText={
                    apartmentSearchValue.length === 0
                      ? 'Start typing to search apartments'
                      : apartmentSearchValue.length < 2
                        ? 'Type at least 2 characters'
                        : isSearchingApartments
                          ? 'Searching...'
                          : `${apartmentSearchResults.length} apartments found`
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearchingApartments && <CircularProgress color="inherit" size={20} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              filterOptions={(options) => options}
              noOptionsText={
                apartmentSearchValue.length === 0
                  ? "Start typing to search apartments"
                  : apartmentSearchValue.length < 2
                    ? "Type at least 2 characters"
                    : isSearchingApartments
                      ? "Searching..."
                      : "No apartments found"
              }
              loading={isSearchingApartments}
              freeSolo={false}
            />
            <TextField
              label="Transfer Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={transferForm.transfer_date}
              onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
              required
            />
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={3}
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="Reason for transfer, special instructions, etc."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTransferDialog}>Cancel</Button>
          <Button onClick={handleTransferTenant} variant="contained" disabled={formSubmitting || !selectedApartment}>
            {formSubmitting ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog open={moveOutDialogOpen} onClose={() => setMoveOutDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move Out Tenant</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <TextField
              label="Move Out Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={moveOutForm.move_out_date}
              onChange={(e) => setMoveOutForm({ ...moveOutForm, move_out_date: e.target.value })}
              required
            />
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={3}
              value={moveOutForm.notes}
              onChange={(e) => setMoveOutForm({ ...moveOutForm, notes: e.target.value })}
              placeholder="Reason for moving out, condition of property, etc."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOutDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMoveOut} variant="contained" disabled={formSubmitting}>
            {formSubmitting ? 'Processing...' : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TenantDetails;
