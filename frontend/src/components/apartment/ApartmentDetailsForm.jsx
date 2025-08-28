import React, { useState, useEffect } from 'react';
import {
  Grid,
  TextField,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  FormHelperText,
  Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  AccountBalance as BankIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';

// Import API for landlord fetching
import api from '../../utils/api';

// Constants
const APARTMENT_STATUS = {
  VACANT: 'vacant',
  OCCUPIED: 'occupied',
  CONTRACT_SENT: 'contract_sent'
};

const PROPERTY_MODELS = {
  MANAGEMENT: 'management',
  RENTAL: 'rental'
};

const GENDER_PREFERENCES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'male', label: 'Male Only' },
  { value: 'female', label: 'Female Only' }
];

function ApartmentDetailsForm({
  formData,
  handleChange,
  tenantData,
  handleTenantChange,
  removeTenant,
  addNewTenant,
  handleTenantSelection,
  availableTenants,
  loading,
  isSubmitting,
  isEdit,
  handleDelete,
  showNotification,
  isAdmin,
  addedTenantIds,
  tenantSelection
}) {

  const [landlords, setLandlords] = useState([]);
  const [loadingLandlords, setLoadingLandlords] = useState(false);

  // FIXED: Fetch landlords using existing backend endpoint
  useEffect(() => {
    const fetchLandlords = async () => {
      try {
        setLoadingLandlords(true);
        const response = await api.get('/landlords/list');
        const landlordsData = response.data?.landlords || response.data || [];
        console.log('Loaded landlords:', landlordsData);
        setLandlords(landlordsData);
      } catch (error) {
        console.error('Error fetching landlords:', error);
        showNotification?.('Failed to load landlords', 'error');
      } finally {
        setLoadingLandlords(false);
      }
    };

    fetchLandlords();
  }, [showNotification]);

  // FIXED: Handle landlord selection properly
  const handleLandlordChange = (event, newValue) => {
    console.log('Landlord selection changed:', newValue);

    if (newValue === null) {
      // Cleared selection
      handleChange({ target: { name: 'landlord_id', value: '' } });
    } else if (typeof newValue === 'object') {
      // Selected from autocomplete
      handleChange({ target: { name: 'landlord_id', value: newValue.id } });
    }
  };

  // Get current landlord for autocomplete
  const getCurrentLandlord = () => {
    if (!formData.landlord_id || !landlords.length) return null;
    return landlords.find(l => l.id === parseInt(formData.landlord_id)) || null;
  };

  return (
    <Box>
      {/* Location Section */}
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationIcon />
        Property Location
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Street Name *"
            name="street_name"
            value={formData.street_name}
            onChange={handleChange}
            required
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="House Number *"
            name="house_number"
            value={formData.house_number}
            onChange={handleChange}
            required
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Building"
            name="building"
            value={formData.building}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="City *"
            name="city"
            value={formData.city}
            onChange={handleChange}
            required
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Floor"
            name="floor"
            value={formData.floor}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Side"
            name="side"
            value={formData.side}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="State/Region"
            name="state"
            value={formData.state}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Zip Code"
            name="zip_code"
            value={formData.zip_code}
            onChange={handleChange}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Country"
            name="country"
            value={formData.country}
            onChange={handleChange}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Property Details Section */}
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HomeIcon />
        Property Details
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Rooms *"
            name="rooms"
            type="number"
            value={formData.rooms}
            onChange={handleChange}
            required
            inputProps={{ min: 1 }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Size (sq m)"
            name="size"
            type="number"
            value={formData.size}
            onChange={handleChange}
            inputProps={{ min: 0, step: 0.1 }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Max Occupancy *"
            name="maxOccupancy"
            type="number"
            value={formData.maxOccupancy}
            onChange={handleChange}
            required
            inputProps={{ min: 1 }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Gender Preference</InputLabel>
            <Select
              name="genderPreference"
              value={formData.genderPreference}
              label="Gender Preference"
              onChange={handleChange}
            >
              {GENDER_PREFERENCES.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              label="Status"
              onChange={handleChange}
            >
              <MenuItem value={APARTMENT_STATUS.VACANT}>Vacant</MenuItem>
              <MenuItem value={APARTMENT_STATUS.OCCUPIED}>Occupied</MenuItem>
              <MenuItem value={APARTMENT_STATUS.CONTRACT_SENT}>Contract Sent</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Move-in Date"
            name="moveInDate"
            type="date"
            value={formData.moveInDate}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Move-out Date"
            name="moveOutDate"
            type="date"
            value={formData.moveOutDate}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Landlord Section */}
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon />
        Landlord Information
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          {/* FIXED: Landlord selection with proper autocomplete */}
          <Autocomplete
            options={landlords}
            getOptionLabel={(option) => option.name ? `${option.name} - ${option.company_name || 'No Company'}` : ''}
            value={getCurrentLandlord()}
            onChange={handleLandlordChange}
            loading={loadingLandlords}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Landlord"
                fullWidth
                helperText={formData.landlord_id ?
                  `Selected landlord ID: ${formData.landlord_id}` :
                  'Choose a landlord for this apartment'
                }
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.company_name || 'No Company'} • {option.email}
                  </Typography>
                </Box>
              </li>
            )}
            noOptionsText={loadingLandlords ? "Loading..." : "No landlords found"}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Financial Section */}
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BankIcon />
        Financial Information
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Monthly Rent *"
            name="rent"
            type="number"
            value={formData.rent}
            onChange={handleChange}
            required
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              startAdornment: '€'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Security Deposit"
            name="deposit"
            type="number"
            value={formData.deposit}
            onChange={handleChange}
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              startAdornment: '€'
            }}
          />
        </Grid>

        {/* Admin-only Financial Fields */}
        {isAdmin && (
          <>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Property Model</InputLabel>
                <Select
                  name="model"
                  value={formData.model}
                  label="Property Model"
                  onChange={handleChange}
                >
                  <MenuItem value={PROPERTY_MODELS.RENTAL}>Rental</MenuItem>
                  <MenuItem value={PROPERTY_MODELS.MANAGEMENT}>Management</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Management Fee"
                name="managementFee"
                type="number"
                value={formData.managementFee}
                onChange={handleChange}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: '₪'
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Rent Cost"
                name="rentCost"
                type="number"
                value={formData.rentCost}
                onChange={handleChange}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: '₪'
                }}
              />
            </Grid>
          </>
        )}
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Notes Section */}
      <Typography variant="h6" gutterBottom>
        Additional Notes
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            multiline
            rows={3}
            placeholder="Any additional information about the apartment..."
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Tenant Section */}
      <Typography variant="h6" gutterBottom>
        Tenants ({tenantData?.length || 0}/{formData.maxOccupancy})
      </Typography>

      <Box sx={{ mb: 3 }}>
        {tenantSelection}
      </Box>
    </Box>
  );
}


export default ApartmentDetailsForm;
