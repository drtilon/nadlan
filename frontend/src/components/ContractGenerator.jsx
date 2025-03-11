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
  Chip,
  Autocomplete
} from '@mui/material';
import {
  DescriptionOutlined as DescriptionIcon,
  SearchOutlined as SearchIcon,
  ApartmentOutlined as ApartmentIcon,
  FileDownloadOutlined as DownloadIcon
} from '@mui/icons-material';
import api from '../utils/api';

function ContractGenerator({ showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('');
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApartments, setFilteredApartments] = useState([]);

  // Fetch apartments when component mounts
  useEffect(() => {
    fetchApartments();
  }, []);

  // Filter apartments based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredApartments(apartments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = apartments.filter(apt => 
      apt.address.toLowerCase().includes(query)
    );
    setFilteredApartments(filtered);
  }, [searchQuery, apartments]);

  const fetchApartments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/list');
      setApartments(response.data || []);
      setFilteredApartments(response.data || []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      if (error.response && error.response.status === 401) {
        showNotification('Your session has expired. Please log in again.', 'error');
      } else {
        showNotification('Failed to load apartments', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Update tenant information when an apartment is selected
  useEffect(() => {
    if (!selectedApartment) {
      setTenants([]);
      return;
    }

    const apartment = apartments.find(apt => apt.id === selectedApartment);
    if (apartment) {
      // Handle different tenant data formats
      if (Array.isArray(apartment.tenants)) {
        setTenants(apartment.tenants);
      } else if (typeof apartment.tenants === 'string') {
        const tenantNames = apartment.tenants.split(',').map(name => name.trim()).filter(name => name);
        setTenants(tenantNames.map(name => ({ name })));
      } else {
        setTenants([]);
      }
    }
  }, [selectedApartment, apartments]);

  const handleApartmentChange = (event, newValue) => {
    if (newValue) {
      setSelectedApartment(newValue.id);
    } else {
      setSelectedApartment('');
    }
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
      // Simplified API call - only requires apartmentId
      const response = await api.post('/documents/createContract', {
        apartmentId: selectedApartment
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
            <Grid item xs={12}>
              <Autocomplete
                options={filteredApartments}
                getOptionLabel={(option) => option.address}
                onChange={handleApartmentChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Apartments"
                    variant="outlined"
                    fullWidth
                    placeholder="Type to search by address"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <SearchIcon color="action" sx={{ mr: 1 }} />
                          {params.InputProps.startAdornment}
                        </>
                      )
                    }}
                  />
                )}
              />
            </Grid>

            {selectedApartment && (
              <>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Selected Apartment Details
                    </Typography>
                    
                    {apartments.find(apt => apt.id === selectedApartment) && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="h6">
                          <ApartmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          {apartments.find(apt => apt.id === selectedApartment).address}
                        </Typography>
                        
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Tenants on Contract:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            {tenants.length > 0 ? (
                              tenants.map((tenant, index) => (
                                <Chip
                                  key={index}
                                  label={tenant.name || (tenant.firstName && tenant.lastName ? `${tenant.firstName} ${tenant.lastName}` : tenant)}
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
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box display="flex" justifyContent="center" mt={2}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={generateContract}
                  disabled={!selectedApartment || tenants.length === 0 || generating}
                  startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
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
