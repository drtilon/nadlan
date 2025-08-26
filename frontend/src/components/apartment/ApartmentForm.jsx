// ApartmentForm.jsx - Complete fixed version
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box
} from '@mui/material';
import api from '../../utils/api';
import ApartmentDetailsForm from './ApartmentDetailsForm';
import TenantFormDialog from '../tenant/TenantFormDialog';
import TenantSelector from '../tenant/TenantSelector';
import { getUserData } from '../../utils/api';

// Constants
const APARTMENT_STATUS = {
  VACANT: 'vacant',
  OCCUPIED: 'occupied',
  CONTRACT_SENT: 'contract_sent'
};

const PROPERTY_MODELS = {
  MANAGEMENT: 'management',
  RENTAL: 'rental'
};

function ApartmentForm({ isEdit = false, initialData = {}, onSuccess, showNotification }) {
  // Get user data to check if admin
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  const emptyForm = {
    // Address components
    street_name: '',
    house_number: '',
    zip_code: '',
    city: '',
    state: '',
    country: 'Israel',
    building: '',
    floor: '',
    side: '',

    // Property details
    rooms: 0,
    size: 0,
    maxOccupancy: 1,

    // Financial (basic fields only)
    rent: 0,
    deposit: 0,

    // Admin-only financial fields (will be filtered out for users)
    managementFee: 0.00,
    rentCost: 0.00,
    model: PROPERTY_MODELS.MANAGEMENT,

    // Other fields
    landlord_id: null,
    moveInDate: '',
    contractEndDate: '',
    notes: '',
    status: APARTMENT_STATUS.VACANT,
    genderPreference: 'mixed'
  };

  // Clean and process initial data
  const cleanedInitialData = isEdit ? {
    ...initialData,
    // Handle address components
    street_name: initialData.street_name || initialData.address_components?.street_name || '',
    house_number: initialData.house_number || initialData.address_components?.house_number || '',
    zip_code: initialData.zip_code || initialData.address_components?.zip_code || '',
    city: initialData.city || initialData.address_components?.city || '',
    state: initialData.state || initialData.address_components?.state || '',
    country: initialData.country || initialData.address_components?.country || 'Israel',
    building: initialData.building || initialData.address_components?.building || '',
    floor: initialData.floor || initialData.address_components?.floor || '',
    side: initialData.side || initialData.address_components?.side || '',

    // Ensure status is valid
    status: Object.values(APARTMENT_STATUS).includes(initialData.status)
      ? initialData.status
      : APARTMENT_STATUS.VACANT,
    landlord_id: initialData.landlord?.id || initialData.landlord_id,
    maxOccupancy: initialData.maxOccupancy || 1,

    // Financial fields - only include if admin and data exists
    managementFee: isAdmin && initialData.managementFee !== undefined ? initialData.managementFee : 0.00,
    rentCost: isAdmin && initialData.rentCost !== undefined ? initialData.rentCost : 0.00,
    model: isAdmin && initialData.model ? initialData.model : PROPERTY_MODELS.MANAGEMENT,

    // Date formatting
    moveInDate: initialData.moveInDate ?
      (typeof initialData.moveInDate === 'string' ?
        initialData.moveInDate.split('T')[0] :
        initialData.moveInDate) : '',
    contractEndDate: initialData.contractEndDate ?
      (typeof initialData.contractEndDate === 'string' ?
        initialData.contractEndDate.split('T')[0] :
        initialData.contractEndDate) : '',
  } : {};

  const [formData, setFormData] = useState({ ...emptyForm, ...cleanedInitialData });
  const [tenantData, setTenantData] = useState([]);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [addedTenantIds, setAddedTenantIds] = useState(new Set());

  // Initialize tenant data for edit mode
  useEffect(() => {
    const initializeTenants = () => {
      if (isEdit && initialData.tenants && Array.isArray(initialData.tenants)) {
        const processedTenants = initialData.tenants.map((tenant, index) => ({
          id: tenant.id,
          name: tenant.name || '',
          firstName: tenant.firstName || '',
          lastName: tenant.lastName || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
          bornOn: tenant.bornOn || '',
          refundIban: tenant.refundIban || '',
          isPrimary: index === 0 || tenant.isPrimary || false
        }));

        setTenantData(processedTenants);

        // Track existing tenant IDs
        const existingIds = processedTenants
          .filter(t => t.id && !String(t.id).startsWith('temp-'))
          .map(t => t.id);
        setAddedTenantIds(new Set(existingIds));
      }
    };

    initializeTenants();
  }, [isEdit, initialData.tenants]);

  // Fetch available tenants
  useEffect(() => {
    const fetchAvailableTenants = async () => {
      try {
        setLoading(true);
        // Use existing tenant endpoint from tenants.py
        const response = await api.get('/tenants/list');

        if (response.data && Array.isArray(response.data)) {
          setAvailableTenants(response.data);
        } else {
          console.warn('Invalid tenant data received:', response.data);
          setAvailableTenants([]);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
        setAvailableTenants([]);
        showNotification('Error loading tenants', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableTenants();
  }, [showNotification]);

  // Handle form field changes
  const handleChange = (event, isNumber = false) => {
    const { name, value } = event.target;
    let processedValue = isNumber ? (value ? parseFloat(value) : 0) : value;

    // Special handling for rooms change - suggest maxOccupancy
    if (name === 'rooms' && isNumber && processedValue > 0) {
      if (formData.maxOccupancy <= 1) {
        const suggestedOccupancy = Math.max(1, processedValue + 1);
        setFormData(prev => ({
          ...prev,
          rooms: processedValue,
          maxOccupancy: suggestedOccupancy
        }));
        return;
      }
    }

    // Only allow admin users to modify financial model fields
    if (name === 'model' && isAdmin) {
      if (processedValue === PROPERTY_MODELS.MANAGEMENT) {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          rentCost: 0
        }));
      } else if (processedValue === PROPERTY_MODELS.RENTAL) {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          managementFee: 0
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: processedValue
        }));
      }
    } else {
      // For non-admin users or other fields, just update normally
      setFormData(prev => ({
        ...prev,
        [name]: processedValue
      }));
    }
  };

  // Handle tenant changes
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

  // Add a selected tenant - FIXED VERSION
  const handleTenantSelection = (tenant) => {
    if (!tenant) {
      console.warn('No tenant selected');
      return;
    }

    // Check if tenant is already added
    if (tenant.id && addedTenantIds.has(tenant.id)) {
      showNotification('This tenant is already added to the apartment', 'warning');
      return;
    }

    // Check occupancy limit
    if (tenantData.length >= formData.maxOccupancy) {
      showNotification(`Cannot add more tenants. Maximum occupancy is ${formData.maxOccupancy}`, 'warning');
      return;
    }

    // Create new tenant entry with proper structure
    const newTenant = {
      id: tenant.id,
      name: tenant.name || '',
      firstName: tenant.firstName || '',
      lastName: tenant.lastName || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      bornOn: tenant.bornOn || '',
      refundIban: tenant.refundIban || '',
      isPrimary: tenantData.length === 0, // First tenant is primary
      isExistingTenant: true
    };

    // Add tenant to the list
    setTenantData(prev => [...prev, newTenant]);

    // Track the added tenant ID
    if (tenant.id) {
      setAddedTenantIds(prev => new Set(prev).add(tenant.id));
    }

    console.log('Added tenant:', newTenant);
  };

  // Remove a tenant - FIXED VERSION
  const removeTenant = (index) => {
    if (index < 0 || index >= tenantData.length) {
      console.warn('Invalid tenant index for removal:', index);
      return;
    }

    const tenantToRemove = tenantData[index];
    console.log('Removing tenant:', tenantToRemove);

    setTenantData(prev => {
      const newData = prev.filter((_, i) => i !== index);

      // If we removed the primary tenant, make the first remaining tenant primary
      if (tenantToRemove.isPrimary && newData.length > 0) {
        newData[0].isPrimary = true;
      }

      return newData;
    });

    // Remove from added tenant IDs if it was an existing tenant
    if (tenantToRemove.id && !String(tenantToRemove.id).startsWith('temp-')) {
      setAddedTenantIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(tenantToRemove.id);
        return newSet;
      });
    }
  };

  // Add a new tenant with dialog
  const addNewTenant = () => {
    if (tenantData.length >= formData.maxOccupancy) {
      showNotification(`Cannot add more tenants. Maximum occupancy is ${formData.maxOccupancy}`, 'warning');
      return;
    }
    setTenantFormOpen(true);
  };

  // Handle new tenant creation from dialog - FIXED VERSION
  const handleTenantCreated = (newTenant) => {
    if (!newTenant) {
      console.warn('No tenant data received from dialog');
      return;
    }

    const tenantWithTempId = {
      ...newTenant,
      id: `temp-${Date.now()}`,
      isPrimary: tenantData.length === 0,
      isExistingTenant: false
    };

    setTenantData(prev => [...prev, tenantWithTempId]);
    setTenantFormOpen(false);

    console.log('Created new tenant:', tenantWithTempId);
  };

  // Handle form submission - FIXED VERSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Basic validations
      if (formData.maxOccupancy < 1) {
        showNotification('Maximum occupancy must be at least 1', 'error');
        return;
      }

      if (tenantData.length > formData.maxOccupancy) {
        showNotification(`Number of tenants (${tenantData.length}) exceeds maximum occupancy (${formData.maxOccupancy})`, 'error');
        return;
      }

      // Clean form data
      const cleanedFormData = { ...formData };
      delete cleanedFormData.rentInSentance;
      delete cleanedFormData.address;

      // For non-admin users, remove sensitive fields
      if (!isAdmin) {
        delete cleanedFormData.managementFee;
        delete cleanedFormData.rentCost;
        delete cleanedFormData.model;
      }

      // Process tenants for backend
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
            bornOn: tenant.bornOn || '',
            refundIban: tenant.refundIban || '',
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
        // Use role-specific endpoint
        const endpoint = isAdmin ?
          `/admin/edit/${initialData.id}` :
          `/user/edit/${initialData.id}`;
        await api.put(endpoint, payload);
        showNotification('Apartment updated successfully', 'success');
      } else {
        await api.post('/add', payload);
        showNotification('Apartment added successfully', 'success');
      }

      onSuccess();
    } catch (error) {
      console.error('Submit error:', error);
      showNotification(`Error: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete apartment - admin only
  const handleDelete = async () => {
    if (!isAdmin) {
      showNotification('Only administrators can delete apartments', 'error');
      return;
    }

    if (!window.confirm("Are you sure you want to delete this apartment? This action cannot be undone.")) {
      return;
    }

    try {
      setIsSubmitting(true);
      await api.delete(`/apartments/${initialData.id}`);
      showNotification('Apartment deleted successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error deleting apartment:', error);
      showNotification(`Error deleting apartment: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEdit ? 'Edit Apartment' : 'Add New Apartment'}
        </Typography>
        {!isAdmin && (
          <Box sx={{
            p: 2,
            bgcolor: 'info.light',
            borderRadius: 1,
            mb: 2,
            border: '1px solid',
            borderColor: 'info.main'
          }}>
            <Typography variant="body2" color="info.dark">
              📝 <strong>User Mode:</strong> You can edit apartment details and landlord information,
              but financial management settings (profit calculations) are only visible to administrators for privacy.
            </Typography>
          </Box>
        )}
      </Box>

      <form onSubmit={handleSubmit}>
        <ApartmentDetailsForm
          formData={formData}
          handleChange={handleChange}
          tenantData={tenantData}
          handleTenantChange={handleTenantChange}
          setTenantAsPrimary={setTenantAsPrimary}
          removeTenant={removeTenant}
          addNewTenant={addNewTenant}
          handleTenantSelection={handleTenantSelection}
          availableTenants={availableTenants}
          loading={loading}
          isSubmitting={isSubmitting}
          isEdit={isEdit}
          handleDelete={handleDelete}
          showNotification={showNotification}
          isAdmin={isAdmin}
          addedTenantIds={addedTenantIds}
          // Pass tenant selection component as prop
          tenantSelection={
            <TenantSelector
              tenantData={tenantData}
              availableTenants={availableTenants}
              addedTenantIds={addedTenantIds}
              loading={loading}
              onTenantSelection={handleTenantSelection}
              onSetTenantAsPrimary={setTenantAsPrimary}
              onRemoveTenant={removeTenant}
              onOpenTenantForm={addNewTenant}
            />
          }
        />
      </form>

      {/* Tenant Form Dialog */}
      <TenantFormDialog
        open={tenantFormOpen}
        onClose={() => setTenantFormOpen(false)}
        onTenantCreated={handleTenantCreated}
        showNotification={showNotification}
        createOnly={true}
      />
    </Paper>
  );
}

export default ApartmentForm;
