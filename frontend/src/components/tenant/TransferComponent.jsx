// components/tenant/TransferComponent.jsx
import React from 'react';
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
  Divider,
  FormControlLabel,
  Checkbox,
  Alert
} from '@mui/material';
import { SwapHoriz as TransferIcon } from '@mui/icons-material';

function TransferComponent({
  tenantId,
  tenantName,
  apartments,
  onSuccess,
  onCancel,
  transferForm,
  setTransferForm,
  submitting
}) {
  const handleInputChange = (field, value) => {
    setTransferForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!transferForm.new_apartment_id) {
      return 'Please select a destination apartment';
    }
    if (!transferForm.move_out_date) {
      return 'Please select a move-out date';
    }
    if (!transferForm.move_in_date) {
      return 'Please select a move-in date';
    }
    const moveOutDate = new Date(transferForm.move_out_date);
    const moveInDate = new Date(transferForm.move_in_date);
    if (moveInDate <= moveOutDate) {
      return 'Move-in date must be after move-out date';
    }
    return null;
  };

  const handleSubmit = () => {
    const error = validateForm();
    if (error) {
      // You can show this error via notification if needed
      return;
    }
    onSuccess();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TransferIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">
          Transfer {tenantName} to Another Apartment
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Alert severity="info" sx={{ mb: 3 }}>
        This will move the tenant out of their current apartment and into a new one.
        The tenant will be removed from their current contract and assigned to the new apartment's active contract.
      </Alert>

      <Grid container spacing={3}>
        {/* Destination Apartment */}
        <Grid item xs={12}>
          <FormControl fullWidth required>
            <InputLabel>Select Destination Apartment</InputLabel>
            <Select
              value={transferForm.new_apartment_id}
              label="Select Destination Apartment"
              onChange={(e) => handleInputChange('new_apartment_id', e.target.value)}
            >
              {apartments.map((apartment) => (
                <MenuItem key={apartment.apartment_id || apartment.id} value={apartment.apartment_id || apartment.id}>
                  <Box>
                    <Typography variant="body1">
                      {apartment.address}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Rent: €{apartment.monthly_rent || apartment.rent || 0}/month
                      {apartment.tenants && apartment.tenants.length > 0 && (
                        ` • Current tenants: ${apartment.tenants.join(', ')}`
                      )}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Move Out Date */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Move Out Date"
            value={transferForm.move_out_date}
            onChange={(e) => handleInputChange('move_out_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            helperText="Date when tenant leaves current apartment"
          />
        </Grid>

        {/* Move In Date */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Move In Date"
            value={transferForm.move_in_date}
            onChange={(e) => handleInputChange('move_in_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            helperText="Date when tenant enters new apartment"
          />
        </Grid>

        {/* Auto-assign to New Contract */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transferForm.assign_to_new_contract}
                onChange={(e) => handleInputChange('assign_to_new_contract', e.target.checked)}
              />
            }
            label="Automatically assign to active contract in new apartment"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            If checked, the tenant will be automatically added to any active contract in the destination apartment.
            If unchecked, the tenant will be transferred but not assigned to any contract.
          </Typography>
        </Grid>

        {/* Transfer Notes */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Transfer Notes (Optional)"
            value={transferForm.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Reason for transfer, special instructions, etc..."
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={submitting || !transferForm.new_apartment_id || !transferForm.move_out_date || !transferForm.move_in_date}
          startIcon={submitting ? <CircularProgress size={20} /> : <TransferIcon />}
        >
          {submitting ? 'Transferring...' : 'Transfer Tenant'}
        </Button>
      </Box>

      {/* Validation Error Display */}
      {validateForm() && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {validateForm()}
        </Alert>
      )}
    </Box>
  );
}

export default TransferComponent;
