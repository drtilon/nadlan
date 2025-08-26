// TenantFormDialog.jsx - Correct tenant creation dialog
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Typography,
  Box,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

function TenantFormDialog({
  open,
  onClose,
  onTenantCreated,
  showNotification,
  createOnly = false
}) {
  const [tenantData, setTenantData] = useState({
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    phone: '',
    bornOn: '',
    refundIban: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTenantData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-generate full name when first/last name changes
    if (name === 'firstName' || name === 'lastName') {
      const firstName = name === 'firstName' ? value : tenantData.firstName;
      const lastName = name === 'lastName' ? value : tenantData.lastName;

      setTenantData(prev => ({
        ...prev,
        name: `${firstName} ${lastName}`.trim()
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!tenantData.firstName || !tenantData.lastName) {
      showNotification('First name and last name are required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare tenant data
      const tenantToSubmit = {
        ...tenantData,
        name: `${tenantData.firstName} ${tenantData.lastName}`.trim()
      };

      // For createOnly mode, just return the data to parent
      if (createOnly) {
        onTenantCreated(tenantToSubmit);
        handleClose();
        return;
      }

      // Otherwise, make API call to create tenant
      const response = await api.post('/tenants/add', tenantToSubmit);

      showNotification('Tenant created successfully', 'success');
      onTenantCreated(response.data);
      handleClose();

    } catch (error) {
      console.error('Error creating tenant:', error);
      showNotification(`Error creating tenant: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form data
    setTenantData({
      firstName: '',
      lastName: '',
      name: '',
      email: '',
      phone: '',
      bornOn: '',
      refundIban: ''
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="h6">
          Add New Tenant
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name *"
                name="firstName"
                value={tenantData.firstName}
                onChange={handleChange}
                required
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name *"
                name="lastName"
                value={tenantData.lastName}
                onChange={handleChange}
                required
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={tenantData.name}
                onChange={handleChange}
                variant="outlined"
                disabled
                helperText="Auto-generated from first and last name"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={tenantData.email}
                onChange={handleChange}
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={tenantData.phone}
                onChange={handleChange}
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                name="bornOn"
                type="date"
                value={tenantData.bornOn}
                onChange={handleChange}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Refund IBAN"
                name="refundIban"
                value={tenantData.refundIban}
                onChange={handleChange}
                variant="outlined"
                placeholder="For security deposit refunds"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting || !tenantData.firstName || !tenantData.lastName}
          >
            {isSubmitting ? 'Creating...' : 'Add Tenant'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default TenantFormDialog;
