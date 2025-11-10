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
  Tab,
  LinearProgress
} from '@mui/material';
import {
  DescriptionOutlined as DescriptionIcon,
  SearchOutlined as SearchIcon,
  ApartmentOutlined as ApartmentIcon,
  FileDownloadOutlined as DownloadIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  ListAlt as ListIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
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
    const apartmentsArray = Array.isArray(apartments) ? apartments : [];

    if (!searchQuery) {
      setFilteredApartments(apartmentsArray);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = apartmentsArray.filter(apt =>
      apt && apt.address && apt.address.toLowerCase().includes(query)
    );
    setFilteredApartments(filtered);
  }, [searchQuery, apartments]);

  const fetchApartments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/list');
      const apartmentsData = Array.isArray(response.data) ? response.data : (response.data?.apartments || []);
      setApartments(apartmentsData);
      setFilteredApartments(apartmentsData);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      showNotification('Failed to load apartments', 'error');
      setApartments([]);
      setFilteredApartments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await api.get('/documents/templates');
      const templatesData = Array.isArray(response.data) ? response.data : [];
      setTemplates(templatesData);

      // Find default template
      const defaultTemplate = templatesData.find(t => t.is_default);
      if (defaultTemplate) {
        setDefaultTemplate(defaultTemplate);
        setSelectedTemplate(defaultTemplate.id);
      } else if (templatesData.length > 0) {
        // If no default, set the first template as selected
        setSelectedTemplate(templatesData[0].id);
      } else {
        // No templates available
        setSelectedTemplate('');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      showNotification('Failed to load contract templates', 'error');
      setTemplates([]);
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

    const apartmentsArray = Array.isArray(apartments) ? apartments : [];
    const apartment = apartmentsArray.find(apt => apt.id === selectedApartment);
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
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Create AbortController for request cancellation if needed
      const controller = new AbortController();

      // API call with template selection and better error handling
      const response = await api.post('/documents/createContract', {
        apartmentId: selectedApartment,
        templateId: selectedTemplate
      }, {
        responseType: 'blob', // Important for file download
        timeout: 30000, // 30 second timeout
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Check if response is actually a blob
      if (!(response.data instanceof Blob)) {
        throw new Error('Invalid response format');
      }

      // Check if the blob is empty or too small (likely an error response)
      if (response.data.size < 100) {
        throw new Error('Generated contract file is empty or corrupted');
      }

      // Create a blob from the response data
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // Create a link element and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      // Get apartment details for filename
      const apartmentsArray = Array.isArray(apartments) ? apartments : [];
      const apartment = apartmentsArray.find(apt => apt.id === selectedApartment);
      const fileName = `Rental_Contract_${apartment ? (apartment.address || 'Apartment').replace(/[^a-zA-Z0-9]/g, '_') : 'Apartment'}.docx`;

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);

      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);

      // Handle specific error cases
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        showNotification('Request timed out. Please try again with a smaller file or check your connection.', 'error');
      } else if (error.response?.status === 413) {
        showNotification('File too large. Please reduce the template size and try again.', 'error');
      } else if (error.response?.status === 404) {
        showNotification('Contract template not found. Please select a different template.', 'error');
      } else if (error.response?.status >= 500) {
        showNotification('Server error. Please try again later.', 'error');
      } else if (error.message.includes('Network Error')) {
        showNotification('Network error. Please check your connection and try again.', 'error');
      } else {
        showNotification('Failed to generate contract. Please try again.', 'error');
      }
    } finally {
      setGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const safeFilteredApartments = Array.isArray(filteredApartments) ? filteredApartments : [];
  const safeApartments = Array.isArray(apartments) ? apartments : [];

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
                      <Alert
                        severity="warning"
                        sx={{ mb: 3 }}
                        icon={<WarningIcon />}
                      >
                        No contract templates found. Please add a template first using the "Manage Templates" tab.
                      </Alert>
                    )}

                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      2. Select Property
                    </Typography>
                    <Autocomplete
                      options={safeFilteredApartments}
                      getOptionLabel={(option) => option?.address || ''}
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
                          {safeApartments.find(apt => apt.id === selectedApartment) && (
                            <>
                              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ApartmentIcon sx={{ mr: 1 }} />
                                {safeApartments.find(apt => apt.id === selectedApartment).address}
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
                                    Move-in Date: {safeApartments.find(apt => apt.id === selectedApartment).moveInDate || 'Not specified'}
                                  </Typography>
                                  <Typography variant="body2">
                                    Contract End: {safeApartments.find(apt => apt.id === selectedApartment).contractEndDate || 'Not specified'}
                                  </Typography>
                                  <Typography variant="body2">
                                    Rent: {safeApartments.find(apt => apt.id === selectedApartment).rent || 'Not specified'}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </>
                          )}
                        </Paper>
                      </Box>
                    )}

                    {/* Progress indicator */}
                    {isUploading && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Generating contract... {uploadProgress}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={uploadProgress}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
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

                    {/* Additional info for users */}
                    <Box sx={{ mt: 3 }}>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          <strong>Note:</strong> Contract generation may take a few moments.
                          The file will automatically download when ready.
                        </Typography>
                      </Alert>

                      {templates.length > 0 && (
                        <Alert severity="success">
                          <Typography variant="body2">
                            Using template: <strong>{templates.find(t => t.id === selectedTemplate)?.name || 'Default'}</strong>
                          </Typography>
                        </Alert>
                      )}
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
