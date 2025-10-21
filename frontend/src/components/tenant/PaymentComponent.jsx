// components/tenant/PaymentComponent.jsx - FIXED
import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Divider
} from '@mui/material';
import { AttachMoney as MoneyIcon } from '@mui/icons-material';
import api from '../../utils/api';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'check', label: 'Check' }
];

const PAYMENT_TYPES = [
  { value: 'rent', label: 'Rent' },
  { value: 'deposit', label: 'Security Deposit' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function PaymentComponent({
  tenantId,
  tenantName,
  apartmentId,
  onSuccess,
  onCancel,
  showNotification
}) {
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'rent',
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    notes: ''
  });

  const handleSubmit = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      if (showNotification) {
        showNotification('Please enter a valid amount', 'error');
      }
      return;
    }

    if (!apartmentId) {
      if (showNotification) {
        showNotification('Cannot add payment: No apartment assigned', 'error');
      }
      return;
    }

    if (!tenantId || !tenantName) {
      if (showNotification) {
        showNotification('Cannot add payment: Missing tenant information', 'error');
      }
      return;
    }

    setSubmitting(true);

    try {
      // FIXED: Use the individual payment endpoint with both tenant_id and tenant_name
      const response = await api.post('/payment/individual', {
        apartment_id: apartmentId,
        tenant_id: tenantId,  // FIXED: Include tenant_id
        tenant_name: tenantName,
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        payment_type: paymentForm.payment_type,
        month: paymentForm.month,
        year: paymentForm.year,
        notes: paymentForm.notes
      });

      if (showNotification) {
        showNotification('Payment added successfully', 'success');
      }

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      const errorMessage = error.response?.data?.message || 'Error adding payment';
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <MoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">
          Add Payment for {tenantName}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* Payment Amount */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Amount (€)"
            type="number"
            value={paymentForm.amount}
            onChange={(e) => handleInputChange('amount', e.target.value)}
            inputProps={{
              min: 0,
              step: 0.01,
            }}
            required
          />
        </Grid>

        {/* Payment Date */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Payment Date"
            value={paymentForm.payment_date}
            onChange={(e) => handleInputChange('payment_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>

        {/* Payment Method */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={paymentForm.payment_method}
              onChange={(e) => handleInputChange('payment_method', e.target.value)}
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

        {/* Payment Type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Payment Type</InputLabel>
            <Select
              value={paymentForm.payment_type}
              onChange={(e) => handleInputChange('payment_type', e.target.value)}
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

        {/* Month */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Month</InputLabel>
            <Select
              value={paymentForm.month}
              onChange={(e) => handleInputChange('month', e.target.value)}
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

        {/* Year */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Year"
            value={paymentForm.year}
            onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
            inputProps={{
              min: 2020,
              max: 2030,
            }}
          />
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes (Optional)"
            value={paymentForm.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Additional payment notes..."
          />
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !paymentForm.amount}
              startIcon={submitting ? <CircularProgress size={20} /> : <MoneyIcon />}
            >
              {submitting ? 'Adding Payment...' : 'Add Payment'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default PaymentComponent;
