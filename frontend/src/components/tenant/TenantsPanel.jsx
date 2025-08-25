// components/TenantsPanel.jsx - FIXED VERSION with ApartmentCard popup
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
  Close as CloseIcon
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
    apartment_id: ''
  });
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);

  // New state for apartment details popup
  const [apartmentDetailsDialogOpen, setApartmentDetailsDialogOpen] = useState(false);
  const [selectedApartmentForDetails, setSelectedApartmentForDetails] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [paginatedTenants, setPaginatedTenants] = useState([]);

  // Fetch tenants and apartments data
  useEffect(() => {
    fetchData();
  }, []);

  // Filter tenants based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTenants(tenants);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tenants.filter(tenant =>
        tenant.name.toLowerCase().includes(query) ||
        (tenant.email && tenant.email.toLowerCase().includes(query)) ||
        (tenant.phone && tenant.phone.toLowerCase().includes(query)) ||
        (tenant.apartment_address && tenant.apartment_address.toLowerCase().includes(query)) ||
        (tenant.bornOn && tenant.bornOn.includes(query)) ||
        (tenant.refundIban && tenant.refundIban.toLowerCase().includes(query))
      );
      setFilteredTenants(filtered);
    }
    // Reset to first page when search changes
    setCurrentPage(1);
  }, [searchQuery, tenants]);

  // Update paginated tenants when filtered tenants or pagination settings change
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedTenants(filteredTenants.slice(startIndex, endIndex));
  }, [filteredTenants, currentPage, itemsPerPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch tenants
      const tenantsResponse = await api.get('/tenants/list');
      setTenants(tenantsResponse.data);
      setFilteredTenants(tenantsResponse.data);

      // UPDATED: Properly handle apartment API response structure
      const apartmentsResponse = await api.get('/list');
      let apartmentsData = [];

      if (apartmentsResponse.data) {
        // Handle both paginated and direct array responses
        if (apartmentsResponse.data.apartments) {
          apartmentsData = apartmentsResponse.data.apartments;
        } else if (Array.isArray(apartmentsResponse.data)) {
          apartmentsData = apartmentsResponse.data;
        }
      }

      setApartments(apartmentsData);
      console.log('Loaded apartments:', apartmentsData.length);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tenant = null) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        bornOn: tenant.bornOn || '',
        refundIban: tenant.refundIban || '',
        apartment_id: tenant.apartment_id || ''
      });
    } else {
      setEditingTenant(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        bornOn: '',
        refundIban: '',
        apartment_id: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTenant(null);
    setFormSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
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

  // Handle view tenant details with React Router
  const handleViewTenant = (tenant) => {
    navigate(`/tenants/${tenant.id}`);
  };

  // UPDATED: Get apartment details by ID with fresh data
  const getApartmentDetails = (apartmentId) => {
    if (!apartments || !Array.isArray(apartments) || !apartmentId) {
      return null;
    }

    return apartments.find(apt => apt.id === apartmentId);
  };

  // NEW: Handle apartment click to show ApartmentDetailsDialog
  const handleApartmentClick = (apartmentId, e) => {
    e.stopPropagation(); // Prevent row click
    const apartment = getApartmentDetails(apartmentId);
    if (apartment) {
      setSelectedApartmentForDetails(apartment);
      setApartmentDetailsDialogOpen(true);
    }
  };

  // NEW: Close apartment details dialog
  const handleCloseApartmentDetailsDialog = () => {
    setApartmentDetailsDialogOpen(false);
    setSelectedApartmentForDetails(null);
  };

  // NEW: Handle apartment details dialog actions
  const handleEditApartment = (apartment) => {
    handleCloseApartmentDetailsDialog();
    showNotification(`Editing apartment: ${apartment.address}`, 'info');
    // You can add navigation or emit event to parent here
  };

  const handleGoToApartmentPayments = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}/payments`);
  };

  const handleGenerateContract = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    showNotification('Contract generation initiated', 'info');
    // Add contract generation logic here
  };

  const handleExtendContract = (apartment) => {
    handleCloseApartmentDetailsDialog();
    showNotification(`Contract extension for: ${apartment.address}`, 'info');
    // Add contract extension logic here
  };

  const handleOpenContractManagement = () => {
    handleCloseApartmentDetailsDialog();
    showNotification('Opening contract management', 'info');
    // Add contract management logic here
  };

  const handleGoToTenantFromDetails = (tenantId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/tenants/${tenantId}`);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
  };

  // Check if user is admin (you might need to adjust this based on your auth system)
  const isAdmin = true; // Replace with actual admin check

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
              <>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead sx={{ bgcolor: 'primary.light' }}>
                      <TableRow>
                        <TableCell>Tenant Name</TableCell>
                        <TableCell>Contact Information</TableCell>
                        <TableCell>Personal Details</TableCell>
                        <TableCell>Assigned Property</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTenants.map((tenant) => {
                        const apartmentDetails = getApartmentDetails(tenant.apartment_id);
                        return (
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
                              <Stack spacing={1}>
                                {tenant.bornOn && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BirthdayIcon fontSize="small" color="action" />
                                    <Typography variant="body2">
                                      {formatDate(tenant.bornOn)}
                                    </Typography>
                                  </Box>
                                )}
                                {tenant.refundIban && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IbanIcon fontSize="small" color="action" />
                                    <Typography variant="body2">
                                      {tenant.refundIban}
                                    </Typography>
                                  </Box>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              {apartmentDetails ? (
                                <Tooltip title="Click to view apartment details">
                                  <Chip
                                    icon={<HomeIcon />}
                                    label={apartmentDetails.address}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                    clickable
                                    onClick={(e) => handleApartmentClick(tenant.apartment_id, e)}
                                    sx={{
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        backgroundColor: 'primary.50',
                                        boxShadow: 2,
                                        transform: 'translateY(-1px)'
                                      }
                                    }}
                                  />
                                </Tooltip>
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination component */}
                <Pagination
                  totalItems={filteredTenants.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </>
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
        <EnhancedTenantForm
          formData={formData}
          setFormData={setFormData}
          editingTenant={editingTenant}
          apartments={apartments}
          formSubmitting={formSubmitting}
          handleCloseDialog={handleCloseDialog}
          handleSubmit={handleSubmit}
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography>
            Are you sure you want to delete the tenant "{tenantToDelete?.name}"?
            This action cannot be undone.
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={handleDeleteTenant}
              disabled={formSubmitting}
            >
              {formSubmitting ? <CircularProgress size={24} /> : 'Delete'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* NEW: Apartment Details Dialog */}
      <ApartmentDetailsDialog
        open={apartmentDetailsDialogOpen}
        onClose={handleCloseApartmentDetailsDialog}
        apartment={selectedApartmentForDetails}
        onEdit={handleEditApartment}
        onGoToPayments={handleGoToApartmentPayments}
        onGenerateContract={handleGenerateContract}
        onExtendContract={handleExtendContract}
        onOpenContractManagement={handleOpenContractManagement}
        onGoToTenant={handleGoToTenantFromDetails}
        isAdmin={isAdmin}
      />
    </Container>
  );
}

export default TenantsPanel;
