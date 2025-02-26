import React, { useState } from 'react';
import { Paper, Typography } from '@mui/material';
import api from '../utils/api';
import ModelSelection from './ModelSelection';
import ApartmentDetailsForm from './ApartmentDetailsForm';

function ApartmentForm({ isEdit = false, initialData = {}, onSuccess, showNotification }) {
  const emptyForm = {
    address: '',
    rooms: '',
    size: '',
    tenants: [{ name: '', email: '', phone: '' }],  // Array for multiple tenants
    landlordName: '',
    landlordEmail: '',
    landlordPhone: '',
    moveInDate: '',
    contractEndDate: '',
    rent: '',
    deposit: '',
    notes: '',
    IBAN: '',
    status: '',
    model: '',
    managementFee: '',
    rentCost: ''
  };

  const [formData, setFormData] = useState(isEdit ? initialData : emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelChosen, setModelChosen] = useState(isEdit ? true : false);

  // Handle input changes for the main form fields
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle changes for tenant fields
  const handleTenantChange = (index, field, value) => {
    const updatedTenants = [...formData.tenants];
    updatedTenants[index][field] = value;
    setFormData({ ...formData, tenants: updatedTenants });
  };

  // Add a new empty tenant row
  const addTenant = () => {
    setFormData({
      ...formData,
      tenants: [...formData.tenants, { name: '', email: '', phone: '' }]
    });
  };

  // Remove a tenant
  const removeTenant = (index) => {
    const updatedTenants = formData.tenants.filter((_, i) => i !== index);
    setFormData({ ...formData, tenants: updatedTenants });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        tenants: JSON.stringify(formData.tenants) // Convert array to JSON before sending
      };

      if (isEdit) {
        await api.put(`/edit/${initialData.id}`, payload);
      } else {
        await api.post('/add', payload);
      }

      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification(`שגיאה: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete apartment
  const handleDelete = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק דירה זו?")) {
      return;
    }
    setIsSubmitting(true);
    try {
      await api.delete(`/delete/${initialData.id}`);
      showNotification("דירה נמחקה בהצלחה", "success");
      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification(`שגיאה במחיקת דירה: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Select management model
  const chooseModel = (modelType) => {
    setFormData({ ...formData, model: modelType });
    setModelChosen(true);
  };

  return (
    <Paper sx={{ p: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
        {isEdit ? 'עריכת פרטי דירה' : 'הוספת דירה חדשה'}
      </Typography>
      {!modelChosen && !isEdit ? (
        <ModelSelection onSelect={chooseModel} />
      ) : (
        <ApartmentDetailsForm
          formData={formData}
          handleChange={handleChange}
          handleTenantChange={handleTenantChange}
          addTenant={addTenant}
          removeTenant={removeTenant}
          handleSubmit={handleSubmit}
          handleDelete={handleDelete}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
        />
      )}
    </Paper>
  );
}

export default ApartmentForm;

