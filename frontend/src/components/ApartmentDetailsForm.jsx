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
  tenantSelection
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
            <TextField
              fullWidth
              label="Apartment Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Number of Rooms"
              name="rooms"
              value={formData.rooms}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Size (sq meters)"
              type="number"
              name="size"
              value={formData.size}
              onChange={(e) => handleChange(e, true)}
              required
              variant="outlined"
            />
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

          {/* Tenant Selection Component */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium' }}>
              Assign Tenants:
            </Typography>
            {tenantSelection}
          </Grid>

          {/* Landlord Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<PersonIcon sx={{ color: 'grey.700' }} />}
              title="Landlord Details"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Landlord Name"
              name="landlordName"
              value={formData.landlordName}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="email"
              label="Landlord Email"
              name="landlordEmail"
              value={formData.landlordEmail}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Landlord Phone"
              name="landlordPhone"
              value={formData.landlordPhone}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          {/* Contract Details */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <SectionTitle
              icon={<DescriptionIcon sx={{ color: 'grey.700' }} />}
              title="Contract Details"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Move-In Date"
              name="moveInDate"
              InputLabelProps={{ shrink: true }}
              value={formData.moveInDate || ''}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="Contract End Date"
              name="contractEndDate"
              InputLabelProps={{ shrink: true }}
              value={formData.contractEndDate || ''}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Monthly Rent ($)"
              onChange={(e) => handleChange(e, true)}
              name="rent"
              value={formData.rent}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Deposit ($)"
              onChange={(e) => handleChange(e, true)}
              name="deposit"
              value={formData.deposit}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Bank IBAN"
              name="IBAN"
              value={formData.IBAN}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                label="Status"
                name="status"
                value={['occupied', 'vacant', 'contract_sent', ''].includes(formData.status) ? formData.status : ''}
                onChange={handleChange}
              >
                <MenuItem value="occupied">Occupied</MenuItem>
                <MenuItem value="vacant">Vacant</MenuItem>
                <MenuItem value="contract_sent">Contract Sent</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              multiline
              rows={3}
              variant="outlined"
            />
          </Grid>

          {/* Management and Rental Fields */}
          {formData.model === 'management' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Management Fee (%)"
                name="managementFee"
                value={formData.managementFee}
                onChange={(e) => handleChange(e, true)}
                variant="outlined"
              />
            </Grid>
          )}
          {formData.model === 'rental' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Rental Cost ($)"
                name="rentCost"
                value={formData.rentCost}
                onChange={(e) => handleChange(e, true)}
                variant="outlined"
              />
            </Grid>
          )}

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
