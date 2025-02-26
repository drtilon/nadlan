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
  CircularProgress
} from '@mui/material';

const ApartmentDetailsForm = ({
  formData,
  handleChange,
  handleTenantChange,
  addTenant,
  removeTenant,
  handleSubmit,
  handleDelete,
  isEdit,
  isSubmitting
}) => {
  console.log(formData)
  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Apartment Details */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom color="primary">
            פרטי הנכס
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="כתובת דירה"
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
            label="מספר חדרים"
            name="rooms"
            value={formData.rooms}
            onChange={handleChange}
            required
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="גודל במ״ר"
            name="size"
            value={formData.size}
            onChange={handleChange}
            required
            variant="outlined"
          />
        </Grid>

        {/* Tenant Details */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
            פרטי דיירים
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>

        {formData.tenants.map((tenant, index) => (
          <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="שם דייר"
                value={tenant.name}
                onChange={(e) => handleTenantChange(index, "name", e.target.value)}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="email"
                label="מייל דייר"
                value={tenant.email}
                onChange={(e) => handleTenantChange(index, "email", e.target.value)}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="טלפון דייר"
                value={tenant.phone}
                onChange={(e) => handleTenantChange(index, "phone", e.target.value)}
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={1}>
              <Button onClick={() => removeTenant(index)} color="error" variant="outlined">
                X
              </Button>
            </Grid>
          </Grid>
        ))}

        <Grid item xs={12}>
          <Button onClick={addTenant} variant="contained" color="primary">
            + הוסף דייר
          </Button>
        </Grid>

        {/* Landlord Details */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
            פרטי בעל הדירה
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="שם בעל דירה"
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
            label="מייל בעל דירה"
            name="landlordEmail"
            value={formData.landlordEmail}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="טלפון בעל דירה"
            name="landlordPhone"
            value={formData.landlordPhone}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>

        {/* Contract Details */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
            פרטי חוזה
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="date"
            label="תאריך כניסה"
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
            label="תאריך סיום חוזה"
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
            label="שכירות חודשית (₪)"
            name="rent"
            value={formData.rent}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="פיקדון (₪)"
            name="deposit"
            value={formData.deposit}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="IBAN לשכירות"
            name="IBAN"
            value={formData.IBAN}
            onChange={handleChange}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="status-label">סטטוס</InputLabel>
            <Select
              labelId="status-label"
              label="סטטוס"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <MenuItem value="מושכר">מושכר</MenuItem>
              <MenuItem value="פנוי">פנוי</MenuItem>
              <MenuItem value="חוזה נשלח">חוזה נשלח</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="הערות"
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
              label="דמי ניהול (%)"
              name="managementFee"
              value={formData.managementFee}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
        )}
        {formData.model === 'rental' && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="number"
              label="עלות שכירות (₪)"
              name="rentCost"
              value={formData.rentCost}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
        )}

        {/* Submit and Delete Buttons */}
        <Grid item xs={12} sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            size="large"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
            sx={{ minWidth: 150, mr: isEdit ? 2 : 0 }}
          >
            {isEdit ? 'עדכון דירה' : 'הוספת דירה'}
          </Button>
          {isEdit && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleDelete}
              size="large"
              disabled={isSubmitting}
              sx={{ minWidth: 150 }}
            >
              מחק דירה
            </Button>
          )}
        </Grid>
      </Grid>
    </form>
  );
};

export default ApartmentDetailsForm;

