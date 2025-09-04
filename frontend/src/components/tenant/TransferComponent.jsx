// components/tenant/TransferComponent.jsx - FIXED with searchable apartment selection
import React, { useState } from 'react';
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
      // You can show this error via notification if needed
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
        The tenant will be removed from their current contract and assigned to the new apartment's active contract.
      </Alert>

      <Grid container spacing={3}>
        {/* Searchable Apartment Selection */}
        <Grid item xs={12}>
          <Autocomplete
            options={apartments}
            getOptionLabel={(option) => option.address || `Apartment ${option.apartment_id || option.id}`}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body1">
                    {option.address}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rent: €{option.monthly_rent || option.rent || 0}/month
                    {option.tenants && option.tenants.length > 0 && (
                      ` • Current tenants: ${option.tenants.join(', ')}`
                    )}
                  </Typography>
                </Box>
              </Box>
            )}
            value={selectedApartment}
            onChange={(event, newValue) => {
              setSelectedApartment(newValue);
            }}
            inputValue={apartmentSearchValue}
            onInputChange={(event, newInputValue) => {
              setApartmentSearchValue(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Destination Apartment"
                placeholder="Type to search apartments by address..."
                fullWidth
                required
              />
            )}
            filterOptions={(options, { inputValue }) => {
              const filterValue = inputValue.toLowerCase();
              return options.filter((option) => {
                const address = (option.address || '').toLowerCase();
                const city = (option.city || '').toLowerCase();
                const streetName = (option.street_name || '').toLowerCase();
                const houseNumber = (option.house_number || '').toString().toLowerCase();
                return address.includes(filterValue) ||
                       city.includes(filterValue) ||
                       streetName.includes(filterValue) ||
                       houseNumber.includes(filterValue);
              });
            }}
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
          disabled={submitting || !selectedApartment || !transferForm.move_out_date || !transferForm.move_in_date}
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
