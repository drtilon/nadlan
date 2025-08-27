// components/tenant/TenantDetails.jsx - COMPLETE FIXED VERSION
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Backdrop,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab
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
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  SwapHoriz as TransferIcon,
  ExitToApp as MoveOutIcon,
  LocationOn as LocationIcon,
  ContactPage as PassportIcon,
  CreditCard as IbanIcon,
  Edit as EditIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { green, red, orange, blue, grey } from '@mui/material/colors';
import api from '../../utils/api';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';
import PaymentComponent from './PaymentComponent';
import TransferComponent from './TransferComponent';
import TenantEdit from './TenantEdit';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const [apartment, setApartment] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [moveSummary, setMoveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [moveOutDialogOpen, setMoveOutDialogOpen] = useState(false);
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);

  // Form states
  const [moveOutForm, setMoveOutForm] = useState({
    move_out_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [transferForm, setTransferForm] = useState({
    new_apartment_id: '',
    move_out_date: new Date().toISOString().split('T')[0],
    move_in_date: new Date().toISOString().split('T')[0],
    notes: '',
    assign_to_new_contract: true
  });

  // Table pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
      fetchApartments();
    }
  }, [tenantId]);

  const fetchTenantData = async () => {
    setLoading(true);
    try {
      // Fetch tenant details - FIXED: Use correct endpoint
      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      const tenantData = tenantResponse.data;
      setTenant(tenantData);

      // Fetch apartment details if tenant has one
      if (tenantData.apartment_id) {
        try {
          const apartmentResponse = await api.get(`/apartments/${tenantData.apartment_id}`);
          setApartment(apartmentResponse.data);
        } catch (error) {
          console.error('Error fetching apartment:', error);
        }
      }

      // Fetch payment history
      try {
        const paymentResponse = await api.get(`/payment-history/tenant/${tenantId}`);
        if (paymentResponse.data) {
          setPaymentHistory(paymentResponse.data.payments || []);
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

    if (!endDate) {
      return { text: 'Ongoing Contract', color: 'success' };
    }

    const daysUntilEnd = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilEnd < 0) {
      return { text: 'Contract Expired', color: 'error' };
    } else if (daysUntilEnd <= 30) {
      return { text: `Expires in ${daysUntilEnd} days`, color: 'warning' };
    } else {
      return { text: 'Active Contract', color: 'success' };
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleEditTenant = () => {
    setEditDialogOpen(true);
  };

  const handleAddPayment = () => {
    if (!tenant?.apartment_id) {
      if (showNotification) {
        showNotification('Cannot add payment: tenant is not assigned to an apartment', 'error');
      }
      return;
    }
    setPaymentDialogOpen(true);
  };

  const handleMoveOut = async () => {
    if (!moveOutForm.move_out_date) {
      if (showNotification) {
        showNotification('Please select a move-out date', 'error');
      }
      return;
    }

    try {
      setSubmitting(true);

      // Find the current contract tenant record
      const currentContractTenant = moveHistory.find(h => h.is_current);
      if (!currentContractTenant) {
        if (showNotification) {
          showNotification('No current contract found for this tenant', 'error');
        }
        return;
      }

      await api.put(`/contract-tenants/${currentContractTenant.contract_tenant_id}/move-out`, {
        move_out_date: moveOutForm.move_out_date,
        notes: moveOutForm.notes
      });

      if (showNotification) {
        showNotification(`${tenant.name} has been moved out successfully`, 'success');
      }
      setMoveOutDialogOpen(false);

      // Reset form and refresh data
      setMoveOutForm({
        move_out_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await fetchTenantData();
    } catch (error) {
      console.error('Error moving out tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error moving out tenant';
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.new_apartment_id || !transferForm.move_out_date || !transferForm.move_in_date) {
      if (showNotification) {
        showNotification('Please fill in all required fields', 'error');
      }
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/tenants/${tenantId}/transfer`, transferForm);

      if (showNotification) {
        showNotification(`${tenant.name} has been transferred successfully`, 'success');
      }
      setTransferDialogOpen(false);

      // Reset form and refresh data
      setTransferForm({
        new_apartment_id: '',
        move_out_date: new Date().toISOString().split('T')[0],
        move_in_date: new Date().toISOString().split('T')[0],
        notes: '',
        assign_to_new_contract: true
      });
      await fetchTenantData();
    } catch (error) {
      console.error('Error transferring tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error transferring tenant';
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApartmentClick = (apartmentData) => {
    setSelectedApartmentForDetails(apartmentData);
    setApartmentDetailsDialogOpen(true);
  };

  const handleCloseApartmentDetailsDialog = () => {
    setApartmentDetailsDialogOpen(false);
    setSelectedApartmentForDetails(null);
  };

  // Table pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Tenant not found or failed to load.
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/tenants')}
          sx={{ mt: 2 }}
        >
          Back to Tenants
        </Button>
      </Container>
    );
  }

  const isCurrentlyActive = moveSummary?.is_currently_active || false;
  const currentContract = moveHistory.find(m => m.is_current);
  const contractStatus = getContractStatus(currentContract);
  const paginatedPayments = paymentHistory.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/tenants')}
          sx={{ mb: 2 }}
        >
          Back to Tenants
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {tenant.name}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={isCurrentlyActive ? 'Active Tenant' : 'Former Tenant'}
                color={isCurrentlyActive ? 'success' : 'default'}
                size="small"
                icon={isCurrentlyActive ? <CheckCircleIcon /> : <PersonIcon />}
              />
              <Chip
                label={contractStatus.text}
                color={contractStatus.color}
                size="small"
                icon={<ContractIcon />}
              />
            </Stack>
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={handleEditTenant}
            >
              Edit
            </Button>
            {isCurrentlyActive && (
              <>
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={handleAddPayment}
                  sx={{ bgcolor: green[600], '&:hover': { bgcolor: green[700] } }}
                >
                  Add Payment
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TransferIcon />}
                  onClick={() => setTransferDialogOpen(true)}
                  color="primary"
                >
                  Transfer
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MoveOutIcon />}
                  onClick={() => setMoveOutDialogOpen(true)}
                  color="error"
                >
                  Move Out
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Personal Information Card */}
        <Grid item xs={12} lg={4}>
          <Card elevation={3} sx={{ height: 'fit-content', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: blue[600],
                    fontSize: '1.5rem',
                    mr: 2
                  }}
                >
                  {tenant.name ? tenant.name.charAt(0).toUpperCase() : 'T'}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {tenant.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {tenant.id}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={2}>
                {tenant.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <EmailIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2">{tenant.email}</Typography>
                  </Box>
                )}

                {tenant.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PhoneIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2">{tenant.phone}</Typography>
                  </Box>
                )}

                {tenant.passport_id && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PassportIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2">Passport: {tenant.passport_id}</Typography>
                  </Box>
                )}

                {tenant.bornOn && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BirthdayIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2">
                      {formatDate(tenant.bornOn)}
                    </Typography>
                  </Box>
                )}

                {tenant.gender && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <GenderIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2">
                      {tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1).replace('_', ' ')}
                    </Typography>
                  </Box>
                )}

                {tenant.refundIban && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IbanIcon sx={{ color: grey[600], mr: 2 }} />
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {tenant.refundIban}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side - Apartment, Payment Summary, and History */}
        <Grid item xs={12} lg={8}>
          {/* Current Apartment Information Card */}
          <Card elevation={3} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                <HomeIcon sx={{ mr: 1, color: blue[600] }} />
                Assigned Property & Contract
              </Typography>

              {apartment ? (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Address
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          cursor: 'pointer',
                          color: blue[600],
                          '&:hover': { textDecoration: 'underline' }
                        }}
                        onClick={() => handleApartmentClick(apartment)}
                      >
                        {apartment.address}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Monthly Rent
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(apartment.rent || apartment.monthly_rent)}
                      </Typography>
                    </Box>
                  </Grid>

                  {currentContract && (
                    <>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Contract Number
                          </Typography>
                          <Typography variant="body1">
                            {currentContract.contract_number || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Contract Period
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(currentContract.move_in_date)} - {formatDate(currentContract.move_out_date)}
                          </Typography>
                        </Box>
                      </Grid>
                    </>
                  )}
                </Grid>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No apartment currently assigned.
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary Card */}
          {paymentSummary && (
            <Card elevation={3} sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                  <PaymentIcon sx={{ mr: 1, color: green[600] }} />
                  Payment Summary
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Payments
                      </Typography>
                      <Typography variant="h6">
                        {paymentSummary.total_payments || 0}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Paid
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(paymentSummary.total_paid || 0)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Due
                      </Typography>
                      <Typography variant="h6">
                        {formatCurrency(paymentSummary.total_due || 0)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Outstanding
                      </Typography>
                      <Typography variant="h6" color={paymentSummary.outstanding > 0 ? "error.main" : "success.main"}>
                        {formatCurrency(paymentSummary.outstanding || 0)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Tabs for Payment and Move History */}
          <Paper elevation={3} sx={{ borderRadius: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="Payment History" icon={<PaymentIcon />} iconPosition="start" />
              <Tab label="Move History" icon={<HistoryIcon />} iconPosition="start" />
            </Tabs>

            {/* Payment History Tab */}
            <TabPanel value={activeTab} index={0}>
              {paymentHistory.length > 0 ? (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell>Amount Due</TableCell>
                          <TableCell>Amount Paid</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Method</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedPayments.map((payment, index) => (
                          <TableRow key={payment.id || index}>
                            <TableCell>
                              {formatDate(payment.paymentDate)}
                            </TableCell>
                            <TableCell>
                              {payment.month} {payment.year}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(payment.amountDue || 0)}
                            </TableCell>
                            <TableCell>
                              <Typography color="success.main">
                                {formatCurrency(payment.amountPaid || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={payment.status || 'Paid'}
                                color={payment.status === 'paid' ? 'success' : 'warning'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {payment.paymentMethod || 'Bank Transfer'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {paymentHistory.length > rowsPerPage && (
                    <TablePagination
                      component="div"
                      count={paymentHistory.length}
                      page={page}
                      onPageChange={handleChangePage}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[5, 10, 25]}
                    />
                  )}
                </>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No payment history available.
                </Alert>
              )}
            </TabPanel>

            {/* Move History Tab */}
            <TabPanel value={activeTab} index={1}>
              {moveHistory.length > 0 ? (
                <List>
                  {moveHistory.map((move, index) => (
                    <ListItem
                      key={move.contract_tenant_id || index}
                      sx={{
                        border: '1px solid',
                        borderColor: move.is_current ? green[300] : grey[300],
                        borderRadius: 2,
                        mb: 1,
                        bgcolor: move.is_current ? green[50] : 'background.paper'
                      }}
                    >
                      <ListItemIcon>
                        <HomeIcon color={move.is_current ? 'success' : 'disabled'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                              {move.apartment_address || 'Unknown Address'}
                            </Typography>
                            {move.is_current && (
                              <Chip label="Current" color="success" size="small" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Contract: {move.contract_number || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Period: {formatDate(move.move_in_date)} - {formatDate(move.move_out_date)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Monthly Rent: {formatCurrency(move.monthly_rent || 0)}
                            </Typography>
                            {move.duration_days && (
                              <Typography variant="body2" color="text.secondary">
                                Duration: {move.duration_days} days
                              </Typography>
                            )}
                            {move.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Notes: {move.notes}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No move history available.
                </Alert>
              )}

              {/* Move History Summary */}
              {moveSummary && moveHistory.length > 0 && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Move History Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Total Apartments
                      </Typography>
                      <Typography variant="body1">
                        {moveSummary.total_apartments_lived || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Total Contracts
                      </Typography>
                      <Typography variant="body1">
                        {moveSummary.total_contracts || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Est. Total Rent Paid
                      </Typography>
                      <Typography variant="body1">
                        {formatCurrency(moveSummary.estimated_total_rent_paid || 0)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={moveSummary.is_currently_active ? 'Active' : 'Inactive'}
                        color={moveSummary.is_currently_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Tenant Dialog */}
      <TenantEdit
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          fetchTenantData(); // Refresh data after edit
        }}
        tenant={tenant}
        apartments={apartments}
        showNotification={showNotification}
        onSave={fetchTenantData}
      />

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment for {tenant.name}</DialogTitle>
        <DialogContent>
          <PaymentComponent
            tenantId={tenantId}
            tenantName={tenant.name}
            apartmentId={tenant.apartment_id}
            onSuccess={() => {
              setPaymentDialogOpen(false);
              fetchTenantData();
              if (showNotification) {
                showNotification('Payment added successfully', 'success');
              }
            }}
            onCancel={() => setPaymentDialogOpen(false)}
            showNotification={showNotification}
          />
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer {tenant.name} to Another Apartment</DialogTitle>
        <DialogContent>
          <TransferComponent
            tenantId={tenantId}
            tenantName={tenant.name}
            apartments={apartments}
            onSuccess={handleTransfer}
            onCancel={() => setTransferDialogOpen(false)}
            transferForm={transferForm}
            setTransferForm={setTransferForm}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog open={moveOutDialogOpen} onClose={() => setMoveOutDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move Out {tenant.name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            type="date"
            label="Move Out Date"
            value={moveOutForm.move_out_date}
            onChange={(e) => setMoveOutForm({...moveOutForm, move_out_date: e.target.value})}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (Optional)"
            value={moveOutForm.notes}
            onChange={(e) => setMoveOutForm({...moveOutForm, notes: e.target.value})}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOutDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleMoveOut}
            color="error"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Move Out'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apartment Details Dialog */}
      {selectedApartmentForDetails && (
        <ApartmentDetailsDialog
          open={apartmentDetailsDialogOpen}
          onClose={handleCloseApartmentDetailsDialog}
          apartment={selectedApartmentForDetails}
          onEdit={(apartmentId) => {
            handleCloseApartmentDetailsDialog();
            navigate(`/apartments/${apartmentId}`);
          }}
          onGoToPayments={(apartmentId) => {
            handleCloseApartmentDetailsDialog();
            navigate(`/apartments/${apartmentId}/payments`);
          }}
        />
      )}
    </Container>
  );
}

export default TenantDetails;
