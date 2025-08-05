import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Tabs,
  Tab,
  Autocomplete,
  Checkbox,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Avatar,
  Stack,
  Collapse,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  Event as EventIcon,
  AttachMoney as MoneyIcon,
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Group as GroupIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const CONTRACT_STATUSES = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'terminated', label: 'Terminated', color: 'error' },
  { value: 'pending', label: 'Pending', color: 'warning' }
];

const TabPanel = React.memo(({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
  </div>
));

function ContractManagementDialog({
  open,
  onClose,
  apartment,
  showNotification,
  onContractChange,
  onGoToTenant
}) {
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editingContract, setEditingContract] = useState(null);
  const [expandedContracts, setExpandedContracts] = useState(new Set());

  const [contractForm, setContractForm] = useState({
    contract_number: '',
    start_date: '',
    end_date: '',
    monthly_rent: '',
    security_deposit: '',
    status: 'active',
    notes: '',
    tenant_ids: []
  });

  // Debug re-renders
  useEffect(() => {
    console.log('ContractManagementDialog re-rendered');
  });

  useEffect(() => {
    if (open && apartment) {
      fetchContracts();
      fetchTenants();
      resetForm();
    }
  }, [open, apartment]);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/apartments/${apartment.id}/contracts`);
      setContracts(response.data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      showNotification('Error loading contracts', 'error');
    } finally {
      setLoading(false);
    }
  }, [apartment, showNotification]);

  const fetchTenants = useCallback(async () => {
    try {
      const response = await api.get('/tenants/list');
      console.log('Tenants fetched:', response.data);
      setTenants(response.data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      showNotification('Error loading tenants', 'error');
    }
  }, [showNotification]);

  const resetForm = useCallback(() => {
    setContractForm({
      contract_number: '',
      start_date: '',
      end_date: '',
      monthly_rent: apartment?.rent?.toString() || '',
      security_deposit: apartment?.deposit?.toString() || '',
      status: 'active',
      notes: '',
      tenant_ids: []
    });
    setEditingContract(null);
  }, [apartment]);

  const handleContractNumberChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, contract_number: e.target.value }));
  }, []);

  const handleStatusChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, status: e.target.value }));
  }, []);

  const handleStartDateChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, start_date: e.target.value }));
  }, []);

  const handleEndDateChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, end_date: e.target.value }));
  }, []);

  const handleMonthlyRentChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, monthly_rent: e.target.value }));
  }, []);

  const handleSecurityDepositChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, security_deposit: e.target.value }));
  }, []);

  const handleNotesChange = useCallback((e) => {
    setContractForm(prev => ({ ...prev, notes: e.target.value }));
  }, []);

  const handleTenantIdsChange = useCallback((event, newValue) => {
    setContractForm(prev => ({ ...prev, tenant_ids: newValue.map(tenant => tenant.id) }));
  }, []);

  const loadFromApartment = useCallback(() => {
    if (!apartment) {
      showNotification('No apartment data available', 'error');
      return;
    }

    const apartmentTenantIds = apartment.tenants ? apartment.tenants.map(tenant => tenant.id) : [];
    const currentDate = new Date();
    const contractNumber = `APT${apartment.id}-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    const loadedForm = {
      contract_number: contractNumber,
      start_date: apartment.moveInDate || currentDate.toISOString().split('T')[0],
      end_date: apartment.contractEndDate || '',
      monthly_rent: apartment.rent?.toString() || '',
      security_deposit: apartment.deposit?.toString() || '',
      status: 'active',
      notes: apartment.notes || '',
      tenant_ids: apartmentTenantIds
    };

    setContractForm(loadedForm);
    showNotification(
      `Loaded data from apartment: ${apartmentTenantIds.length} tenants, rent €${apartment.rent || 0}`,
      'success'
    );
  }, [apartment, showNotification]);

  const handleCreateContract = useCallback(async () => {
    if (!contractForm.contract_number || !contractForm.start_date || !contractForm.monthly_rent) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        apartment_id: apartment.id,
        ...contractForm,
        monthly_rent: parseFloat(contractForm.monthly_rent),
        security_deposit: parseFloat(contractForm.security_deposit || 0)
      };

      if (editingContract) {
        await api.put(`/contracts/${editingContract.id}`, payload);
        showNotification('Contract updated successfully', 'success');
      } else {
        await api.post('/contracts', payload);
        showNotification('Contract created successfully', 'success');
      }

      await fetchContracts();
      resetForm();
      setTabValue(0);
      onContractChange?.();
    } catch (error) {
      console.error('Error saving contract:', error);
      const errorMessage = error.response?.data?.message || 'Error saving contract';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [apartment, contractForm, editingContract, showNotification, onContractChange, resetForm, fetchContracts]);

  const handleEditContract = useCallback((contract) => {
    setEditingContract(contract);
    setContractForm({
      contract_number: contract.contract_number || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      monthly_rent: contract.monthly_rent?.toString() || '',
      security_deposit: contract.security_deposit?.toString() || '',
      status: contract.status || 'active',
      notes: contract.notes || '',
      tenant_ids: contract.tenants?.map(t => t.tenant_id) || []
    });
    setTabValue(1);
  }, []);

  const handleDeleteContract = useCallback(async (contractId) => {
    if (!window.confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/contracts/${contractId}`);
      showNotification('Contract deleted successfully', 'success');
      await fetchContracts();
      onContractChange?.();
    } catch (error) {
      console.error('Error deleting contract:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting contract';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, onContractChange, fetchContracts]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }, []);

  const getStatusChip = useCallback((status) => {
    const statusConfig = CONTRACT_STATUSES.find(s => s.value === status) || CONTRACT_STATUSES[0];
    return (
      <Chip
        label={statusConfig.label}
        color={statusConfig.color}
        size="small"
        variant="outlined"
      />
    );
  }, []);

  const toggleContractExpansion = useCallback((contractId) => {
    setExpandedContracts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractId)) {
        newSet.delete(contractId);
      } else {
        newSet.add(contractId);
      }
      return newSet;
    });
  }, []);

  const handleTenantClick = useCallback((contractTenant) => {
    if (onGoToTenant && contractTenant.tenant) {
      onClose();
      onGoToTenant(contractTenant.tenant.id);
    }
  }, [onClose, onGoToTenant]);

  const renderTenantsSection = useCallback((tenants) => {
    if (!tenants || tenants.length === 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            No tenants assigned
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <GroupIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" color="primary">
            Tenants ({tenants.length})
          </Typography>
        </Box>
        <Stack spacing={1}>
          {tenants.map((contractTenant) => (
            <Paper
              key={contractTenant.id}
              elevation={1}
              sx={{
                p: 2,
                backgroundColor: contractTenant.is_primary ? 'primary.50' : 'grey.50',
                border: contractTenant.is_primary ? '1px solid' : 'none',
                borderColor: contractTenant.is_primary ? 'primary.200' : 'transparent',
                cursor: onGoToTenant ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': onGoToTenant ? {
                  boxShadow: 2,
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)'
                } : {}
              }}
              onClick={() => handleTenantClick(contractTenant)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: contractTenant.is_primary ? 'primary.main' : 'grey.400' }}>
                    {contractTenant.is_primary ? <StarIcon /> : <PersonIcon />}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {contractTenant.tenant?.name || 'Unknown Tenant'}
                      {contractTenant.is_primary && (
                        <Chip
                          label="Primary"
                          size="small"
                          color="primary"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {contractTenant.tenant?.email || 'No email'}
                    </Typography>
                    {contractTenant.tenant?.phone && (
                      <Typography variant="body2" color="text.secondary">
                        📞 {contractTenant.tenant.phone}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight="medium">
                    {contractTenant.rent_share_percentage}% share
                  </Typography>
                  {contractTenant.move_in_date && (
                    <Typography variant="caption" color="text.secondary">
                      Moved in: {formatDate(contractTenant.move_in_date)}
                    </Typography>
                  )}
                  {contractTenant.move_out_date && (
                    <Typography variant="caption" color="error">
                      Moved out: {formatDate(contractTenant.move_out_date)}
                    </Typography>
                  )}
                </Box>
              </Box>

              {contractTenant.notes && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Note: {contractTenant.notes}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      </Box>
    );
  }, [formatDate, onGoToTenant]);

  const tenantOptions = useMemo(() => tenants, [tenants]);
  const selectedTenants = useMemo(() => tenants.filter(tenant => contractForm.tenant_ids.includes(tenant.id)), [tenants, contractForm.tenant_ids]);

  const renderAutocompleteInput = useCallback((params) => {
    console.log('Autocomplete renderInput called');
    return (
      <TextField
        {...params}
        label="Assign Tenants"
        placeholder="Select tenants for this contract"
        helperText="Choose which tenants will be part of this contract period"
        inputProps={{ ...params.inputProps, 'data-testid': 'tenant-autocomplete-input' }}
      />
    );
  }, []);

  const renderAutocompleteOption = useCallback((props, tenant, { selected }) => {
    console.log('Autocomplete renderOption called for tenant:', tenant.id);
    return (
      <li {...props} key={tenant.id}>
        <Checkbox
          checked={selected}
          style={{ marginRight: 8 }}
        />
        <ListItemText
          primary={tenant.name}
          secondary={tenant.email || tenant.phone || 'No contact info'}
        />
      </li>
    );
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '900px'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon />
          <Typography variant="h6">
            Contract Management - {apartment?.address}
          </Typography>
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab
            label={`Contracts (${contracts.length})`}
            icon={<HistoryIcon />}
            iconPosition="start"
          />
          <Tab
            label={editingContract ? "Edit Contract" : "New Contract"}
            icon={editingContract ? <EditIcon /> : <AddIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ height: '500px', overflow: 'auto' }}>
            {contracts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <DescriptionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Contract Periods Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first contract period to start managing tenant assignments and rental terms.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setTabValue(1)}
                >
                  Create First Contract
                </Button>
              </Box>
            ) : (
              <List sx={{ p: 1 }}>
                {contracts.map((contract) => (
                  <React.Fragment key={contract.id}>
                    <Card
                      elevation={2}
                      sx={{
                        mb: 2,
                        border: contract.is_current ? '2px solid' : '1px solid',
                        borderColor: contract.is_current ? 'success.main' : 'divider'
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {contract.contract_number}
                              {contract.is_current && (
                                <Chip
                                  label="Current"
                                  color="success"
                                  size="small"
                                  variant="filled"
                                />
                              )}
                              {getStatusChip(contract.status)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Contract ID: {contract.id}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => toggleContractExpansion(contract.id)}
                              color="primary"
                            >
                              {expandedContracts.has(contract.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleEditContract(contract)}
                              color="primary"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteContract(contract.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>

                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <EventIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Duration
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatDate(contract.start_date)} - {formatDate(contract.end_date) || 'Ongoing'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ({contract.duration_days || 0} days)
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <MoneyIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Monthly Rent
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatCurrency(contract.monthly_rent)}
                                </Typography>
                                {contract.security_deposit > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    Deposit: {formatCurrency(contract.security_deposit)}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <GroupIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Tenants
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {contract.tenants?.length || 0} assigned
                                </Typography>
                                {contract.tenants?.length > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    Primary: {contract.tenants.find(t => t.is_primary)?.tenant?.name || 'None'}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} sm={6} md={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <DescriptionIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Created
                                </Typography>
                                <Typography variant="body2" fontWeight="medium">
                                  {formatDate(contract.created_at)}
                                </Typography>
                                {contract.created_by && (
                                  <Typography variant="caption" color="text.secondary">
                                    by {contract.created_by}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>

                        {contract.tenants && contract.tenants.length > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Tenants:
                              </Typography>
                              {contract.tenants.slice(0, 3).map((ct) => (
                                <Chip
                                  key={ct.id}
                                  label={ct.tenant?.name || 'Unknown'}
                                  size="small"
                                  variant={ct.is_primary ? "filled" : "outlined"}
                                  color={ct.is_primary ? "primary" : "default"}
                                  icon={ct.is_primary ? <StarIcon /> : <PersonIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTenantClick(ct);
                                  }}
                                  sx={{
                                    cursor: onGoToTenant ? 'pointer' : 'default',
                                    '&:hover': onGoToTenant ? {
                                      backgroundColor: ct.is_primary ? 'primary.700' : 'grey.300'
                                    } : {}
                                  }}
                                />
                              ))}
                              {contract.tenants.length > 3 && (
                                <Chip
                                  label={`+${contract.tenants.length - 3} more`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                              )}
                            </Box>
                          </Box>
                        )}

                        {contract.notes && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              "{contract.notes.length > 100 ? contract.notes.substring(0, 100) + '...' : contract.notes}"
                            </Typography>
                          </Box>
                        )}

                        <Collapse in={expandedContracts.has(contract.id)}>
                          <Divider sx={{ my: 2 }} />
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                              Detailed Information
                            </Typography>

                            <Box sx={{ mb: 3 }}>
                              {renderTenantsSection(contract.tenants)}
                            </Box>

                            {contract.notes && (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Contract Notes
                                </Typography>
                                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                                  <Typography variant="body2">
                                    {contract.notes}
                                  </Typography>
                                </Paper>
                              </Box>
                            )}

                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Financial Details
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Monthly Rent:</strong> {formatCurrency(contract.monthly_rent)}
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Security Deposit:</strong> {formatCurrency(contract.security_deposit)}
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Status:</strong> {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                                  </Typography>
                                </Paper>
                              </Grid>

                              <Grid item xs={12} md={6}>
                                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Timeline
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Start Date:</strong> {formatDate(contract.start_date)}
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>End Date:</strong> {formatDate(contract.end_date) || 'Open-ended'}
                                  </Typography>
                                  <Typography variant="body2">
                                    <strong>Duration:</strong> {contract.duration_days || 0} days
                                  </Typography>
                                  {contract.updated_at !== contract.created_at && (
                                    <Typography variant="body2">
                                      <strong>Last Updated:</strong> {formatDate(contract.updated_at)}
                                    </Typography>
                                  )}
                                </Paper>
                              </Grid>
                            </Grid>
                          </Box>
                        </Collapse>
                      </CardContent>
                    </Card>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ height: '500px', overflow: 'auto', p: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert
                  severity={editingContract ? "info" : "success"}
                  sx={{ mb: 2 }}
                >
                  {editingContract
                    ? `Editing contract: ${editingContract.contract_number}`
                    : 'Create a new contract period for this apartment'
                  }
                </Alert>
              </Grid>

              {!editingContract && (
                <Grid item xs={12}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'info.50',
                      border: '1px solid',
                      borderColor: 'info.200'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" color="info.main" gutterBottom>
                          Quick Setup
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Load apartment data: {apartment?.tenants?.length || 0} tenants, rent €{apartment?.rent || 0}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        color="info"
                        startIcon={<DownloadIcon />}
                        onClick={loadFromApartment}
                        disabled={!apartment}
                      >
                        Load from Apartment
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contract Number *"
                  value={contractForm.contract_number}
                  onChange={handleContractNumberChange}
                  onFocus={() => console.log('Contract Number focused')}
                  onBlur={() => console.log('Contract Number blurred')}
                  placeholder="e.g., APT001-2025-01"
                  helperText="Enter a unique identifier for this contract"
                  inputProps={{ 'data-testid': 'contract-number-input' }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={contractForm.status}
                    label="Status"
                    onChange={handleStatusChange}
                  >
                    {CONTRACT_STATUSES.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Date *"
                  type="date"
                  value={contractForm.start_date}
                  onChange={handleStartDateChange}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ 'data-testid': 'start-date-input' }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={contractForm.end_date}
                  onChange={handleEndDateChange}
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty for open-ended contract"
                  inputProps={{ 'data-testid': 'end-date-input' }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monthly Rent *"
                  type="number"
                  value={contractForm.monthly_rent}
                  onChange={handleMonthlyRentChange}
                  InputProps={{
                    startAdornment: '€',
                  }}
                  helperText="Enter the monthly rental amount"
                  inputProps={{ 'data-testid': 'monthly-rent-input' }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Security Deposit"
                  type="number"
                  value={contractForm.security_deposit}
                  onChange={handleSecurityDepositChange}
                  InputProps={{
                    startAdornment: '€',
                  }}
                  helperText="Security deposit amount"
                  inputProps={{ 'data-testid': 'security-deposit-input' }}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={tenantOptions}
                  getOptionLabel={(tenant) => tenant.name}
                  value={selectedTenants}
                  onChange={handleTenantIdsChange}
                  renderOption={renderAutocompleteOption}
                  renderInput={renderAutocompleteInput}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={contractForm.notes}
                  onChange={handleNotesChange}
                  onFocus={() => console.log('Notes focused')}
                  onBlur={() => console.log('Notes blurred')}
                  placeholder="Additional notes about this contract period..."
                  inputProps={{ 'data-testid': 'notes-input' }}
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>

        {tabValue === 1 && (
          <>
            <Button
              onClick={resetForm}
              disabled={loading}
              startIcon={<RefreshIcon />}
            >
              Reset
            </Button>
            {!editingContract && (
              <Button
                onClick={loadFromApartment}
                disabled={loading || !apartment}
                startIcon={<DownloadIcon />}
                color="info"
              >
                Load from Apartment
              </Button>
            )}
            <Button
              onClick={handleCreateContract}
              variant="contained"
              disabled={loading || !contractForm.contract_number || !contractForm.start_date || !contractForm.monthly_rent}
            >
              {editingContract ? 'Update Contract' : 'Create Contract'}
            </Button>
          </>
        )}

        {tabValue === 0 && contracts.length > 0 && (
          <Button
            onClick={() => setTabValue(1)}
            variant="contained"
            startIcon={<AddIcon />}
          >
            New Contract
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ContractManagementDialog;
