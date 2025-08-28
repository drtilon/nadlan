// components/TenantsPanel.jsx - COMPLETE FIXED VERSION with Apartment Click Dialog
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Alert,
  Stack,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  Divider
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
  Visibility as ViewIcon,
  CreditCard as IbanIcon,
  Cake as BirthdayIcon,
  MoreVert as MoreIcon,
  Business as ApartmentIcon,
  Assignment as ContractIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { green, red, orange, blue, grey } from '@mui/material/colors';
import api from '../../utils/api';
import EnhancedTenantForm from './EnhancedTenantForm';
import Pagination from '../common/Pagination';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

function TenantsPanel({ showNotification }) {
  const navigate = useNavigate();

  // State management
  const [tenants, setTenants] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [apartmentFilter, setApartmentFilter] = useState('all');
  const [contractStatusFilter, setContractStatusFilter] = useState('all');

  // Form and dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    passport_id: '',
    refund_iban: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete confirmation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);

  // Action menu
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);

  // Apartment details dialog - NEW
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);

  // Filtered and paginated data
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [paginatedTenants, setPaginatedTenants] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withContracts: 0,
    withoutContracts: 0,
    activeContracts: 0
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyFilters();
  }, [tenants, searchQuery, genderFilter, apartmentFilter, contractStatusFilter]);

  // Update pagination when filtered data changes
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedTenants(filteredTenants.slice(startIndex, endIndex));
  }, [filteredTenants, currentPage, itemsPerPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tenants with enhanced data
      const tenantsResponse = await api.get('/tenants/list');
      const tenantsData = tenantsResponse.data.tenants || [];

      // Fetch apartments for filter dropdown - CORRECT ENDPOINT
      const apartmentsResponse = await api.get('/list');
      const apartmentsData = apartmentsResponse.data.apartments || [];

      setTenants(tenantsData);
      setApartments(apartmentsData);
      updateStats(tenantsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      if (showNotification) {
        showNotification('Failed to load data', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (tenantsData) => {
    const total = tenantsData.length;
    const withContracts = tenantsData.filter(tenant =>
      tenant.current_contracts && tenant.current_contracts.length > 0
    ).length;
    const withoutContracts = total - withContracts;
    const activeContracts = tenantsData.reduce(
      (sum, tenant) => sum + (tenant.current_contracts ? tenant.current_contracts.length : 0), 0
    );

    setStats({
      total,
      withContracts,
      withoutContracts,
      activeContracts
    });
  };

  const applyFilters = () => {
    let filtered = [...tenants];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tenant =>
        tenant.name?.toLowerCase().includes(query) ||
        tenant.email?.toLowerCase().includes(query) ||
        tenant.phone?.toLowerCase().includes(query) ||
        tenant.passport_id?.toLowerCase().includes(query) ||
        // Search in apartment addresses
        (tenant.current_contracts && tenant.current_contracts.some(contract =>
          contract.apartment_address?.toLowerCase().includes(query)
        ))
      );
    }

    // Gender filter
    if (genderFilter !== 'all') {
      filtered = filtered.filter(tenant =>
        tenant.gender?.toLowerCase() === genderFilter.toLowerCase()
      );
    }

    // Apartment filter
    if (apartmentFilter !== 'all') {
      const apartmentId = parseInt(apartmentFilter);
      filtered = filtered.filter(tenant =>
        tenant.current_contracts && tenant.current_contracts.some(contract =>
          contract.apartment_id === apartmentId
        )
      );
    }

    // Contract status filter
    if (contractStatusFilter !== 'all') {
      if (contractStatusFilter === 'with_contracts') {
        filtered = filtered.filter(tenant =>
          tenant.current_contracts && tenant.current_contracts.length > 0
        );
      } else if (contractStatusFilter === 'without_contracts') {
        filtered = filtered.filter(tenant =>
          !tenant.current_contracts || tenant.current_contracts.length === 0
        );
      }
    }

    setFilteredTenants(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setApartmentFilter('all');
    setContractStatusFilter('all');
  };

  const handleOpenDialog = (tenant = null) => {
    if (tenant) {
      // Edit mode
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        date_of_birth: tenant.date_of_birth || '',
        gender: tenant.gender || '',
        passport_id: tenant.passport_id || '',
        refund_iban: tenant.refund_iban || ''
      });
    } else {
      // Add mode
      setEditingTenant(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        passport_id: '',
        refund_iban: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTenant(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      passport_id: '',
      refund_iban: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      if (showNotification) {
        showNotification('Name and email are required', 'error');
      }
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingTenant) {
        // Update existing tenant
        await api.put(`/tenants/update/${editingTenant.id}`, formData);
        if (showNotification) {
          showNotification('Tenant updated successfully', 'success');
        }
      } else {
        // Add new tenant
        await api.post('/tenants/add', formData);
        if (showNotification) {
          showNotification('Tenant added successfully', 'success');
        }
      }

      handleCloseDialog();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving tenant:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save tenant';
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleActionMenuClick = (event, tenant) => {
    event.stopPropagation();
    setSelectedTenant(tenant);
    setActionMenuAnchor(event.currentTarget);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setSelectedTenant(null);
  };

  const handleViewTenant = (tenant) => {
    navigate(`/tenants/${tenant.id}`);
    handleActionMenuClose();
  };

  const handleEditTenant = (tenant) => {
    handleOpenDialog(tenant);
    handleActionMenuClose();
  };

  const openDeleteConfirmation = (tenant) => {
    setTenantToDelete(tenant);
    setConfirmDeleteOpen(true);
    handleActionMenuClose();
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;

    setFormSubmitting(true);
    try {
      await api.delete(`/tenants/delete/${tenantToDelete.id}`);
      if (showNotification) {
        showNotification('Tenant deleted successfully', 'success');
      }
      setConfirmDeleteOpen(false);
      setTenantToDelete(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting tenant:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete tenant';
      if (showNotification) {
        showNotification(errorMessage, 'error');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // NEW: Handle apartment click to open details dialog
  const handleApartmentClick = async (apartmentId, event) => {
    event.stopPropagation(); // Prevent row click

    try {
      // First try to find apartment from our loaded list (faster)
      let apartment = apartments.find(apt => apt.id === apartmentId);

      // If not found in list, fetch from API
      if (!apartment) {
        const response = await api.get(`/apartment/${apartmentId}`);
        apartment = response.data;
      }

      if (!apartment) {
        if (showNotification) {
          showNotification('Apartment not found', 'error');
        }
        return;
      }

      // Calculate expiry status to match what ApartmentDetailsDialog expects
      const calculateExpiryStatus = (contractEndDate) => {
        if (!contractEndDate) return { status: 'no_date', daysUntilExpiry: null };

        const endDate = new Date(contractEndDate);
        const today = new Date();
        const timeDiff = endDate.getTime() - today.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysUntilExpiry < 0) {
          return { status: 'expired', daysUntilExpiry };
        } else if (daysUntilExpiry <= 30) {
          return { status: 'expiring_soon', daysUntilExpiry };
        } else {
          return { status: 'valid', daysUntilExpiry };
        }
      };

      // Add expiryStatus to apartment object
      apartment.expiryStatus = calculateExpiryStatus(apartment.contractEndDate);

      setSelectedApartmentForDetails(apartment);
      setApartmentDetailsDialogOpen(true);
    } catch (error) {
      console.error('Error showing apartment details:', error);
      if (showNotification) {
        showNotification('Failed to load apartment details', 'error');
      }
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getGenderIcon = (gender) => {
    if (!gender) return null;
    return gender.toLowerCase() === 'male' ? '♂️' : gender.toLowerCase() === 'female' ? '♀️' : '⚧';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper elevation={1} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Tenants Management
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Tenant
            </Button>
          </Stack>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">{stats.total}</Typography>
                <Typography variant="body2" color="text.secondary">Total Tenants</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">{stats.withContracts}</Typography>
                <Typography variant="body2" color="text.secondary">With Contracts</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">{stats.withoutContracts}</Typography>
                <Typography variant="body2" color="text.secondary">Without Contracts</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="info.main">{stats.activeContracts}</Typography>
                <Typography variant="body2" color="text.secondary">Active Contracts</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Gender</InputLabel>
                <Select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value)}
                  label="Gender"
                >
                  <MenuItem value="all">All Genders</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Apartment</InputLabel>
                <Select
                  value={apartmentFilter}
                  onChange={(e) => setApartmentFilter(e.target.value)}
                  label="Apartment"
                >
                  <MenuItem value="all">All Apartments</MenuItem>
                  {apartments.map((apartment) => (
                    <MenuItem key={apartment.id} value={apartment.id.toString()}>
                      {apartment.address}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Contract Status</InputLabel>
                <Select
                  value={contractStatusFilter}
                  onChange={(e) => setContractStatusFilter(e.target.value)}
                  label="Contract Status"
                >
                  <MenuItem value="all">All Tenants</MenuItem>
                  <MenuItem value="with_contracts">With Contracts</MenuItem>
                  <MenuItem value="without_contracts">Without Contracts</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} md={1}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                size="small"
              >
                Clear
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Loading State */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Content */}
        {!loading && (
          <>
            {filteredTenants.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {tenants.length === 0
                  ? "No tenants found. Add tenants using the button above."
                  : "No tenants match the current filters. Try adjusting your search criteria."
                }
              </Alert>
            ) : (
              <>
                {/* Results Summary */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Showing {paginatedTenants.length} of {filteredTenants.length} tenants
                  {filteredTenants.length !== tenants.length && ` (filtered from ${tenants.length} total)`}
                </Typography>

                {/* Tenants Table */}
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tenant</TableCell>
                        <TableCell>Contact</TableCell>
                        <TableCell>Personal Info</TableCell>
                        <TableCell>Current Apartment</TableCell>
                        <TableCell>Financial</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTenants.map((tenant) => {
                        return (
                          <TableRow
                            key={tenant.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleViewTenant(tenant)}
                          >
                            {/* Tenant Info */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: blue[500] }}>
                                  {tenant.name?.charAt(0).toUpperCase() || 'T'}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {tenant.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {tenant.id}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>

                            {/* Contact */}
                            <TableCell>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <EmailIcon fontSize="small" color="action" />
                                  <Typography variant="body2">{tenant.email}</Typography>
                                </Box>
                                {tenant.phone && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PhoneIcon fontSize="small" color="action" />
                                    <Typography variant="body2">{tenant.phone}</Typography>
                                  </Box>
                                )}
                              </Box>
                            </TableCell>

                            {/* Personal Info */}
                            <TableCell>
                              <Box>
                                {tenant.gender && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <span>{getGenderIcon(tenant.gender)}</span>
                                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                      {tenant.gender}
                                    </Typography>
                                  </Box>
                                )}
                                {tenant.date_of_birth && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BirthdayIcon fontSize="small" color="action" />
                                    <Typography variant="body2">{formatDate(tenant.date_of_birth)}</Typography>
                                  </Box>
                                )}
                                {tenant.passport_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    Passport: {tenant.passport_id}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>

                            {/* Current Apartment */}
                            <TableCell>
                              {tenant.current_contracts && tenant.current_contracts.length > 0 ? (
                                <Box>
                                  {tenant.current_contracts.map((contract, index) => (
                                    <Chip
                                      key={index}
                                      label={contract.apartment_address}
                                      size="small"
                                      variant="outlined"
                                      icon={<HomeIcon />}
                                      onClick={(event) => handleApartmentClick(contract.apartment_id, event)}
                                      sx={{
                                        mb: 0.5,
                                        mr: 0.5,
                                        cursor: 'pointer',
                                        '&:hover': {
                                          backgroundColor: 'primary.light',
                                          color: 'white'
                                        }
                                      }}
                                    />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No apartment assigned
                                </Typography>
                              )}
                            </TableCell>

                            {/* Financial */}
                            <TableCell>
                              <Box>
                                {tenant.current_contracts && tenant.current_contracts.length > 0 ? (
                                  <Typography variant="body2" color="success.main">
                                    €{tenant.current_contracts.reduce((sum, contract) => sum + (contract.monthly_rent || 0), 0)}/month
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No rent
                                  </Typography>
                                )}
                                {tenant.refund_iban && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IbanIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                      IBAN on file
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </TableCell>

                            {/* Actions */}
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={(event) => handleActionMenuClick(event, tenant)}
                              >
                                <MoreIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                {filteredTenants.length > itemsPerPage && (
                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredTenants.length / itemsPerPage)}
                      onPageChange={handlePageChange}
                      itemsPerPage={itemsPerPage}
                      totalItems={filteredTenants.length}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        <MenuItem onClick={() => handleViewTenant(selectedTenant)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEditTenant(selectedTenant)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Tenant</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => openDeleteConfirmation(selectedTenant)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Tenant</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add/Edit Tenant Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  label="Gender"
                >
                  <MenuItem value="">Not Specified</MenuItem>
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Passport ID"
                value={formData.passport_id}
                onChange={(e) => setFormData({ ...formData, passport_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Refund IBAN"
                value={formData.refund_iban}
                onChange={(e) => setFormData({ ...formData, refund_iban: e.target.value })}
                helperText="For security deposit refunds"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={formSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Saving...' : (editingTenant ? 'Update' : 'Add Tenant')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete tenant "{tenantToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDeleteOpen(false)}
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteTenant}
            color="error"
            variant="contained"
            disabled={formSubmitting}
          >
            {formSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apartment Details Dialog - NEW */}
      <ApartmentDetailsDialog
        apartment={selectedApartmentForDetails}
        open={apartmentDetailsDialogOpen}
        onClose={() => {
          setApartmentDetailsDialogOpen(false);
          setSelectedApartmentForDetails(null);
        }}
        onGoToTenant={(tenantId) => {
          setApartmentDetailsDialogOpen(false);
          navigate(`/tenants/${tenantId}`);
        }}
        showNotification={showNotification}
        isAdmin={true}
      />
    </Container>
  );
}

export default TenantsPanel;
