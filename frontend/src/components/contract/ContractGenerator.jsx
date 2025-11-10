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
  ListAlt as ListIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import ContractTemplatesManager from './ContractTemplatesManager';

function ContractGenerator({ showNotification }) {
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (tabValue === 0) {
      fetchTemplates();
    }
  }, [tabValue]);

  useEffect(() => {
    const searchApartments = async () => {
      if (!searchQuery || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await api.get('/list');
        const apartmentsData = Array.isArray(response.data) ? response.data : (response.data?.apartments || []);

        const query = searchQuery.toLowerCase();
        const filtered = apartmentsData.filter(apt =>
          apt && apt.address && apt.address.toLowerCase().includes(query)
        );

        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching apartments:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchApartments();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await api.get('/documents/templates');
      const templatesData = Array.isArray(response.data) ? response.data : [];
      setTemplates(templatesData);

      const defaultTemplate = templatesData.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id);
      } else if (templatesData.length > 0) {
        setSelectedTemplate(templatesData[0].id);
      } else {
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

  useEffect(() => {
    if (!selectedApartment) {
      setTenants([]);
      return;
    }

    if (Array.isArray(selectedApartment.tenants)) {
      setTenants(selectedApartment.tenants);
    } else if (typeof selectedApartment.tenants === 'string') {
      const tenantNames = selectedApartment.tenants.split(',').map(name => name.trim()).filter(name => name);
      setTenants(tenantNames.map(name => ({ name })));
    } else {
      setTenants([]);
    }
  }, [selectedApartment]);

  const handleApartmentChange = (event, newValue) => {
    setSelectedApartment(newValue);
  };

  const handleTemplateChange = (event) => {
    setSelectedTemplate(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefreshTemplates = () => {
    fetchTemplates();
    showNotification('Templates refreshed', 'success');
  };

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
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.post('/documents/createContract', {
        apartmentId: selectedApartment.id,
        templateId: selectedTemplate
      }, {
        responseType: 'blob',
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!(response.data instanceof Blob)) {
        throw new Error('Invalid response format');
      }

      if (response.data.size < 100) {
        throw new Error('Generated contract file is empty or corrupted');
      }

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `Rental_Contract_${selectedApartment.address.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);

      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);

      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        showNotification('Request timed out. Please try again.', 'error');
      } else if (error.response?.status === 413) {
        showNotification('File too large. Please try again.', 'error');
      } else if (error.response?.status === 404) {
        showNotification('Contract template not found.', 'error');
      } else if (error.response?.status >= 500) {
        showNotification('Server error. Please try again later.', 'error');
      } else if (error.message.includes('Network Error')) {
        showNotification('Network error. Please check your connection.', 'error');
      } else {
        showNotification('Failed to generate contract.', 'error');
      }
    } finally {
      setGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
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
                    2. Search and Select Property
                  </Typography>
                  <Autocomplete
                    options={searchResults}
                    loading={searchLoading}
                    getOptionLabel={(option) => option?.address || ''}
                    onChange={handleApartmentChange}
                    value={selectedApartment}
                    getOptionKey={(option) => option?.id || Math.random()}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    noOptionsText={searchQuery.length < 2 ? "Type at least 2 characters to search" : "No apartments found"}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search Apartments"
                        variant="outlined"
                        fullWidth
                        placeholder="Type to search by address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <SearchIcon color="action" sx={{ mr: 1 }} />
                              {params.InputProps.startAdornment}
                            </>
                          ),
                          endAdornment: (
                            <>
                              {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
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
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <ApartmentIcon sx={{ mr: 1 }} />
                          {selectedApartment.address}
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
                                    key={`tenant-${selectedApartment.id}-${index}`}
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
                              Move-in Date: {selectedApartment.moveInDate || 'Not specified'}
                            </Typography>
                            <Typography variant="body2">
                              Contract End: {selectedApartment.contractEndDate || 'Not specified'}
                            </Typography>
                            <Typography variant="body2">
                              Rent: {selectedApartment.rent || 'Not specified'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Box>
                  )}

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

                  <Box sx={{ mt: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Note:</strong> Contract generation may take a few moments.
                        The file will automatically download when ready.
                      </Typography>
                    </Alert>

                    {templates.length > 0 && selectedTemplate && (
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
