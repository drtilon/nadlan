import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Autocomplete,
  TextField,
  Chip
} from '@mui/material';
import api from '../utils/api';
import ModelSelection from './ModelSelection';
import ApartmentDetailsForm from './ApartmentDetailsForm';

function ApartmentForm({ isEdit = false, initialData = {}, onSuccess, showNotification }) {
  const emptyForm = {
    address: '',
    rooms: 0,
    size: 0,
    landlordName: '',
    landlordEmail: '',
    landlordPhone: '',
    moveInDate: '',
    contractEndDate: '',
    rent: 0,
    deposit: 0,
    notes: '',
    IBAN: '',
    status: '',
    model: '',
    managementFee: 0,
    rentCost: 0
  };

  const [tenantData, setTenantData] = useState([]);
  const [formData, setFormData] = useState(isEdit ? initialData : emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelChosen, setModelChosen] = useState(isEdit ? true : false);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available tenants from database
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true);
        const response = await api.get('/tenants/list');
        setAvailableTenants(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching tenants:', error);
        showNotification('Error loading tenants from database', 'error');
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Initialize tenant data if editing
  useEffect(() => {
    if (isEdit && initialData.tenants) {
      // Handle both string format and array format
      if (typeof initialData.tenants === 'string') {
        const tenantNames = initialData.tenants.split(',').map(name => name.trim()).filter(name => name);

        // Match with available tenants or create placeholder objects
        const initialTenantData = tenantNames.map(name => {
          const existingTenant = availableTenants.find(t => t.name === name);
          return existingTenant || { name, email: '', phone: '' };
        });

        setTenantData(initialTenantData);
      } else if (Array.isArray(initialData.tenants)) {
        setTenantData(initialData.tenants);
      }
    }
  }, [isEdit, initialData, availableTenants]);

  // Handle input changes for the main form fields
  const handleChange = (e, isNumber) => {
    setFormData({
      ...formData,
      [e.target.name]: isNumber ? parseInt(e.target.value) : e.target.value
    });
  };

  // Handle changes for tenant fields
  const handleTenantChange = (index, field, value) => {
    setTenantData(prev =>
      prev.map((tenant, i) =>
        i === index ? { ...tenant, [field]: value } : tenant
      )
    );
  };

  // Add a selected tenant
  const handleTenantSelection = (event, tenant) => {
    if (tenant) {
      setTenantData([...tenantData, tenant]);
    }
  };

  // Remove a tenant
  const removeTenant = (index) => {
    setTenantData(prev => prev.filter((item, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        new_apartment: formData,
        new_tenants: tenantData
      };

      if (isEdit) {
        await api.put(`/edit/${initialData.id}`, payload);
        showNotification('Apartment updated successfully', 'success');
      } else {
        await api.post('/add', payload);
        showNotification('Apartment added successfully', 'success');
      }

      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete apartment
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this apartment?")) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.delete(`/delete/${initialData.id}`);
      showNotification("Apartment deleted successfully", "success");
      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification(`Error deleting apartment: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select management model
  const chooseModel = (modelType) => {
    setFormData({ ...formData, model: modelType });
    setModelChosen(true);
  };

  // Modified props to pass to ApartmentDetailsForm
  const formProps = {
    formData,
    tenantData,
    handleChange,
    handleTenantChange,
    handleSubmit,
    handleDelete,
    isEdit,
    isSubmitting,
    // New tenant selection components
    tenantSelection: (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Tenants
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {tenantData.map((tenant, index) => (
            <Chip
              key={index}
              label={tenant.name}
              onDelete={() => removeTenant(index)}
              color="primary"
              variant="outlined"
            />
          ))}
          {tenantData.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No tenants assigned to this apartment
            </Typography>
          )}
        </Box>

        <Autocomplete
          options={availableTenants.filter(
            tenant => !tenantData.some(t => t.id === tenant.id)
          )}
          getOptionLabel={(option) => option.name}
          onChange={handleTenantSelection}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add tenant"
              variant="outlined"
              fullWidth
              placeholder="Search and select a tenant"
              helperText="Select from existing tenants in the database"
            />
          )}
          loading={loading}
          loadingText="Loading tenants..."
          noOptionsText="No tenants found or all tenants already added"
        />
      </Box>
    )
  };

  return (
    <Paper sx={{ p: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
        {isEdit ? 'Edit Apartment Details' : 'Add New Apartment'}
      </Typography>
      {!modelChosen && !isEdit ? (
        <ModelSelection onSelect={chooseModel} />
      ) : (
        <ApartmentDetailsForm {...formProps} />
      )}
    </Paper>
  );
}

export default ApartmentForm;
