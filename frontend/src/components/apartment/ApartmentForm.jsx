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
    address: '',
    rooms: 0,
    size: 0,
    landlord_id: null,
    moveInDate: '',
    contractEndDate: '',
    rent: 0,
    deposit: 0,
    notes: '',
    status: APARTMENT_STATUS.VACANT,
    model: PROPERTY_MODELS.MANAGEMENT,
    managementFee: 0,
    rentCost: 0
  };

  const [tenantData, setTenantData] = useState([]);

  // Clean initial data
  const cleanedInitialData = isEdit ? {
    ...initialData,
    status: Object.values(APARTMENT_STATUS).includes(initialData.status)
      ? initialData.status
      : APARTMENT_STATUS.VACANT,
    landlord_id: initialData.landlord?.id || initialData.landlord_id
  } : emptyForm;

  // Remove any invalid fields
  if (cleanedInitialData.rentInSentance) {
    delete cleanedInitialData.rentInSentance;
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
            lastName: tenant.lastName || lastName,
            isCurrentTenant: isEdit && initialData.id && tenant.apartment_id === initialData.id
          };
        });

        setAvailableTenants(processedTenants);
        setLoading(false);

        // If editing, find current tenants for this apartment
        if (isEdit && initialData.id) {
          const currentTenants = processedTenants.filter(t => t.apartment_id === initialData.id);

          if (currentTenants.length > 0 && tenantData.length === 0) {
            const tenantsWithPrimary = currentTenants.map((tenant, index) => ({
              ...tenant,
              isPrimary: index === 0
            }));

            setTenantData(tenantsWithPrimary);
            const tenantIdSet = new Set(tenantsWithPrimary.map(t => t.id).filter(Boolean));
            setAddedTenantIds(tenantIdSet);
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

  // Initialize tenant data from current contract if editing
  useEffect(() => {
    if (isEdit && initialData) {
      let tenantsToProcess = [];

      // Try to get tenants from current_contract first
      if (initialData.current_contract?.tenants) {
        tenantsToProcess = initialData.current_contract.tenants.map(ct => ct.tenant).filter(Boolean);
      }
      // Fallback to legacy tenants array
      else if (initialData.tenants) {
        if (typeof initialData.tenants === 'string') {
          const tenantNames = initialData.tenants.split(',').map(name => name.trim()).filter(name => name);
          tenantsToProcess = tenantNames.map((name, index) => {
            const existingTenant = availableTenants.find(t =>
              t.name === name ||
              (t.firstName && t.lastName && `${t.firstName} ${t.lastName}` === name) ||
              (initialData.id && t.apartment_id === initialData.id)
            );

            if (existingTenant) {
              return { ...existingTenant, isPrimary: index === 0 };
            } else {
              const nameParts = name.split(' ');
              return {
                id: `temp-${index}`,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                name,
                email: '',
                phone: '',
                isPrimary: index === 0
              };
            }
          });
        } else if (Array.isArray(initialData.tenants)) {
          tenantsToProcess = initialData.tenants.map((tenant, index) => ({
            ...tenant,
            firstName: tenant.firstName || (tenant.name ? tenant.name.split(' ')[0] : ''),
            lastName: tenant.lastName || (tenant.name ? tenant.name.split(' ').slice(1).join(' ') : ''),
            isPrimary: tenant.isPrimary === undefined ? index === 0 : tenant.isPrimary
          }));
        }
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
      if (!formData.address) {
        showNotification('Address is required', 'error');
        setIsSubmitting(false);
        return;
      }

      const cleanedFormData = { ...formData };
      delete cleanedFormData.rentInSentance;

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
