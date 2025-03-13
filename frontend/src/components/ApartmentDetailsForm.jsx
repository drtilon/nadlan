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
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider
} from '@mui/material';
import {
  Home as HomeIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';

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
  isAdmin // New prop to check admin status
}) => {
  // Function to display current tenants if they exist
  const renderCurrentTenants = () => {
    if (!tenantData || tenantData.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No tenants currently assigned to this apartment.
        </Typography>
      );
    }

    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        {tenantData.map((tenant, index) => (
          <ListItem key={tenant.id || index} alignItems="flex-start">
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: 'grey.300' }}>
                <PersonIcon sx={{ color: 'grey.700' }} />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()}
              secondary={
                <>
                  <Typography component="span" variant="body2" color="text.primary">
                    {tenant.email}
                  </Typography>
                  {tenant.phone && ` — ${tenant.phone}`}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    );
  };

  // Section title component
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
                onChange={handleChange}
                required
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                placeholder="Enter apartment address"
                disabled={!isAdmin && isEdit} // Only admins can edit existing addresses
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
                disabled={!isAdmin && isEdit} // Only admins can edit existing apartment details
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
                disabled={!isAdmin && isEdit} // Only admins can edit existing apartment details
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

          {/* Current Tenants Section */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Current Tenants:
            </Typography>
            {renderCurrentTenants()}
          </Grid>

          {/* Tenant Selection Component - Only shown to admins */}
          {isAdmin && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
                Assign Tenants:
              </Typography>
              {tenantSelection}
            </Grid>
          )}

          {/* Landlord Details - Only shown to admins */}
          {isAdmin && (
            <>
              <Grid item xs={12} sx={{ mt: 2 }}>
                <SectionTitle
                  icon={<PersonIcon sx={{ color: 'grey.700' }} />}
                  title="Landlord Details"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Landlord Name</Typography>
                  <TextField
                    fullWidth
                    name="landlordName"
                    value={formData.landlordName}
                    onChange={handleChange}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="Enter landlord name"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Landlord Email</Typography>
                  <TextField
                    fullWidth
                    type="email"
                    name="landlordEmail"
                    value={formData.landlordEmail}
                    onChange={handleChange}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="Enter landlord email"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Landlord Phone</Typography>
                  <TextField
                    fullWidth
                    name="landlordPhone"
                    value={formData.landlordPhone}
                    onChange={handleChange}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="Enter landlord phone"
                  />
                </Box>
              </Grid>
            </>
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
                onChange={handleChange}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                disabled={!isAdmin && isEdit} // Only admins can edit dates for existing apartments
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
                onChange={handleChange}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                disabled={!isAdmin && isEdit} // Only admins can edit dates for existing apartments
              />
            </Box>
          </Grid>
          
          {/* Financial Details - Only visible to admins */}
          {isAdmin && (
            <>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Monthly Rent ($)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    name="rent"
                    value={formData.rent}
                    onChange={(e) => handleChange(e, true)}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="0"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Deposit ($)</Typography>
                  <TextField
                    fullWidth
                    type="number"
                    name="deposit"
                    value={formData.deposit}
                    onChange={(e) => handleChange(e, true)}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="0"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="body1" sx={{ mb: 1 }}>Bank IBAN</Typography>
                  <TextField
                    fullWidth
                    name="IBAN"
                    value={formData.IBAN}
                    onChange={handleChange}
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    placeholder="Enter IBAN"
                  />
                </Box>
              </Grid>
            </>
          )}
          
          <Grid item xs={12} sm={isAdmin ? 6 : 12}>
            <Box>
              <Typography variant="body1" sx={{ mb: 1 }}>Status</Typography>
              <FormControl fullWidth variant="outlined">
                <Select
                  name="status"
                  value={['occupied', 'vacant', 'contract_sent', ''].includes(formData.status) ? formData.status : ''}
                  onChange={handleChange}
                  displayEmpty
                  disabled={!isAdmin && isEdit} // Only admins can change status of existing apartments
                >
                  <MenuItem value="">Select status</MenuItem>
                  <MenuItem value="occupied">Occupied</MenuItem>
                  <MenuItem value="vacant">Vacant</MenuItem>
                  <MenuItem value="contract_sent">Contract Sent</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Grid>

          {/* Notes field only for admins */}
          {isAdmin && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="body1" sx={{ mb: 1 }}>Notes</Typography>
                <TextField
                  fullWidth
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  placeholder="Enter notes"
                />
              </Box>
            </Grid>
          )}

          {/* Management and Rental Fields - Only visible to admins */}
          {isAdmin && (
            <>
              {formData.model === 'management' && (
                <Grid item xs={12}>
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
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>Rental Cost ($)</Typography>
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

          {/* Submit and Delete Buttons - Delete only for admins */}
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
