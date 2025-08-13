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

  // Section title component for consistent styling
  const SectionTitle = ({ icon, title }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 2,
        borderBottom: '1px solid',
        borderColor: 'grey.300',
        pb: 1
      }}
    >
      {icon}
      <Typography variant="h6" sx={{ ml: 1, fontWeight: '500' }}>
        {title}
      </Typography>
    </Box>
  );

  return (
    <form onSubmit={handleSubmit}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 2
        }}
      >
        <Grid container spacing={3}>
          {/* Apartment Details */}
          <Grid item xs={12}>
            <SectionTitle
              icon={<HomeIcon sx={{ color: 'grey.700' }} />}
              title="Property Details"
            />
          </Grid>

          <Grid item xs={12}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Apartment Address *</Typography>
              <TextField
                fullWidth
                name="address"
                value={formData.address}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter apartment address"
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Number of Rooms *</Typography>
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
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Size (sq meters) *</Typography>
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
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
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
                placeholder="0"
                inputProps={{ min: 1, max: 50 }}
                helperText="Maximum number of people allowed"
              />
            </Box>
          </Grid>

          {/* Landlord Section */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<BusinessIcon sx={{ color: 'grey.700' }} />}
              title="Landlord Details"
            />
          </Grid>

          <Grid item xs={12}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Select Landlord *</Typography>
              <Autocomplete
                fullWidth
                options={landlords}
                getOptionLabel={(option) => option.company_name || ''}
                value={selectedLandlord}
                onChange={handleLandlordChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    placeholder={loadingLandlords ? 'Loading landlords...' : 'Select a landlord'}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                )}
                loading={loadingLandlords}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body1">{option.company_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.name} - {option.email}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  size="small"
                  onClick={fetchLandlords}
                  startIcon={<RefreshIcon />}
                >
                  Refresh
                </Button>
              </Box>
            </Box>
          </Grid>

          {/* Tenant Details Section */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<PersonIcon sx={{ color: 'grey.700' }} />}
              title="Tenant Details"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Assign Tenants:
            </Typography>
            {tenantSelection}
          </Grid>

          {/* Occupancy Information */}
          {formData.maxOccupancy > 0 && tenantData.length > 0 && (
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: tenantData.length > formData.maxOccupancy ? 'error.main' :
                              tenantData.length === formData.maxOccupancy ? 'warning.main' : 'success.main',
                  borderRadius: 1,
                  bgcolor: tenantData.length > formData.maxOccupancy ? 'error.50' :
                           tenantData.length === formData.maxOccupancy ? 'warning.50' : 'success.50'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PeopleIcon sx={{
                    color: tenantData.length > formData.maxOccupancy ? 'error.main' :
                           tenantData.length === formData.maxOccupancy ? 'warning.main' : 'success.main'
                  }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Occupancy Status: {tenantData.length}/{formData.maxOccupancy}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {tenantData.length > formData.maxOccupancy
                    ? 'Warning: Number of tenants exceeds maximum occupancy!'
                    : tenantData.length === formData.maxOccupancy
                    ? 'Apartment is at full capacity'
                    : `${formData.maxOccupancy - tenantData.length} space(s) available`
                  }
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Contract Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<DescriptionIcon sx={{ color: 'grey.700' }} />}
              title="Contract Details"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Move-In Date</Typography>
              <TextField
                fullWidth
                type="date"
                name="moveInDate"
                value={formData.moveInDate || ''}
                onChange={(e) => {
                  const value = e.target.value || '';
                  handleChange({
                    target: {
                      name: e.target.name,
                      value: value
                    }
                  });
                }}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  inputProps: {
                    min: "1900-01-01",
                    max: "2100-12-31"
                  }
                }}
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
                onChange={(e) => {
                  const value = e.target.value || '';
                  handleChange({
                    target: {
                      name: e.target.name,
                      value: value
                    }
                  });
                }}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  inputProps: {
                    min: "1900-01-01",
                    max: "2100-12-31"
                  }
                }}
              />
            </Box>
          </Grid>

          {/* Financial Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<BankIcon sx={{ color: 'grey.700' }} />}
              title="Financial Details"
            />
          </Grid>

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

          {/* Model Selection and Related Fields */}
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

              {isAdmin && isEdit && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDelete}
                  size="large"
                  disabled={isSubmitting}
                  startIcon={<DeleteIcon />}
                  sx={{
                    minWidth: 150,
                    '&:hover': {
                      borderColor: 'error.main',
                      color: 'error.main',
                    }
                  }}
                >
                  Delete Apartment
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </form>
  );
};

export default ApartmentDetailsForm;
