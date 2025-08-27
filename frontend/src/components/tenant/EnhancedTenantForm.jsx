// components/tenant/EnhancedTenantForm.jsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import {
  Grid,
  TextField,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Divider,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Save as SaveIcon,
  ContactPage as PassportIcon,
  Wc as GenderIcon,
  Home as HomeIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

function EnhancedTenantForm({
  formData,
  setFormData,
  editingTenant,
  apartments,
  formSubmitting,
  handleCloseDialog,
  handleSubmit
}) {
  const [nameFields, setNameFields] = useState({
    firstName: '',
    lastName: ''
  });

  // Split name into first and last name when editing
  useEffect(() => {
    if (editingTenant && formData.name) {
      const nameParts = formData.name.split(' ');
      setNameFields({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || ''
      });
    } else if (!editingTenant) {
      setNameFields({
        firstName: '',
        lastName: ''
      });
    }
  }, [editingTenant, formData.name]);

  // Update full name when first or last name changes
  useEffect(() => {
    const fullName = `${nameFields.firstName} ${nameFields.lastName}`.trim();
    setFormData(prev => ({
      ...prev,
      name: fullName
    }));
  }, [nameFields, setFormData]);

  const handleNameChange = (e) => {
    const { name, value } = e.target;
    setNameFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get current apartment details
  const getCurrentApartment = () => {
    if (formData.apartment_id) {
      return apartments.find(apt => apt.id === parseInt(formData.apartment_id));
    }
    return null;
  };

  const currentApartment = getCurrentApartment();

  return (
    <>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Personal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="First Name"
              name="firstName"
              value={nameFields.firstName}
              onChange={handleNameChange}
              required
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last Name"
              name="lastName"
              value={nameFields.lastName}
              onChange={handleNameChange}
              required
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Full Name"
              name="name"
              value={formData.name || ''}
              disabled
              variant="filled"
              helperText="Auto-generated from first and last name"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              name="bornOn"
              type="date"
              value={formData.bornOn || ''}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                shrink: true,
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Gender"
              name="gender"
              value={formData.gender || ''}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
              SelectProps={{
                native: true,
              }}
            >
              <option value=""></option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Passport ID"
              name="passport_id"
              value={formData.passport_id || ''}
              onChange={handleInputChange}
              variant="filled"
              placeholder="Enter passport ID (optional)"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
              helperText="Passport or ID document number"
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                Contact Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone || ''}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Refund IBAN"
              name="refundIban"
              value={formData.refundIban || ''}
              onChange={handleInputChange}
              variant="filled"
              placeholder="DE89 3704 0044 0532 0130 00"
              helperText="Bank account for security deposit refunds"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                Assigned Property & Contract
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth variant="filled">
              <InputLabel sx={{ fontSize: '1rem', fontWeight: 'medium' }}>
                Assigned Apartment
              </InputLabel>
              <Select
                name="apartment_id"
                value={formData.apartment_id || ''}
                onChange={handleInputChange}
                label="Assigned Apartment"
              >
                <MenuItem value="">
                  <em>No apartment assigned</em>
                </MenuItem>
                {apartments.map((apartment) => (
                  <MenuItem key={apartment.id} value={apartment.id}>
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body1">
                        {apartment.address}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={`€${apartment.rent || apartment.monthly_rent || 0}/month`}
                          size="small"
                          icon={<MoneyIcon />}
                          color="primary"
                          variant="outlined"
                        />
                        {apartment.status && (
                          <Chip
                            label={apartment.status}
                            size="small"
                            color={apartment.status === 'occupied' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        )}
                        {apartment.tenants && apartment.tenants.length > 0 && (
                          <Chip
                            label={`${apartment.tenants.length} tenant(s)`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Show current apartment details if selected */}
          {currentApartment && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Selected Apartment Details:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <Typography variant="body1">
                      {currentApartment.address}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Monthly Rent
                    </Typography>
                    <Typography variant="body1">
                      €{currentApartment.rent || currentApartment.monthly_rent || 0}
                    </Typography>
                  </Grid>
                  {currentApartment.landlord_name && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Landlord
                      </Typography>
                      <Typography variant="body1">
                        {currentApartment.landlord_name}
                      </Typography>
                    </Grid>
                  )}
                  {currentApartment.contract_info && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Contract Status
                      </Typography>
                      <Chip
                        label={currentApartment.contract_info.status || 'No Contract'}
                        size="small"
                        color={currentApartment.contract_info.status === 'active' ? 'success' : 'default'}
                      />
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleCloseDialog}
          color="inherit"
          disabled={formSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={formSubmitting || !nameFields.firstName || !nameFields.lastName}
          startIcon={formSubmitting ?
            <CircularProgress size={20} /> :
            (editingTenant ? <SaveIcon /> : <PersonAddIcon />)
          }
        >
          {editingTenant ? 'Update Tenant' : 'Add Tenant'}
        </Button>
      </DialogActions>
    </>
  );
}

export default EnhancedTenantForm;
