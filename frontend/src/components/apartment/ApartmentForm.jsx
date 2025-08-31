import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

// Import components
import ApartmentDetailsForm from './ApartmentDetailsForm';
import TenantSelector from '../tenant/TenantSelector';
import TenantForm from '../tenant/EnhancedTenantForm';

// Import API and utilities
import api from '../../utils/api';

const ApartmentForm = ({
  initialData = null,
  onSuccess,
  showNotification,
  isAdmin = false
}) => {
  const isEdit = !!initialData;

  // Form state
  const [formData, setFormData] = useState({
    street_name: '',
    house_number: '',
    building: '',
    floor: '',
    side: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'Israel',
    rooms: 1,
    size: '',
    rent: '',
    deposit: '',
    maxOccupancy: 1,
    genderPreference: 'mixed',
    status: 'vacant',
    notes: '',
    landlord_id: '',
    moveInDate: '',
    moveOutDate: '',
    // FIXED: Admin fields with proper defaults
    model: 'rental',
    managementFee: 0,
    rentCost: 0
  });

  // Tenant management state
  const [tenantData, setTenantData] = useState([]);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [addedTenantIds, setAddedTenantIds] = useState(new Set());
  const [tenantFormOpen, setTenantFormOpen] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIXED: Initialize form data properly including admin fields
  useEffect(() => {
    if (isEdit && initialData) {
      console.log('Initializing form with data:', initialData);

      setFormData({
        street_name: initialData.street_name || '',
        house_number: initialData.house_number || '',
        building: initialData.building || '',
        floor: initialData.floor || '',
        side: initialData.side || '',
        city: initialData.city || '',
        state: initialData.state || '',
        zip_code: initialData.zip_code || '',
        country: initialData.country || 'Israel',
        rooms: initialData.bedrooms || initialData.rooms || 1,
        size: initialData.area || initialData.size || '',
        rent: initialData.rent || '',
        deposit: initialData.deposit || '',
        maxOccupancy: initialData.maxOccupancy || 1,
        genderPreference: initialData.genderPreference || 'mixed',
        status: initialData.status || 'vacant',
        notes: initialData.notes || '',
        landlord_id: initialData.landlord_id || '',
        moveInDate: initialData.moveInDate ? initialData.moveInDate.split('T')[0] : '',
        moveOutDate: initialData.moveOutDate ? initialData.moveOutDate.split('T')[0] : '',
        // FIXED: Properly initialize admin fields from backend data
        model: initialData.model || 'rental',
        managementFee: initialData.managementFee || 0,
        rentCost: initialData.rentCost || 0
      });

      // Initialize tenants if they exist
      if (initialData.tenants && Array.isArray(initialData.tenants)) {
        const existingTenants = initialData.tenants.map(tenant => ({
          ...tenant,
          isExistingTenant: true
        }));
        setTenantData(existingTenants);
        setAddedTenantIds(new Set(initialData.tenants.map(t => t.id)));
      }
    }
  }, [isEdit, initialData]);

  // Fetch available tenants
  useEffect(() => {
    const fetchAvailableTenants = async () => {
      try {
        const response = await api.get('/tenants/available');
        setAvailableTenants(response.data.tenants || response.data || []);
      } catch (error) {
        console.error('Error fetching available tenants:', error);
      }
    };

    fetchAvailableTenants();
  }, []);

  // Handle form changes
  const handleChange = (event) => {
    const { name, value } = event.target;
    console.log(`Form field changed: ${name} = ${value}`);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle tenant changes
  const handleTenantChange = (index, field, value) => {
    setTenantData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove tenant
  const removeTenant = (index) => {
    const tenantToRemove = tenantData[index];
    setTenantData(prev => prev.filter((_, i) => i !== index));
    if (tenantToRemove.id) {
      setAddedTenantIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tenantToRemove.id);
        return newSet;
      });
    }
  };

  // Handle tenant selection
  const handleTenantSelection = (tenant) => {
    if (addedTenantIds.has(tenant.id)) {
      showNotification?.('Tenant already added', 'warning');
      return;
    }

    if (tenantData.length >= formData.maxOccupancy) {
      showNotification?.(`Maximum occupancy (${formData.maxOccupancy}) reached`, 'warning');
      return;
    }

    const tenantToAdd = {
      id: tenant.id,
      name: tenant.name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      date_of_birth: tenant.date_of_birth || '',
      refund_iban: tenant.refund_iban || '',
      passport_id: tenant.passport_id || '',
      gender: tenant.gender || '',
      isExistingTenant: true
    };

    setTenantData(prev => [...prev, tenantToAdd]);
    setAddedTenantIds(prev => new Set([...prev, tenant.id]));
  };

  // Handle new tenant creation
  const handleNewTenantSubmit = (newTenantData) => {
    if (tenantData.length >= formData.maxOccupancy) {
      showNotification?.(`Maximum occupancy (${formData.maxOccupancy}) reached`, 'warning');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tenantToAdd = {
      id: tempId,
      ...newTenantData,
      isExistingTenant: false
    };

    setTenantData(prev => [...prev, tenantToAdd]);
    setTenantFormOpen(false);
  };

  // FIXED: Handle apartment deletion
  const handleDelete = async () => {
    if (!isEdit || !initialData?.id) return;

    if (window.confirm('Are you sure you want to delete this apartment? This action cannot be undone.')) {
      try {
        await api.delete(`/apartments/delete/${initialData.id}`);
        showNotification?.('Apartment deleted successfully', 'success');
        onSuccess?.();
      } catch (error) {
        console.error('Error deleting apartment:', error);
        const errorMessage = error.response?.data?.message || 'Failed to delete apartment';
        showNotification?.(errorMessage, 'error');
      }
    }
  };

  // FIXED: Form submission with proper handling
  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      console.log('Form submission started');
      console.log('Form data:', formData);
      console.log('Tenant data:', tenantData);
      console.log('Is admin:', isAdmin);

      // Validation
      if (!formData.street_name || !formData.house_number || !formData.city) {
        showNotification?.('Please fill in required address fields: Street Name, House Number, and City', 'error');
        return;
      }

      if (!formData.rent || formData.rent <= 0) {
        showNotification?.('Please enter a valid rent amount', 'error');
        return;
      }

      if (!formData.maxOccupancy || formData.maxOccupancy < 1) {
        showNotification?.('Maximum occupancy must be at least 1', 'error');
        return;
      }

      if (tenantData.length > formData.maxOccupancy) {
        showNotification?.(`Number of tenants (${tenantData.length}) exceeds maximum occupancy (${formData.maxOccupancy})`, 'error');
        return;
      }

      // FIXED: Clean form data - remove computed fields
      const cleanedFormData = { ...formData };
      delete cleanedFormData.rentInSentance;
      delete cleanedFormData.address;

      // FIXED: For non-admin users, remove only admin-specific financial fields
      if (!isAdmin) {
        delete cleanedFormData.managementFee;
        delete cleanedFormData.rentCost;
        delete cleanedFormData.model;
        console.log('Removed admin-only fields for non-admin user');
      } else {
        console.log('Keeping admin fields - user is admin');
      }

      // FIXED: Ensure landlord_id is properly included
      if (formData.landlord_id) {
        cleanedFormData.landlord_id = parseInt(formData.landlord_id);
      }

      console.log('Cleaned form data:', cleanedFormData);

      // FIXED: Process tenants with correct field names
      const processedTenants = tenantData.map(tenant => {
        const isExistingTenant = tenant.id && !String(tenant.id).startsWith('temp-');

        if (isExistingTenant) {
          return {
            id: tenant.id,
            name: tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim(),
            email: tenant.email || '',
            phone: tenant.phone || '',
            isExistingTenant: true
          };
        } else {
          return {
            name: tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim(),
            email: tenant.email || '',
            phone: tenant.phone || '',
            date_of_birth: tenant.date_of_birth || '',
            refund_iban: tenant.refund_iban || '',
            passport_id: tenant.passport_id || '',
            gender: tenant.gender || '',
            isExistingTenant: false
          };
        }
      });

      const payload = {
        new_apartment: cleanedFormData,
        new_tenants: processedTenants
      };

      console.log('Submitting payload:', payload);

      if (isEdit) {
        // Use existing edit endpoints
        const endpoint = isAdmin
          ? `/apartments/edit-admin/${initialData.id}`
          : `/apartments/edit/${initialData.id}`;

        console.log(`Using edit endpoint: ${endpoint}`);

        const response = await api.put(endpoint, payload);
        console.log('Edit response:', response.data);

        showNotification?.('Apartment updated successfully!', 'success');
        onSuccess?.(response.data.apartment);
      } else {
        // Use add endpoint
        const endpoint = '/apartments/add';
        console.log(`Using add endpoint: ${endpoint}`);

        const response = await api.post(endpoint, payload);
        console.log('Add response:', response.data);

        showNotification?.('Apartment created successfully!', 'success');
        onSuccess?.(response.data.apartment);
      }

    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          (isEdit ? 'Failed to update apartment' : 'Failed to create apartment');
      showNotification?.(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading apartment form...</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {isEdit ? 'Edit Apartment' : 'Add New Apartment'}
      </Typography>

      {/* FIXED: Display admin status for debugging */}
      {isAdmin && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Admin Mode: You can edit all fields including management fees and rent costs
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Apartment Details Form */}
        <ApartmentDetailsForm
          formData={formData}
          handleChange={handleChange}
          tenantData={tenantData}
          handleTenantChange={handleTenantChange}
          removeTenant={removeTenant}
          addNewTenant={() => setTenantFormOpen(true)}
          handleTenantSelection={handleTenantSelection}
          availableTenants={availableTenants}
          loading={loading}
          isSubmitting={isSubmitting}
          isEdit={isEdit}
          handleDelete={handleDelete}
          showNotification={showNotification}
          isAdmin={isAdmin}
          addedTenantIds={addedTenantIds}
        />

        <Divider sx={{ my: 3 }} />

        {/* Tenant Section */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Tenants ({tenantData.length}/{formData.maxOccupancy})
        </Typography>

        <TenantSelector
          tenantData={tenantData}
          availableTenants={availableTenants}
          onTenantChange={handleTenantChange}
          onRemoveTenant={removeTenant}
          onAddExistingTenant={handleTenantSelection}
          onAddNewTenant={() => setTenantFormOpen(true)}
          addedTenantIds={addedTenantIds}
          maxOccupancy={formData.maxOccupancy}
        />

        <Divider sx={{ my: 3 }} />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            disabled={isSubmitting}
            size="large"
          >
            {isSubmitting
              ? (isEdit ? 'Updating...' : 'Creating...')
              : (isEdit ? 'Update Apartment' : 'Create Apartment')
            }
          </Button>
        </Box>
      </form>

      {/* New Tenant Dialog */}
      <Dialog
        open={tenantFormOpen}
        onClose={() => setTenantFormOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent>
          <TenantForm
            onSubmit={handleNewTenantSubmit}
            showNotification={showNotification}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTenantFormOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ApartmentForm;
