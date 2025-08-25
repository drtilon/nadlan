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
    // Address components (replacing single address field)
    street_name: '',
    house_number: '',
    zip_code: '',
    city: '',
    state: '',
    country: '',
    building: '',
    floor: '',
    side: '',

    // Property details
    rooms: 0,
    size: 0,
    maxOccupancy: 1,

    // Financial
    rent: 0,
    deposit: 0,
    managementFee: 0.00,
    rentCost: 0.00,

    // Other fields
    landlord_id: null,
    moveInDate: '',
    contractEndDate: '',
    notes: '',
    status: APARTMENT_STATUS.VACANT,
    model: PROPERTY_MODELS.MANAGEMENT,
    genderPreference: 'mixed'
  };

  const [tenantData, setTenantData] = useState([]);

  // Clean and process initial data
  const cleanedInitialData = isEdit ? {
    ...initialData,
    // Handle address components
    street_name: initialData.street_name || initialData.address_components?.street_name || '',
    house_number: initialData.house_number || initialData.address_components?.house_number || '',
    zip_code: initialData.zip_code || initialData.address_components?.zip_code || '',
    city: initialData.city || initialData.address_components?.city || '',
    state: initialData.state || initialData.address_components?.state || '',
    country: initialData.country || initialData.address_components?.country || '',
    building: initialData.building || initialData.address_components?.building || '',
    floor: initialData.floor || initialData.address_components?.floor || '',
    side: initialData.side || initialData.address_components?.side || '',

    // Ensure status is valid
    status: Object.values(APARTMENT_STATUS).includes(initialData.status)
      ? initialData.status
      : APARTMENT_STATUS.VACANT,
    landlord_id: initialData.landlord?.id || initialData.landlord_id,
    maxOccupancy: initialData.maxOccupancy || 1,

    // Ensure financial fields have default values
    managementFee: initialData.managementFee || 0.00,
    rentCost: initialData.rentCost || 0.00,
    model: initialData.model || PROPERTY_MODELS.MANAGEMENT,
    genderPreference: initialData.genderPreference || 'mixed'
  } : emptyForm;

  // Remove any invalid/legacy fields
  if (cleanedInitialData.rentInSentance) {
    delete cleanedInitialData.rentInSentance;
  }
  if (cleanedInitialData.address) {
    delete cleanedInitialData.address;
  }

  const [formData, setFormData] = useState(cleanedInitialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [addedTenantIds, setAddedTenantIds] = useState(new Set());

  // Fetch tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        setLoading(true);
        const response = await api.get('/tenants/list');

        const processedTenants = response.data.map(tenant => {
          let firstName = '', lastName = '';
          if (tenant.name && !tenant.firstName && !tenant.lastName) {
            const nameParts = tenant.name.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }

          return {
            ...tenant,
            firstName: tenant.firstName || firstName,
            lastName: tenant.lastName || lastName
          };
        });

        setAvailableTenants(processedTenants);
      } catch (error) {
        console.error('Error fetching tenants:', error);
        showNotification('Error fetching tenants', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, [showNotification]);

  // Process initial tenant data
  useEffect(() => {
    if (isEdit && initialData && availableTenants.length > 0) {
      let tenantsToProcess = [];

      if (initialData.tenants && initialData.tenants.length > 0) {
        tenantsToProcess = initialData.tenants.map((tenant, index) => ({
          ...tenant,
          firstName: tenant.firstName || (tenant.name ? tenant.name.split(' ')[0] : ''),
          lastName: tenant.lastName || (tenant.name ? tenant.name.split(' ').slice(1).join(' ') : ''),
          isPrimary: tenant.isPrimary === undefined ? index === 0 : tenant.isPrimary
        }));
      }

      if (tenantsToProcess.length > 0 && tenantData.length === 0) {
        setTenantData(tenantsToProcess);
        const tenantIdSet = new Set(tenantsToProcess.map(t => t.id).filter(id => !id.toString().startsWith('temp-')));
        setAddedTenantIds(tenantIdSet);
      }
    }
  }, [isEdit, initialData, availableTenants]);

  // Handle input changes for the main form fields
  const handleChange = (e, isNumber) => {
    const { name, value } = e.target;

    if (name === 'rentInSentance') return;

    const processedValue = isNumber ? (value ? parseFloat(value) : 0) : value;

    // Special handling for rooms change - suggest maxOccupancy
    if (name === 'rooms' && isNumber && processedValue > 0) {
      // Auto-suggest maxOccupancy based on rooms if maxOccupancy is still default
      if (formData.maxOccupancy <= 1) {
        const suggestedOccupancy = Math.max(1, processedValue + 1); // rooms + 1 as a reasonable default
        setFormData(prev => ({
          ...prev,
          rooms: processedValue,
          maxOccupancy: suggestedOccupancy
        }));
        return;
      }
    }

    if (name === 'model') {
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

  // Add a selected tenant
  const handleTenantSelection = (tenant) => {
    if (tenant) {
      if (tenant.id && addedTenantIds.has(tenant.id)) {
        showNotification('This tenant is already added to the apartment', 'warning');
        return;
      }

      // Check if adding this tenant would exceed max occupancy
      if (tenantData.length >= formData.maxOccupancy) {
        showNotification(`Cannot add more tenants. Maximum occupancy is ${formData.maxOccupancy}`, 'warning');
        return;
      }

      const isPrimary = tenantData.length === 0;

      const enrichedTenant = {
        ...tenant,
        firstName: tenant.firstName || (tenant.name ? tenant.name.split(' ')[0] : ''),
        lastName: tenant.lastName || (tenant.name ? tenant.name.split(' ').slice(1).join(' ') : ''),
        isPrimary
      };

      setTenantData([...tenantData, enrichedTenant]);

      if (tenant.id) {
        setAddedTenantIds(new Set([...addedTenantIds, tenant.id]));
      }
    }
  };

  // Add a newly created tenant
  const handleNewTenantCreated = (newTenant) => {
    if (newTenant.id && addedTenantIds.has(newTenant.id)) {
      showNotification('This tenant is already added to the apartment', 'warning');
      setTenantFormOpen(false);
      return;
    }

    // Check if adding this tenant would exceed max occupancy
    if (tenantData.length >= formData.maxOccupancy) {
      showNotification(`Cannot add more tenants. Maximum occupancy is ${formData.maxOccupancy}`, 'warning');
      setTenantFormOpen(false);
      return;
    }

    const isPrimary = tenantData.length === 0;

    setTenantData([...tenantData, {
      ...newTenant,
      isPrimary
    }]);

    if (newTenant.id) {
      setAddedTenantIds(new Set([...addedTenantIds, newTenant.id]));
    }

    setTenantFormOpen(false);
  };

  // Remove a tenant
  const removeTenant = (index) => {
    const removedTenant = tenantData[index];
    const newTenantData = tenantData.filter((item, i) => i !== index);

    if (removedTenant.isPrimary && newTenantData.length > 0) {
      newTenantData[0].isPrimary = true;
    }

    setTenantData(newTenantData);

    if (removedTenant.id) {
      const newAddedTenantIds = new Set(addedTenantIds);
      newAddedTenantIds.delete(removedTenant.id);
      setAddedTenantIds(newAddedTenantIds);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required address fields
      if (!formData.street_name || !formData.house_number || !formData.city || !formData.zip_code) {
        showNotification('Street name, house number, city, and ZIP code are required', 'error');
        setIsSubmitting(false);
        return;
      }

      if (!formData.maxOccupancy || formData.maxOccupancy < 1) {
        showNotification('Maximum occupancy must be at least 1', 'error');
        setIsSubmitting(false);
        return;
      }

      // Check if tenants exceed max occupancy
      if (tenantData.length > formData.maxOccupancy) {
        showNotification(`Number of tenants (${tenantData.length}) exceeds maximum occupancy (${formData.maxOccupancy})`, 'error');
        setIsSubmitting(false);
        return;
      }

      const cleanedFormData = { ...formData };

      // Remove any invalid/legacy fields
      delete cleanedFormData.rentInSentance;
      delete cleanedFormData.address; // Remove legacy address field if present

      // Ensure managementFee and rentCost are always sent (for backend validation)
      // For non-admin users, these will use default values
      if (!isAdmin) {
        // Set default values based on model for non-admin users
        if (cleanedFormData.model === PROPERTY_MODELS.MANAGEMENT) {
          cleanedFormData.managementFee = 0.00;
          cleanedFormData.rentCost = 0.00;
        } else {
          cleanedFormData.managementFee = 0.00;
          cleanedFormData.rentCost = 0.00;
        }
        // Force management model for non-admin users
        cleanedFormData.model = PROPERTY_MODELS.MANAGEMENT;
      }

      const processedTenants = tenantData.map(tenant => {
        const isExistingTenant = tenant.id && !String(tenant.id).startsWith('temp-');

        if (isExistingTenant) {
          return {
            id: tenant.id,
            name: tenant.name || `${tenant.firstName} ${tenant.lastName}`.trim(),
            email: tenant.email || '',
            phone: tenant.phone || '',
            isExistingTenant: true
          };
        } else {
          return {
            name: tenant.name || `${tenant.firstName} ${tenant.lastName}`.trim(),
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

  // Props to pass to ApartmentDetailsForm
  const formProps = {
    formData,
    tenantData,
    handleChange,
    handleTenantChange,
    handleSubmit,
    handleDelete,
    isEdit,
    isSubmitting,
    isAdmin,
    tenantSelection: (
      <TenantSelector
        tenantData={tenantData}
        availableTenants={availableTenants}
        addedTenantIds={addedTenantIds}
        loading={loading}
        onTenantSelection={handleTenantSelection}
        onSetTenantAsPrimary={setTenantAsPrimary}
        onRemoveTenant={removeTenant}
        onOpenTenantForm={() => setTenantFormOpen(true)}
        maxOccupancy={formData.maxOccupancy}
        currentTenantCount={tenantData.length}
      />
    )
  };

  return (
    <Paper sx={{ p: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
        {isEdit ? 'Edit Apartment Details' : 'Add New Apartment'}
      </Typography>
      <ApartmentDetailsForm {...formProps} />

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
