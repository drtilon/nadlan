// components/tenant/TenantEdit.jsx - Reusable Tenant Edit Dialog
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import api from '../../utils/api';

function TenantEdit({ open, onClose, tenant, apartments, showNotification, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bornOn: '',
    refundIban: '',
    passport_id: '',
    gender: '',
    apartment_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Update form data when tenant changes
  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        bornOn: tenant.bornOn || '',
        refundIban: tenant.refundIban || '',
        passport_id: tenant.passport_id || '',
        gender: tenant.gender || '',
        apartment_id: tenant.apartment_id || ''
      });
    }
  }, [tenant]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showNotification('Tenant name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.put(`/tenants/update/${tenant.id}`, formData);

      showNotification('Tenant updated successfully', 'success');

      // Call the onSave callback to refresh parent data
      if (onSave) {
        onSave();
      }

      onClose();
    } catch (error) {
      console.error('Error updating tenant:', error);
      showNotification(
        `Error updating tenant: ${error.response?.data?.message || error.message}`,
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 2,
        fontWeight: 700,
        color: 'text.primary'
      }}>
        Edit {tenant?.name || 'Tenant'}
        <IconButton
          onClick={handleClose}
          disabled={submitting}
          sx={{ ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Name Field */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Full Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              error={!formData.name.trim()}
              helperText={!formData.name.trim() ? 'Name is required' : ''}
            />
          </Grid>

          {/* Email Field */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </Grid>

          {/* Phone Field */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </Grid>

          {/* Birth Date Field */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              value={formData.bornOn}
              onChange={(e) => setFormData({ ...formData, bornOn: e.target.value })}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>

          {/* Passport ID Field */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Passport ID"
              value={formData.passport_id}
              onChange={(e) => setFormData({ ...formData, passport_id: e.target.value })}
            />
          </Grid>

          {/* Gender Field */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                label="Gender"
              >
                <MenuItem value="">Not specified</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Apartment Assignment Field */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Assigned Apartment</InputLabel>
              <Select
                value={formData.apartment_id}
                onChange={(e) => setFormData({ ...formData, apartment_id: e.target.value })}
                label="Assigned Apartment"
              >
                <MenuItem value="">No apartment assigned</MenuItem>
                {apartments.map((apartment) => (
                  <MenuItem key={apartment.id} value={apartment.id}>
                    {apartment.address || `${apartment.street_name} ${apartment.house_number}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* IBAN Field */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Bank Account (IBAN)"
              value={formData.refundIban}
              onChange={(e) => setFormData({ ...formData, refundIban: e.target.value })}
              placeholder="IL12 3456 7890 1234 5678 901"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        <Button
          onClick={handleClose}
          disabled={submitting}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !formData.name.trim()}
          color="primary"
          sx={{ minWidth: 120 }}
        >
          {submitting ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            'Save Changes'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TenantEdit;
