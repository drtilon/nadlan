// components/TenantsPanel.jsx - COMPLETE ENHANCED FIXED VERSION
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

      let tenantsData = [];

      // Handle different response structures
      if (tenantsResponse.data.success && tenantsResponse.data.tenants) {
        tenantsData = tenantsResponse.data.tenants;
      } else if (Array.isArray(tenantsResponse.data)) {
        tenantsData = tenantsResponse.data;
      } else {
        console.warn('Unexpected tenants response structure:', tenantsResponse.data);
        tenantsData = [];
      }

      setTenants(tenantsData);

      // Fetch apartments for filters and address mapping
      const apartmentsResponse = await api.get('/list');
      let apartmentsData = [];

      if (apartmentsResponse.data && apartmentsResponse.data.apartments) {
        apartmentsData = apartmentsResponse.data.apartments;
      } else if (Array.isArray(apartmentsResponse.data)) {
        apartmentsData = apartmentsResponse.data;
      } else {
        console.warn('Unexpected apartments response structure:', apartmentsResponse.data);
        apartmentsData = [];
      }

      setApartments(apartmentsData);

      // Calculate stats
      calculateStats(tenantsData);

    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading tenant data', 'error');
      setTenants([]);
      setApartments([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tenantsData) => {
    const total = tenantsData.length;
    const withContracts = tenantsData.filter(tenant =>
      tenant.current_contracts && tenant.current_contracts.length > 0
    ).length;
    const withoutContracts = total - withContracts;
    const activeContracts = tenantsData.reduce((acc, tenant) =>
      acc + (tenant.current_contracts ? tenant.current_contracts.length : 0), 0
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
        date_of_birth: tenant.date_of_birth || tenant.birthdate || '',
        gender: tenant.gender || '',
        passport_id: tenant.passport_id || '',
        refund_iban: tenant.refund_iban || tenant.refundIban || ''
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
    setFormSubmitting(false);
    setEditingTenant(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showNotification('Tenant name is required', 'error');
      return;
    }

    if (!formData.email.trim()) {
      showNotification('Email is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingTenant) {
        // Update existing tenant
        await api.put(`/tenants/${editingTenant.id}`, formData);
        showNotification('Tenant updated successfully', 'success');
      } else {
        // Add new tenant - using the correct endpoint
        await api.post('/tenants/add', formData);
        showNotification('Tenant added successfully', 'success');
      }

      fetchData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error saving tenant data';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleActionMenuOpen = (event, tenant) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedTenant(tenant);
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
      await api.delete(`/tenants/${tenantToDelete.id}`);
      showNotification('Tenant deleted successfully', 'success');
      fetchData();
      setConfirmDeleteOpen(false);
      setTenantToDelete(null);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      const errorMessage = error.response?.data?.message || 'Error deleting tenant';
      showNotification(errorMessage, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getContractStatusInfo = (tenant) => {
    if (!tenant.current_contracts || tenant.current_contracts.length === 0) {
      return { status: 'No Contract', color: grey[500], bgColor: grey[100] };
    }

    const contractCount = tenant.current_contracts.length;
    if (contractCount === 1) {
      return { status: 'Active Contract', color: green[700], bgColor: green[100] };
    } else {
      return { status: `${contractCount} Contracts`, color: blue[700], bgColor: blue[100] };
    }
  };

  const getApartmentInfo = (tenant) => {
    if (!tenant.current_contracts || tenant.current_contracts.length === 0) {
      return 'Not Assigned';
    }

    const apartments = tenant.current_contracts.map(contract => contract.apartment_address);
    return apartments.join(', ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header with Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
                <PersonIcon sx={{ mr: 1 }} /> Tenant Management
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PersonAddIcon />}
                onClick={() => handleOpenDialog()}
                size="large"
              >
                Add New Tenant
              </Button>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {stats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Tenants
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {stats.withContracts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      With Contracts
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {stats.withoutContracts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Without Contracts
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main" fontWeight="bold">
                      {stats.activeContracts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Contracts
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <FilterIcon sx={{ mr: 1 }} /> Filters & Search
        </Typography>

        <Grid container spacing={2} alignItems="center">
          {/* Search */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search tenants..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Gender Filter */}
          <Grid item xs={12} sm={6} md={2}>
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

          {/* Apartment Filter */}
          <Grid item xs={12} sm={6} md={2}>
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
                    {apartment.address || `Apt ${apartment.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Contract Status Filter */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Contract Status</InputLabel>
              <Select
                value={contractStatusFilter}
                onChange={(e) => setContractStatusFilter(e.target.value)}
                label="Contract Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="with_contracts">With Contracts</MenuItem>
                <MenuItem value="without_contracts">Without Contracts</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12} md={2}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchData}
                disabled={loading}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                size="small"
              >
                Clear
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      <Paper elevation={3} sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              Loading tenants...
            </Typography>
          </Box>
        ) : (
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
                        <TableCell>Contract Status</TableCell>
                        <TableCell>Financial</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTenants.map((tenant) => {
                        const contractInfo = getContractStatusInfo(tenant);
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
                                  {tenant.name?.charAt(0)?.toUpperCase() || 'T'}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold">
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
                              <Stack spacing={0.5}>
                                {tenant.email && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <EmailIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                    <Typography variant="body2">{tenant.email}</Typography>
                                  </Box>
                                )}
                                {tenant.phone && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PhoneIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                    <Typography variant="body2">{tenant.phone}</Typography>
                                  </Box>
                                )}
                              </Stack>
                            </TableCell>

                            {/* Personal Info */}
                            <TableCell>
                              <Stack spacing={0.5}>
                                {tenant.gender && (
                                  <Chip
                                    label={tenant.gender}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                  />
                                )}
                                {(tenant.date_of_birth || tenant.birthdate) && (
                                  <Typography variant="caption" color="text.secondary">
                                    <BirthdayIcon sx={{ fontSize: 14, mr: 0.5 }} />
                                    {formatDate(tenant.date_of_birth || tenant.birthdate)}
                                  </Typography>
                                )}
                                {tenant.passport_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {tenant.passport_id}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>

                            {/* Current Apartment */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <HomeIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                <Typography variant="body2">
                                  {getApartmentInfo(tenant)}
                                </Typography>
                              </Box>
                            </TableCell>

                            {/* Contract Status */}
                            <TableCell>
                              <Chip
                                label={contractInfo.status}
                                size="small"
                                sx={{
                                  color: contractInfo.color,
                                  backgroundColor: contractInfo.bgColor,
                                  fontWeight: 'medium'
                                }}
                                icon={<ContractIcon sx={{ fontSize: 16 }} />}
                              />
                            </TableCell>

                            {/* Financial Info */}
                            <TableCell>
                              {(tenant.refund_iban || tenant.refundIban) && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <IbanIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    IBAN Available
                                  </Typography>
                                </Box>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleActionMenuOpen(e, tenant)}
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
    </Container>
  );
}

export default TenantsPanel;
