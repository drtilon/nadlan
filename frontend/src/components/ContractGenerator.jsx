// components/ContractGenerator.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
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
  Autocomplete,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import {
  DescriptionOutlined as DescriptionIcon,
  SearchOutlined as SearchIcon,
  ApartmentOutlined as ApartmentIcon,
  FileDownloadOutlined as DownloadIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  ListAlt as ListIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ContractTemplatesManager from './ContractTemplatesManager';

function ContractGenerator({ showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('');
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [defaultTemplate, setDefaultTemplate] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch apartments and templates when component mounts
  useEffect(() => {
    fetchApartments();
    fetchTemplates();
  }, []);

  // Refresh templates when switching back to the Generate Contract tab
  useEffect(() => {
    if (tabValue === 0) {
      fetchTemplates();
    }
  }, [tabValue]);

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
      showNotification('Failed to load apartments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await api.get('/documents/templates');
      setTemplates(response.data || []);

      // Find default template
      const defaultTemplate = response.data.find(t => t.is_default);
      if (defaultTemplate) {
        setDefaultTemplate(defaultTemplate);
        setSelectedTemplate(defaultTemplate.id);
      } else if (response.data.length > 0) {
        // If no default, set the first template as selected
        setSelectedTemplate(response.data[0].id);
      } else {
        // No templates available
        setSelectedTemplate('');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      showNotification('Failed to load contract templates', 'error');
    } finally {
      setTemplatesLoading(false);
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

  const handleTemplateChange = (event) => {
    setSelectedTemplate(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Function to handle template refresh
  const handleRefreshTemplates = () => {
    fetchTemplates();
    showNotification('Templates refreshed', 'success');
  };

  // Callback function for when templates are updated in ContractTemplatesManager
  const handleTemplatesUpdated = () => {
    fetchTemplates();
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

    if (!selectedTemplate && templates.length > 0) {
      showNotification('Please select a contract template', 'error');
      return;
    }

    setGenerating(true);
    try {
      // API call with template selection
      const response = await api.post('/documents/createContract', {
        apartmentId: selectedApartment,
        templateId: selectedTemplate
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
    <>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="contract management tabs">
            <Tab
              icon={<DescriptionIcon />}
              iconPosition="start"
              label="Generate Contract"
              id="tab-0"
            />
            <Tab
              icon={<SettingsIcon />}
              iconPosition="start"
              label="Manage Templates"
              id="tab-1"
            />
            <Tab
              icon={<ListIcon />}
              iconPosition="start"
              label="Contract Manager"
              id="tab-2"
              onClick={() => navigate('/contracts/manage')}
            />
          </Tabs>
        </Box>

        {tabValue === 0 ? (
          <>
            <Box display="flex" alignItems="center" mb={3}>
              <DescriptionIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
              <Typography variant="h5" component="h2">
                Generate Contract
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
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        1. Select Contract Template
                      </Typography>
                      <Tooltip title="Refresh Templates">
                        <IconButton
                          size="small"
                          onClick={handleRefreshTemplates}
                          disabled={templatesLoading}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
                      <InputLabel id="template-select-label">Contract Template</InputLabel>
                      <Select
                        labelId="template-select-label"
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                        label="Contract Template"
                        disabled={templates.length === 0 || templatesLoading}
                      >
                        {templatesLoading ? (
                          <MenuItem value="">
                            <em>Loading templates...</em>
                          </MenuItem>
                        ) : templates.length === 0 ? (
                          <MenuItem value="">
                            <em>No templates available</em>
                          </MenuItem>
                        ) : (
                          templates.map((template) => (
                            <MenuItem key={template.id} value={template.id}>
                              {template.name}
                              {template.is_default && (
                                <Chip
                                  label="Default"
                                  color="success"
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>

                    {templates.length === 0 && !templatesLoading && (
                      <Alert severity="info" sx={{ mb: 3 }}>
                        No contract templates found. Please add a template first using the "Manage Templates" tab.
                      </Alert>
                    )}

                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      2. Select Property
                    </Typography>
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
                      sx={{ mb: 3 }}
                    />

                    {selectedApartment && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                          3. Review Details
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          {apartments.find(apt => apt.id === selectedApartment) && (
                            <>
                              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ApartmentIcon sx={{ mr: 1 }} />
                                {apartments.find(apt => apt.id === selectedApartment).address}
                              </Typography>

                              <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Tenants:
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {tenants.length > 0 ? (
                                      tenants.map((tenant, index) => (
                                        <Chip
                                          key={index}
                                          label={tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant}
                                          size="small"
                                          variant="outlined"
                                        />
                                      ))
                                    ) : (
                                      <Typography color="error">
                                        No tenants assigned to this apartment
                                      </Typography>
                                    )}
                                  </Box>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Contract Details:
                                  </Typography>
                                  <Typography variant="body2">
                                    Move-in Date: {apartments.find(apt => apt.id === selectedApartment).moveInDate || 'Not specified'}
                                  </Typography>
                                  <Typography variant="body2">
                                    Contract End: {apartments.find(apt => apt.id === selectedApartment).contractEndDate || 'Not specified'}
                                  </Typography>
                                  <Typography variant="body2">
                                    Rent: {apartments.find(apt => apt.id === selectedApartment).rent || 'Not specified'}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </>
                          )}
                        </Paper>
                      </Box>
                    )}

                    <Box display="flex" justifyContent="center" mt={4}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={generating ? <CircularProgress size={24} color="inherit" /> : <DownloadIcon />}
                        onClick={generateContract}
                        disabled={
                          generating ||
                          !selectedApartment ||
                          tenants.length === 0 ||
                          (templates.length > 0 && !selectedTemplate) ||
                          templatesLoading
                        }
                        sx={{ minWidth: 250 }}
                      >
                        {generating ? 'Generating...' : 'Generate Contract'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </>
        ) : tabValue === 1 ? (
          <ContractTemplatesManager
            showNotification={showNotification}
            onTemplatesUpdated={handleTemplatesUpdated}
          />
        ) : null}
      </Paper>
    </>
  );
}

export default ContractGenerator;
