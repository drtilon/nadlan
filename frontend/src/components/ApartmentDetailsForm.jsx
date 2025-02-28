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
  Divider,
  CircularProgress,
  Box,
  Paper
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
  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Apartment Details */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              borderRadius: 2
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
            >
              <HomeIcon sx={{ mr: 1 }} />
              Property Details
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Apartment Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
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
            type="number"
            label="Number of Rooms"
            name="rooms"
            value={formData.rooms}
            onChange={(e) => handleChange(e, true)}
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
            label="Size (sq meters)"
            type="number"
            name="size"
            value={formData.size}
            onChange={(e) => handleChange(e, true)}
            required
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
          />
        </Grid>

        {/* Tenant Details */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'info.light',
              color: 'info.contrastText',
              borderRadius: 2,
              mt: 3
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
            >
              <PersonIcon sx={{ mr: 1 }} />
              Tenant Details
            </Typography>
          </Paper>
        </Grid>

        {/* Tenant Selection Component */}
        <Grid item xs={12}>
          {tenantSelection}
        </Grid>

        {/* Landlord Details */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'success.light',
              color: 'success.contrastText',
              borderRadius: 2,
              mt: 3
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
            >
              <PersonIcon sx={{ mr: 1 }} />
              Landlord Details
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Landlord Name"
            name="landlordName"
            value={formData.landlordName}
            onChange={handleChange}
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
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
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Landlord Phone"
            name="landlordPhone"
            value={formData.landlordPhone}
            onChange={handleChange}
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
          />
        </Grid>

        {/* Contract Details */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'warning.light',
              color: 'warning.contrastText',
              borderRadius: 2,
              mt: 3
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
            >
              <DescriptionIcon sx={{ mr: 1 }} />
              Contract Details
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Move-In Date"
            name="moveInDate"
            InputLabelProps={{
              shrink: true,
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
            value={formData.moveInDate || ''}
            onChange={handleChange}
            variant="filled"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="Contract End Date"
            name="contractEndDate"
            InputLabelProps={{
              shrink: true,
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
            value={formData.contractEndDate || ''}
            onChange={handleChange}
            variant="filled"
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
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
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
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Bank IBAN"
            name="IBAN"
            value={formData.IBAN}
            onChange={handleChange}
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth variant="filled">
            <InputLabel id="status-label" sx={{ fontSize: '1rem', fontWeight: 'medium' }}>Status</InputLabel>
            <Select
              labelId="status-label"
              label="Status"
              name="status"
              value={formData.status}
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
            variant="filled"
            InputLabelProps={{
              sx: { fontSize: '1rem', fontWeight: 'medium' }
            }}
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
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
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
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>
        )}

        {/* Submit and Delete Buttons */}
        <Grid item xs={12} sx={{ textAlign: 'center', mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              sx={{ minWidth: 150 }}
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
                sx={{ minWidth: 150 }}
              >
                Delete Apartment
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

export default ApartmentDetailsForm;
