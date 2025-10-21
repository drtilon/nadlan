// components/tenant/TenantDetails.jsx - CORRECTED for Real DB Schema
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Divider,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Phone as PhoneIcon,
  Email as EmailIcon,
  Cake as BirthdayIcon,
  Wc as GenderIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  SwapHoriz as TransferIcon,
  ExitToApp as MoveOutIcon,
  ContactPage as PassportIcon,
  Edit as EditIcon,
  Euro as EuroIcon
} from '@mui/icons-material';
import api from '../../utils/api';
import PaymentComponent from './PaymentComponent';

const TenantDetails = ({ showNotification }) => {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  // State
  const [tenant, setTenant] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [contractHistory, setContractHistory] = useState([]); // FIXED: Use contractHistory instead of moveHistory
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

  const [transferForm, setTransferForm] = useState({
    new_apartment_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    move_out_date: new Date().toISOString().split('T')[0],
    move_in_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Next day
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

  // FIXED: Computed values using contractHistory instead of moveHistory
  const currentContract = tenant?.current_contracts?.[0];
  let currentApartment = currentContract?.apartment || tenant?.current_apartment;

  // If no current apartment from contracts, try to get it from contract history
  if (!currentApartment && contractHistory.length > 0) {
    const currentContract = contractHistory.find(contract => contract.is_current);
    if (currentContract) {
      currentApartment = {
        id: currentContract.apartment_id,
        address: currentContract.apartment_address,
        monthly_rent: currentContract.monthly_rent || 0,
        rent: currentContract.monthly_rent || 0
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

  // Search apartments function
  const searchApartments = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setApartmentSearchResults([]);
      return;
    }

    setIsSearchingApartments(true);
    try {
      const response = await api.get(`/list?search=${encodeURIComponent(searchQuery)}&limit=20`);
      let apartmentData = response.data;

      if (apartmentData && apartmentData.apartments) {
        apartmentData = apartmentData.apartments;
      }

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
    }, 500);

    setSearchTimeout(timeout);
  };

  // FIXED: Data fetching using correct endpoints
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

      // FIXED: Fetch payment history using the correct endpoint
      try {
        const paymentResponse = await api.get(`/tenants/${tenantId}/payment-history`);
        if (paymentResponse.data) {
          // Handle multiple possible response structures
          const payments = paymentResponse.data.payments ||
                          paymentResponse.data.payment_history ||
                          paymentResponse.data.paymentHistory ||
                          [];
          setPaymentHistory(payments);
          console.log('Payment history loaded:', payments.length, 'payments');
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
        setPaymentHistory([]);
        if (showNotification) {
          showNotification('Could not load payment history', 'warning');
        }
      }

      // FIXED: Fetch contract history (not move history)
      try {
        const contractResponse = await api.get(`/tenants/${tenantId}/move-history`);
        if (contractResponse.data) {
          setContractHistory(contractResponse.data.move_history || []);
        }
      } catch (error) {
        console.error('Error fetching contract history:', error);
        setContractHistory([]);
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
      await api.put(`/tenants/update/${tenantId}`, editFormData);
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

  // FIXED: Payment success handler
  const handlePaymentSuccess = (paymentData) => {
    showNotification('Payment added successfully', 'success');
    setPaymentDialogOpen(false);
    // Refresh the tenant data to get updated payment history
    fetchTenantData();
  };

  // FIXED: Transfer handler using correct API
  const handleTransferTenant = async () => {
    if (!selectedApartment) {
      showNotification('Please select a new apartment', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const transferData = {
        new_apartment_id: selectedApartment.id,
        transfer_date: transferForm.transfer_date,
        move_out_date: transferForm.move_out_date,
        move_in_date: transferForm.move_in_date,
        notes: transferForm.notes
      };

      await api.post(`/tenants/${tenantId}/transfer`, transferData);
      showNotification('Tenant transferred successfully', 'success');
      setTransferDialogOpen(false);
      setTransferForm({
        new_apartment_id: '',
        transfer_date: new Date().toISOString().split('T')[0],
        move_out_date: new Date().toISOString().split('T')[0],
        move_in_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={() => navigate('/tenants')}>
          Back to Tenants
        </Button>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Tenant not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/tenants')}
          sx={{ mb: 2 }}
        >
          Back to Tenants
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" component="h1">
                {tenant.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <PhoneIcon color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  {tenant.phone || 'No phone'}
                </Typography>
                <EmailIcon color="action" fontSize="small" sx={{ ml: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {tenant.email || 'No email'}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Chip
            label={currentContract || currentApartment ? 'Active Tenant' : 'Inactive'}
            color={currentContract || currentApartment ? 'success' : 'default'}
            icon={currentContract || currentApartment ? <CheckCircleIcon /> : <ErrorIcon />}
          />
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
            onClick={() => setTransferDialogOpen(true)}
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
                  <Typography variant="body2" color="text.secondary">Tenant ID</Typography>
                  <Typography variant="body1">{tenant.passport_id || 'N/A'}</Typography>
                </Box>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Current Property */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              Current Property
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {currentApartment ? (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">Address</Typography>
                      <Typography variant="body1">
                        {currentApartment.address || 'N/A'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">Contract Period</Typography>
                      <Typography variant="body1">
                        {currentContract ?
                          `${formatDate(currentContract.start_date)} - ${formatDate(currentContract.end_date) || 'Ongoing'}` :
                          contractHistory.find(contract => contract.is_current) ?
                            `${formatDate(contractHistory.find(contract => contract.is_current).move_in_date)} - Present` :
                            'N/A'
                        }
                      </Typography>
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
          <Paper sx={{ p: 3, mt: 3 }}>
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
                        <TableCell>{payment.description || payment.notes || payment.paymentType || 'Payment'}</TableCell>
                        <TableCell align="right">{formatCurrency(payment.amountPaid || payment.amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={payment.status || 'Completed'}
                            color={getStatusColor(payment.status)}
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

      {/* FIXED: Contract History instead of Move History */}
      {contractHistory.length > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom color="primary">
            Contract History
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <List>
            {contractHistory.map((contract, index) => (
              <ListItem key={index} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                <ListItemIcon>
                  <HistoryIcon color={contract.is_current ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body1">
                        {contract.apartment_address}
                      </Typography>
                      {contract.is_current && (
                        <Chip label="Current" color="primary" size="small" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {formatCurrency(contract.monthly_rent)}/month
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(contract.move_in_date)} - {contract.move_out_date ? formatDate(contract.move_out_date) : 'Present'}
                      {contract.contract_number && ` • Contract: ${contract.contract_number}`}
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
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date of Birth"
                value={editFormData.date_of_birth}
                onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={editFormData.gender}
                  onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  label="Gender"
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Passport/ID"
                value={editFormData.passport_id}
                onChange={(e) => setEditFormData({ ...editFormData, passport_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Refund IBAN"
                value={editFormData.refund_iban}
                onChange={(e) => setEditFormData({ ...editFormData, refund_iban: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog - FIXED */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent>
          <PaymentComponent
            tenantId={parseInt(tenantId)}
            tenantName={tenant.name}
            apartmentId={currentApartment?.id}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setPaymentDialogOpen(false)}
            showNotification={showNotification}
          />
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog - FIXED */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Transfer Tenant</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Autocomplete
                options={apartmentSearchResults}
                getOptionLabel={(option) =>
                  `${option.full_address || option.address || `Apt ${option.id}`} - ${option.apartment_number || 'N/A'}`
                }
                value={selectedApartment}
                onChange={(event, newValue) => setSelectedApartment(newValue)}
                inputValue={apartmentSearchValue}
                onInputChange={(event, newInputValue) => {
                  setApartmentSearchValue(newInputValue);
                  debouncedSearchApartments(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Destination Apartment"
                    placeholder="Type address or apartment number..."
                    required
                  />
                )}
                loading={isSearchingApartments}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Move Out Date"
                value={transferForm.move_out_date}
                onChange={(e) => setTransferForm({ ...transferForm, move_out_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Move In Date"
                value={transferForm.move_in_date}
                onChange={(e) => setTransferForm({ ...transferForm, move_in_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
                helperText="Move-in date must be after move-out date"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleTransferTenant}
            variant="contained"
            disabled={formSubmitting || !selectedApartment}
          >
            {formSubmitting ? 'Transferring...' : 'Transfer Tenant'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog open={moveOutDialogOpen} onClose={() => setMoveOutDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move Out Tenant</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Move Out Date"
                value={moveOutForm.move_out_date}
                onChange={(e) => setMoveOutForm({ ...moveOutForm, move_out_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={moveOutForm.notes}
                onChange={(e) => setMoveOutForm({ ...moveOutForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOutDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleMoveOut}
            variant="contained"
            color="error"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Processing...' : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TenantDetails;
