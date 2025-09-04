// components/tenant/TenantDetails.jsx - FIXED with searchable transfer
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Box,
  Chip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Payment as PaymentIcon,
  SwapHoriz as TransferIcon,
  ExitToApp as MoveOutIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  CreditCard as IbanIcon
} from '@mui/icons-material';
import api from '../../utils/api';

function TenantDetails({ showNotification }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  // State management
  const [tenant, setTenant] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
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

  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [apartmentSearchValue, setApartmentSearchValue] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '€0.00';
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
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

  // Fetch apartments for transfer - only when transfer dialog opens
  const fetchApartments = async () => {
    try {
      const response = await api.get('/list');
      let apartmentData = response.data;
      if (apartmentData.success) {
        apartmentData = apartmentData.apartments;
      }
      setApartments(Array.isArray(apartmentData) ? apartmentData : []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setApartments([]);
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

  const handleMoveOutTenant = async () => {
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

  // Handle transfer dialog open
  const handleOpenTransferDialog = () => {
    setTransferDialogOpen(true);
    fetchApartments(); // Load apartments when dialog opens
  };

  // Handle close dialogs
  const handleCloseTransferDialog = () => {
    setTransferDialogOpen(false);
    setSelectedApartment(null);
    setApartmentSearchValue('');
    setTransferForm({
      new_apartment_id: '',
      transfer_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading tenant details...</Typography>
      </Container>
    );
  }

  if (error || !tenant) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="error">{error || 'Tenant not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/tenants')} sx={{ mt: 2 }}>
          Back to Tenants
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/tenants')} sx={{ mr: 1 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {tenant.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<EditIcon />}
            variant="outlined"
            onClick={() => setEditDialogOpen(true)}
          >
            Edit
          </Button>
          <Button
            startIcon={<PaymentIcon />}
            variant="outlined"
            onClick={() => setPaymentDialogOpen(true)}
          >
            Add Payment
          </Button>
          <Button
            startIcon={<TransferIcon />}
            variant="outlined"
            onClick={handleOpenTransferDialog}
          >
            Transfer
          </Button>
          <Button
            startIcon={<MoveOutIcon />}
            variant="outlined"
            color="warning"
            onClick={() => setMoveOutDialogOpen(true)}
          >
            Move Out
          </Button>
        </Box>
      </Box>

      {/* Tenant Information */}
      <Grid container spacing={3}>
        {/* Basic Information Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography>{tenant.name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography>{tenant.email || 'Not provided'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography>{tenant.phone || 'Not provided'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  <Typography>Born: {formatDate(tenant.date_of_birth)}</Typography>
                </Box>
                {tenant.gender && (
                  <Box>
                    <Chip
                      label={tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1)}
                      size="small"
                      color={tenant.gender.toLowerCase() === 'male' ? 'primary' : 'secondary'}
                    />
                  </Box>
                )}
                {tenant.passport_id && (
                  <Typography variant="body2" color="text.secondary">
                    Passport ID: {tenant.passport_id}
                  </Typography>
                )}
                {tenant.refund_iban && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IbanIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2">{tenant.refund_iban}</Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Current Housing Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Housing
              </Typography>
              {tenant.current_contracts && tenant.current_contracts.length > 0 ? (
                <Stack spacing={2}>
                  {tenant.current_contracts.map((contract, index) => (
                    <Box key={index}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <HomeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body1">{contract.apartment_address}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Contract: {contract.contract_number}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Period: {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                      </Typography>
                      <Chip
                        label={contract.status || 'Active'}
                        size="small"
                        color={getStatusColor(contract.status)}
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">No current housing assignments</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment History */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Payment History
        </Typography>
        {paymentHistory.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paymentHistory.slice(0, 10).map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell>
                      <Chip
                        label={payment.status || 'Paid'}
                        size="small"
                        color={getStatusColor(payment.status)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No payment history available</Alert>
        )}
      </Paper>

      {/* Move History */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Move History
        </Typography>
        {moveHistory.length > 0 ? (
          <Stack spacing={2}>
            {moveHistory.map((move, index) => (
              <Box key={index} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body1">
                  {move.type}: {move.details}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(move.date)}
                </Typography>
                {move.notes && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Notes: {move.notes}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No move history available</Alert>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tenant</DialogTitle>
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
              options={apartments}
              getOptionLabel={(option) => option.address || option.full_address || `Apartment ${option.id}`}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.address || option.full_address || `Apartment ${option.id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rent: €{option.rent || option.monthly_rent || 0}/month
                      {option.tenants && option.tenants.length > 0 && (
                        ` • Current tenants: ${option.tenants.map(t => t.name || t).join(', ')}`
                      )}
                    </Typography>
                  </Box>
                </Box>
              )}
              value={selectedApartment}
              onChange={(event, newValue) => {
                setSelectedApartment(newValue);
              }}
              inputValue={apartmentSearchValue}
              onInputChange={(event, newInputValue) => {
                setApartmentSearchValue(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Apartment"
                  placeholder="Type to search apartments..."
                  fullWidth
                  required
                />
              )}
              filterOptions={(options, { inputValue }) => {
                const filterValue = inputValue.toLowerCase();
                return options.filter((option) => {
                  const address = (option.address || option.full_address || '').toLowerCase();
                  const city = (option.city || '').toLowerCase();
                  const streetName = (option.street_name || '').toLowerCase();
                  return address.includes(filterValue) ||
                         city.includes(filterValue) ||
                         streetName.includes(filterValue);
                });
              }}
              noOptionsText="No apartments found"
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
          <Button onClick={handleMoveOutTenant} variant="contained" disabled={formSubmitting}>
            {formSubmitting ? 'Moving Out...' : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TenantDetails;
