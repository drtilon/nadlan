// TenantDetails.jsx - FIXED VERSION based on your actual code
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
  ListItemIcon
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
  ExitToApp as MoveOutIcon
} from '@mui/icons-material';
import { green, red, orange, blue, grey } from '@mui/material/colors';
import api from '../../utils/api';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [moveOutDialogOpen, setMoveOutDialogOpen] = useState(false);
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);

  // Form states
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    notes: ''
  });

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
      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      const tenantData = tenantResponse.data.success ? tenantResponse.data.tenant : tenantResponse.data;
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
      if (showNotification) {
        showNotification('Error loading tenant details', 'error');
      }
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

  const getContractStatus = (contractInfo) => {
    if (!contractInfo) return { text: 'No Contract', color: 'default' };

    const today = new Date();
    const endDate = contractInfo.end_date ? new Date(contractInfo.end_date) : null;

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

  const isCurrentlyActive = () => {
    const currentRecord = moveHistory.find(h => h.is_current);
    return currentRecord && !currentRecord.move_out_date;
  };

  const getDisplayApartmentInfo = () => {
    if (apartment) return apartment;

    if (moveHistory.length > 0) {
      const mostRecentMove = moveHistory[0];
      return {
        address: mostRecentMove.apartment_address || 'Unknown Address',
        rent: mostRecentMove.monthly_rent || 0,
        is_previous: true
      };
    }

    return null;
  };

  // Event handlers
  const handleAddPayment = async () => {
    if (!tenant?.apartment_id) {
      if (showNotification) {
        showNotification('Cannot add payment: tenant is not assigned to an apartment', 'error');
      }
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/payment', {
        apartment_id: tenant.apartment_id,
        tenant_name: tenant.name,
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        notes: paymentForm.notes
      });

      if (showNotification) {
        showNotification('Payment added successfully', 'success');
      }
      setPaymentDialogOpen(false);
      setPaymentForm({
        amount: '',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'rent',
        notes: ''
      });
      fetchPaymentHistory(tenantId);
    } catch (error) {
      console.error('Error adding payment:', error);
      if (showNotification) {
        showNotification(error.response?.data?.message || 'Error adding payment', 'error');
      }
    } finally {
      setSubmitting(false);
    }
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

  const handleEditApartment = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}`);
  };

  const handleGoToApartmentPayments = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}/payments`);
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
        <Backdrop open={loading} sx={{ color: '#fff', zIndex: 1 }}>
          <CircularProgress color="inherit" size={60} />
        </Backdrop>
      </Container>
    );
  }

  if (!tenant) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Tenant not found or failed to load.
        </Alert>
      </Container>
    );
  }

  const contractStatus = getContractStatus(tenant.contract_info);
  const currentlyActive = isCurrentlyActive();
  const displayApartment = getDisplayApartmentInfo();
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
                label={currentlyActive ? 'Active Tenant' : 'Former Tenant'}
                color={currentlyActive ? 'success' : 'default'}
                size="small"
                icon={currentlyActive ? <CheckCircleIcon /> : <PersonIcon />}
              />
              {tenant.contract_info && (
                <Chip
                  label={contractStatus.text}
                  color={contractStatus.color}
                  size="small"
                  icon={<ContractIcon />}
                />
              )}
            </Stack>
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            {currentlyActive && (
              <>
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => setPaymentDialogOpen(true)}
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
                    bgcolor: blue[500],
                    fontSize: '1.5rem',
                    mr: 2
                  }}
                >
                  {tenant.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {tenant.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tenant ID: #{tenant.id}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                {tenant.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <EmailIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1">
                        {tenant.email}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {tenant.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PhoneIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body1">
                        {tenant.phone}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {tenant.date_of_birth && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <BirthdayIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Date of Birth
                      </Typography>
                      <Typography variant="body1">
                        {formatDate(tenant.date_of_birth)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {tenant.gender && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <GenderIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Gender
                      </Typography>
                      <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                        {tenant.gender.replace('_', ' ')}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Housing Information Card */}
        <Grid item xs={12} lg={8}>
          <Card elevation={3} sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <HomeIcon color="primary" />
                {currentlyActive ? 'Current Apartment' : 'Housing Information'}
              </Typography>

              {displayApartment ? (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'grey.100',
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    }
                  }}
                  onClick={() => handleApartmentClick(displayApartment)}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {displayApartment.address}
                    {displayApartment.is_previous && (
                      <Chip label="Previous" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="h5" color="success.main" sx={{ fontWeight: 600 }}>
                    {formatCurrency(displayApartment.rent)}/month
                  </Typography>
                </Paper>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <HomeIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3, color: 'text.secondary' }} />
                  <Typography variant="h6" color="text.secondary">
                    No Apartment Assigned
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Summary Cards */}
        {paymentSummary && (
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: blue[50], borderLeft: `4px solid ${blue[500]}` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: blue[700] }}>
                      {paymentSummary.total_payments}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Payments
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: green[50], borderLeft: `4px solid ${green[500]}` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: green[700] }}>
                      {formatCurrency(paymentSummary.total_paid)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Paid
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: orange[50], borderLeft: `4px solid ${orange[500]}` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: orange[700] }}>
                      {formatCurrency(paymentSummary.total_due)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Due
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{
                  bgcolor: paymentSummary.outstanding > 0 ? red[50] : green[50],
                  borderLeft: `4px solid ${paymentSummary.outstanding > 0 ? red[500] : green[500]}`
                }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="h4" sx={{
                      fontWeight: 700,
                      color: paymentSummary.outstanding > 0 ? red[700] : green[700]
                    }}>
                      {formatCurrency(paymentSummary.outstanding)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Outstanding
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        )}

        {/* Move History */}
        {moveHistory.length > 0 && (
          <Grid item xs={12}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <TimelineIcon />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Move History ({moveHistory.length} contracts)
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List>
                    {moveHistory.map((move, index) => (
                      <ListItem key={move.contract_tenant_id} sx={{ py: 2, borderBottom: index < moveHistory.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                        <ListItemIcon>
                          <Chip
                            label={move.is_current ? 'Current' : 'Past'}
                            size="small"
                            color={move.is_current ? 'success' : 'default'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={move.apartment_address || 'Unknown Address'}
                          secondary={`${formatDate(move.move_in_date)} → ${move.move_out_date ? formatDate(move.move_out_date) : 'Present'} • ${formatCurrency(move.monthly_rent)}/month`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Card>
          </Grid>
        )}

        {/* Payment History Table */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3, pb: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Payment History ({paymentHistory.length} payments)
                </Typography>
              </Box>

              {paymentHistory.length > 0 ? (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Amount Due</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Amount Paid</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedPayments.map((payment) => {
                          const isPaid = payment.amountPaid >= payment.amountDue;

                          return (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {payment.paymentDate ? formatDate(payment.paymentDate) : 'Not paid'}
                              </TableCell>
                              <TableCell>
                                {typeof payment.month === 'string' ? payment.month : `${payment.month}/${payment.year}`}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={payment.paymentType?.toUpperCase() || 'RENT'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(payment.amountDue)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: isPaid ? green[600] : red[600], fontWeight: 600 }}>
                                {formatCurrency(payment.amountPaid)}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={isPaid ? 'PAID' : 'PENDING'}
                                  color={isPaid ? 'success' : 'warning'}
                                  icon={isPaid ? <CheckCircleIcon /> : <HistoryIcon />}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={paymentHistory.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                  />
                </>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <PaymentIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" color="text.secondary">
                    No Payment History
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment for {tenant.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              InputProps={{ startAdornment: <Typography>€</Typography> }}
              fullWidth
              required
            />
            <TextField
              label="Payment Date"
              type="date"
              value={paymentForm.payment_date}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddPayment}
            variant="contained"
            disabled={submitting || !paymentForm.amount}
          >
            {submitting ? <CircularProgress size={20} /> : 'Add Payment'}
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
