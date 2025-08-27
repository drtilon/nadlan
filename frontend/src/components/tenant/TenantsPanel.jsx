// components/TenantsPanel.jsx - FIXED Assigned Property & Contract Column
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
  DialogContent,
  DialogActions,
  CircularProgress
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
  Close as CloseIcon,
  Schedule as ContractIcon,
  Warning as ExpiryIcon,
  ContactPage as PassportIcon,
  Wc as GenderIcon,
  AttachMoney as MoneyIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import api from '../../utils/api';
import EnhancedTenantForm from './EnhancedTenantForm';
import Pagination from '../common/Pagination';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

function TenantsPanel({ showNotification }) {
  const navigate = useNavigate();

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
    bornOn: '',
    refundIban: '',
    passport_id: '',
    gender: '',
    apartment_id: ''
  });
  const [filters, setFilters] = useState({
    apartment_id: '',
    gender: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [apartmentDialogOpen, setApartmentDialogOpen] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTenants();
    fetchApartments();
  }, [currentPage, filters, searchQuery]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage - 1,
        limit: itemsPerPage,
        search: searchQuery,
        ...filters
      });

      const response = await api.get(`tenants/list?${params}`);
      setTenants(response.data.tenants || []);
      const total = response.data.total || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));
    } catch (error) {
      console.error('Error fetching tenants:', error);
      showNotification('Error fetching tenants', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await api.get('/list');
      setApartments(response.data.apartments || []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
    }
  };

  const handleCreateTenant = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      bornOn: '',
      refundIban: '',
      passport_id: '',
      gender: '',
      apartment_id: ''
    });
    setOpenDialog(true);
  };

  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      bornOn: tenant.date_of_birth || '',
      refundIban: tenant.refund_iban || '',
      passport_id: tenant.passport_id || '',
      gender: tenant.gender || '',
      apartment_id: tenant.current_contracts?.[0]?.apartment_id || ''
    });
    setOpenDialog(true);
  };

  const handleDeleteTenant = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this tenant?')) {
      try {
        await api.delete(`/api/tenants/${tenantId}`);
        showNotification('Tenant deleted successfully', 'success');
        fetchTenants();
      } catch (error) {
        console.error('Error deleting tenant:', error);
        showNotification('Error deleting tenant', 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTenant) {
        await api.put(`/api/tenants/${editingTenant.id}`, formData);
        showNotification('Tenant updated successfully', 'success');
      } else {
        await api.post('/api/tenants', formData);
        showNotification('Tenant created successfully', 'success');
      }
      setOpenDialog(false);
      fetchTenants();
    } catch (error) {
      console.error('Error saving tenant:', error);
      showNotification('Error saving tenant', 'error');
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ apartment_id: '', gender: '' });
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleViewApartment = (apartmentId) => {
    const apartment = apartments.find(apt => apt.id === apartmentId);
    if (apartment) {
      setSelectedApartment(apartment);
      setApartmentDialogOpen(true);
    }
  };

  // FIXED: Enhanced function to render tenant's assigned property & contract info
  const renderAssignedProperty = (tenant) => {
    if (!tenant.current_contracts || tenant.current_contracts.length === 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label="No Assignment"
            size="small"
            color="default"
            variant="outlined"
          />
        </Box>
      );
    }

    // Show all current contracts (in case tenant has multiple)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tenant.current_contracts.map((contract, index) => {
          const apartmentAddress = contract.apartment_address || 'Unknown Address';
          const rentShare = contract.rent_share_percentage || 0;
          const monthlyRent = contract.monthly_rent || 0;
          const moveInDate = contract.move_in_date ? new Date(contract.move_in_date).toLocaleDateString() : 'N/A';

          return (
            <Box key={index} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Tooltip title="View apartment details">
                  <IconButton
                    size="small"
                    onClick={() => handleViewApartment(contract.apartment_id)}
                    sx={{ color: 'primary.main' }}
                  >
                    <HomeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {apartmentAddress}
                </Typography>
                {contract.is_primary && (
                  <Chip label="Primary" size="small" color="primary" />
                )}
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Chip
                  icon={<MoneyIcon />}
                  label={`€${monthlyRent.toFixed(0)} (${rentShare.toFixed(0)}%)`}
                  size="small"
                  variant="outlined"
                  color="success"
                />
                <Chip
                  icon={<ContractIcon />}
                  label={`Since ${moveInDate}`}
                  size="small"
                  variant="outlined"
                  color="info"
                />
                <Chip
                  icon={<AssignmentIcon />}
                  label={contract.status || 'active'}
                  size="small"
                  color={contract.status === 'active' ? 'success' : 'default'}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const getGenderIcon = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return <PersonIcon sx={{ color: 'blue' }} />;
      case 'female':
        return <PersonIcon sx={{ color: 'pink' }} />;
      default:
        return <GenderIcon />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            <PersonAddIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Tenants Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTenant}
            sx={{ borderRadius: 2 }}
          >
            Add Tenant
          </Button>
        </Box>

        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              placeholder="Search tenants..."
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />

            <TextField
              select
              label="Filter by Apartment"
              size="small"
              value={filters.apartment_id}
              onChange={(e) => handleFilterChange('apartment_id', e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 200 }}
            >
              <option value="">All Apartments</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.address}
                </option>
              ))}
            </TextField>

            <TextField
              select
              label="Filter by Gender"
              size="small"
              value={filters.gender}
              onChange={(e) => handleFilterChange('gender', e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 150 }}
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </TextField>

            <Button
              variant="outlined"
              onClick={clearFilters}
              startIcon={<RefreshIcon />}
            >
              Clear
            </Button>
          </Stack>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        <TableContainer component={Paper} variant="outlined">
          <Table sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Tenant Info</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Contact Details</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Personal Info</TableCell>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 350 }}>Assigned Property & Contract</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id} hover>
                  {/* Tenant Info */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                          {tenant.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {tenant.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Contact Details */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {tenant.email || 'No email'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {tenant.phone || 'No phone'}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  {/* Personal Info */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getGenderIcon(tenant.gender)}
                        <Typography variant="body2">
                          {tenant.gender || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BirthdayIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {formatDate(tenant.date_of_birth)}
                        </Typography>
                      </Box>
                      {tenant.passport_id && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PassportIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {tenant.passport_id}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </TableCell>

                  {/* FIXED: Assigned Property & Contract */}
                  <TableCell>
                    {renderAssignedProperty(tenant)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => navigate(`/tenants/${tenant.id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEditTenant(tenant)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteTenant(tenant.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {tenants.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No tenants found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery || filters.apartment_id || filters.gender
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first tenant'}
            </Typography>
          </Box>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        {/* Create/Edit Tenant Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
              <IconButton onClick={() => setOpenDialog(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <EnhancedTenantForm
              formData={formData}
              setFormData={setFormData}
              apartments={apartments}
              isEditing={!!editingTenant}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              {editingTenant ? 'Update' : 'Create'} Tenant
            </Button>
          </DialogActions>
        </Dialog>

        {/* Apartment Details Dialog */}
        {selectedApartment && (
          <ApartmentDetailsDialog
            open={apartmentDialogOpen}
            onClose={() => setApartmentDialogOpen(false)}
            apartment={selectedApartment}
            onEdit={() => navigate(`/apartments/${selectedApartment.id}/edit`)}
          />
        )}
      </Paper>
    </Container>
  );
}

export default TenantsPanel;
