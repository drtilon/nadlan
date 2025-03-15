// src/components/ApartmentForm.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Autocomplete,
  TextField,
  Chip,
  Avatar,
  Tooltip,
  Button
} from '@mui/material';
import { Person as PersonIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import api from '../utils/api';
import ApartmentDetailsForm from './ApartmentDetailsForm';
import TenantFormDialog from './TenantFormDialog';
import { getUserData } from '../utils/api';

function ApartmentForm({ isEdit = false, initialData = {}, onSuccess, showNotification }) {
  // Get user data to check if admin
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  const emptyForm = {
    address: '',
    rooms: 0,
    size: 0,
    landlord_id: null, // Using the new landlord_id field
    moveInDate: '',
    contractEndDate: '',
    rent: 0,
    rentInSentance: '',
    deposit: 0,
    notes: '',
    status: 'vacant', // Set a default status
    model: 'management', // Default model is management
    managementFee: 0,
    rentCost: 0
  };

  const [tenantData, setTenantData] = useState([]);
  // Use initialData if provided, otherwise use emptyForm
  const validStatusOptions = ['occupied', 'vacant', 'contract_sent', ''];
  const cleanedInitialData = isEdit ? {
    ...initialData,
    status: validStatusOptions.includes(initialData.status) ? initialData.status : 'vacant',
    // If there's a landlord object nested in initialData, use its ID
    landlord_id: initialData.landlord ? initialData.landlord.id : initialData.landlord_id
  } : emptyForm;

  const [formData, setFormData] = useState(cleanedInitialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);

  // Fetch the list of tenants once on component mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true);
        const response = await api.get('/tenants/list');

        // Process tenant data to match our component needs
        const processedTenants = response.data.map(tenant => {
          // Split name into firstName and lastName if needed
          let firstName = '', lastName = '';
          if (tenant.name && !tenant.firstName && !tenant.lastName) {
            const nameParts = tenant.name.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }

          return {
            ...tenant,
            firstName: tenant.firstName || firstName,
            lastName: tenant.lastName || lastName,
            // Identify if this tenant is assigned to the current apartment
            isCurrentTenant: isEdit && initialData.id && tenant.apartment_id === initialData.id
          };
        });

        setAvailableTenants(processedTenants);
        setLoading(false);

        // If editing, find current tenants for this apartment
        if (isEdit && initialData.id) {
          const currentTenants = processedTenants.filter(t => t.apartment_id === initialData.id);

          // If we have current tenants from the database and no tenant data yet, use them
          if (currentTenants.length > 0 && tenantData.length === 0) {
            // Mark the first tenant as primary by default
            const tenantsWithPrimary = currentTenants.map((tenant, index) => ({
              ...tenant,
              isPrimary: index === 0
            }));

            setTenantData(tenantsWithPrimary);
          }
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
        showNotification('Error loading tenants from database', 'error');
        setLoading(false);
      }
    };

    fetchTenants();
  }, [isEdit, initialData.id]);

  // Initialize tenant data if editing
  useEffect(() => {
    if (isEdit && initialData.tenants) {
      // Handle both string format and array format
      if (typeof initialData.tenants === 'string') {
        const tenantNames = initialData.tenants.split(',').map(name => name.trim()).filter(name => name);

        // Match with available tenants or create placeholder objects
        const initialTenantData = tenantNames.map((name, index) => {
          // Look for matching tenant in available tenants list
          const existingTenant = availableTenants.find(t =>
            // Match by exact name
            t.name === name ||
            // Match by constructed name (if we have firstName/lastName fields)
            (t.firstName && t.lastName && `${t.firstName} ${t.lastName}` === name) ||
            // Match by apartment_id if we're looking at current tenants for this apartment
            (initialData.id && t.apartment_id === initialData.id)
          );

          if (existingTenant) {
            return {
              ...existingTenant,
              isPrimary: index === 0 // Make first tenant primary by default
            };
          } else {
            // Create a placeholder with name parts split
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            return {
              id: `temp-${index}`,
              firstName,
              lastName,
              name,
              email: '',
              phone: '',
              isPrimary: index === 0
            };
          }
        });

        setTenantData(initialTenantData);
      } else if (Array.isArray(initialData.tenants)) {
        // If it's already an array, ensure each tenant has the expected fields
        const processedTenants = initialData.tenants.map((tenant, index) => ({
          ...tenant,
          // If tenant has name but not firstName/lastName, split it
          firstName: tenant.firstName || (tenant.name ? tenant.name.split(' ')[0] : ''),
          lastName: tenant.lastName || (tenant.name ? tenant.name.split(' ').slice(1).join(' ') : ''),
          // Ensure isPrimary is set
          isPrimary: tenant.isPrimary === undefined ? index === 0 : tenant.isPrimary
        }));

        setTenantData(processedTenants);
      }
    }
  }, [isEdit, initialData, availableTenants]);

  // Handle input changes for the main form fields with model-specific logic
  const handleChange = (e, isNumber) => {
    const { name, value } = e.target;
    const processedValue = isNumber ? (value ? parseFloat(value) : 0) : value;

    // When changing the model, clear data that doesn't apply to the new model
    if (name === 'model') {
      if (processedValue === 'management') {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          rentCost: 0  // Clear rental data when switching to management
        }));
      } else if (processedValue === 'rental') {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          managementFee: 0  // Clear management data when switching to rental
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: processedValue
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: processedValue
      }));
    }
  };

  // Handle changes for tenant fields
  const handleTenantChange = (index, field, value) => {
    setTenantData(prev =>
      prev.map((tenant, i) =>
        i === index ? { ...tenant, [field]: value } : tenant
      )
    );
  };

  // Set a tenant as primary
  const setTenantAsPrimary = (index) => {
    setTenantData(prev =>
      prev.map((tenant, i) => ({
        ...tenant,
        isPrimary: i === index
      }))
    );
  };

  // Add a selected tenant
  const handleTenantSelection = (event, tenant) => {
    if (tenant) {
      // If this is the first tenant, make them primary
      const isPrimary = tenantData.length === 0;

      // Ensure the tenant has firstName and lastName
      const enrichedTenant = {
        ...tenant,
        firstName: tenant.firstName || (tenant.name ? tenant.name.split(' ')[0] : ''),
        lastName: tenant.lastName || (tenant.name ? tenant.name.split(' ').slice(1).join(' ') : ''),
        isPrimary
      };

      setTenantData([...tenantData, enrichedTenant]);
    }
  };

  // Add a newly created tenant to the list
  const handleNewTenantCreated = (newTenant) => {
    // If this is the first tenant, make them primary
    const isPrimary = tenantData.length === 0;

    // Add the new tenant to the tenant data
    setTenantData([...tenantData, {
      ...newTenant,
      isPrimary
    }]);

    // Close the tenant form dialog
    setTenantFormOpen(false);
  };

  // Remove a tenant
  const removeTenant = (index) => {
    const removedTenant = tenantData[index];
    const newTenantData = tenantData.filter((item, i) => i !== index);

    // If we removed the primary tenant and there are still tenants left,
    // set the first remaining tenant as primary
    if (removedTenant.isPrimary && newTenantData.length > 0) {
      newTenantData[0].isPrimary = true;
    }

    setTenantData(newTenantData);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Ensure all required fields are present
      if (!formData.address) {
        showNotification('Address is required', 'error');
        setIsSubmitting(false);
        return;
      }

      // Make sure rentInSentance is set if not already
      if (!formData.rentInSentance) {
        // Simple conversion of rent to words
        formData.rentInSentance = `${formData.rent} dollars`;
      }

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
      showNotification(`Error: ${error.response?.data?.message || error.message}`, 'error');
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

  // Generate tenant display name
  const getTenantDisplayName = (tenant) => {
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    } else if (tenant.name) {
      return tenant.name;
    } else {
      return 'Unnamed Tenant';
    }
  };

  // Get tenant display details for tooltip
  const getTenantTooltip = (tenant) => {
    const parts = [];
    if (tenant.email) parts.push(`Email: ${tenant.email}`);
    if (tenant.phone) parts.push(`Phone: ${tenant.phone}`);
    if (tenant.apartment_address && tenant.apartment_id !== initialData.id) {
      parts.push(`Current apartment: ${tenant.apartment_address}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'No contact information';
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
    isAdmin, // Pass the admin status to the details form
    // New tenant selection components
    tenantSelection: (
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {tenantData.map((tenant, index) => (
            <Tooltip
              key={index}
              title={getTenantTooltip(tenant)}
              placement="top"
            >
              <Chip
                avatar={
                  <Avatar
                    sx={{
                      bgcolor: tenant.isPrimary ? 'primary.main' : 'default'
                    }}
                  >
                    <PersonIcon />
                  </Avatar>
                }
                label={getTenantDisplayName(tenant)}
                onDelete={() => removeTenant(index)}
                onClick={() => setTenantAsPrimary(index)}
                color={tenant.isPrimary ? "primary" : "default"}
                variant={tenant.isPrimary ? "filled" : "outlined"}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          ))}
          {tenantData.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No tenants assigned to this apartment
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Autocomplete
            options={availableTenants.filter(
              tenant => !tenantData.some(t => t.id === tenant.id)
            )}
            getOptionLabel={(option) => {
              if (option.firstName && option.lastName) {
                return `${option.firstName} ${option.lastName}`;
              }
              return option.name || 'Unnamed Tenant';
            }}
            onChange={handleTenantSelection}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add existing tenant"
                variant="outlined"
                fullWidth
                placeholder="Search and select a tenant"
              />
            )}
            loading={loading}
            loadingText="Loading tenants..."
            noOptionsText="No tenants found or all tenants already added"
            sx={{ flexGrow: 1 }}
          />

          <Button
            variant="contained"
            color="primary"
            startIcon={<PersonAddIcon />}
            onClick={() => setTenantFormOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            New Tenant
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Select from existing tenants or create a new one. Click on a tenant chip to mark as primary.
        </Typography>
      </Box>
    )
  };

  return (
    <Paper sx={{ p: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
        {isEdit ? 'Edit Apartment Details' : 'Add New Apartment'}
      </Typography>
      <ApartmentDetailsForm {...formProps} />

      {/* Tenant creation dialog */}
      <TenantFormDialog
        open={tenantFormOpen}
        onClose={() => setTenantFormOpen(false)}
        onSave={handleNewTenantCreated}
        showNotification={showNotification}
      />
    </Paper>
  );
}

export default ApartmentForm;
