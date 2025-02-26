import React, { useState } from 'react';
import { Paper, Typography } from '@mui/material';
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
  const [tenantData,setTenantData]  = useState([])

  const [formData, setFormData] = useState(isEdit ? initialData : emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modelChosen, setModelChosen] = useState(isEdit ? true : false);

  // Handle input changes for the main form fields
  const handleChange = (e,isNumber) => {
    setFormData({ ...formData, [e.target.name]:isNumber?parseInt(e.target.value): e.target.value });
  };

  // Handle changes for tenant fields
  const handleTenantChange = (index, field, value) => {
    setTenantData(prev=>prev.map((tenant,i) => i==index?{...tenant,[field]:value}:tenant))
      };

  // Add a new empty tenant row
  const addTenant = () => {
    setTenantData([
      ...tenantData,
      { name: '', email: '', phone: '' }
    ]);
  };

  // Remove a tenant
  const removeTenant = (index) => {
    setTenantData(prev=>prev.filter((item,i) => i != index))
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    console.log(formData,tenantData)

    try {
      const payload = {new_apartment:formData,new_tenants:tenantData}

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
          tenantData={tenantData}
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

