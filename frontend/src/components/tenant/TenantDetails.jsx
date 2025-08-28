// components/tenant/TenantDetails.jsx - COMPLETE ENHANCED VERSION with Property Click Support
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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton
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
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  SwapHoriz as TransferIcon,
  ExitToApp as MoveOutIcon,
  LocationOn as LocationIcon,
  ContactPage as PassportIcon,
  CreditCard as IbanIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Apartment as ApartmentIcon,
  CalendarToday as CalendarIcon,
  Euro as EuroIcon,
  Business as BusinessIcon,
  Bed as BedIcon,
  Straighten as SizeIcon,
  Groups as OccupancyIcon,
  AccountBalance as BankIcon,
  Phone as ContactIcon
} from '@mui/icons-material';
import { green, red, orange, blue, grey } from '@mui/material/colors';
import api from '../../utils/api';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function TenantDetails({ showNotification }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  // State management
  const [tenant, setTenant] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [moveSummary, setMoveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);
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
  const [moveOutForm, setMoveOutForm] = useState({
    move_out_date: '',
    reason: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

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

      let tenantData;
      if (tenantResponse.data.success) {
        tenantData = tenantResponse.data.tenant;
      } else {
        tenantData = tenantResponse.data;
      }

      setTenant(tenantData);

      // Set edit form data
      setEditFormData({
        name: tenantData.name || '',
        email: tenantData.email || '',
        phone: tenantData.phone || '',
        date_of_birth: tenantData.date_of_birth || tenantData.birthdate || '',
        gender: tenantData.gender || '',
        passport_id: tenantData.passport_id || '',
        refund_iban: tenantData.refund_iban || tenantData.refundIban || ''
      });

      // Fetch payment history
      try {
        const paymentResponse = await api.get(`/tenants/${tenantId}/payment-history`);
        if (paymentResponse.data) {
          setPaymentHistory(paymentResponse.data.payment_history || []);
          setPaymentSummary(paymentResponse.data.summary || {
            total_payments: 0,
            total_paid: 0,
            total_due: 0,
            outstanding: 0
          });
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
        setPaymentHistory([]);
        setPaymentSummary({
          total_payments: 0,
          total_paid: 0,
          total_due: 0,
          outstanding: 0
        });
      }

      // Fetch move history
      try {
        const moveResponse = await api.get(`/tenants/${tenantId}/move-history`);
        if (moveResponse.data) {
          setMoveHistory(moveResponse.data.move_history || []);
          setMoveSummary(moveResponse.data.summary || {
            total_apartments_lived: 0,
            total_contracts: 0,
            current_apartment: null,
            estimated_total_rent_paid: 0,
            is_currently_active: false
          });
        }
      } catch (error) {
        console.error('Error fetching move history:', error);
        setMoveHistory([]);
        setMoveSummary({
          total_apartments_lived: 0,
          total_contracts: 0,
          current_apartment: null,
          estimated_total_rent_paid: 0,
          is_currently_active: false
        });
      }

    } catch (error) {
      console.error('Error fetching tenant data:', error);
      if (showNotification) {
        showNotification('Error fetching tenant data', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const getContractStatus = (contract) => {
    if (!contract) return { text: 'No Contract', color: 'default' };

    const today = new Date();
    const endDate = contract.end_date ? new Date(contract.end_date) : null;

    if (contract.status === 'active') {
      if (!endDate) {
        return { text: 'Active (Open-ended)', color: 'success' };
      } else if (endDate > today) {
        return { text: 'Active', color: 'success' };
      } else {
        return { text: 'Expired', color: 'error' };
      }
    }
    return { text: contract.status || 'Unknown', color: 'default' };
  };

  // Enhanced function to handle property/apartment click
  const handlePropertyClick = async (apartmentInfo) => {
    try {
      // If we have an apartment_id from the contract, fetch the full apartment details
      let apartmentId = apartmentInfo.apartment_id;

      if (!apartmentId && apartmentInfo.contract_period_id) {
        // Try to get apartment ID from contract if not directly available
        const contractResponse = await api.get(`/contracts/${apartmentInfo.contract_period_id}`);
        apartmentId = contractResponse.data?.apartment_id;
      }

      if (apartmentId) {
        // Fetch full apartment details
        const apartmentResponse = await api.get(`/apartments/${apartmentId}`);
        const apartmentData = apartmentResponse.data;

        setSelectedApartmentForDetails(apartmentData);
        setApartmentDetailsDialogOpen(true);
      } else {
        // Fallback: show what info we have in a simple dialog
        setSelectedApartmentForDetails(apartmentInfo);
        setApartmentDetailsDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching apartment details:', error);
      showNotification('Error loading apartment details', 'error');
    }
  };

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
      fetchTenantData(); // Refresh data
    } catch (error) {
      console.error('Error updating tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error updating tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleMoveOut = async () => {
    if (!moveOutForm.move_out_date) {
      showNotification('Move out date is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      await api.post(`/tenants/${tenantId}/move-out`, moveOutForm);
      showNotification('Tenant moved out successfully', 'success');
      setMoveOutDialogOpen(false);
      fetchTenantData(); // Refresh data
    } catch (error) {
      console.error('Error moving out tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error processing move out';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={60} />
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          Tenant not found or error loading tenant data.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/tenants')} size="large">
              <BackIcon />
            </IconButton>
            <Avatar sx={{ width: 64, height: 64, bgcolor: blue[500] }}>
              {tenant.name?.charAt(0)?.toUpperCase() || 'T'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1">
                {tenant.name}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Tenant ID: {tenant.id}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
            {tenant.current_contracts?.length > 0 && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<MoveOutIcon />}
                onClick={() => setMoveOutDialogOpen(true)}
              >
                Move Out
              </Button>
            )}
          </Box>
        </Box>

        {/* Key Stats */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h4" color="primary">
                  {tenant.current_contracts?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Contracts
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h4" color="success.main">
                  {moveSummary?.total_apartments_lived || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Apartments Lived
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h4" color="info.main">
                  {paymentSummary?.total_payments || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Payments
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card variant="outlined" sx={{ textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h4" color="warning.main">
                  {formatCurrency(paymentSummary?.outstanding || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Outstanding
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper elevation={3} sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Personal Information" />
          <Tab label="Current Contracts" />
          <Tab label="Payment History" />
          <Tab label="Move History" />
        </Tabs>

        {/* Personal Information Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Contact Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><EmailIcon /></ListItemIcon>
                  <ListItemText
                    primary="Email"
                    secondary={tenant.email || 'Not provided'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><PhoneIcon /></ListItemIcon>
                  <ListItemText
                    primary="Phone"
                    secondary={tenant.phone || 'Not provided'}
                  />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Personal Details
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><BirthdayIcon /></ListItemIcon>
                  <ListItemText
                    primary="Date of Birth"
                    secondary={formatDate(tenant.date_of_birth || tenant.birthdate) || 'Not provided'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><GenderIcon /></ListItemIcon>
                  <ListItemText
                    primary="Gender"
                    secondary={tenant.gender || 'Not specified'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><PassportIcon /></ListItemIcon>
                  <ListItemText
                    primary="Passport ID"
                    secondary={tenant.passport_id || 'Not provided'}
                  />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Financial Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon><IbanIcon /></ListItemIcon>
                  <ListItemText
                    primary="Refund IBAN"
                    secondary={tenant.refund_iban || tenant.refundIban || 'Not provided'}
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Current Contracts Tab */}
        <TabPanel value={activeTab} index={1}>
          {!tenant.current_contracts || tenant.current_contracts.length === 0 ? (
            <Alert severity="info">
              This tenant has no active contracts.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {tenant.current_contracts.map((contract, index) => (
                <Grid item xs={12} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={4}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                                borderRadius: 1,
                                p: 1,
                                ml: -1,
                                mr: -1
                              }
                            }}
                            onClick={() => handlePropertyClick(contract)}
                          >
                            <HomeIcon color="primary" />
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {contract.apartment_address || 'Apartment'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Click to view details
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                          <Typography variant="body2" color="text.secondary">
                            Monthly Rent
                          </Typography>
                          <Typography variant="h6" color="primary">
                            {formatCurrency(contract.monthly_rent)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Move In Date
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(contract.move_in_date)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            Status
                          </Typography>
                          <Chip
                            label={getContractStatus(contract).text}
                            color={getContractStatus(contract).color}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Payment History Tab */}
        <TabPanel value={activeTab} index={2}>
          {paymentHistory.length === 0 ? (
            <Alert severity="info">
              No payment history available for this tenant.
            </Alert>
          ) : (
            <>
              {/* Payment Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="primary">
                        {formatCurrency(paymentSummary?.total_paid || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Paid
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="warning.main">
                        {formatCurrency(paymentSummary?.total_due || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Due
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="error.main">
                        {formatCurrency(paymentSummary?.outstanding || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Outstanding
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="info.main">
                        {paymentSummary?.total_payments || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Payments
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Payments Table */}
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
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell>{payment.description || 'Payment'}</TableCell>
                        <TableCell align="right">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={payment.status}
                            color={payment.status === 'paid' ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{payment.method || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </TabPanel>

        {/* Move History Tab */}
        <TabPanel value={activeTab} index={3}>
          {moveHistory.length === 0 ? (
            <Alert severity="info">
              No move history available for this tenant.
            </Alert>
          ) : (
            <>
              {/* Move Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="primary">
                        {moveSummary?.total_apartments_lived || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Apartments Lived
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="info.main">
                        {moveSummary?.total_contracts || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Contracts
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="success.main">
                        {formatCurrency(moveSummary?.estimated_total_rent_paid || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Rent Paid
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Chip
                        label={moveSummary?.is_currently_active ? 'Active' : 'Inactive'}
                        color={moveSummary?.is_currently_active ? 'success' : 'default'}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Current Status
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Move History Timeline */}
              <Box>
                {moveHistory.map((move, index) => (
                  <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'action.hover',
                                borderRadius: 1,
                                p: 1,
                                ml: -1,
                                mr: -1
                              }
                            }}
                            onClick={() => handlePropertyClick(move)}
                          >
                            <HomeIcon color="primary" />
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {move.apartment_address}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Click to view details
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="body2" color="text.secondary">
                            Move In
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(move.move_in_date)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="body2" color="text.secondary">
                            Move Out
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(move.move_out_date) || 'Present'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Typography variant="body2" color="text.secondary">
                            Monthly Rent
                          </Typography>
                          <Typography variant="h6" color="primary">
                            {formatCurrency(move.monthly_rent)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </>
          )}
        </TabPanel>
      </Paper>

      {/* Edit Tenant Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Tenant Information</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name *"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={editFormData.date_of_birth}
                onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={editFormData.gender}
                  onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  label="Gender"
                >
                  <MenuItem value="">Not Specified</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Passport ID"
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
                helperText="For security deposit refunds"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={formSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleEditSubmit}
            variant="contained"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Updating...' : 'Update Tenant'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog open={moveOutDialogOpen} onClose={() => setMoveOutDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move Out Tenant</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will mark the tenant as moved out from their current apartment(s).
          </Alert>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Move Out Date *"
                type="date"
                value={moveOutForm.move_out_date}
                onChange={(e) => setMoveOutForm({ ...moveOutForm, move_out_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason (Optional)"
                multiline
                rows={3}
                value={moveOutForm.reason}
                onChange={(e) => setMoveOutForm({ ...moveOutForm, reason: e.target.value })}
                placeholder="Enter reason for move out..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOutDialogOpen(false)} disabled={formSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleMoveOut}
            variant="contained"
            color="warning"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Processing...' : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apartment Details Dialog */}
      <Dialog
        open={apartmentDetailsDialogOpen}
        onClose={() => setApartmentDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ApartmentIcon />
            Apartment Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedApartmentForDetails ? (
            <Box>
              {/* Basic Information */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocationIcon color="primary" />
                    <Typography variant="body1">
                      <strong>Address:</strong> {selectedApartmentForDetails.apartment_address || selectedApartmentForDetails.address || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ApartmentIcon color="primary" />
                    <Typography variant="body1">
                      <strong>Apartment ID:</strong> {selectedApartmentForDetails.apartment_id || selectedApartmentForDetails.id || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Property Details (if available) */}
              {(selectedApartmentForDetails.bedrooms || selectedApartmentForDetails.area || selectedApartmentForDetails.size) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Property Details
                  </Typography>
                  <Grid container spacing={2}>
                    {selectedApartmentForDetails.bedrooms && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BedIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Bedrooms:</strong> {selectedApartmentForDetails.bedrooms}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {(selectedApartmentForDetails.area || selectedApartmentForDetails.size) && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SizeIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Area:</strong> {selectedApartmentForDetails.area || selectedApartmentForDetails.size} m²
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedApartmentForDetails.maxOccupancy && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <OccupancyIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Max Occupancy:</strong> {selectedApartmentForDetails.maxOccupancy}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}

              {/* Financial Information */}
              {(selectedApartmentForDetails.monthly_rent || selectedApartmentForDetails.rent || selectedApartmentForDetails.deposit) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Financial Information
                  </Typography>
                  <Grid container spacing={2}>
                    {(selectedApartmentForDetails.monthly_rent || selectedApartmentForDetails.rent) && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EuroIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Monthly Rent:</strong> {formatCurrency(selectedApartmentForDetails.monthly_rent || selectedApartmentForDetails.rent)}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedApartmentForDetails.deposit && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BankIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Deposit:</strong> {formatCurrency(selectedApartmentForDetails.deposit)}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedApartmentForDetails.managementFee && (
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Management Fee:</strong> {formatCurrency(selectedApartmentForDetails.managementFee)}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}

              {/* Landlord Information (if available) */}
              {selectedApartmentForDetails.landlord && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Landlord Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <PersonIcon color="primary" />
                        <Typography variant="body1">
                          <strong>Name:</strong> {selectedApartmentForDetails.landlord.name || 'N/A'}
                        </Typography>
                      </Box>
                    </Grid>
                    {selectedApartmentForDetails.landlord.company_name && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <BusinessIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Company:</strong> {selectedApartmentForDetails.landlord.company_name}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedApartmentForDetails.landlord.email && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <EmailIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Email:</strong> {selectedApartmentForDetails.landlord.email}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {selectedApartmentForDetails.landlord.phone && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <ContactIcon color="primary" />
                          <Typography variant="body1">
                            <strong>Phone:</strong> {selectedApartmentForDetails.landlord.phone}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}

              {/* Current Tenants (if available) */}
              {selectedApartmentForDetails.tenants && selectedApartmentForDetails.tenants.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Current Tenants
                  </Typography>
                  <List>
                    {selectedApartmentForDetails.tenants.map((tenantInfo, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <PersonIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={tenantInfo.name}
                          secondary={`${tenantInfo.email} • ${tenantInfo.phone}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Box>
          ) : (
            <Typography>Loading apartment details...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApartmentDetailsDialogOpen(false)}>
            Close
          </Button>
          {selectedApartmentForDetails?.apartment_id && (
            <Button
              variant="contained"
              onClick={() => {
                setApartmentDetailsDialogOpen(false);
                navigate(`/apartments/${selectedApartmentForDetails.apartment_id}`);
              }}
            >
              View Full Details
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TenantDetails;
