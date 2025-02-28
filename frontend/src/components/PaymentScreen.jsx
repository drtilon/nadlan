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
  IconButton,
  Tooltip,
  LinearProgress,
  Collapse,
  Stack
} from '@mui/material';
import {
  KeyboardArrowUp as ExpandLessIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  RefreshOutlined as RefreshIcon,
  PaymentOutlined as PaymentIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  SaveOutlined as SaveIcon
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

function PaymentScreen({ showNotification, initialApartment }) {
  // Use the initialApartment prop (if provided) as the default selection
  const [selectedApartment, setSelectedApartment] = useState(initialApartment || '');
  const [apartments, setApartments] = useState([]);
  const [paymentData, setPaymentData] = useState({});
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [totalRent, setTotalRent] = useState(0);
  const [initializedDefaults, setInitializedDefaults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [expandedMonths, setExpandedMonths] = useState({});
  const currentYear = new Date().getFullYear();

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

  // When an apartment is selected, fetch its details and payment data
  useEffect(() => {
    if (!selectedApartment) return;

    const fetchApartmentData = async () => {
      try {
        setLoading(true);
        setInitializedDefaults(false);
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
        setPaymentData(processedData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        if (!initializedDefaults) {
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
          setPaymentData(defaultData);
          setInitializedDefaults(true);
          showNotification('Initialized new payment data for this apartment', 'info');
        }
        setLoading(false);
      }
    };

    fetchApartmentData();
  }, [selectedApartment, showNotification, initializedDefaults]);

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

  // Parse tenant names from apartment details (assumes comma-separated names)
  const parseTenantNames = () => {
    if (!apartmentDetails?.tenants) return [];

    // Handle both string and array formats for tenant names
    if (typeof apartmentDetails.tenants === 'string') {
      return apartmentDetails.tenants
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
    } else if (Array.isArray(apartmentDetails.tenants)) {
      return apartmentDetails.tenants.map(t =>
        typeof t === 'string' ? t : (t.name || '')
      ).filter(name => name);
    }

    return [];
  };

  // Load tenants for a given month from apartment details
  const loadTenantsForMonth = (month) => {
    const tenantNames = parseTenantNames();
    if (tenantNames.length === 0) {
      showNotification('No tenants found for this apartment. Please add tenants first.', 'warning');
      return;
    }
    setPaymentData((prev) => {
      const existingTenants = prev[month]?.tenants || [];
      const updatedTenants = tenantNames.map((name) => {
        const foundTenant = existingTenants.find((t) => t.name === name);
        return foundTenant || { name, paid: false, amountDue: 0, amountPaid: 0 };
      });
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants
        }
      };
    });
    showNotification('Tenants loaded successfully!', 'success');
  };

  // Evenly split rent among the tenants for a month
  const splitRentEvenly = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('Please load tenants first', 'warning');
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
      setLoading(true);
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
          other: parseFloat(monthObj.extraPayments?.other) || 0
        };
      }

      await api.post(`/payments/${selectedApartment}`, formattedData);
      showNotification('Payment data saved successfully!', 'success');
      setLoading(false);
    } catch (error) {
      console.error(error);
      showNotification(`Error saving payment data: ${error.message || 'Unknown error'}`, 'error');
      setLoading(false);
    }
  };

  // Get months for the current quarter based on selected tab
  const getQuarterMonths = () => {
    const quarterStart = currentTab * 3;
    return MONTH_LIST.slice(quarterStart, quarterStart + 3);
  };

  return (
    <Paper sx={{ p: 4, mt: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <WalletIcon sx={{ mr: 1 }} /> Payment Management
      </Typography>

      {/* Apartment selection */}
      <Box sx={{ mb: 4 }}>
        <FormControl fullWidth variant="outlined">
          <InputLabel id="apartment-select-label">Select Apartment</InputLabel>
          <Select
            labelId="apartment-select-label"
            value={selectedApartment}
            label="Select Apartment"
            onChange={(e) => setSelectedApartment(e.target.value)}
            disabled={loading}
          >
            {apartments.map((apartment) => (
              <MenuItem key={apartment.id} value={apartment.id}>
                {apartment.address}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {selectedApartment && !loading && (
        <div>
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
                    <Typography variant="body2" color="text.secondary">
                      Model: {apartmentDetails.model || 'Not specified'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tenants: {apartmentDetails.tenants || 'None registered'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="h6" align="right" sx={{ color: 'primary.main' }}>
                      ${totalRent.toFixed(2)}/month
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Quarter tabs */}
          <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={currentTab}
              onChange={(e, newValue) => setCurrentTab(newValue)}
              variant="fullWidth"
            >
              <Tab label="Q1 (Jan-Mar)" />
              <Tab label="Q2 (Apr-Jun)" />
              <Tab label="Q3 (Jul-Sep)" />
              <Tab label="Q4 (Oct-Dec)" />
            </Tabs>
          </Box>

          {/* Loop through each month in the current quarter */}
          {getQuarterMonths().map((month) => {
            const isExpanded = expandedMonths[month] !== false;
            const paymentPercentage = calculatePaymentPercentage(month);
            const paymentStatus = paymentData[month]?.status || 'not_paid';
            const remainingAmount = calculateRemainingAmount(month);

            return (
              <Card key={month} sx={{ mb: 3, borderLeft: 4, borderColor: STATUS_COLORS[paymentStatus] }}>
                {/* Month header */}
                <CardContent sx={{ py: 2, cursor: 'pointer' }} onClick={() => toggleMonthExpanded(month)}>
                  <Grid container alignItems="center">
                    <Grid item xs={6}>
                      <Typography variant="h6">
                        {month} {currentYear}
                        <IconButton size="small" sx={{ ml: 1 }}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Typography>
                    </Grid>
                    <Grid item xs={6} textAlign="right">
                      <Chip
                        label={paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Not Paid'}
                        size="small"
                        sx={{
                          bgcolor: STATUS_COLORS[paymentStatus],
                          color: 'white',
                          fontWeight: 'bold',
                          mr: 1
                        }}
                      />
                      <Typography variant="body2" component="span">
                        ${remainingAmount} left
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={paymentPercentage}
                        sx={{
                          height: 8,
                          borderRadius: 1,
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: STATUS_COLORS[paymentStatus]
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                        {paymentPercentage}% collected
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>

                {/* Expandable month details */}
                <Collapse in={isExpanded}>
                  <Divider />
                  <CardContent>
                    {/* Quick actions */}
                    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => loadTenantsForMonth(month)}
                      >
                        Load Tenants
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PaymentIcon />}
                        onClick={() => splitRentEvenly(month)}
                        disabled={!paymentData[month]?.tenants?.length}
                      >
                        Split Rent Evenly
                      </Button>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel id={`${month}-status-label`}>Payment Status</InputLabel>
                        <Select
                          labelId={`${month}-status-label`}
                          value={paymentData[month]?.status || 'not_paid'}
                          label="Payment Status"
                          onChange={(e) => handlePaymentChange(month, 'status', e.target.value)}
                        >
                          <MenuItem value="paid">Paid</MenuItem>
                          <MenuItem value="partial">Partial</MenuItem>
                          <MenuItem value="not_paid">Not Paid</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>

                    {/* Tenant payment details */}
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                      <Box component="span" sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'primary.main', mr: 1 }}></Box>
                      Tenant Payments
                    </Typography>

                    {paymentData[month]?.tenants && paymentData[month].tenants.length > 0 ? (
                      <Grid container spacing={2}>
                        {paymentData[month].tenants.map((tenant, index) => (
                          <Grid item xs={12} md={6} key={index}>
                            <Card variant="outlined" sx={{
                              bgcolor: tenant.paid ? 'rgba(76, 175, 80, 0.05)' : 'transparent',
                              borderColor: tenant.paid ? 'success.light' : 'divider'
                            }}>
                              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={12}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            checked={tenant.paid}
                                            onChange={(e) => handleTenantStatusChange(month, index, e.target.checked)}
                                            color="success"
                                          />
                                        }
                                        label={
                                          <Typography variant="subtitle2">
                                            {tenant.name}
                                          </Typography>
                                        }
                                      />
                                      <Chip
                                        label={tenant.paid ? 'Paid' : 'Pending'}
                                        size="small"
                                        sx={{
                                          bgcolor: tenant.paid ? STATUS_COLORS.paid : STATUS_COLORS.not_paid,
                                          color: 'white',
                                        }}
                                      />
                                    </Box>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <TextField
                                      fullWidth
                                      label="Amount Due"
                                      type="number"
                                      value={tenant.amountDue || 0}
                                      onChange={(e) => handleTenantAmountChange(month, index, 'amountDue', e.target.value)}
                                      InputProps={{
                                        startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                                      }}
                                      size="small"
                                    />
                                  </Grid>
                                  <Grid item xs={6}>
                                    <TextField
                                      fullWidth
                                      label="Amount Paid"
                                      type="number"
                                      value={tenant.amountPaid || 0}
                                      onChange={(e) => handleTenantAmountChange(month, index, 'amountPaid', e.target.value)}
                                      error={tenant.amountPaid < tenant.amountDue}
                                      InputProps={{
                                        startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                                      }}
                                      size="small"
                                    />
                                  </Grid>
                                  {tenant.amountPaid < tenant.amountDue && (
                                    <Grid item xs={12}>
                                      <Typography variant="caption" color="error.main">
                                        Missing: ${(tenant.amountDue - tenant.amountPaid).toFixed(2)}
                                      </Typography>
                                    </Grid>
                                  )}
                                </Grid>
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Card variant="outlined" sx={{ mb: 3, bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <CardContent sx={{ textAlign: 'center', p: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No tenants registered. Click "Load Tenants" to add tenants for this month.
                          </Typography>
                        </CardContent>
                      </Card>
                    )}

                    {/* Additional payments */}
                    <Typography variant="subtitle1" sx={{ mt: 3, mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                      <Box component="span" sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'secondary.main', mr: 1 }}></Box>
                      Additional Payments
                    </Typography>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Internet"
                              type="number"
                              value={paymentData[month]?.extraPayments?.internet || 0}
                              onChange={(e) => handleExtraPaymentChange(month, 'internet', e.target.value)}
                              InputProps={{
                                startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                              }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Electricity"
                              type="number"
                              value={paymentData[month]?.extraPayments?.electricity || 0}
                              onChange={(e) => handleExtraPaymentChange(month, 'electricity', e.target.value)}
                              InputProps={{
                                startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                              }}
                              size="small"
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Other Expenses"
                              type="number"
                              value={paymentData[month]?.extraPayments?.other || 0}
                              onChange={(e) => handleExtraPaymentChange(month, 'other', e.target.value)}
                              InputProps={{
                                startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography>,
                              }}
                              size="small"
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Collapse>
              </Card>
            );
          })}

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmit}
              startIcon={<SaveIcon />}
              disabled={loading}
            >
              Save Payment Data
            </Button>
          </Box>
        </div>
      )}
    </Paper>
  );
}

export default PaymentScreen;
