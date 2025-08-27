// Enhanced TenantDetails.jsx - Complete modern design with payment functionality and move-out
// FIXED: Now properly handles moved-out tenants with professional minimalistic design
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
  TablePagination,
  Tooltip,
  LinearProgress,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
  Backdrop,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Cake as BirthdayIcon,
  ContactPage as PassportIcon,
  Wc as GenderIcon,
  Schedule as ContractIcon,
  Warning as ExpiryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  SquareFoot as SizeIcon,
  MeetingRoom as RoomsIcon,
  LocationOn as LocationIcon,
  AccountBalance as BankIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Visibility as VisibilityIcon,
  ExitToApp as MoveOutIcon,
  SwapHoriz as TransferIcon,
  ExpandMore as ExpandMoreIcon,
  Timeline as TimelineIcon,
  PersonOff as PersonOffIcon,
  RestoreFromTrash as RestoreIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import api from '../../utils/api';
import TenantEdit from './TenantEdit';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

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

function TenantDetails({ showNotification }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [tenant, setTenant] = useState(null);
  const [apartment, setApartment] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [moveOutDialogOpen, setMoveOutDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [apartments, setApartments] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    notes: ''
  });

  // Move-out form state
  const [moveOutForm, setMoveOutForm] = useState({
    move_out_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    new_apartment_id: '',
    move_out_date: new Date().toISOString().split('T')[0],
    move_in_date: new Date().toISOString().split('T')[0],
    notes: '',
    assign_to_new_contract: true
  });

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
      fetchApartments();
    }
  }, [tenantId]);

  // FIXED: Always fetch payment and move history, regardless of apartment_id
  const fetchTenantData = async () => {
    setLoading(true);
    try {
      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      const tenantData = tenantResponse.data.success ?
        tenantResponse.data.tenant : tenantResponse.data;
      setTenant(tenantData);

      // Always fetch payment and move history
      const dataPromises = [
        fetchPaymentHistory(tenantId),
        fetchMoveHistory(tenantId)
      ];

      // Only fetch apartment data if tenant is currently assigned
      if (tenantData.apartment_id) {
        dataPromises.push(fetchApartmentData(tenantData.apartment_id));
      } else {
        // Clear apartment data for moved-out tenants
        setApartment(null);
      }

      await Promise.all(dataPromises);
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      showNotification('Error loading tenant details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApartmentData = async (apartmentId) => {
    try {
      const apartmentResponse = await api.get(`/apartment/${apartmentId}`);
      setApartment(apartmentResponse.data);
    } catch (error) {
      console.error('Error fetching apartment data:', error);
      try {
        const alternativeResponse = await api.get(`/apartments/${apartmentId}`);
        setApartment(alternativeResponse.data);
      } catch (altError) {
        console.error('Error with alternative apartment endpoint:', altError);
        setApartment(null);
      }
    }
  };

  const fetchPaymentHistory = async (tenantId) => {
    try {
      const response = await api.get(`/tenant-payment-history/${tenantId}`);
      if (response.data) {
        setPaymentHistory(response.data.payments || []);
        setPaymentSummary(response.data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPaymentHistory([]);
      setPaymentSummary(null);
    }
  };

  const fetchMoveHistory = async (tenantId) => {
    try {
      const response = await api.get(`/tenants/${tenantId}/move-history`);
      if (response.data) {
        setMoveHistory(response.data.move_history || []);
      }
    } catch (error) {
      console.error('Error fetching move history:', error);
      setMoveHistory([]);
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await api.get('/list');
      const apartmentsData = response.data?.apartments || response.data || [];
      setApartments(Array.isArray(apartmentsData) ? apartmentsData : []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      setApartments([]);
    }
  };

  const handleBack = () => {
    navigate('/tenants');
  };

  const handleEditTenant = () => {
    setEditDialogOpen(true);
  };

  const handleApartmentClick = (apartment) => {
    if (apartment) {
      setSelectedApartmentForDetails(apartment);
      setApartmentDetailsDialogOpen(true);
    }
  };

  const handleCloseApartmentDetailsDialog = () => {
    setApartmentDetailsDialogOpen(false);
    setSelectedApartmentForDetails(null);
  };

  const handleEditApartment = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}`);
  };

  const handleGoToApartmentPayments = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}/payments`);
  };

  const handleMoveOut = async () => {
    if (!moveOutForm.move_out_date) {
      showNotification('Please select a move-out date', 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Find the current contract tenant record
      const currentContractTenant = moveHistory.find(h => h.is_current);
      if (!currentContractTenant) {
        showNotification('No current contract found for this tenant', 'error');
        return;
      }

      await api.put(`/contract-tenants/${currentContractTenant.contract_tenant_id}/move-out`, {
        move_out_date: moveOutForm.move_out_date,
        notes: moveOutForm.notes
      });

      showNotification(`${tenant.name} has been moved out successfully`, 'success');
      setMoveOutDialogOpen(false);

      // Reset form
      setMoveOutForm({
        move_out_date: new Date().toISOString().split('T')[0],
        notes: ''
      });

      // Refresh data
      await fetchTenantData();
    } catch (error) {
      console.error('Error moving out tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error moving out tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.new_apartment_id || !transferForm.move_out_date || !transferForm.move_in_date) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSubmitting(true);

      await api.post(`/tenants/${tenantId}/transfer`, transferForm);

      showNotification(`${tenant.name} has been transferred successfully`, 'success');
      setTransferDialogOpen(false);

      // Reset form
      setTransferForm({
        new_apartment_id: '',
        move_out_date: new Date().toISOString().split('T')[0],
        move_in_date: new Date().toISOString().split('T')[0],
        notes: '',
        assign_to_new_contract: true
      });

      // Refresh data
      await fetchTenantData();
    } catch (error) {
      console.error('Error transferring tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error transferring tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!paymentForm.amount) {
      showNotification('Please enter a payment amount', 'error');
      return;
    }

    // For moved-out tenants, we need to get apartment info from move history
    let apartmentIdForPayment = tenant.apartment_id;
    if (!apartmentIdForPayment && moveHistory.length > 0) {
      // Use the most recent apartment from move history
      const mostRecentMove = moveHistory[0];
      apartmentIdForPayment = mostRecentMove.apartment_id;
    }

    if (!apartmentIdForPayment) {
      showNotification('Cannot determine apartment for payment. Please contact support.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const paymentData = {
        apartment_id: apartmentIdForPayment,
        amount: parseFloat(paymentForm.amount),
        tenant_name: tenant.name,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        month: paymentForm.month,
        year: paymentForm.year,
        notes: paymentForm.notes,
        contract_period_id: tenant.contract_info?.contract_period_id || null
      };

      await api.post('/payment', paymentData);
      showNotification('Payment added successfully', 'success');
      setPaymentDialogOpen(false);

      // Reset form
      setPaymentForm({
        amount: '',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'rent',
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear(),
        notes: ''
      });

      // Refresh payment history
      await fetchPaymentHistory(tenantId);
    } catch (error) {
      console.error('Error adding payment:', error);
      const errorMessage = error.response?.data?.message || 'Error adding payment';
      showNotification(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatContractStatus = (contractInfo) => {
    if (!contractInfo) return null;

    const today = new Date();
    const endDate = contractInfo.end_date ? new Date(contractInfo.end_date) : null;

    if (!endDate) {
      return { status: 'ongoing', color: 'success', text: 'Ongoing Contract' };
    }

    const daysUntilExpiry = contractInfo.days_until_expiry;

    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: 'error', text: 'Contract Expired' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', color: 'warning', text: `Expires in ${daysUntilExpiry} days` };
    } else {
      return { status: 'active', color: 'success', text: `${daysUntilExpiry} days remaining` };
    }
  };

  const getPaymentStatusColor = (payment) => {
    if (!payment.amountDue || payment.amountPaid >= payment.amountDue) return 'success';
    if (payment.amountPaid > 0) return 'warning';
    return 'error';
  };

  const getInitials = (name) => {
    return name?.split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || '??';
  };

  const getContractProgress = () => {
    if (!tenant.contract_info?.start_date || !tenant.contract_info?.end_date) return 100;

    const start = new Date(tenant.contract_info.start_date);
    const end = new Date(tenant.contract_info.end_date);
    const now = new Date();

    const total = end - start;
    const elapsed = now - start;

    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  // Check if tenant is currently active (not moved out)
  const isCurrentlyActive = () => {
    const currentRecord = moveHistory.find(h => h.is_current);
    return currentRecord && !currentRecord.move_out_date;
  };

  // Get most recent apartment info from move history for moved-out tenants
  const getDisplayApartmentInfo = () => {
    if (apartment) return apartment;

    if (moveHistory.length > 0) {
      const mostRecentMove = moveHistory[0];
      return {
        address: mostRecentMove.apartment_address || 'Unknown Address',
        street_name: mostRecentMove.apartment_address?.split(' ')[0] || '',
        house_number: mostRecentMove.apartment_address?.split(' ')[1] || '',
        city: 'Previous Apartment',
        zip_code: '',
        state: '',
        country: '',
        rent: mostRecentMove.monthly_rent || 0,
        deposit: 0,
        area: null,
        rooms: null,
        is_previous: true
      };
    }

    return null;
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedPayments = paymentHistory.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Backdrop open={loading} sx={{ color: '#fff', zIndex: 1 }}>
          <CircularProgress color="inherit" size={60} />
        </Backdrop>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Tenant not found or failed to load.
        </Alert>
      </Container>
    );
  }

  const contractStatus = formatContractStatus(tenant.contract_info);
  const contractProgress = getContractProgress();
  const currentlyActive = isCurrentlyActive();
  const displayApartment = getDisplayApartmentInfo();

  // Processed data
  const addressLine1 = displayApartment ?
    (displayApartment.is_previous ?
      `${displayApartment.address} (Previous)` :
      `${displayApartment.street_name || ''} ${displayApartment.house_number || ''}, ${displayApartment.city || ''}`) :
    'Not assigned';
  const addressLine2 = displayApartment && !displayApartment.is_previous ?
    `${displayApartment.zip_code || ''} ${displayApartment.state || ''}, ${displayApartment.country || ''}` : '';
  const monthlyRent = tenant.contract_info ?
    formatCurrency(tenant.contract_info.monthly_rent * (tenant.contract_info.rent_share_percentage / 100)) :
    'Not available';

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      {/* Header - Clean and Minimalistic */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>

          <Avatar
            sx={{
              width: 48,
              height: 48,
              backgroundColor: 'primary.main',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: 500
            }}
          >
            {getInitials(tenant.name)}
          </Avatar>

          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {tenant.name}
              </Typography>
              {!currentlyActive && (
                <Chip
                  icon={<PersonOffIcon />}
                  label="Moved Out"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography variant="h6" color="text.secondary">
              {addressLine1}
              {addressLine2 && <><br />{addressLine2}</>}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEditTenant}
              color="primary"
            >
              Edit Tenant
            </Button>
            {currentlyActive && (
              <>
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => setPaymentDialogOpen(true)}
                  color="primary"
                >
                  Add Payment
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MoveOutIcon />}
                  onClick={() => setMoveOutDialogOpen(true)}
                  color="warning"
                >
                  Move Out
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* Personal Information - Clean Design */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ height: '100%', borderRadius: 2 }}>
            <Box sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Personal Information
                </Typography>
              </Stack>

              <Stack spacing={2.5}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <EmailIcon sx={{ color: 'action.active', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                        Email
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {tenant.email || 'Not provided'}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <PhoneIcon sx={{ color: 'action.active', fontSize: 20 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                        Phone
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {tenant.phone || 'Not provided'}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {tenant.bornOn && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <BirthdayIcon sx={{ color: 'action.active', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          Date of Birth
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {formatDate(tenant.bornOn)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

                {tenant.passport_id && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <PassportIcon sx={{ color: 'action.active', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          Passport ID
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {tenant.passport_id}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}

                {tenant.refundIban && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <BankIcon sx={{ color: 'action.active', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          Bank Account (IBAN)
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {tenant.refundIban}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Apartment & Contract Information */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ height: '100%', borderRadius: 2 }}>
            <Box sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <HomeIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {currentlyActive ? 'Current Apartment' : 'Previous Apartment'}
                </Typography>
                {!currentlyActive && (
                  <Chip
                    size="small"
                    label="Historical"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Stack>

              {displayApartment ? (
                <Stack spacing={2.5}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <LocationIcon sx={{ color: 'action.active', fontSize: 20 }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          Address
                        </Typography>
                        <Chip
                          icon={<HomeIcon />}
                          label={displayApartment.is_previous ?
                            `${displayApartment.address} (Previous)` :
                            addressLine1
                          }
                          color="primary"
                          variant="outlined"
                          onClick={() => !displayApartment.is_previous && handleApartmentClick(displayApartment)}
                          sx={{
                            cursor: !displayApartment.is_previous ? 'pointer' : 'default',
                            fontWeight: 500,
                            '&:hover': !displayApartment.is_previous ? {
                              backgroundColor: 'primary.light',
                              color: 'white'
                            } : {}
                          }}
                        />
                      </Box>
                    </Stack>
                  </Box>

                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <MoneyIcon sx={{ color: 'action.active', fontSize: 20 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                          {currentlyActive ? 'Monthly Rent' : 'Previous Rent'}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {monthlyRent}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Contract Information */}
                  {tenant.contract_info && (
                    <>
                      <Divider />
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                          <ContractIcon sx={{ color: 'action.active', fontSize: 20 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                            Contract Details
                          </Typography>
                        </Stack>

                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Box sx={{
                              p: 1.5,
                              backgroundColor: 'success.light',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'success.main',
                              color: 'success.contrastText'
                            }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                Start Date
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                {formatDate(tenant.contract_info.start_date)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box sx={{
                              p: 1.5,
                              backgroundColor: 'warning.light',
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'warning.main',
                              color: 'warning.contrastText'
                            }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                End Date
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                                {formatDate(tenant.contract_info.end_date)}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {contractStatus && (
                          <Box sx={{ mt: 2 }}>
                            <Chip
                              label={contractStatus.text}
                              size="small"
                              color={contractStatus.color}
                              sx={{ fontWeight: 500 }}
                            />
                          </Box>
                        )}
                      </Box>
                    </>
                  )}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                  <HomeIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2">
                    No apartment information available
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Move History Accordion - Only show if there's history */}
        {moveHistory.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ borderRadius: 2 }}>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ backgroundColor: 'primary.light', color: 'primary.contrastText' }}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <TimelineIcon />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Move History ({moveHistory.length} {moveHistory.length === 1 ? 'contract' : 'contracts'})
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List>
                    {moveHistory.map((move, index) => (
                      <ListItem
                        key={move.contract_tenant_id}
                        sx={{
                          borderBottom: index < moveHistory.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          py: 2
                        }}
                      >
                        <ListItemIcon>
                          <Chip
                            label={move.is_current ? 'Current' : 'Past'}
                            size="small"
                            color={move.is_current ? 'success' : 'default'}
                            sx={{ minWidth: 60 }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={move.apartment_address || 'Unknown Address'}
                          secondary={
                            <Stack spacing={0.5}>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(move.move_in_date)} → {move.move_out_date ? formatDate(move.move_out_date) : 'Current'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Contract: {move.contract_number} | {move.rent_share_percentage}% share | {formatCurrency(move.monthly_rent || 0)}
                              </Typography>
                              {move.duration_days && (
                                <Typography variant="caption" color="text.secondary">
                                  Duration: {Math.floor(move.duration_days / 30)} months, {move.duration_days % 30} days
                                </Typography>
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Paper>
          </Grid>
        )}

        {/* Payment History */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ borderRadius: 2 }}>
            <Box sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <ReceiptIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Payment History
                  </Typography>
                  <Chip
                    label={`${paymentHistory.length} payments`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
                {currentlyActive && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setPaymentDialogOpen(true)}
                    color="primary"
                  >
                    Add Payment
                  </Button>
                )}
              </Stack>

              {paymentHistory.length === 0 ? (
                <Box sx={{
                  textAlign: 'center',
                  py: 6,
                  backgroundColor: 'action.hover',
                  borderRadius: 2,
                  border: '2px dashed',
                  borderColor: 'divider'
                }}>
                  <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Payment History
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    This tenant hasn't made any payments yet
                  </Typography>
                  {currentlyActive && (
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setPaymentDialogOpen(true)}
                      color="primary"
                    >
                      Add First Payment
                    </Button>
                  )}
                </Box>
              ) : (
                <>
                  {/* Payment Summary */}
                  {paymentSummary && (
                    <Paper variant="outlined" sx={{ mb: 3, backgroundColor: 'primary.light', color: 'primary.contrastText' }}>
                      <Box sx={{ p: 2.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                          Payment Summary
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Total Paid
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.dark' }}>
                                {formatCurrency(paymentSummary.total_paid)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Total Due
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {formatCurrency(paymentSummary.total_due)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Outstanding
                              </Typography>
                              <Typography variant="h6" sx={{
                                fontWeight: 700,
                                color: paymentSummary.outstanding > 0 ? 'error.main' : 'success.dark'
                              }}>
                                {formatCurrency(paymentSummary.outstanding)}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    </Paper>
                  )}

                  {/* Payment Table */}
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ backgroundColor: 'primary.light' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>Period</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }} align="right">Amount</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }} align="center">Status</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>Method</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedPayments.map((payment) => (
                          <TableRow key={payment.id} hover>
                            <TableCell>
                              {formatDate(payment.paymentDate)}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {payment.month} {payment.year}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={payment.paymentType}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(payment.amountPaid)}
                              {payment.amountDue && payment.amountDue !== payment.amountPaid && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  of {formatCurrency(payment.amountDue)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={
                                  getPaymentStatusColor(payment) === 'success' ? <CheckCircleIcon /> :
                                  getPaymentStatusColor(payment) === 'warning' ? <ExpiryIcon /> :
                                  <ErrorIcon />
                                }
                                label={
                                  getPaymentStatusColor(payment) === 'success' ? 'Paid' :
                                  getPaymentStatusColor(payment) === 'warning' ? 'Partial' :
                                  'Unpaid'
                                }
                                size="small"
                                color={getPaymentStatusColor(payment)}
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {payment.paymentMethod?.replace('_', ' ')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination */}
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={paymentHistory.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{ borderTop: 1, borderColor: 'divider', mt: 2 }}
                  />
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Tenant Dialog */}
      <TenantEdit
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        tenant={tenant}
        apartments={apartments}
        showNotification={showNotification}
        onSave={fetchTenantData}
      />

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 2, color: 'text.primary', fontWeight: 700 }}>
          Add Payment for {tenant.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount (€)"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payment Date"
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Payment Type</InputLabel>
                <Select
                  value={paymentForm.payment_type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                  label="Payment Type"
                >
                  {PAYMENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  label="Payment Method"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method.value} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Month</InputLabel>
                <Select
                  value={paymentForm.month}
                  onChange={(e) => setPaymentForm({ ...paymentForm, month: e.target.value })}
                  label="Month"
                >
                  {MONTHS.map((month) => (
                    <MenuItem key={month} value={month}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={paymentForm.year}
                onChange={(e) => setPaymentForm({ ...paymentForm, year: parseInt(e.target.value) })}
                sx={{ mb: 2 }}
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
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setPaymentDialogOpen(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePaymentSubmit}
            disabled={submitting || !paymentForm.amount}
            color="primary"
            sx={{ minWidth: 120 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Add Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog
        open={moveOutDialogOpen}
        onClose={() => setMoveOutDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 2, color: 'text.primary', fontWeight: 700 }}>
          Move Out {tenant.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 1 }}>
            This will mark the tenant as moved out but keep their historical record.
          </Alert>
          <TextField
            fullWidth
            label="Move Out Date"
            type="date"
            value={moveOutForm.move_out_date}
            onChange={(e) => setMoveOutForm({ ...moveOutForm, move_out_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Notes (optional)"
            multiline
            rows={4}
            value={moveOutForm.notes}
            onChange={(e) => setMoveOutForm({ ...moveOutForm, notes: e.target.value })}
            placeholder="Add any notes about the move-out..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setMoveOutDialogOpen(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleMoveOut}
            disabled={submitting}
            color="error"
            sx={{ minWidth: 120 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 2, color: 'text.primary', fontWeight: 700 }}>
          Transfer {tenant.name} to New Apartment
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>New Apartment</InputLabel>
                <Select
                  value={transferForm.new_apartment_id}
                  onChange={(e) => setTransferForm({ ...transferForm, new_apartment_id: e.target.value })}
                  label="New Apartment"
                >
                  {apartments.map((apt) => (
                    <MenuItem key={apt.id} value={apt.id}>
                      {apt.address || `${apt.street_name} ${apt.house_number}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Move Out Date"
                type="date"
                value={transferForm.move_out_date}
                onChange={(e) => setTransferForm({ ...transferForm, move_out_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Move In Date"
                type="date"
                value={transferForm.move_in_date}
                onChange={(e) => setTransferForm({ ...transferForm, move_in_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (optional)"
                multiline
                rows={3}
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setTransferDialogOpen(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleTransfer}
            disabled={submitting || !transferForm.new_apartment_id}
            color="primary"
            sx={{ minWidth: 120 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apartment Details Dialog */}
      <ApartmentDetailsDialog
        open={apartmentDetailsDialogOpen}
        onClose={handleCloseApartmentDetailsDialog}
        apartment={selectedApartmentForDetails}
        onEdit={handleEditApartment}
        onGoToPayments={handleGoToApartmentPayments}
        onGenerateContract={() => {}}
        onExtendContract={() => {}}
        onOpenContractManagement={() => {}}
        onGoToTenant={() => {}}
        isAdmin={true}
      />
    </Container>
  );
}

export default TenantDetails;
