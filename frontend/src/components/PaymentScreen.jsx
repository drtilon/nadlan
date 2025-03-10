// components/PaymentScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Divider,
  Box,
  Alert,
  Tab,
  Tabs,
  Chip,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  LinearProgress,
  Collapse,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Badge
} from '@mui/material';
import {
  KeyboardArrowUp as ExpandLessIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  RefreshOutlined as RefreshIcon,
  PaymentOutlined as PaymentIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  SaveOutlined as SaveIcon,
  ReceiptOutlined as ReceiptIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  CalendarMonth as CalendarIcon,
  CheckCircleOutline as CheckIcon,
  HistoryOutlined as HistoryIcon,
  Close as CloseIcon,
  EditOutlined as EditIcon,
  CheckCircle as PaidIcon,
  Cancel as UnpaidIcon,
  Error as PartialIcon
} from '@mui/icons-material';
import api from '../utils/api';

// Define the months for payment management
const MONTH_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Colors for payment status
const STATUS_COLORS = {
  paid: '#4caf50',
  partial: '#ff9800',
  not_paid: '#f44336'
};

function PaymentScreen({ showNotification, initialApartment, isAdmin = true }) {
  const theme = useTheme();
  // Use the initialApartment prop (if provided) as the default selection
  const [selectedApartment, setSelectedApartment] = useState(initialApartment || '');
  const [apartments, setApartments] = useState([]);
  const [paymentData, setPaymentData] = useState({});
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [totalRent, setTotalRent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('');
  const [expandedMonths, setExpandedMonths] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [receiptsDialogOpen, setReceiptsDialogOpen] = useState(false);

  // Get the current year and month
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth(); // 0-indexed (January = 0)

  // When component mounts, set the current month
  useEffect(() => {
    setCurrentMonth(MONTH_LIST[currentMonthIndex]);
  }, [currentMonthIndex]);

  // Fetch the list of apartments once on component mount
  useEffect(() => {
    const fetchApartments = async () => {
      try {
        setLoading(true);
        const response = await api.get('/list');
        setApartments(response.data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        showNotification('Error fetching apartments', 'error');
        setLoading(false);
      }
    };
    fetchApartments();
  }, [showNotification]);

  // Parse tenant names from apartment details
  const parseTenantNames = (apartmentData) => {
    if (!apartmentData?.tenants) return [];

    // Handle both string and array formats for tenant names
    if (typeof apartmentData.tenants === 'string') {
      return apartmentData.tenants
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
    } else if (Array.isArray(apartmentData.tenants)) {
      return apartmentData.tenants.map(tenant => {
        // If tenant is an object, extract the name properly
        if (typeof tenant === 'object' && tenant !== null) {
          return tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || '';
        }
        // If tenant is a string, use it directly
        return typeof tenant === 'string' ? tenant : '';
      }).filter(name => name);
    }

    return [];
  };

  // Automatically load tenants for all months based on apartment details
  const autoLoadTenantsForAllMonths = (apartmentData, currentPaymentData, rentAmount) => {
    const tenantNames = parseTenantNames(apartmentData);
    if (tenantNames.length === 0) {
      showNotification('No tenants found for this apartment. Please add tenants first.', 'warning');
      return currentPaymentData;
    }

    const updatedPaymentData = { ...currentPaymentData };

    // Calculate default amount due per tenant
    const amountPerTenant = tenantNames.length > 0 ? rentAmount / tenantNames.length : 0;

    // Update all months with tenant data
    for (const month of MONTH_LIST) {
      const existingMonthData = updatedPaymentData[month] || {
        status: 'not_paid',
        extraPayments: {
          internet: 0,
          electricity: 0,
          other: 0
        }
      };

      // Get existing tenants for this month
      const existingTenants = existingMonthData.tenants || [];

      // Create or update tenant entries
      const updatedTenants = tenantNames.map((name) => {
        const foundTenant = existingTenants.find((t) => t.name === name);
        return foundTenant || {
          name,
          paid: false,
          amountDue: amountPerTenant,
          amountPaid: 0
        };
      });

      // Update the month data with the new tenant information
      updatedPaymentData[month] = {
        ...existingMonthData,
        tenants: updatedTenants,
        status: determinePaymentStatus(updatedTenants)
      };
    }

    return updatedPaymentData;
  };

  // When an apartment is selected, fetch its details and payment data
  useEffect(() => {
    if (!selectedApartment) return;

    const fetchApartmentData = async () => {
      try {
        setLoading(true);
        // Get apartment details
        const apartmentResponse = await api.get(`/apartment/${selectedApartment}`);
        setApartmentDetails(apartmentResponse.data);

        // Determine the rent value based on the model
        const rentValue = apartmentResponse.data.model === 'rental'
          ? parseFloat(apartmentResponse.data.rent_cost) || 0
          : parseFloat(apartmentResponse.data.rent) || 0;
        setTotalRent(rentValue);

        // Get payment data
        const paymentResponse = await api.get(`/payments/${selectedApartment}`);
        const processedData = {};
        for (const month of MONTH_LIST) {
          const monthData = paymentResponse.data[month];
          if (monthData.tenants) {
            // Ensure tenant data is properly structured
            monthData.tenants = monthData.tenants.map((tenant) => ({
              ...tenant,
              name: tenant.name || '',
              paid: tenant.paid || false,
              amountDue: parseFloat(tenant.amountDue) || 0,
              amountPaid: parseFloat(tenant.amountPaid) || 0,
            }));
          } else {
            monthData.tenants = [];
          }

          // Handle both nested and flat structures for extra payments
          if (!monthData.extraPayments) {
            monthData.extraPayments = {
              internet: parseFloat(monthData.internet) || 0,
              electricity: parseFloat(monthData.electricity) || 0,
              other: parseFloat(monthData.other) || 0,
            };
          } else {
            // Ensure values are numbers
            monthData.extraPayments = {
              internet: parseFloat(monthData.extraPayments.internet) || 0,
              electricity: parseFloat(monthData.extraPayments.electricity) || 0,
              other: parseFloat(monthData.extraPayments.other) || 0,
            };
          }
          processedData[month] = monthData;
        }

        // Automatically load tenants for all months
        const updatedData = autoLoadTenantsForAllMonths(
          apartmentResponse.data,
          processedData,
          rentValue
        );

        setPaymentData(updatedData);
        
        // Fetch payment history
        try {
          const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
          setPaymentHistory(historyResponse.data || []);
        } catch (error) {
          console.error('Error fetching payment history:', error);
          setPaymentHistory([]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Initialize default data if an error occurs
        const defaultData = {};
        MONTH_LIST.forEach((month) => {
          defaultData[month] = {
            status: 'not_paid',
            tenants: [],
            extraPayments: {
              internet: 0,
              electricity: 0,
              other: 0
            }
          };
        });

        // Still try to add tenants even for the default data
        if (apartmentDetails) {
          const updatedData = autoLoadTenantsForAllMonths(
            apartmentDetails,
            defaultData,
            totalRent
          );
          setPaymentData(updatedData);
        } else {
          setPaymentData(defaultData);
        }

        showNotification('Error loading payment data. Using default configuration.', 'warning');
        setLoading(false);
      }
    };

    fetchApartmentData();
  }, [selectedApartment, showNotification]);

  // Calculate the remaining amount for a given month
  const calculateRemainingAmount = (month) => {
    if (!paymentData[month]?.tenants) return totalRent.toFixed(2);
    let totalPaid = 0;

    // Sum up all tenant payments
    if (paymentData[month].tenants && Array.isArray(paymentData[month].tenants)) {
      totalPaid = paymentData[month].tenants.reduce(
        (sum, tenant) => sum + (parseFloat(tenant.amountPaid) || 0),
        0
      );
    }

    return Math.max(0, totalRent - totalPaid).toFixed(2);
  };

  // Calculate payment percentage for progress bar
  const calculatePaymentPercentage = (month) => {
    if (!paymentData[month]?.tenants || totalRent === 0) return 0;
    const totalPaid = paymentData[month].tenants.reduce(
      (sum, tenant) => sum + (parseFloat(tenant.amountPaid) || 0),
      0
    );
    return Math.min(100, Math.round((totalPaid / totalRent) * 100));
  };

  // Determine overall payment status from tenant statuses
  const determinePaymentStatus = (tenants) => {
    if (!tenants || !Array.isArray(tenants) || !tenants.length) return 'not_paid';

    // Check if all tenants have paid fully
    const allPaid = tenants.every((tenant) => {
      return tenant.paid || (parseFloat(tenant.amountPaid) >= parseFloat(tenant.amountDue) && parseFloat(tenant.amountDue) > 0);
    });

    if (allPaid) return 'paid';

    // Check if any tenant has made at least a partial payment
    const anyPaid = tenants.some((tenant) => {
      return tenant.paid || parseFloat(tenant.amountPaid) > 0;
    });

    return anyPaid ? 'partial' : 'not_paid';
  };

  // Format the tenant list for display
  const formatTenantList = () => {
    if (!apartmentDetails?.tenants) return 'None registered';

    // If tenants is an array of objects, extract and join names
    if (Array.isArray(apartmentDetails.tenants)) {
      return apartmentDetails.tenants.map(tenant => {
        if (typeof tenant === 'object' && tenant !== null) {
          return tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim();
        }
        return typeof tenant === 'string' ? tenant : '';
      }).filter(name => name).join(', ') || 'None registered';
    }

    // If tenants is a string, return it directly
    return typeof apartmentDetails.tenants === 'string'
      ? apartmentDetails.tenants
      : 'None registered';
  };

  // Evenly split rent among the tenants for a month
  const splitRentEvenly = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    const amountPerTenant = totalRent / tenants.length;
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        amountDue: amountPerTenant,
        amountPaid: tenant.paid ? amountPerTenant : tenant.amountPaid
      }));
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants
        }
      };
    });
    showNotification(`Rent split evenly: $${amountPerTenant.toFixed(2)} per tenant`, 'success');
  };

  // Mark all tenants as paid for a month
  const markAllAsPaid = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        paid: true,
        amountPaid: tenant.amountDue
      }));
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants,
          status: 'paid'
        }
      };
    });
    
    showNotification(`All tenants marked as paid for ${month}`, 'success');
  };
  
  // Mark all tenants as unpaid for a month
  const markAllAsUnpaid = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        paid: false,
        amountPaid: 0
      }));
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants,
          status: 'not_paid'
        }
      };
    });
    
    showNotification(`All tenants marked as unpaid for ${month}`, 'success');
  };

  // Update payment status or other fields for a month
  const handlePaymentChange = (month, field, value) => {
    setPaymentData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value
      }
    }));
  };

  // Update tenant paid status when checkbox changes
  const handleTenantStatusChange = (month, tenantIndex, checked) => {
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updated = { ...tenant, paid: checked };
          if (checked) {
            updated.amountPaid = tenant.amountDue;
          }
          return updated;
        }
        return tenant;
      });
      return {
        ...prev,
        [month]: {
          ...monthData,
          tenants: updatedTenants,
          status: determinePaymentStatus(updatedTenants)
        }
      };
    });
  };

  // Update tenant amounts for due or paid fields
  const handleTenantAmountChange = (month, tenantIndex, field, value) => {
    const numValue = parseFloat(value) || 0;
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updatedTenant = { ...tenant, [field]: numValue };
          if (field === 'amountPaid') {
            updatedTenant.paid = numValue >= tenant.amountDue;
          } else if (field === 'amountDue') {
            updatedTenant.paid = tenant.amountPaid >= numValue;
          }
          return updatedTenant;
        }
        return tenant;
      });
      return {
        ...prev,
        [month]: {
          ...monthData,
          tenants: updatedTenants,
          status: determinePaymentStatus(updatedTenants)
        }
      };
    });
  };

  // Update extra payment fields (e.g., internet, electricity, other)
  const handleExtraPaymentChange = (month, field, value) => {
    const numValue = parseFloat(value) || 0;
    setPaymentData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        extraPayments: {
          ...prev[month].extraPayments,
          [field]: numValue
        }
      }
    }));
  };

  // Toggle expanded state for a month
  const toggleMonthExpanded = (month) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  // Save the payment data to the backend
  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      const formattedData = {};
      for (const month of MONTH_LIST) {
        const monthObj = paymentData[month];
        if (!monthObj) continue;

        // Format tenant data to ensure proper structure
        const formattedTenants = (monthObj.tenants || []).map(tenant => ({
          name: tenant.name,
          paid: Boolean(tenant.paid),
          amountDue: parseFloat(tenant.amountDue) || 0,
          amountPaid: parseFloat(tenant.amountPaid) || 0
        }));

        // Format according to the backend's expected structure
        formattedData[month] = {
          status: monthObj.status || 'not_paid',
          tenants: formattedTenants,
          extraPayments: {
            internet: parseFloat(monthObj.extraPayments?.internet) || 0,
            electricity: parseFloat(monthObj.extraPayments?.electricity) || 0,
            other: parseFloat(monthObj.extraPayments?.other) || 0
          },
          // Include flat fields for backward compatibility
          internet: parseFloat(monthObj.extraPayments?.internet) || 0,
          electricity: parseFloat(monthObj.extraPayments?.electricity) || 0,
          other: parseFloat(monthObj.extraPayments?.other) || 0,
          // Add payment date and method
          paymentDate: paymentDate,
          paymentMethod: paymentMethod
        };
      }

      await api.post(`/payments/${selectedApartment}`, formattedData);
      showNotification('Payment data saved successfully!', 'success');
      
      // Refresh payment history after saving
      try {
        const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
        setPaymentHistory(historyResponse.data || []);
      } catch (error) {
        console.error('Error fetching payment history:', error);
      }
      
      setIsSaving(false);
    } catch (error) {
      console.error(error);
      showNotification(`Error saving payment data: ${error.message || 'Unknown error'}`, 'error');
      setIsSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };
  
  // Get payment method display text
  const getPaymentMethodText = (method) => {
    const methodMap = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      credit_card: 'Credit Card',
      check: 'Check',
      other: 'Other'
    };
    return methodMap[method] || method;
  };
  
  // Generate receipt for a payment
  const generateReceipt = (month) => {
    // In a real application, this would generate a PDF receipt
    showNotification(`Receipt generation for ${month} is not implemented yet`, 'info');
  };
  
  // Is this month current, past, or future?
  const getMonthStatus = (month) => {
    const monthIndex = MONTH_LIST.indexOf(month);
    const currentMonthIndex = new Date().getMonth();
    
    if (monthIndex < currentMonthIndex) return 'past';
    if (monthIndex === currentMonthIndex) return 'current';
    return 'future';
  };

  return (
    <Paper sx={{ p: 4, mt: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <WalletIcon sx={{ mr: 1 }} /> Payment Management
      </Typography>

      {/* Apartment selection */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="apartment-select-label">Select Apartment</InputLabel>
            <Select
              labelId="apartment-select-label"
              value={selectedApartment}
              label="Select Apartment"
              onChange={(e) => setSelectedApartment(e.target.value)}
              disabled={loading || isSaving}
            >
              {apartments.map((apartment) => (
                <MenuItem key={apartment.id} value={apartment.id}>
                  {apartment.address}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ height: '100%', alignItems: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide History' : 'Payment History'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ReceiptIcon />}
              onClick={() => setReceiptsDialogOpen(true)}
              disabled={!selectedApartment}
            >
              Receipts
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {selectedApartment && !loading && (
        <>
          {totalRent === 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Rent is not defined for this apartment. Please set the rent in the apartment details.
            </Alert>
          )}

          {/* Apartment summary card */}
          {apartmentDetails && (
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="h6">{apartmentDetails.address}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      <strong>Model:</strong> {apartmentDetails.model || 'Not specified'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Tenants:</strong> {formatTenantList()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ color: 'primary.main' }}>
                        {formatCurrency(totalRent)}<Typography component="span" variant="body2">/month</Typography>
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        <strong>Contract:</strong> {apartmentDetails.contractEndDate ? 
                          `Until ${formatDate(apartmentDetails.contractEndDate)}` : 
                          'No end date specified'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
          
          {/* Payment History Collapse */}
          <Collapse in={showHistory}>
            <Paper sx={{ p: 3, mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Payment History
                </Typography>
                <Button 
                  size="small" 
                  startIcon={<RefreshIcon />} 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
                      setPaymentHistory(historyResponse.data || []);
                      setLoading(false);
                    } catch (error) {
                      console.error('Error fetching payment history:', error);
                      setLoading(false);
                    }
                  }}
                >
                  Refresh
                </Button>
              </Box>
              
              {paymentHistory.length === 0 ? (
                <Alert severity="info">No payment history available for this apartment.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Month</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Amount Due</TableCell>
                        <TableCell align="right">Amount Paid</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistory.map((record, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{formatDate(record.paymentDate)}</TableCell>
                          <TableCell>{record.month} {record.year || currentYear}</TableCell>
                          <TableCell>
                            <Chip 
                              label={record.status === 'paid' ? 'Paid' : record.status === 'partial' ? 'Partial' : 'Not Paid'}
                              size="small"
                              sx={{ 
                                bgcolor: STATUS_COLORS[record.status],
                                color: 'white'
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">{formatCurrency(record.amountDue || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(record.amountPaid || 0)}</TableCell>
                          <TableCell>{getPaymentMethodText(record.paymentMethod)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="View Receipt">
                              <IconButton size="small" onClick={() => generateReceipt(record.month)}>
                                <ReceiptIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Collapse>

          {/* Current Month Payment Entry */}
          <Card sx={{ mb: 4, borderLeft: 4, borderColor: 'primary.main' }}>
            <CardHeader 
              title={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    {currentMonth} {currentYear} Payment Entry
                  </Typography>
                </Box>
              }
              action={
                <Chip
                  label={paymentData[currentMonth]?.status === 'paid' ? 'Paid' : 
                         paymentData[currentMonth]?.status === 'partial' ? 'Partial' : 'Not Paid'}
                  color={paymentData[currentMonth]?.status === 'paid' ? 'success' : 
                         paymentData[currentMonth]?.status === 'partial' ? 'warning' : 'error'}
                />
              }
            />
            <CardContent>
              <Grid container spacing={3}>
                {/* Payment Progress */}
                <Grid item xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Payment Progress</Typography>
                      <Typography variant="body2">
                        {calculatePaymentPercentage(currentMonth)}% collected
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={calculatePaymentPercentage(currentMonth)}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: paymentData[currentMonth]?.status === 'paid' ? STATUS_COLORS.paid : 
                                           paymentData[currentMonth]?.status === 'partial' ? STATUS_COLORS.partial : 
                                           STATUS_COLORS.not_paid
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        Remaining: {formatCurrency(calculateRemainingAmount(currentMonth))}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                {/* Tenant Payment Grid */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tenant Payments
                  </Typography>
                  
                  {!paymentData[currentMonth]?.tenants || paymentData[currentMonth]?.tenants.length === 0 ? (
                    <Alert severity="info">
                      No tenants available for this apartment. Please add tenants to the apartment first.
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Tenant</TableCell>
                            <TableCell align="right">Amount Due</TableCell>
                            <TableCell align="right">Amount Paid</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paymentData[currentMonth]?.tenants.map((tenant, index) => (
                            <TableRow key={index}>
                              <TableCell>{tenant.name}</TableCell>
                              <TableCell align="right">
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  type="number"
                                  value={tenant.amountDue || 0}
                                  onChange={(e) => handleTenantAmountChange(currentMonth, index, 'amountDue', e.target.value)}
                                  InputProps={{
                                    startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                                  }}
                                  sx={{ width: '120px' }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  size="small"
                                  variant="outlined"
                                  type="number"
                                  value={tenant.amountPaid || 0}
                                  onChange={(e) => handleTenantAmountChange(currentMonth, index, 'amountPaid', e.target.value)}
                                  error={tenant.amountPaid < tenant.amountDue}
                                  InputProps={{
                                    startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                                  }}
                                  sx={{ width: '120px' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Switch
                                    checked={tenant.paid}
                                    onChange={(e) => handleTenantStatusChange(currentMonth, index, e.target.checked)}
                                    color="success"
                                  />
                                  <Chip
                                    label={tenant.paid ? 'Paid' : 
                                           tenant.amountPaid > 0 ? 'Partial' : 'Unpaid'}
                                    size="small"
                                    sx={{
                                      bgcolor: tenant.paid ? STATUS_COLORS.paid : 
                                              tenant.amountPaid > 0 ? STATUS_COLORS.partial : STATUS_COLORS.not_paid,
                                      color: 'white',
                                      ml: 1
                                    }}
                                  />
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title={tenant.paid ? 'Mark as Unpaid' : 'Mark as Paid'}>
                                  <IconButton 
                                    size="small" 
                                    color={tenant.paid ? 'error' : 'success'}
                                    onClick={() => handleTenantStatusChange(currentMonth, index, !tenant.paid)}
                                  >
                                    {tenant.paid ? <UnpaidIcon fontSize="small" /> : <PaidIcon fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Grid>
                
                {/* Additional Payments */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Additional Costs
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Internet"
                        variant="outlined"
                        type="number"
                        value={paymentData[currentMonth]?.extraPayments?.internet || 0}
                        onChange={(e) => handleExtraPaymentChange(currentMonth, 'internet', e.target.value)}
                        InputProps={{
                          startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Electricity"
                        variant="outlined"
                        type="number"
                        value={paymentData[currentMonth]?.extraPayments?.electricity || 0}
                        onChange={(e) => handleExtraPaymentChange(currentMonth, 'electricity', e.target.value)}
                        InputProps={{
                          startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Other Expenses"
                        variant="outlined"
                        type="number"
                        value={paymentData[currentMonth]?.extraPayments?.other || 0}
                        onChange={(e) => handleExtraPaymentChange(currentMonth, 'other', e.target.value)}
                        InputProps={{
                          startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Grid>
                
                {/* Payment Details */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Payment Details
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Payment Date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel id="payment-method-label">Payment Method</InputLabel>
                        <Select
                          labelId="payment-method-label"
                          value={paymentMethod}
                          label="Payment Method"
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                          <MenuItem value="cash">Cash</MenuItem>
                          <MenuItem value="credit_card">Credit Card</MenuItem>
                          <MenuItem value="check">Check</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Grid>
                
                {/* Quick Actions */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Quick Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<PaymentIcon />}
                      onClick={() => splitRentEvenly(currentMonth)}
                      disabled={!paymentData[currentMonth]?.tenants?.length}
                    >
                      Split Rent Evenly
                    </Button>
                    <Button
                      variant="outlined"
                      color="success"
                      startIcon={<PaidIcon />}
                      onClick={() => markAllAsPaid(currentMonth)}
                      disabled={!paymentData[currentMonth]?.tenants?.length}
                    >
                      Mark All Paid
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<UnpaidIcon />}
                      onClick={() => markAllAsUnpaid(currentMonth)}
                      disabled={!paymentData[currentMonth]?.tenants?.length}
                    >
                      Mark All Unpaid
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmit}
              startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              disabled={loading || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Payment Data'}
            </Button>
          </Box>
          
          {/* All Months Overview */}
          <Box sx={{ mt: 5 }}>
            <Typography variant="h6" gutterBottom>
              Payment Status Overview
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Expected</TableCell>
                    <TableCell align="right">Collected</TableCell>
                    <TableCell align="right">Progress</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MONTH_LIST.map((month) => {
                    const monthStatus = getMonthStatus(month);
                    const percentage = calculatePaymentPercentage(month);
                    return (
                      <TableRow 
                        key={month} 
                        sx={{ 
                          bgcolor: monthStatus === 'current' ? 'rgba(25, 118, 210, 0.05)' : undefined,
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                            cursor: 'pointer'
                          }
                        }}
                        onClick={() => setCurrentMonth(month)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {monthStatus === 'current' && (
                              <Chip 
                                label="Current"
                                color="primary" 
                                size="small"
                                sx={{ mr: 1 }}
                              />
                            )}
                            {month} {currentYear}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(totalRent)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(totalRent - calculateRemainingAmount(month))}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={percentage} 
                                sx={{
                                  height: 6,
                                  borderRadius: 1,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: percentage === 100 ? STATUS_COLORS.paid : 
                                                    percentage > 0 ? STATUS_COLORS.partial : 
                                                    STATUS_COLORS.not_paid
                                  }
                                }}
                              />
                            </Box>
                            <Box sx={{ minWidth: 35 }}>
                              <Typography variant="body2" color="text.secondary">
                                {percentage}%
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={paymentData[month]?.status === 'paid' ? 'Paid' : 
                                 paymentData[month]?.status === 'partial' ? 'Partial' : 'Not Paid'}
                            size="small"
                            sx={{ 
                              bgcolor: paymentData[month]?.status === 'paid' ? STATUS_COLORS.paid : 
                                      paymentData[month]?.status === 'partial' ? STATUS_COLORS.partial : 
                                      STATUS_COLORS.not_paid,
                              color: 'white'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}
      
      {/* Receipts Dialog */}
      <Dialog
        open={receiptsDialogOpen}
        onClose={() => setReceiptsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              <ReceiptIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Payment Receipts
            </Typography>
            <IconButton onClick={() => setReceiptsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {paymentHistory.length === 0 ? (
            <Alert severity="info">
              No payment receipts available. Save payments to generate receipts.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentHistory.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatDate(record.paymentDate)}</TableCell>
                      <TableCell>{record.month} {record.year || currentYear}</TableCell>
                      <TableCell align="right">{formatCurrency(record.amountPaid || 0)}</TableCell>
                      <TableCell>{getPaymentMethodText(record.paymentMethod)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<ReceiptIcon />}
                          onClick={() => generateReceipt(record.month)}
                        >
                          Receipt
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default PaymentScreen;
