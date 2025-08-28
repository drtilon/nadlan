// Enhanced ApartmentDetailsDialog.jsx - FIXED VERSION with Management Fee and Rent Cost
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Bed as BedIcon,
  SquareFoot as SquareFootIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Visibility as ViewIcon,
  FileCopy as CopyIcon,
  Apartment as ApartmentIcon,
  Euro as EuroIcon,
  LocationOn as LocationIcon,
  ContactMail as ContactMailIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Groups as GroupsIcon
} from '@mui/icons-material';

function ApartmentDetailsDialog({
  apartment,
  open,
  onClose,
  onGenerateContract,
  onExtendContract,
  onOpenContractManagement,
  onGoToTenant,
  onEdit,
  showNotification,
  isAdmin = false
}) {
  const [currentTenants, setCurrentTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantsError, setTenantsError] = useState(null);

  // Fetch current tenants when dialog opens - MUST be before early return
  useEffect(() => {
    if (open && apartment?.id) {
      fetchCurrentTenants();
    }
  }, [open, apartment?.id]);

  if (!apartment) return null;

  const fetchCurrentTenants = async () => {
    setLoadingTenants(true);
    setTenantsError(null);
    try {
      // Use the new detailed endpoint that includes all tenant info and contract expiry
      const response = await fetch(`/api/apartments/${apartment.id}/active-tenants-detailed`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }

      const data = await response.json();

      // Transform the detailed data - no need for additional API calls
      const tenantsWithFullDetails = data.active_tenants.map((tenantData) => ({
        id: tenantData.tenant_id,
        name: tenantData.name,
        email: tenantData.email,
        phone: tenantData.phone,
        gender: tenantData.gender || 'not_specified',
        contractExpiryDate: tenantData.contract_expiry_date,
        contractTenantId: tenantData.contract_tenant_id,
        isPrimary: tenantData.is_primary
      }));

      setCurrentTenants(tenantsWithFullDetails);
    } catch (error) {
      console.error('Error fetching current tenants:', error);
      setTenantsError('Failed to load tenants');
    } finally {
      setLoadingTenants(false);
    }
  };

  // Get current tenants count
  const currentTenantCount = currentTenants.length;
  const maxOccupancy = apartment.maxOccupancy || 1;

  // Get tenant display name
  const getTenantDisplayName = (tenant) => {
    if (!tenant) return 'Unknown Tenant';
    return tenant.name || 'Unnamed Tenant';
  };

  // Handle copying text to clipboard
  const handleCopyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      if (showNotification) {
        showNotification(`${label} copied to clipboard`, 'success');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle tenant click
  const handleTenantClick = (tenantId) => {
    if (onGoToTenant && tenantId) {
      onClose();
      onGoToTenant(tenantId);
    }
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return 'Not set';
    try {
      return new Date(date).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid date';
    }
  };

  // Get gender icon and color
  const getGenderDisplay = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return { icon: <MaleIcon fontSize="small" />, color: 'primary.main', text: 'Male' };
      case 'female':
        return { icon: <FemaleIcon fontSize="small" />, color: 'secondary.main', text: 'Female' };
      default:
        return { icon: <GroupsIcon fontSize="small" />, color: 'text.secondary', text: 'Not specified' };
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '70vh',
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 40,
              height: 40
            }}
          >
            <ApartmentIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" component="div">
              {apartment.address || 'Apartment Details'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Property ID: {apartment.id}
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: 'grey.500',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Location Information */}
          <Grid item xs={12}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <LocationIcon color="primary" fontSize="small" />
              Location Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Full Address
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.address || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    City
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.city || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    ZIP Code
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.zip_code || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    State/Province
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.state || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Country
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.country || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Building/Floor
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {[apartment.building, apartment.floor].filter(Boolean).join(' / ') || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Property Details */}
          <Grid item xs={12}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <HomeIcon color="primary" fontSize="small" />
              Property Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Rooms
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.rooms || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Bedrooms
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.bedrooms || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>


              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Size (m²)
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.area || apartment.size || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Maximum Occupancy
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {maxOccupancy}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Gender Preference
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {apartment.genderPreference === 'male' ? 'Male' : apartment.genderPreference === 'female' ? 'Female' : 'Mixed'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Status
                  </Typography>
                  <Chip
                    label={apartment.status || 'Unknown'}
                    size="small"
                    color={apartment.status === 'occupied' ? 'success' : apartment.status === 'vacant' ? 'warning' : 'default'}
                    sx={{ height: 24 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Financial Information - Always show rent, admin sees more */}
          <Grid item xs={12}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <EuroIcon color="primary" fontSize="small" />
              Financial Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Monthly Rent
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    €{apartment.rent || 0}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Security Deposit
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    €{apartment.deposit || 0}
                  </Typography>
                </Box>
              </Grid>

              {/* Admin-only financial fields */}
              {isAdmin && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Rental Model
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {apartment.model === 'management' ? 'Management' : 'Rental'}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Management Fee {apartment.model === 'management' ? '(%)' : '(€)'}
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {apartment.model === 'management' ? `${apartment.managementFee || 0}%` : `€${apartment.managementFee || 0}`}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Rent Cost (What we pay)
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        €{apartment.rentCost || 0}
                      </Typography>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>

          {/* Important Dates */}
          <Grid item xs={12}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <AccessTimeIcon color="primary" fontSize="small" />
              Important Dates
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Move-in Date
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDate(apartment.moveInDate)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: apartment.expiryStatus?.status === 'expired'
                    ? 'error.main'
                    : apartment.expiryStatus?.status === 'expiring_soon'
                      ? 'warning.main'
                      : 'divider',
                  borderRadius: 1,
                  bgcolor: apartment.expiryStatus?.status === 'expired'
                    ? 'error.50'
                    : apartment.expiryStatus?.status === 'expiring_soon'
                      ? 'warning.50'
                      : 'background.paper'
                }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Contract End Date
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDate(apartment.contractEndDate)}
                  </Typography>
                  {apartment.expiryStatus?.daysUntilExpiry !== null && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {apartment.expiryStatus.daysUntilExpiry < 0
                        ? `Expired ${Math.abs(apartment.expiryStatus.daysUntilExpiry)} days ago`
                        : `${apartment.expiryStatus.daysUntilExpiry} days remaining`
                      }
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Current Tenants Section - New Table Format */}
          <Grid item xs={12}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <PersonIcon color="primary" fontSize="small" />
              Current Tenants ({currentTenantCount}/{maxOccupancy})
            </Typography>

            {loadingTenants ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : tenantsError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {tenantsError}
              </Alert>
            ) : currentTenants.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  textAlign: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'grey.50'
                }}
              >
                <PersonIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No tenants currently assigned to this apartment
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Full Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Gender</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Contract Exp. Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentTenants.map((tenant) => {
                      const genderDisplay = getGenderDisplay(tenant.gender);
                      return (
                        <TableRow
                          key={tenant.id}
                          hover
                          sx={{
                            '&:hover': {
                              cursor: 'pointer'
                            }
                          }}
                          onClick={() => handleTenantClick(tenant.id)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar
                                sx={{
                                  width: 32,
                                  height: 32,
                                  bgcolor: tenant.isPrimary ? 'primary.main' : 'grey.400',
                                  fontSize: '0.8rem'
                                }}
                              >
                                {getTenantDisplayName(tenant).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {getTenantDisplayName(tenant)}
                                  {tenant.isPrimary && (
                                    <Chip
                                      label="Primary"
                                      size="small"
                                      color="primary"
                                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {tenant.email || 'No email'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box sx={{ color: genderDisplay.color }}>
                                {genderDisplay.icon}
                              </Box>
                              <Typography variant="body2">
                                {genderDisplay.text}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                color: tenant.contractExpiryDate
                                  ? (new Date(tenant.contractExpiryDate) < new Date() ? 'error.main' : 'text.primary')
                                  : 'text.secondary'
                              }}
                            >
                              {tenant.contractExpiryDate ? formatDate(tenant.contractExpiryDate) : 'No expiry date'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View tenant details">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTenantClick(tenant.id);
                                }}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>

          {/* Notes Section */}
          {apartment.notes && (
            <Grid item xs={12}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <DescriptionIcon color="primary" fontSize="small" />
                Notes
              </Typography>
              <Box
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'grey.50'
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    userSelect: 'text'
                  }}
                >
                  {apartment.notes}
                </Typography>
              </Box>
            </Grid>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 1, textTransform: 'none' }}
        >
          Close
        </Button>

        {onEdit && (
          <Button
            onClick={() => {
              onClose();
              onEdit(apartment);
            }}
            variant="outlined"
            color="primary"
            sx={{ borderRadius: 1, textTransform: 'none' }}
          >
            Edit Apartment
          </Button>
        )}

        {apartment?.contractEndDate && onExtendContract && (
          <Button
            onClick={() => onExtendContract(apartment)}
            variant="outlined"
            color="secondary"
            startIcon={<AccessTimeIcon />}
            sx={{ borderRadius: 1, textTransform: 'none' }}
          >
            Extend Contract
          </Button>
        )}

        {onOpenContractManagement && (
          <Button
            onClick={onOpenContractManagement}
            variant="outlined"
            color="secondary"
            startIcon={<BusinessIcon />}
            sx={{ borderRadius: 1, textTransform: 'none' }}
          >
            Manage Contracts
          </Button>
        )}

        {isAdmin && onGenerateContract && (
          <Button
            onClick={() => onGenerateContract(apartment.id)}
            variant="contained"
            startIcon={<DescriptionIcon />}
            sx={{ borderRadius: 1, textTransform: 'none' }}
          >
            Generate Contract
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ApartmentDetailsDialog;
