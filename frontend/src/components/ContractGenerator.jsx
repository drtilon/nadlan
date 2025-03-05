// components/ContractGenerator.jsx
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import api from '../utils/api';

function ContractGenerator({ showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('');
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contractSettings, setContractSettings] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    rentAmount: '',
    securityDeposit: '',
    specialTerms: ''
  });

  // Fetch apartments when component mounts
  useEffect(() => {
    const fetchApartments = async () => {
      setLoading(true);

      // Check for token before making the request
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        showNotification('Authentication required. Please log in again.', 'error');
        setLoading(false);
        return;
      }

      try {
        // Using the /list endpoint consistent with ApartmentList component
        const response = await api.get('/list');
        setApartments(response.data || []);
      } catch (error) {
        console.error('Error fetching apartments:', error);

        // If we get a 401, the token might be expired or invalid
        if (error.response && error.response.status === 401) {
          showNotification('Your session has expired. Please log in again.', 'error');
        } else {
          showNotification('Failed to load apartments', 'error');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApartments();
  }, [showNotification]);

  // Extract tenants and update settings from apartment data when an apartment is selected
  useEffect(() => {
    if (!selectedApartment) {
      setTenants([]);
      return;
    }

    try {
      const apartment = apartments.find(apt => apt.id === selectedApartment);

      if (apartment) {
        // Handle different tenant data structures
        let extractedTenants = [];

        if (apartment.tenants) {
          if (Array.isArray(apartment.tenants)) {
            // If tenants is already an array of objects
            extractedTenants = apartment.tenants.map(tenant => ({
              id: tenant.id || `tenant-${Math.random().toString(36).substr(2, 9)}`,
              name: tenant.firstName && tenant.lastName
                ? `${tenant.firstName} ${tenant.lastName}`
                : tenant.name || 'Unnamed Tenant',
              email: tenant.email || ''
            }));
          } else if (typeof apartment.tenants === 'string') {
            // If tenants is a comma-separated string
            extractedTenants = apartment.tenants.split(',').map((name, index) => ({
              id: `tenant-${index}`,
              name: name.trim(),
              email: ''
            }));
          }
        }

        setTenants(extractedTenants);

        // Update contract settings based on selected apartment data
        setContractSettings(prev => {
          // Get move-in date from apartment if available
          const moveInDate = apartment.moveInDate ? new Date(apartment.moveInDate) : prev.startDate;

          // Get contract end date from apartment if available
          const contractEndDate = apartment.contractEndDate ? new Date(apartment.contractEndDate) : prev.endDate;

          return {
            ...prev,
            startDate: moveInDate,
            endDate: contractEndDate,
            rentAmount: apartment.rent || apartment.rentAmount || '',
            securityDeposit: apartment.securityDeposit || apartment.rent || apartment.rentAmount || ''
          };
        });
      }
    } catch (error) {
      console.error('Error processing apartment data:', error);
      showNotification('Failed to process apartment data', 'error');
    }
  }, [selectedApartment, apartments, showNotification]);

  const handleApartmentChange = (event) => {
    setSelectedApartment(event.target.value);
  };

  const handleSettingsChange = (field) => (event) => {
    setContractSettings({
      ...contractSettings,
      [field]: event.target.value
    });
  };

  const handleDateChange = (field, newDate) => {
    setContractSettings({
      ...contractSettings,
      [field]: newDate
    });
  };

  const generateContract = async () => {
    if (!selectedApartment) {
      showNotification('Please select an apartment', 'error');
      return;
    }

    if (tenants.length === 0) {
      showNotification('The selected apartment has no tenants', 'error');
      return;
    }

    setGenerating(true);
    try {
      // Get all tenant IDs for the selected apartment
      const tenantIds = tenants.map(tenant => tenant.id);

      const response = await api.post('/documents/createContract', {
        apartmentId: selectedApartment,
        tenantIds: tenantIds, // Send all tenant IDs instead of just one
        contractDetails: {
          startDate: contractSettings.startDate,
          endDate: contractSettings.endDate,
          rentAmount: parseFloat(contractSettings.rentAmount) || 0,
          securityDeposit: parseFloat(contractSettings.securityDeposit) || 0,
          specialTerms: contractSettings.specialTerms
        }
      }, {
        responseType: 'blob' // Important for file download
      });

      // Create a blob from the response data
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Create a link element and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      // Get apartment details for filename
      const apartment = apartments.find(apt => apt.id === selectedApartment);
      const fileName = `Rental_Contract_${apartment ? (apartment.address || 'Apartment') : 'Apartment'}.docx`;

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);
      showNotification('Failed to generate contract', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <DescriptionIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
        <Typography variant="h5" component="h2">
          Rental Contract Generator
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="apartment-select-label">Select Apartment</InputLabel>
                <Select
                  labelId="apartment-select-label"
                  id="apartment-select"
                  value={selectedApartment}
                  label="Select Apartment"
                  onChange={handleApartmentChange}
                >
                  {apartments.map((apartment) => (
                    <MenuItem key={apartment.id} value={apartment.id}>
                      {apartment.address}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" fontWeight="medium">
                  Tenants on Contract:
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {tenants.length > 0 ? (
                    tenants.map((tenant, index) => (
                      <Chip
                        key={tenant.id}
                        label={tenant.name}
                        sx={{ m: 0.5 }}
                        color="primary"
                        variant="outlined"
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No tenants associated with this apartment
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {selectedApartment && tenants.length > 0 && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Contract Details
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lease Start Date"
                    type="date"
                    value={contractSettings.startDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      handleDateChange('startDate', newDate);
                    }}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Lease End Date"
                    type="date"
                    value={contractSettings.endDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      handleDateChange('endDate', newDate);
                    }}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Monthly Rent"
                    type="number"
                    value={contractSettings.rentAmount}
                    onChange={handleSettingsChange('rentAmount')}
                    InputProps={{
                      startAdornment: <Box component="span" mr={1}>€</Box>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Security Deposit"
                    type="number"
                    value={contractSettings.securityDeposit}
                    onChange={handleSettingsChange('securityDeposit')}
                    InputProps={{
                      startAdornment: <Box component="span" mr={1}>€</Box>,
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Special Terms (Optional)"
                    multiline
                    rows={4}
                    value={contractSettings.specialTerms}
                    onChange={handleSettingsChange('specialTerms')}
                    placeholder="Enter any special terms or conditions for this lease agreement..."
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" mt={2}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={generateContract}
                  disabled={!selectedApartment || tenants.length === 0 || generating}
                  startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <DescriptionIcon />}
                >
                  {generating ? 'Generating...' : 'Generate Contract'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {!loading && (!apartments.length || (selectedApartment && !tenants.length)) && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {!apartments.length
            ? 'No apartments available. Please add apartments first.'
            : 'No tenants associated with this apartment. Please add tenants first.'}
        </Alert>
      )}
    </Paper>
  );
}

export default ContractGenerator;
