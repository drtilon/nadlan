// Updated ApartmentDetailsForm.jsx
import React from 'react';
import {
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Box,
  Paper,
  Divider
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Business as BusinessIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';

const ApartmentDetailsForm = ({
  formData,
  tenantData,
  handleChange,
  handleSubmit,
  handleDelete,
  isEdit,
  isSubmitting,
  tenantSelection,
  isAdmin // Property to check admin status
}) => {
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
          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Number of Rooms *</Typography>
              <TextField
                fullWidth
                type="number"
                name="rooms"
                value={formData.rooms}
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
              <Typography variant="body1" sx={{ mb: 1 }}>Size (sq meters) *</Typography>
              <TextField
                fullWidth
                type="number"
                name="size"
                value={formData.size}
                onChange={(e) => handleChange(e, true)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="0"
              />
            </Box>
          </Grid>

          {/* Tenant Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<PersonIcon sx={{ color: 'grey.700' }} />}
              title="Tenant Details"
            />
          </Grid>

          {/* Tenant Selection Component - Show to all users */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Assign Tenants:
            </Typography>
            {tenantSelection}
          </Grid>

          {/* Landlord Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<BusinessIcon sx={{ color: 'grey.700' }} />}
              title="Landlord Details"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord Company Name *</Typography>
              <TextField
                fullWidth
                name="landlordCompanyName"
                value={formData.landlordCompanyName}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter company name"
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord Name *</Typography>
              <TextField
                fullWidth
                name="landlordName"
                value={formData.landlordName}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter landlord name"
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord Company Address *</Typography>
              <TextField
                fullWidth
                name="landlordCompanyAddress"
                value={formData.landlordCompanyAddress}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter company address"
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord IBAN *</Typography>
              <TextField
                fullWidth
                name="landlordIban"
                value={formData.landlordIban}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter IBAN"
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord Email *</Typography>
              <TextField
                fullWidth
                type="email"
                name="landlordEmail"
                value={formData.landlordEmail}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter landlord email"
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Landlord Phone *</Typography>
              <TextField
                fullWidth
                name="landlordPhone"
                value={formData.landlordPhone}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter landlord phone"
              />
            </Box>
          </Grid>

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
                value={formData.rent}
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
              <Typography variant="body1" sx={{ mb: 1 }}>Rent in Words *</Typography>
              <TextField
                fullWidth
                name="rentInSentance"
                value={formData.rentInSentance}
                onChange={(e) => handleChange(e)}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="e.g., One thousand two hundred"
                helperText="Write out the rent amount in words"
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
                value={formData.deposit}
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
              <Typography variant="body1" sx={{ mb: 1 }}>Status *</Typography>
              <FormControl fullWidth variant="outlined" required>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={(e) => handleChange(e)}
                  displayEmpty
                >
                  <MenuItem value="vacant">Vacant</MenuItem>
                  <MenuItem value="occupied">Occupied</MenuItem>
                  <MenuItem value="contract_sent">Contract Sent</MenuItem>
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
                      value={formData.model || 'management'}
                      onChange={(e) => handleChange(e)}
                    >
                      <MenuItem value="management">Management</MenuItem>
                      <MenuItem value="rental">Rental</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Grid>

              {formData.model === 'management' && (
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>Management Fee (%)</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      name="managementFee"
                      value={formData.managementFee}
                      onChange={(e) => handleChange(e, true)}
                      variant="outlined"
                      InputLabelProps={{ shrink: true }}
                      placeholder="0"
                    />
                  </Box>
                </Grid>
              )}

              {formData.model === 'rental' && (
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>Rental Cost (€)</Typography>
                    <TextField
                      fullWidth
                      type="number"
                      name="rentCost"
                      value={formData.rentCost}
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
