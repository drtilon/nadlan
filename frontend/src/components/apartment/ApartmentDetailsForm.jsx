// ApartmentDetailsForm.jsx - COMPLETE FIXED VERSION with proper field visibility
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

  // Fetch landlords for all users (needed for landlord selection)
  useEffect(() => {
    const fetchLandlords = async () => {
      try {
        setLoadingLandlords(true);
        // FIXED: Use correct endpoint /landlords/list instead of /landlords/all
        const response = await api.get('/landlords/list');
        if (response.data && Array.isArray(response.data)) {
          setLandlords(response.data);
        }
      } catch (error) {
        console.error('Error fetching landlords:', error);
        if (showNotification) {
          showNotification('Error loading landlords', 'error');
        }
      } finally {
        setLoadingLandlords(false);
      }
    };

    fetchLandlords();
  }, [showNotification]);

  // FIXED: Get selected landlord for display
  const selectedLandlord = landlords.find(l => l.id === formData.landlord_id);

  return (
    <Grid container spacing={3}>
      {/* Address Section */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Address Information
          </Typography>
        </Box>
      </Grid>

      {/* FIXED: All address fields properly mapped */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Street Name *</Typography>
          <TextField
            name="street_name"
            value={formData.street_name || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            required
            placeholder="Enter street name"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>House Number *</Typography>
          <TextField
            name="house_number"
            value={formData.house_number || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            required
            placeholder="123"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Floor</Typography>
          <TextField
            name="floor"
            value={formData.floor || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="1, 2, Ground..."
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>City *</Typography>
          <TextField
            name="city"
            value={formData.city || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            required
            placeholder="Tel Aviv"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>ZIP Code</Typography>
          <TextField
            name="zip_code"
            value={formData.zip_code || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="12345"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>State</Typography>
          <TextField
            name="state"
            value={formData.state || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="State/Province"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Country</Typography>
          <TextField
            name="country"
            value={formData.country || 'Israel'}
            onChange={handleChange}
            variant="outlined"
            fullWidth
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Building</Typography>
          <TextField
            name="building"
            value={formData.building || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="Building name/number"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Side/Unit</Typography>
          <TextField
            name="side"
            value={formData.side || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="A, B, North, etc."
          />
        </Box>
      </Grid>

      {/* Property Details Section */}
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <HomeIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Property Details
          </Typography>
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Number of Rooms *</Typography>
          <TextField
            name="rooms"
            type="number"
            value={formData.rooms || ''}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            required
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Size (m²)</Typography>
          <TextField
            name="size"
            type="number"
            value={formData.size || ''}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            inputProps={{ min: 0, step: 0.1 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Maximum Occupancy *</Typography>
          <TextField
            name="maxOccupancy"
            type="number"
            value={formData.maxOccupancy || 1}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            required
            inputProps={{ min: 1, step: 1 }}
          />
        </Box>
      </Grid>

      {/* Financial Information Section */}
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <BankIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Financial Information
          </Typography>
          {!isAdmin && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2, fontStyle: 'italic' }}>
              (Management Fee and Rent Cost are admin-only fields)
            </Typography>
          )}
        </Box>
      </Grid>

      {/* FIXED: Admin-only Property Model Selection */}
      {isAdmin && (
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Property Model</InputLabel>
            <Select
              name="model"
              value={formData.model || PROPERTY_MODELS.RENTAL}
              onChange={handleChange}
              label="Property Model"
            >
              <MenuItem value={PROPERTY_MODELS.RENTAL}>
                Rental (Fixed Rent Cost)
              </MenuItem>
              <MenuItem value={PROPERTY_MODELS.MANAGEMENT}>
                Management (Percentage Fee)
              </MenuItem>
            </Select>
            <FormHelperText>
              {formData.model === PROPERTY_MODELS.MANAGEMENT
                ? 'You earn a percentage of the rent as management fee'
                : 'You pay a fixed cost and keep the difference as profit'
              }
            </FormHelperText>
          </FormControl>
        </Grid>
      )}

      {/* Monthly Rent - Visible to ALL users */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Monthly Rent *</Typography>
          <TextField
            name="rent"
            type="number"
            value={formData.rent || ''}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            required
            inputProps={{ min: 0, step: 1 }}
            InputProps={{
              startAdornment: <BankIcon sx={{ mr: 1, color: 'action.active' }} />
            }}
          />
        </Box>
      </Grid>

      {/* Security Deposit - Visible to ALL users */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Security Deposit</Typography>
          <TextField
            name="deposit"
            type="number"
            value={formData.deposit || ''}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>
      </Grid>

      {/* FIXED: Admin-only Financial Fields */}
      {isAdmin && formData.model === PROPERTY_MODELS.MANAGEMENT && (
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Management Fee (%)</Typography>
            <TextField
              name="managementFee"
              type="number"
              value={formData.managementFee || ''}
              onChange={(e) => handleChange(e, true)}
              variant="outlined"
              fullWidth
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              helperText="Percentage of rent you earn as management fee"
            />
          </Box>
        </Grid>
      )}

      {isAdmin && formData.model === PROPERTY_MODELS.RENTAL && (
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Rent Cost (Fixed)</Typography>
            <TextField
              name="rentCost"
              type="number"
              value={formData.rentCost || ''}
              onChange={(e) => handleChange(e, true)}
              variant="outlined"
              fullWidth
              inputProps={{ min: 0, step: 1 }}
              helperText="Fixed amount you pay as rent cost"
            />
          </Box>
        </Grid>
      )}

      {/* FIXED: Landlord Selection - Available to ALL users */}
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <Autocomplete
            options={landlords}
            getOptionLabel={(option) => option.name || ''}
            value={selectedLandlord || null}
            onChange={(event, newValue) => {
              handleChange({
                target: {
                  name: 'landlord_id',
                  value: newValue ? newValue.id : null
                }
              });
            }}
            loading={loadingLandlords}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Landlord"
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingLandlords ? <div>Loading...</div> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <FormHelperText>Select the landlord for this property</FormHelperText>
        </FormControl>
      </Grid>

      {/* Status and Preferences Section */}
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Status & Preferences
          </Typography>
        </Box>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            name="status"
            value={formData.status || APARTMENT_STATUS.VACANT}
            onChange={handleChange}
            label="Status"
          >
            <MenuItem value={APARTMENT_STATUS.VACANT}>Vacant</MenuItem>
            <MenuItem value={APARTMENT_STATUS.OCCUPIED}>Occupied</MenuItem>
            <MenuItem value={APARTMENT_STATUS.CONTRACT_SENT}>Contract Sent</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Gender Preference</InputLabel>
          <Select
            name="genderPreference"
            value={formData.genderPreference || 'mixed'}
            onChange={handleChange}
            label="Gender Preference"
          >
            {GENDER_PREFERENCES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      {/* FIXED: Date Fields */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Move-in Date</Typography>
          <TextField
            name="moveInDate"
            type="date"
            value={formData.moveInDate || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Contract End Date</Typography>
          <TextField
            name="contractEndDate"
            type="date"
            value={formData.contractEndDate || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Grid>

      {/* Notes Field */}
      <Grid item xs={12}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Notes</Typography>
          <TextField
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            multiline
            rows={3}
            placeholder="Additional notes about this apartment..."
          />
        </Box>
      </Grid>

      {/* Tenant Section */}
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Tenant Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            ({tenantData.length}/{formData.maxOccupancy} occupied)
          </Typography>
        </Box>

        {/* Display occupancy warning */}
        {tenantData.length >= formData.maxOccupancy && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This apartment is at maximum occupancy ({formData.maxOccupancy} tenants).
          </Alert>
        )}

        {/* Render tenant selection component */}
        {tenantSelection}
      </Grid>

      {/* Action Buttons */}
      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>

          {/* Delete Button (Admin only, Edit mode only) */}
          {isEdit && isAdmin && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              Delete Apartment
            </Button>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={isSubmitting}
            size="large"
          >
            {isSubmitting
              ? (isEdit ? 'Updating...' : 'Creating...')
              : (isEdit ? 'Update Apartment' : 'Create Apartment')
            }
          </Button>
        </Box>
      </Grid>

      {/* FIXED: Admin vs Default User Information */}
      <Grid item xs={12}>
        <Box sx={{ mt: 2 }}>
          {isAdmin ? (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Admin View:</strong> You can see all fields including Management Fee, Rent Cost, Property Model, and Landlord selection.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="warning">
              <Typography variant="body2">
                <strong>Default User View:</strong> You can edit all basic apartment information including landlord.
                Only Management Fee and Rent Cost are hidden (admin-only fields).
              </Typography>
            </Alert>
          )}
        </Box>
      </Grid>
    </Grid>
  );
}

export default ApartmentDetailsForm;
