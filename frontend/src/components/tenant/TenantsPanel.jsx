// components/TenantsPanel.jsx - UPDATED with Passport ID display
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
  Wc as GenderIcon
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

  const resetFormData = () => {
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
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tenantsResponse, apartmentsResponse] = await Promise.all([
        api.get('/tenants/list'),
        api.get('/list') // Fixed: Use correct apartments endpoint
      ]);

      if (tenantsResponse.data && tenantsResponse.data.success) {
        setTenants(tenantsResponse.data.tenants || []);
      }

      // Handle apartment response structure
      if (apartmentsResponse.data) {
        if (apartmentsResponse.data.apartments) {
          setApartments(apartmentsResponse.data.apartments || []);
        } else if (Array.isArray(apartmentsResponse.data)) {
          setApartments(apartmentsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter and search logic
  useEffect(() => {
    const filtered = tenants.filter(tenant =>
      tenant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.phone?.includes(searchQuery) ||
      tenant.passport_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.gender?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTenants(filtered);
  }, [tenants, searchQuery]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTenants = filteredTenants.slice(startIndex, endIndex);

  const getApartmentDetails = (apartmentId) => {
    return apartments.find(apt => apt.id === apartmentId);
  };

  const handleOpenDialog = (tenant = null) => {
    setEditingTenant(tenant);
    if (tenant) {
              setFormData({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        bornOn: tenant.bornOn || '',
        refundIban: tenant.refundIban || '',
        passport_id: tenant.passport_id || '',
        gender: tenant.gender || '',
        apartment_id: tenant.apartment_id || ''
      });
    } else {
      resetFormData();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTenant(null);
    resetFormData();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showNotification('Tenant name is required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const endpoint = editingTenant ? `/tenants/update/${editingTenant.id}` : '/tenants/add';
      const method = editingTenant ? 'put' : 'post';

      const response = await api[method](endpoint, formData);

      showNotification(
        `Tenant ${editingTenant ? 'updated' : 'added'} successfully`,
        'success'
      );

      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving tenant:', error);
      showNotification(
        `Error ${editingTenant ? 'updating' : 'adding'} tenant: ${
          error.response?.data?.message || error.message
        }`,
        'error'
      );
    } finally {
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
      await api.delete(`/tenants/delete/${tenantToDelete.id}`);
      showNotification('Tenant deleted successfully', 'success');
      setConfirmDeleteOpen(false);
      setTenantToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      showNotification('Error deleting tenant', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleViewTenant = (tenant) => {
    navigate(`/tenants/${tenant.id}`);
  };

  const handleApartmentClick = (apartment) => {
    if (apartment) {
      setSelectedApartmentForDetails(apartment);
      setApartmentDetailsDialogOpen(true);
    }
  };

  const handleCloseApartmentDetailsDialog = () => {
    setApartmentDetailsDialogOpen(false);
    setSelectedApartmentForDetails(null);
  };

  const handleEditApartment = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}`);
  };

  const handleGoToApartmentPayments = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/apartments/${apartmentId}/payments`);
  };

  const handleGenerateContract = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/contracts/generate/${apartmentId}`);
  };

  const handleExtendContract = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/contracts/extend/${apartmentId}`);
  };

  const handleOpenContractManagement = (apartmentId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/contracts/manage/${apartmentId}`);
  };

  const handleGoToTenantFromDetails = (tenantId) => {
    handleCloseApartmentDetailsDialog();
    navigate(`/tenants/${tenantId}`);
  };

  // Format contract expiry status
  const getContractExpiryStatus = (contractInfo) => {
    if (!contractInfo) return null;

    const daysUntilExpiry = contractInfo.days_until_expiry;

    if (daysUntilExpiry === null || daysUntilExpiry === undefined) {
      return { status: 'ongoing', color: 'success', text: 'Ongoing' };
    }

    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: 'error', text: 'Expired' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', color: 'warning', text: `${daysUntilExpiry}d left` };
    } else {
      return { status: 'active', color: 'success', text: `${daysUntilExpiry}d left` };
    }
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
            placeholder="Search tenants by name, email, phone, passport, or gender..."
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
                        <TableCell>Contact & Personal Info</TableCell>
                        <TableCell>Assigned Property & Contract</TableCell>
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
                                {tenant.bornOn && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BirthdayIcon fontSize="small" color="action" />
                                    <Typography variant="body2">Born: {formatDate(tenant.bornOn)}</Typography>
                                  </Box>
                                )}
                                {tenant.passport_id && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PassportIcon fontSize="small" color="action" />
                                    <Typography variant="body2">Passport: {tenant.passport_id}</Typography>
                                  </Box>
                                )}
                                {tenant.gender && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GenderIcon fontSize="small" color="action" />
                                    <Typography variant="body2">
                                      Gender: {tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1).replace('_', ' ')}
                                    </Typography>
                                  </Box>
                                )}
                                {tenant.refundIban && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IbanIcon fontSize="small" color="action" />
                                    <Typography variant="body2">IBAN: {tenant.refundIban}</Typography>
                                  </Box>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              {apartmentDetails ? (
                                <Stack spacing={1}>
                                  <Chip
                                    icon={<HomeIcon />}
                                    label={apartmentDetails.address}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApartmentClick(apartmentDetails);
                                    }}
                                    sx={{ cursor: 'pointer' }}
                                  />

                                  {/* Contract Expiry Information */}
                                  {tenant.contract_info && (() => {
                                    const expiryStatus = getContractExpiryStatus(tenant.contract_info);
                                    return expiryStatus ? (
                                      <Chip
                                        icon={<ContractIcon />}
                                        label={expiryStatus.text}
                                        color={expiryStatus.color}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ) : null;
                                  })()}

                                  {!tenant.contract_info && (
                                    <Chip
                                      icon={<ExpiryIcon />}
                                      label="No Contract"
                                      color="default"
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </Stack>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No apartment assigned
                                </Typography>
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
