// ApartmentDetailsForm.jsx - COMPLETE FIXED VERSION
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
  setTenantAsPrimary,
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
      // Use existing landlords endpoint from landlords.py
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

      {/* Address Section */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Street Name *</Typography>
          <TextField
            name="street_name"
            value={formData.street_name || ''}
            onChange={handleChange}
            required
            variant="outlined"
            fullWidth
            placeholder="Enter street name"
            InputProps={{
              startAdornment: <LocationIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
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
            required
            variant="outlined"
            fullWidth
            placeholder="123"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Building</Typography>
          <TextField
            name="building"
            value={formData.building || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="Building A"
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
            placeholder="2"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Side</Typography>
          <TextField
            name="side"
            value={formData.side || ''}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            placeholder="A"
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>City *</Typography>
          <TextField
            name="city"
            value={formData.city || ''}
            onChange={handleChange}
            required
            variant="outlined"
            fullWidth
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

      {/* Property Details */}
      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Rooms *</Typography>
          <TextField
            name="rooms"
            type="number"
            value={formData.rooms || 0}
            onChange={(e) => handleChange(e, true)}
            required
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
            placeholder="2"
            inputProps={{ min: 0, max: 20 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Size (m²)</Typography>
          <TextField
            name="size"
            type="number"
            value={formData.size || 0}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
            placeholder="80"
            inputProps={{ min: 0, max: 1000 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Max Occupancy *</Typography>
          <TextField
            name="maxOccupancy"
            type="number"
            value={formData.maxOccupancy || 1}
            onChange={(e) => handleChange(e, true)}
            required
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
            placeholder="1"
            inputProps={{ min: 1, max: 50 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Status</Typography>
          <FormControl fullWidth variant="outlined">
            <Select
              name="status"
              value={formData.status || APARTMENT_STATUS.VACANT}
              onChange={handleChange}
              displayEmpty
            >
              <MenuItem value={APARTMENT_STATUS.VACANT}>Vacant</MenuItem>
              <MenuItem value={APARTMENT_STATUS.OCCUPIED}>Occupied</MenuItem>
              <MenuItem value={APARTMENT_STATUS.CONTRACT_SENT}>Contract Sent</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Grid>

      {/* Financial Information - Basic fields for all users */}
      <Grid item xs={12}>
        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <BankIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Financial Information
            </Typography>
          </Box>
        </Paper>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Monthly Rent (€) *</Typography>
          <TextField
            name="rent"
            type="number"
            value={formData.rent || 0}
            onChange={(e) => handleChange(e, true)}
            required
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
            placeholder="1200"
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Box>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Security Deposit (€)</Typography>
          <TextField
            name="deposit"
            type="number"
            value={formData.deposit || 0}
            onChange={(e) => handleChange(e, true)}
            variant="outlined"
            fullWidth
            InputLabelProps={{ shrink: true }}
            placeholder="2400"
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Box>
      </Grid>

      {/* Admin-only financial fields */}
      {isAdmin && (
        <>
          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Property Model</Typography>
              <FormControl fullWidth variant="outlined">
                <Select
                  name="model"
                  value={formData.model || PROPERTY_MODELS.MANAGEMENT}
                  onChange={handleChange}
                  displayEmpty
                >
                  <MenuItem value={PROPERTY_MODELS.MANAGEMENT}>Management</MenuItem>
                  <MenuItem value={PROPERTY_MODELS.RENTAL}>Rental</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Management Fee (€)</Typography>
              <TextField
                name="managementFee"
                type="number"
                value={formData.managementFee || 0}
                onChange={(e) => handleChange(e, true)}
                variant="outlined"
                fullWidth
                InputLabelProps={{ shrink: true }}
                placeholder="150"
                inputProps={{ min: 0, step: 0.01 }}
                disabled={formData.model === PROPERTY_MODELS.RENTAL}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Rent Cost (€)</Typography>
              <TextField
                name="rentCost"
                type="number"
                value={formData.rentCost || 0}
                onChange={(e) => handleChange(e, true)}
                variant="outlined"
                fullWidth
                InputLabelProps={{ shrink: true }}
                placeholder="1000"
                inputProps={{ min: 0, step: 0.01 }}
                disabled={formData.model === PROPERTY_MODELS.MANAGEMENT}
              />
            </Box>
          </Grid>
        </>
      )}

      {/* Dates */}
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

      {/* Landlord Selection - Available to all users */}
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
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box>
                    <Typography variant="body1">{option.company_name}</Typography>
                    {option.name && (
                      <Typography variant="caption" color="text.secondary">
                        Contact: {option.name}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
              noOptionsText="No landlords found"
            />
            <Button
              variant="outlined"
              onClick={fetchLandlords}
              disabled={loadingLandlords}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <RefreshIcon />
            </Button>
          </Box>
        </Box>
      </Grid>

      {/* Gender Preference */}
      <Grid item xs={12} sm={6}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Gender Preference</Typography>
          <FormControl fullWidth variant="outlined">
            <Select
              name="genderPreference"
              value={formData.genderPreference || 'mixed'}
              onChange={handleChange}
              displayEmpty
            >
              <MenuItem value="mixed">Mixed</MenuItem>
              <MenuItem value="male">Male Only</MenuItem>
              <MenuItem value="female">Female Only</MenuItem>
            </Select>
          </FormControl>
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
            placeholder="Additional notes about the property..."
            InputProps={{
              startAdornment: <DescriptionIcon sx={{ mr: 1, color: 'action.active', alignSelf: 'flex-start', mt: 1 }} />,
            }}
          />
        </Box>
      </Grid>

      {/* Action Buttons */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
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
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={isSubmitting}
            size="large"
          >
            {isSubmitting ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                {isEdit ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              isEdit ? 'Update Apartment' : 'Add Apartment'
            )}
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
};

export default ApartmentDetailsForm;
