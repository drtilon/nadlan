// ApartmentDetailsForm.jsx - FIXED VERSION removing primary tenant references
import React, { useState, useEffect } from 'react';
import {
  Typography,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Box,
  Paper,
  Autocomplete,
  InputLabel
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Business as BusinessIcon,
  AccountBalance as BankIcon,
  Refresh as RefreshIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
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

const ApartmentDetailsForm = ({
  formData,
  tenantData,
  handleChange,
  handleTenantChange,
  // REMOVED: setTenantAsPrimary - no more primary tenants
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
  tenantSelection // This prop contains the TenantSelector component
}) => {
  const [landlords, setLandlords] = useState([]);
  const [selectedLandlord, setSelectedLandlord] = useState(null);
  const [loadingLandlords, setLoadingLandlords] = useState(false);

  // Fetch landlords on component mount
  useEffect(() => {
    fetchLandlords();
  }, []);

  // Set selected landlord when formData changes or when landlords are loaded
  useEffect(() => {
    if (landlords.length > 0 && formData.landlord_id) {
      const landlord = landlords.find(l => l.id === formData.landlord_id);
      setSelectedLandlord(landlord || null);
    }
  }, [formData.landlord_id, landlords]);

  const fetchLandlords = async () => {
    setLoadingLandlords(true);
    try {
      const response = await api.get('/landlords/list');
      setLandlords(response.data || []);
    } catch (error) {
      console.error('Error fetching landlords:', error);
      showNotification('Error loading landlords', 'error');
    } finally {
      setLoadingLandlords(false);
    }
  };

  const handleLandlordChange = (event, newValue) => {
    setSelectedLandlord(newValue);
    handleChange({
      target: {
        name: 'landlord_id',
        value: newValue ? newValue.id : null
      }
    });
  };

  return (
    <Grid container spacing={3}>
      {/* Property Information Header */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <HomeIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Property Information
            </Typography>
          </Box>
        </Paper>
      </Grid>

      {/* Address Fields */}
      <Grid item xs={12} sm={8}>
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
            InputProps={{
              startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} />
            }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={4}>
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
            placeholder="Enter city"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Zip Code</Typography>
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

      <Grid item xs={12} sm={4}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Floor</Typography>
          <TextField
            name="floor"
            value={formData.floor || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="Ground, 1st, 2nd, etc."
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

      {/* Property Details */}
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

      {/* Financial Information */}
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

      {/* Status and Preferences */}
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
            <MenuItem value="mixed">Mixed</MenuItem>
            <MenuItem value="male">Male Only</MenuItem>
            <MenuItem value="female">Female Only</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      {/* Date Fields */}
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

      {/* Tenant Information Header */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Tenant Information
            </Typography>
          </Box>
        </Paper>
      </Grid>

      {/* Tenant Selection Component */}
      <Grid item xs={12}>
        {tenantSelection}
      </Grid>

      {/* Landlord Selection */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Landlord</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Autocomplete
              fullWidth
              options={landlords}
              getOptionLabel={(option) => option.company_name || ''}
              value={selectedLandlord}
              onChange={handleLandlordChange}
              loading={loadingLandlords}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  placeholder="Select a landlord"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <BusinessIcon sx={{ mr: 1, color: 'action.active' }} />,
                    endAdornment: (
                      <>
                        {loadingLandlords ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Button
              onClick={fetchLandlords}
              disabled={loadingLandlords}
              sx={{ minWidth: 'auto', p: 1 }}
            >
              <RefreshIcon />
            </Button>
          </Box>
        </Box>
      </Grid>

      {/* Notes */}
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
            placeholder="Additional notes about the apartment..."
            InputProps={{
              startAdornment: <DescriptionIcon sx={{ mr: 1, color: 'action.active', alignSelf: 'flex-start', mt: 1 }} />
            }}
          />
        </Box>
      </Grid>

      {/* Action Buttons */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2 }}>
          <Box>
            {isEdit && isAdmin && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                sx={{ mr: 2 }}
              >
                Delete Apartment
              </Button>
            )}
          </Box>

          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isSubmitting}
            sx={{ minWidth: 150 }}
          >
            {isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              isEdit ? 'Update Apartment' : 'Create Apartment'
            )}
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
};

export default ApartmentDetailsForm;
