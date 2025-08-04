// src/components/EnhancedLandlordForm.jsx
import React from 'react';
import {
  Grid,
  TextField,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Divider,
  Typography,
  Box
} from '@mui/material';
import { Business as BusinessIcon, Save as SaveIcon } from '@mui/icons-material';

function EnhancedLandlordForm({
  formData,
  setFormData,
  editingLandlord,
  formSubmitting,
  handleCloseDialog,
  handleSubmit
}) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium">
              Company Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Company Name"
              name="company_name"
              value={formData.company_name}
              onChange={handleInputChange}
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
              label="Landlord Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
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
              label="Company Address"
              name="company_address"
              value={formData.company_address}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium" sx={{ mt: 2 }}>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
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
              value={formData.phone}
              onChange={handleInputChange}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium" sx={{ mt: 2 }}>
              Financial Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="IBAN / Bank Account"
              name="iban"
              value={formData.iban}
              onChange={handleInputChange}
              variant="filled"
              placeholder="DE89 3704 0044 0532 0130 00"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="medium" sx={{ mt: 2 }}>
              Additional Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleInputChange}
              multiline
              rows={3}
              variant="filled"
              InputLabelProps={{
                sx: { fontSize: '1rem', fontWeight: 'medium' }
              }}
            />
          </Grid>
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
          disabled={formSubmitting}
          startIcon={formSubmitting ?
            <LinearProgress size={20} /> :
            (editingLandlord ? <SaveIcon /> : <BusinessIcon />)
          }
        >
          {editingLandlord ? 'Update Landlord' : 'Add Landlord'}
        </Button>
      </DialogActions>
    </>
  );
}

export default EnhancedLandlordForm;
