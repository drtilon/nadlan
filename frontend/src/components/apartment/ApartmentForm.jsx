// ApartmentForm.jsx - Complete FIXED version with proper edit functionality
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
    // Address components - ALL FIELDS
    street_name: '',
    house_number: '',
    zip_code: '',
    city: '',
    state: '',
    country: 'Israel',
    building: '',
    floor: '',
    side: '',

    // Property details - ALL FIELDS
    rooms: 0,
    size: 0,
    maxOccupancy: 1,

    // Financial fields - Basic for all users
    rent: 0,
    deposit: 0,

    // Admin-only financial fields
    managementFee: 0.00,
    rentCost: 0.00,
    model: PROPERTY_MODELS.RENTAL,

    // Other fields - ALL FIELDS
    landlord_id: null,
    moveInDate: '',
    contractEndDate: '',
    notes: '',
    status: APARTMENT_STATUS.VACANT,
    genderPreference: 'mixed'
  };

  // FIXED: Process initial data properly for edit mode
  const cleanedInitialData = isEdit ? {
    ...initialData,

    // FIXED: Handle ALL address components properly
    street_name: initialData.street_name || initialData.address_components?.street_name || '',
    house_number: initialData.house_number || initialData.address_components?.house_number || '',
    zip_code: initialData.zip_code || initialData.address_components?.zip_code || '',
    city: initialData.city || initialData.address_components?.city || '',
    state: initialData.state || initialData.address_components?.state || '',
    country: initialData.country || initialData.address_components?.country || 'Israel',
    building: initialData.building || initialData.address_components?.building || '',
    floor: initialData.floor || initialData.address_components?.floor || '',
    side: initialData.side || initialData.address_components?.side || '',

    // FIXED: Map backend fields to frontend fields
    rooms: initialData.rooms || initialData.bedrooms || 0,
    size: initialData.size || initialData.area || 0,

    // FIXED: Ensure all required fields are populated
    maxOccupancy: initialData.maxOccupancy || 1,
    rent: initialData.rent || 0,
    deposit: initialData.deposit || 0,

    // FIXED: Status handling
    status: Object.values(APARTMENT_STATUS).includes(initialData.status)
      ? initialData.status
      : APARTMENT_STATUS.VACANT,

    // FIXED: Landlord handling
    landlord_id: initialData.landlord?.id || initialData.landlord_id || null,

    // FIXED: Gender preference
    genderPreference: initialData.genderPreference || 'mixed',

    // FIXED: Admin-only financial fields - properly handle defaults
    managementFee: initialData.managementFee !== undefined ? Number(initialData.managementFee) : 0.00,
    rentCost: initialData.rentCost !== undefined ? Number(initialData.rentCost) : 0.00,
    model: initialData.model || PROPERTY_MODELS.RENTAL,

    // FIXED: Date formatting
    moveInDate: initialData.moveInDate ?
      (typeof initialData.moveInDate === 'string' ?
        initialData.moveInDate.split('T')[0] :
        initialData.moveInDate) : '',
    contractEndDate: initialData.contractEndDate ?
      (typeof initialData.contractEndDate === 'string' ?
        initialData.contractEndDate.split('T')[0] :
        initialData.contractEndDate) : '',

    // FIXED: Notes handling
    notes: initialData.notes || ''
  } : {};

  const [formData, setFormData] = useState({ ...emptyForm, ...cleanedInitialData });
  const [tenantData, setTenantData] = useState([]);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [addedTenantIds, setAddedTenantIds] = useState(new Set());

  // FIXED: Initialize tenant data for edit mode with proper field mapping
  useEffect(() => {
    const initializeTenants = () => {
      if (isEdit && initialData.tenants && Array.isArray(initialData.tenants)) {
        console.log('Initializing tenants from initial data:', initialData.tenants);

        const processedTenants = initialData.tenants.map((tenant, index) => ({
          id: tenant.id,
          name: tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim(),
          firstName: tenant.firstName || tenant.name?.split(' ')[0] || '',
          lastName: tenant.lastName || tenant.name?.split(' ').slice(1).join(' ') || '',
          email: tenant.email || '',
          phone: tenant.phone || '',
          // FIXED: Use correct backend field names
          date_of_birth: tenant.date_of_birth || tenant.dateOfBirth || tenant.bornOn || '',
          refund_iban: tenant.refund_iban || tenant.refundIban || '',
          passport_id: tenant.passport_id || tenant.passportId || '',
          gender: tenant.gender || '',
          isExistingTenant: true
        }));

        console.log('Processed tenants for form:', processedTenants);
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
        const response = await api.get('/tenants/available');

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

  // FIXED: Handle form field changes with proper validation
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

    // FIXED: Allow admin users to modify financial model fields
    if (name === 'model' && isAdmin) {
      if (processedValue === PROPERTY_MODELS.MANAGEMENT) {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          rentCost: 0 // Clear rent cost when switching to management
        }));
      } else if (processedValue === PROPERTY_MODELS.RENTAL) {
        setFormData(prev => ({
          ...prev,
          model: processedValue,
          managementFee: 0 // Clear management fee when switching to rental
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

  // Handle tenant changes
  const handleTenantChange = (index, field, value) => {
    setTenantData(prev =>
      prev.map((tenant, i) =>
        i === index ? { ...tenant, [field]: value } : tenant
      )
    );
  };

  // Remove tenant
  const removeTenant = (index) => {
    setTenantData(prev => {
      const tenantToRemove = prev[index];
      const newData = prev.filter((_, i) => i !== index);

      // Remove from added tenant IDs if it's an existing tenant
      if (tenantToRemove.id && !String(tenantToRemove.id).startsWith('temp-')) {
        setAddedTenantIds(prevIds => {
          const newIds = new Set(prevIds);
          newIds.delete(tenantToRemove.id);
          return newIds;
        });
      }

      return newData;
    });
  };

  // Add a selected tenant
  const handleTenantSelection = (tenant) => {
    console.log('Tenant selected from autocomplete:', tenant);

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

    // Add tenant with proper field mapping
    const tenantWithMapping = {
      ...tenant,
      isExistingTenant: true
    };

    setTenantData(prev => [...prev, tenantWithMapping]);
    setAddedTenantIds(prev => new Set([...prev, tenant.id]));

    console.log('Added tenant:', tenantWithMapping);
  };

  // Add new tenant (open form dialog)
  const addNewTenant = () => {
    if (tenantData.length >= formData.maxOccupancy) {
      showNotification(`Cannot add more tenants. Maximum occupancy is ${formData.maxOccupancy}`, 'warning');
      return;
    }
    setTenantFormOpen(true);
  };

  // Handle new tenant creation from dialog
  const handleTenantCreated = (newTenant) => {
    if (!newTenant) {
      console.warn('No tenant data received from dialog');
      return;
    }

    const tenantWithTempId = {
      ...newTenant,
      id: `temp-${Date.now()}`,
      isExistingTenant: false
    };

    setTenantData(prev => [...prev, tenantWithTempId]);
    setTenantFormOpen(false);

    console.log('Created new tenant:', tenantWithTempId);
  };

  // FIXED: Handle form submission with proper endpoint selection and data cleaning
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // FIXED: Basic validations
      if (!formData.street_name || !formData.house_number || !formData.city) {
        showNotification('Please fill in the required address fields (Street name, House number, City)', 'error');
        return;
      }

      if (formData.maxOccupancy < 1) {
        showNotification('Maximum occupancy must be at least 1', 'error');
        return;
      }

      if (tenantData.length > formData.maxOccupancy) {
        showNotification(`Number of tenants (${tenantData.length}) exceeds maximum occupancy (${formData.maxOccupancy})`, 'error');
        return;
      }

      // FIXED: Clean form data - remove computed fields
      const cleanedFormData = { ...formData };
      delete cleanedFormData.rentInSentance;
      delete cleanedFormData.address;

      // FIXED: For non-admin users, remove only financial admin fields from submission
      if (!isAdmin) {
        delete cleanedFormData.managementFee;
        delete cleanedFormData.rentCost;
        delete cleanedFormData.model;
        // Note: landlord_id is NOT removed - default users CAN edit landlord
      }

      // FIXED: Process tenants for backend with correct field names
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
          // FIXED: Use correct backend field names for new tenants
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
        // FIXED: Use correct endpoints based on user role
        const endpoint = isAdmin
          ? `/apartments/edit-admin/${initialData.id}`
          : `/apartments/edit/${initialData.id}`;

        console.log('Using endpoint:', endpoint);
        await api.put(endpoint, payload);
        showNotification('Apartment updated successfully', 'success');
      } else {
        // FIXED: Use correct endpoint for adding new apartment
        await api.post('/apartments/add', payload);
        showNotification('Apartment created successfully', 'success');
      }

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Submit error:', error);

      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.message ||
                          error.message ||
                          'An unexpected error occurred';

      showNotification(`Error: ${errorMessage}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle apartment deletion (admin only)
  const handleDelete = async () => {
    if (!isEdit || !isAdmin) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this apartment? This action cannot be undone.'
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/apartments/delete/${initialData.id}`);
      showNotification('Apartment deleted successfully', 'success');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting apartment';
      showNotification(errorMessage, 'error');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          {isEdit ? 'Edit Apartment' : 'Add New Apartment'}
        </Typography>
        {!isAdmin && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Note: Only Management Fee and Rent Cost are hidden from default users
          </Typography>
        )}
      </Box>

      <form onSubmit={handleSubmit}>
        <ApartmentDetailsForm
          formData={formData}
          handleChange={handleChange}
          tenantData={tenantData}
          handleTenantChange={handleTenantChange}
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
