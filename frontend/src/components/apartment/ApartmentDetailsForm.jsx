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
  Autocomplete
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
  handleSubmit,
  handleDelete,
  isEdit,
  isSubmitting,
  tenantSelection,
  isAdmin
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
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <Grid container spacing={3}>
        {/* Address Information Header */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Address Information
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Street Name */}
        <Grid item xs={12} sm={8}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Street Name *</Typography>
            <TextField
              fullWidth
              name="street_name"
              value={formData.street_name || ''}
              onChange={(e) => handleChange(e)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Enter street name"
            />
          </Box>
        </Grid>

        {/* House Number */}
        <Grid item xs={12} sm={4}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>House Number *</Typography>
            <TextField
              fullWidth
              name="house_number"
              value={formData.house_number || ''}
              onChange={(e) => handleChange(e)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="123 or 123A"
            />
          </Box>
        </Grid>

        {/* City */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>City *</Typography>
            <TextField
              fullWidth
              name="city"
              value={formData.city || ''}
              onChange={(e) => handleChange(e)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Enter city"
            />
          </Box>
        </Grid>

        {/* ZIP Code */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>ZIP Code *</Typography>
            <TextField
              fullWidth
              name="zip_code"
              value={formData.zip_code || ''}
              onChange={(e) => handleChange(e)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="12345"
            />
          </Box>
        </Grid>

        {/* State */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>State/Province</Typography>
            <TextField
              fullWidth
              name="state"
              value={formData.state || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Optional"
            />
          </Box>
        </Grid>

        {/* Country */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Country *</Typography>
            <TextField
              fullWidth
              name="country"
              value={formData.country || ''}
              onChange={(e) => handleChange(e)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Enter country"
            />
          </Box>
        </Grid>

        {/* Building */}
        <Grid item xs={12} sm={4}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Building</Typography>
            <TextField
              fullWidth
              name="building"
              value={formData.building || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Building A"
            />
          </Box>
        </Grid>

        {/* Floor */}
        <Grid item xs={12} sm={4}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Floor</Typography>
            <TextField
              fullWidth
              name="floor"
              value={formData.floor || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="2 or Ground"
            />
          </Box>
        </Grid>

        {/* Side */}
        <Grid item xs={12} sm={4}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Side/Unit</Typography>
            <TextField
              fullWidth
              name="side"
              value={formData.side || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="A, B, Left, Right"
            />
          </Box>
        </Grid>

        {/* Basic Information Header */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <HomeIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Property Details
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Property Details */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Rooms *</Typography>
            <TextField
              fullWidth
              type="number"
              name="rooms"
              value={formData.rooms === 0 ? '' : formData.rooms}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="0"
              inputProps={{ min: 1, max: 20 }}
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Size (m²) *</Typography>
            <TextField
              fullWidth
              type="number"
              name="size"
              value={formData.size === 0 ? '' : formData.size}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="0"
              inputProps={{ min: 1, max: 10000, step: 0.1 }}
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Maximum Occupancy *</Typography>
            <TextField
              fullWidth
              type="number"
              name="maxOccupancy"
              value={formData.maxOccupancy === 0 ? '' : formData.maxOccupancy}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="1"
              inputProps={{ min: 1, max: 50 }}
            />
          </Box>
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
                          {loadingLandlords ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              <Button
                variant="outlined"
                onClick={fetchLandlords}
                disabled={loadingLandlords}
                sx={{ minWidth: 'auto', p: 1 }}
              >
                <RefreshIcon />
              </Button>
            </Box>
          </Box>
        </Grid>

        {/* Financial Information Header */}
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

        {/* Rent Field */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Monthly Rent (€) *</Typography>
            <TextField
              fullWidth
              type="number"
              name="rent"
              value={formData.rent === 0 ? '' : formData.rent}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="0"
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Deposit (€) *</Typography>
            <TextField
              fullWidth
              type="number"
              name="deposit"
              value={formData.deposit === 0 ? '' : formData.deposit}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="0"
            />
          </Box>
        </Grid>

        {/* Status Field */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Status *</Typography>
            <FormControl fullWidth variant="outlined" required>
              <Select
                name="status"
                value={formData.status}
                onChange={(e) => handleChange(e)}
                displayEmpty
              >
                <MenuItem value={APARTMENT_STATUS.VACANT}>Vacant</MenuItem>
                <MenuItem value={APARTMENT_STATUS.OCCUPIED}>Occupied</MenuItem>
                <MenuItem value={APARTMENT_STATUS.CONTRACT_SENT}>Contract Sent</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Grid>

        {/* Gender Preference Field */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Gender Preference</Typography>
            <FormControl fullWidth variant="outlined">
              <Select
                name="genderPreference"
                value={formData.genderPreference || 'mixed'}
                onChange={(e) => handleChange(e)}
                displayEmpty
              >
                <MenuItem value="mixed">Mixed</MenuItem>
                <MenuItem value="men_only">Men Only</MenuItem>
                <MenuItem value="women_only">Women Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Grid>

        {/* Property Model and Admin-Only Financial Fields */}
        {isAdmin && (
          <>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body1" sx={{ mb: 1 }}>Property Model</Typography>
                <FormControl fullWidth variant="outlined">
                  <Select
                    name="model"
                    value={formData.model || PROPERTY_MODELS.MANAGEMENT}
                    onChange={(e) => handleChange(e)}
                  >
                    <MenuItem value={PROPERTY_MODELS.MANAGEMENT}>Management</MenuItem>
                    <MenuItem value={PROPERTY_MODELS.RENTAL}>Rental</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grid>

            {formData.model === PROPERTY_MODELS.MANAGEMENT && (
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Management Fee (%)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    name="managementFee"
                    value={formData.managementFee === 0 ? '' : formData.managementFee}
                    onChange={(e) => handleChange(e, true)}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="0"
                  />
                </Box>
              </Grid>
            )}

            {formData.model === PROPERTY_MODELS.RENTAL && (
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Rental Cost (€)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    name="rentCost"
                    value={formData.rentCost === 0 ? '' : formData.rentCost}
                    onChange={(e) => handleChange(e, true)}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="0"
                  />
                </Box>
              </Grid>
            )}
          </>
        )}

        {/* Contract Dates */}
        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Move-in Date</Typography>
            <TextField
              fullWidth
              type="date"
              name="moveInDate"
              value={formData.moveInDate || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Contract End Date</Typography>
            <TextField
              fullWidth
              type="date"
              name="contractEndDate"
              value={formData.contractEndDate || ''}
              onChange={(e) => handleChange(e)}
              variant="outlined"
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

        {/* Notes field */}
        <Grid item xs={12}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Notes</Typography>
            <TextField
              fullWidth
              name="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange(e)}
              multiline
              rows={3}
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              placeholder="Enter notes"
            />
          </Box>
        </Grid>

        {/* Submit and Delete Buttons */}
        <Grid item xs={12} sx={{ textAlign: 'center', mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              sx={{
                minWidth: 150,
              }}
            >
              {isEdit ? 'Update Apartment' : 'Add Apartment'}
            </Button>

            {isEdit && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDelete}
                size="large"
                disabled={isSubmitting}
                startIcon={<DeleteIcon />}
                sx={{
                  minWidth: 150,
                }}
              >
                Delete Apartment
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ApartmentDetailsForm;
