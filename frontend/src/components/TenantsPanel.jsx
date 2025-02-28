// components/TenantsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  LinearProgress,
  Tooltip,
  InputAdornment,
  Divider,
  Alert,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import api from '../utils/api';
import TenantDetails from './TenantDetails';

function TenantsPanel({ showNotification }) {
  const [tenants, setTenants] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    apartment_id: ''
  });
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);

  // Fetch tenants and apartments data
  useEffect(() => {
    fetchData();
  }, []);

  // Filter tenants based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTenants(tenants);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tenants.filter(tenant =>
      tenant.name.toLowerCase().includes(query) ||
      (tenant.email && tenant.email.toLowerCase().includes(query)) ||
      (tenant.phone && tenant.phone.toLowerCase().includes(query)) ||
      (tenant.apartment_address && tenant.apartment_address.toLowerCase().includes(query))
    );
    setFilteredTenants(filtered);
  }, [searchQuery, tenants]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tenants
      const tenantsResponse = await api.get('/tenants/list');
      setTenants(tenantsResponse.data);
      setFilteredTenants(tenantsResponse.data);

      // Fetch apartments for dropdown
      const apartmentsResponse = await api.get('/list');
      setApartments(apartmentsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading tenant data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tenant = null) => {
    if (tenant) {
      // Edit mode
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        apartment_id: tenant.apartment_id || ''
      });
    } else {
      // Add mode
      setEditingTenant(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        apartment_id: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormSubmitting(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      showNotification('Tenant name is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingTenant) {
        // Update existing tenant
        await api.put(`/tenants/${editingTenant.id}`, formData);
        showNotification('Tenant updated successfully', 'success');
      } else {
        // Add new tenant
        await api.post('/tenants/add', formData);
        showNotification('Tenant added successfully', 'success');
      }

      fetchData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving tenant:', error);
      showNotification('Error saving tenant data', 'error');
      setFormSubmitting(false);
    }
  };

  const openDeleteConfirmation = (tenant) => {
    setTenantToDelete(tenant);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    setFormSubmitting(true);
    try {
      await api.delete(`/tenants/${tenantToDelete.id}`);
      showNotification('Tenant deleted successfully', 'success');
      fetchData();
      setConfirmDeleteOpen(false);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      showNotification('Error deleting tenant', 'error');
    } finally {
      setFormSubmitting(false);
      setTenantToDelete(null);
    }
  };

  // Handle view tenant details
  const handleViewTenant = (tenant) => {
    setSelectedTenant(tenant.id);
  };

  // Get apartment address by ID
  const getApartmentAddress = (apartmentId) => {
    const apartment = apartments.find(apt => apt.id === apartmentId);
    return apartment ? apartment.address : 'Not Assigned';
  };

  // If a tenant is selected, show tenant details
  if (selectedTenant) {
    return (
      <TenantDetails
        tenantId={selectedTenant}
        onBack={() => setSelectedTenant(null)}
        showNotification={showNotification}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonIcon sx={{ mr: 1 }} /> Tenant Management
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PersonAddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add New Tenant
          </Button>
        </Box>

        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            placeholder="Search tenants..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, maxWidth: 500 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
          </Box>
        ) : (
          <>
            {filteredTenants.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No tenants found. Add tenants using the button above.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: 'primary.light' }}>
                    <TableRow>
                      <TableCell>Tenant Name</TableCell>
                      <TableCell>Contact Information</TableCell>
                      <TableCell>Assigned Property</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow
                        key={tenant.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handleViewTenant(tenant)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle1">
                              {tenant.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Stack spacing={1}>
                            {tenant.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography variant="body2">{tenant.email}</Typography>
                              </Box>
                            )}
                            {tenant.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography variant="body2">{tenant.phone}</Typography>
                              </Box>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {tenant.apartment_id ? (
                            <Chip
                              icon={<HomeIcon />}
                              label={getApartmentAddress(tenant.apartment_id)}
                              color="primary"
                              variant="outlined"
                              size="small"
                            />
                          ) : (
                            <Chip
                              label="Not Assigned"
                              color="default"
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="View Details">
                            <IconButton
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewTenant(tenant);
                              }}
                              size="small"
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Tenant">
                            <IconButton
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(tenant);
                              }}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Tenant">
                            <IconButton
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteConfirmation(tenant);
                              }}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Paper>

      {/* Add/Edit Tenant Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tenant Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                variant="filled"
                InputLabelProps={{
                  sx: { fontSize: '1rem', fontWeight: 'medium' }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                variant="filled"
                InputLabelProps={{
                  sx: { fontSize: '1rem', fontWeight: 'medium' }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                variant="filled"
                InputLabelProps={{
                  sx: { fontSize: '1rem', fontWeight: 'medium' }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Assigned Apartment"
                name="apartment_id"
                value={formData.apartment_id}
                onChange={handleInputChange}
                variant="filled"
                InputLabelProps={{
                  sx: { fontSize: '1rem', fontWeight: 'medium' }
                }}
                SelectProps={{
                  native: true,
                }}
              >
                <option value=""></option>
                {apartments.map((apartment) => (
                  <option key={apartment.id} value={apartment.id}>
                    {apartment.address}
                  </option>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCloseDialog}
            color="inherit"
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={formSubmitting}
            startIcon={formSubmitting ? <LinearProgress size={20} /> : null}
          >
            {editingTenant ? 'Update Tenant' : 'Add Tenant'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the tenant "{tenantToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDeleteOpen(false)}
            color="inherit"
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteTenant}
            color="error"
            variant="contained"
            disabled={formSubmitting}
            startIcon={formSubmitting ? <LinearProgress size={20} /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TenantsPanel;
