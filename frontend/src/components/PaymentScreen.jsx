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
  Alert
} from '@mui/material';
import api from '../utils/api';

/**
 * Move your month list outside the component so
 * it's not recreated on every render.
 */
const MONTH_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function PaymentScreen({ showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('');
  const [paymentData, setPaymentData] = useState({});
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [totalRent, setTotalRent] = useState(0);

  // Prevent repeatedly initializing defaults on every error
  const [initializedDefaults, setInitializedDefaults] = useState(false);

  /**
   * 1) Fetch all apartments ONCE (no dependencies other than []),
   *    removing `showNotification` from dependency array to avoid re-renders.
   */
  useEffect(() => {
    const fetchApartments = async () => {
      try {
        const response = await api.get('/list');
        setApartments(response.data);
      } catch (error) {
        console.error(error);
        showNotification('Error fetching apartments', 'error');
      }
    };
    fetchApartments();
  }, []); // runs only on mount

  /**
   * 2) When an apartment is selected, load details + payment data.
   *    We do NOT include showNotification or MONTH_LIST in dependencies
   *    to prevent re-running the effect unnecessarily.
   */
  useEffect(() => {
    if (!selectedApartment) return;

    const fetchApartmentData = async () => {
      try {
        // Reset default-data flag before new fetch
        setInitializedDefaults(false);

        // 1) Get apartment details
        const apartmentResponse = await api.get(`/apartment/${selectedApartment}`);
        setApartmentDetails(apartmentResponse.data);

        // 2) Determine the total rent to display (based on model)
        const rentValue = apartmentResponse.data.model === 'rental'
          ? parseFloat(apartmentResponse.data.rent_cost) || 0
          : parseFloat(apartmentResponse.data.rent) || 0;
        setTotalRent(rentValue);

        // 3) Get payment data
        const paymentResponse = await api.get(`/payments/${selectedApartment}`);

        // 4) Process the payment data
        const processedData = {};
        for (const month of MONTH_LIST) {
          const monthData = paymentResponse.data[month];
          
          // Make sure we have a valid structure for tenants
          if (monthData.tenants) {
            monthData.tenants = monthData.tenants.map((tenant) => ({
              ...tenant,
              amountDue: tenant.amountDue || 0,
              amountPaid: tenant.amountPaid || 0,
            }));
          } else {
            monthData.tenants = [];
          }

          // Ensure extraPayments exists
          if (!monthData.extraPayments) {
            monthData.extraPayments = {
              internet: monthData.internet || 0,
              electricity: monthData.electricity || 0,
              other: monthData.other || 0,
            };
          }

          processedData[month] = monthData;
        }

        setPaymentData(processedData);
      } catch (error) {
        console.error('Error fetching data:', error);

        /**
         * Only initialize defaults once if there is an error.
         * This prevents a loop of repeated fetch → error → set defaults → re-fetch → ...
         */
        if (!initializedDefaults) {
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
      }
    };

    fetchApartmentData();
  }, [selectedApartment]); // re-run only when selectedApartment changes

  const handleApartmentChange = (e) => {
    setSelectedApartment(e.target.value);
  };

  // Helper to determine overall payment status from tenant statuses
  const determinePaymentStatus = (tenants) => {
    if (!tenants.length) return 'not_paid';
    const allPaid = tenants.every((tenant) => tenant.paid);
    if (allPaid) return 'paid';
    const anyPaid = tenants.some((tenant) => tenant.paid || tenant.amountPaid > 0);
    return anyPaid ? 'partial' : 'not_paid';
  };

  // Calculate how much is left to pay for a month
  const calculateRemainingAmount = (month) => {
    if (!paymentData[month]?.tenants) return totalRent;
    const totalPaid = paymentData[month].tenants.reduce(
      (sum, tenant) => sum + (parseFloat(tenant.amountPaid) || 0),
      0
    );
    return Math.max(0, totalRent - totalPaid).toFixed(2);
  };

  // Extract tenant names from apartmentDetails
  const parseTenantNames = () => {
    if (!apartmentDetails?.tenants) return [];
    // Assuming tenant names are comma-separated
    return apartmentDetails.tenants
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name);
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
      // Merge existing tenant data with newly loaded names
      const updatedTenants = tenantNames.map((name) => {
        const foundTenant = existingTenants.find((t) => t.name === name);
        if (foundTenant) {
          return foundTenant;
        }
        return {
          name,
          paid: false,
          amountDue: 0,
          amountPaid: 0
        };
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
        // If they were marked paid, update amountPaid to the new due
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

    showNotification(`Rent split evenly: ₪${amountPerTenant.toFixed(2)} per tenant`, 'success');
  };

  // Update high-level payment status for a month
  const handlePaymentChange = (month, field, value) => {
    setPaymentData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value
      }
    }));
  };

  // Checkbox: whether a tenant is fully paid
  const handleTenantStatusChange = (month, tenantIndex, checked) => {
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updated = { ...tenant, paid: checked };
          if (checked) {
            // If marking as paid, assume they've paid the full amountDue
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

  // Change either amountDue or amountPaid for a tenant
  const handleTenantAmountChange = (month, tenantIndex, field, value) => {
    const numValue = parseFloat(value) || 0;
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updatedTenant = { ...tenant, [field]: numValue };
          // Update `paid` status
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

  // Change extra payments (internet, electricity, other)
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

  // Save payment data to the backend
  const handleSubmit = async () => {
    try {
      // Format data for the backend
      const formattedData = {};
      for (const month of MONTH_LIST) {
        const monthObj = paymentData[month];
        if (!monthObj) continue;

        formattedData[month] = {
          ...monthObj,
          // Flatten out extraPayments
          internet: monthObj.extraPayments?.internet || 0,
          electricity: monthObj.extraPayments?.electricity || 0,
          other: monthObj.extraPayments?.other || 0
        };
      }

      await api.post(`/payments/${selectedApartment}`, formattedData);
      showNotification('Payment data saved successfully!', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Error saving payment data', 'error');
    }
  };

  return (
    <Paper sx={{ p: 4, mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        ניהול תשלומים
      </Typography>

      {/* 1) Select an apartment */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="apartment-select-label">בחר דירה</InputLabel>
        <Select
          labelId="apartment-select-label"
          value={selectedApartment}
          label="בחר דירה"
          onChange={handleApartmentChange}
        >
          {apartments.map((apartment) => (
            <MenuItem key={apartment.id} value={apartment.id}>
              {apartment.address}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedApartment && (
        <div>
          {totalRent === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              שכר הדירה לא מוגדר עבור דירה זו. אנא הגדר את שכר הדירה בפרטי הדירה.
            </Alert>
          )}

          {/* 2) Loop through MONTH_LIST to display payment info per month */}
          {MONTH_LIST.map((month) => (
            <Paper key={month} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">{month}</Typography>
              <Divider sx={{ my: 1 }} />

              {/* Display total rent and remaining amount */}
              <Box sx={{ mb: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={6}>
                    <Typography variant="subtitle1">
                      סה״כ שכר דירה: ₪{totalRent.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography
                      variant="subtitle1"
                      color={
                        parseFloat(calculateRemainingAmount(month)) > 0
                          ? 'error'
                          : 'success'
                      }
                    >
                      יתרה: ₪{calculateRemainingAmount(month)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Payment status & actions */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id={`${month}-status-label`}>סטטוס תשלום</InputLabel>
                    <Select
                      labelId={`${month}-status-label`}
                      value={paymentData[month]?.status || 'not_paid'}
                      label="סטטוס תשלום"
                      onChange={(e) => handlePaymentChange(month, 'status', e.target.value)}
                    >
                      <MenuItem value="paid">שולם</MenuItem>
                      <MenuItem value="partial">חלקי</MenuItem>
                      <MenuItem value="not_paid">לא שולם</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => loadTenantsForMonth(month)}
                      >
                        טען דיירים
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => splitRentEvenly(month)}
                        disabled={paymentData[month]?.tenants?.length === 0}
                      >
                        חלק שכ״ד שווה
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>

              {/* Tenant payment info */}
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                תשלומי דיירים
              </Typography>
              {paymentData[month]?.tenants && paymentData[month].tenants.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  {paymentData[month].tenants.map((tenant, index) => (
                    <Box
                      key={index}
                      sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={tenant.paid}
                                onChange={(e) =>
                                  handleTenantStatusChange(month, index, e.target.checked)
                                }
                              />
                            }
                            label={tenant.name}
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            label="סכום שצריך לשלם (₪)"
                            type="number"
                            value={tenant.amountDue || 0}
                            onChange={(e) =>
                              handleTenantAmountChange(month, index, 'amountDue', e.target.value)
                            }
                          />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <TextField
                            fullWidth
                            label="סכום ששולם (₪)"
                            type="number"
                            value={tenant.amountPaid || 0}
                            onChange={(e) =>
                              handleTenantAmountChange(month, index, 'amountPaid', e.target.value)
                            }
                            error={tenant.amountPaid < tenant.amountDue}
                            helperText={
                              tenant.amountPaid < tenant.amountDue
                                ? `חסר: ₪${(tenant.amountDue - tenant.amountPaid).toFixed(2)}`
                                : ''
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <Typography
                            variant="body2"
                            color={tenant.paid ? 'success.main' : 'error.main'}
                          >
                            {tenant.paid ? 'שולם במלואו' : 'טרם שולם במלואו'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box
                  sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    אין דיירים רשומים. לחץ על "טען דיירים" כדי להוסיף דיירים לחודש זה.
                  </Typography>
                </Box>
              )}

              {/* Extra Payments */}
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                תשלומים נוספים
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="אינטרנט (₪)"
                    type="number"
                    value={paymentData[month]?.extraPayments?.internet || 0}
                    onChange={(e) => handleExtraPaymentChange(month, 'internet', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="חשמל (₪)"
                    type="number"
                    value={paymentData[month]?.extraPayments?.electricity || 0}
                    onChange={(e) => handleExtraPaymentChange(month, 'electricity', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="אחר (₪)"
                    type="number"
                    value={paymentData[month]?.extraPayments?.other || 0}
                    onChange={(e) => handleExtraPaymentChange(month, 'other', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}

          <Button variant="contained" color="primary" onClick={handleSubmit}>
            שמור נתוני תשלום
          </Button>
        </div>
      )}
    </Paper>
  );
}

export default PaymentScreen;

