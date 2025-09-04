// components/tenant/TransferComponent.jsx - FIXED with proper date validation
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Grid,
  Typography,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  Autocomplete
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
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [apartmentSearchValue, setApartmentSearchValue] = useState('');

  // FIXED: Auto-set move_in_date when move_out_date changes
  useEffect(() => {
    if (transferForm.move_out_date) {
      const moveOutDate = new Date(transferForm.move_out_date);
      const moveInDate = new Date(moveOutDate);
      moveInDate.setDate(moveOutDate.getDate() + 1); // Next day by default

      setTransferForm(prev => ({
        ...prev,
        move_in_date: moveInDate.toISOString().split('T')[0]
      }));
    }
  }, [transferForm.move_out_date, setTransferForm]);

  const handleInputChange = (field, value) => {
    setTransferForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!selectedApartment) {
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
      // Show error notification
      console.error('Validation error:', error);
      return;
    }

    // Update the transfer form with selected apartment ID
    const updatedForm = {
      ...transferForm,
      new_apartment_id: selectedApartment.apartment_id || selectedApartment.id
    };
    setTransferForm(updatedForm);
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
        The move-in date must be after the move-out date.
      </Alert>

      <Grid container spacing={3}>
        {/* Apartment Selection */}
        <Grid item xs={12}>
          <Autocomplete
            options={apartments}
            getOptionLabel={(option) =>
              `${option.full_address || option.address || `Apt ${option.id}`} - ${option.apartment_number || 'N/A'}`
            }
            value={selectedApartment}
            onChange={(event, newValue) => setSelectedApartment(newValue)}
            inputValue={apartmentSearchValue}
            onInputChange={(event, newInputValue) => setApartmentSearchValue(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Destination Apartment"
                placeholder="Type address or apartment number..."
                required
                helperText="Select the apartment where the tenant will be transferred"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography variant="body1">
                    {option.full_address || option.address || `Apartment ${option.id}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unit: {option.apartment_number || 'N/A'} •
                    Rent: €{option.monthly_rent || 'N/A'}/month
                  </Typography>
                </Box>
              </li>
            )}
            noOptionsText="No apartments found. Try a different search term."
          />
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

        {/* Move In Date - FIXED: Shows validation message */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Move In Date"
            value={transferForm.move_in_date}
            onChange={(e) => handleInputChange('move_in_date', e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            helperText={
              transferForm.move_out_date && transferForm.move_in_date &&
              new Date(transferForm.move_in_date) <= new Date(transferForm.move_out_date)
                ? "❌ Must be after move-out date"
                : "Date when tenant enters new apartment"
            }
            error={
              transferForm.move_out_date && transferForm.move_in_date &&
              new Date(transferForm.move_in_date) <= new Date(transferForm.move_out_date)
            }
          />
        </Grid>

        {/* Auto-assign to New Contract */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={transferForm.assign_to_new_contract || true}
                onChange={(e) => handleInputChange('assign_to_new_contract', e.target.checked)}
              />
            }
            label="Automatically assign to active contract in new apartment"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The tenant will be automatically added to any active contract in the destination apartment.
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

      {/* FIXED: Show validation error */}
      {(() => {
        const error = validateForm();
        return error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        );
      })()}

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
          disabled={submitting || !!validateForm()}
          startIcon={submitting ? <CircularProgress size={20} /> : <TransferIcon />}
        >
          {submitting ? 'Transferring...' : 'Transfer Tenant'}
        </Button>
      </Box>
    </Box>
  );
}

export default TransferComponent;
