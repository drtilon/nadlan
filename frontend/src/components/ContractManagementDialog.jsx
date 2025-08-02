// ContractManagementDialog.jsx
import React, { useState, useEffect } from 'react';
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
  FormControlLabel
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
  History as HistoryIcon
} from '@mui/icons-material';
import api from '../utils/api';

const CONTRACT_STATUSES = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'default' },
  { value: 'terminated', label: 'Terminated', color: 'error' },
  { value: 'pending', label: 'Pending', color: 'warning' }
];

function ContractManagementDialog({
  open,
  onClose,
  apartment,
  showNotification,
  onContractChange // Callback when contracts are modified
}) {
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [editingContract, setEditingContract] = useState(null);
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

  useEffect(() => {
    if (open && apartment) {
      fetchContracts();
      fetchTenants();
      resetForm();
    }
  }, [open, apartment]);

  const fetchContracts = async () => {
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
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get('/tenants/list');
      setTenants(response.data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      showNotification('Error loading tenants', 'error');
    }
  };

  const resetForm = () => {
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
  };

  const handleFormChange = (field, value) => {
    setContractForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateContract = async () => {
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
      setTabValue(0); // Switch back to contracts list
      onContractChange?.(); // Notify parent component
    } catch (error) {
      console.error('Error saving contract:', error);
      const errorMessage = error.response?.data?.message || 'Error saving contract';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditContract = (contract) => {
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
    setTabValue(1); // Switch to form tab
  };

  const handleDeleteContract = async (contractId) => {
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
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusChip = (status) => {
    const statusConfig = CONTRACT_STATUSES.find(s => s.value === status) || CONTRACT_STATUSES[0];
    return (
      <Chip
        label={statusConfig.label}
        color={statusConfig.color}
        size="small"
        variant="outlined"
      />
    );
  };

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '800px'
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
        {/* Contracts List Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ height: '500px', overflow: 'auto' }}>
            {contracts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <DescriptionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Contracts Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create the first contract period for this apartment
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setTabValue(1)}
                >
                  Create Contract
                </Button>
              </Box>
            ) : (
              <List>
                {contracts.map((contract, index) => (
                  <React.Fragment key={contract.id}>
                    <ListItem sx={{ px: 3, py: 2 }}>
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: contract.is_current ? 'success.main' : 'grey.300',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 600
                          }}
                        >
                          {index + 1}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {contract.contract_number}
                            </Typography>
                            {getStatusChip(contract.status)}
                            {contract.is_current && (
                              <Chip
                                label="CURRENT"
                                color="success"
                                size="small"
                                variant="filled"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={12} sm={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <EventIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    {formatDate(contract.start_date)} - {formatDate(contract.end_date) || 'Ongoing'}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <MoneyIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    {formatCurrency(contract.monthly_rent)}/month
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <PersonIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    {contract.tenants?.length || 0} tenant(s)
                                  </Typography>
                                </Box>
                                {contract.tenants && contract.tenants.length > 0 && (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                    {contract.tenants.map((ct) => (
                                      <Chip
                                        key={ct.id}
                                        label={ct.tenant?.name || 'Unknown'}
                                        size="small"
                                        variant="outlined"
                                        color={ct.is_primary ? 'primary' : 'default'}
                                        sx={{ fontSize: '0.75rem' }}
                                      />
                                    ))}
                                  </Box>
                                )}
                              </Grid>
                            </Grid>
                            {contract.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                {contract.notes}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
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
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < contracts.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>

        {/* Contract Form Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ height: '500px', overflow: 'auto', px: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  {editingContract
                    ? `Editing contract: ${editingContract.contract_number}`
                    : 'Create a new contract period for this apartment'
                  }
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contract Number *"
                  value={contractForm.contract_number}
                  onChange={(e) => handleFormChange('contract_number', e.target.value)}
                  placeholder="e.g., APT001-2025-01"
                  helperText="Enter a unique identifier for this contract"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={contractForm.status}
                    label="Status"
                    onChange={(e) => handleFormChange('status', e.target.value)}
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
                  onChange={(e) => handleFormChange('start_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={contractForm.end_date}
                  onChange={(e) => handleFormChange('end_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Leave empty for open-ended contract"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monthly Rent *"
                  type="number"
                  value={contractForm.monthly_rent}
                  onChange={(e) => handleFormChange('monthly_rent', e.target.value)}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>€</Typography>
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Security Deposit"
                  type="number"
                  value={contractForm.security_deposit}
                  onChange={(e) => handleFormChange('security_deposit', e.target.value)}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>€</Typography>
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={tenants}
                  getOptionLabel={(tenant) => tenant.name}
                  value={tenants.filter(t => contractForm.tenant_ids.includes(t.id))}
                  onChange={(event, newValue) => {
                    handleFormChange('tenant_ids', newValue.map(t => t.id));
                  }}
                  renderOption={(props, tenant, { selected }) => (
                    <li {...props}>
                      <Checkbox
                        checked={selected}
                        style={{ marginRight: 8 }}
                      />
                      <ListItemText
                        primary={tenant.name}
                        secondary={tenant.email || tenant.phone || 'No contact info'}
                      />
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assign Tenants"
                      placeholder="Select tenants for this contract"
                      helperText="Choose which tenants will be part of this contract period"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={contractForm.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Additional notes about this contract period..."
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
            >
              Reset
            </Button>
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
