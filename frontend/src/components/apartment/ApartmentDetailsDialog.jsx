// ApartmentDetailsDialog.jsx - COMPLETE FIXED VERSION
import React from 'react';
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
  Stack
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
  ContactMail as ContactMailIcon
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
  if (!apartment) return null;

  // Get current tenants (handle both old and new data structures)
  const getCurrentTenants = () => {
    // Try to get tenants from current contract first
    if (apartment.current_contract?.tenants) {
      return apartment.current_contract.tenants.map(ct => ct.tenant).filter(Boolean);
    }

    // Fallback to legacy tenants array
    if (apartment.tenants && Array.isArray(apartment.tenants)) {
      return apartment.tenants;
    }

    return [];
  };

  const tenants = getCurrentTenants();
  const currentTenantCount = apartment.current_tenant_count || tenants.length;
  const maxOccupancy = apartment.maxOccupancy || 1;

  // Get tenant display name
  const getTenantDisplayName = (tenant) => {
    if (!tenant) return 'Unknown Tenant';
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    }
    return tenant.name || 'Unnamed Tenant';
  };

  // Get tenant initials for avatar
  const getTenantInitials = (tenant) => {
    const name = getTenantDisplayName(tenant);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handle copying text to clipboard
  const handleCopyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      if (showNotification) {
        showNotification(`${label} copied to clipboard`, 'success');
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      if (showNotification) {
        showNotification('Failed to copy to clipboard', 'error');
      }
    }
  };

  // Handle tenant navigation (separate from copy functionality)
  const handleTenantNavigation = (tenant) => {
    if (onGoToTenant) {
      onClose(); // Close the dialog first
      onGoToTenant(tenant.id);
    }
  };

  // Handle text selection prevention for navigation
  const handleMouseDown = (e) => {
    // Allow text selection by preventing click if user is selecting text
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      e.stopPropagation();
      return;
    }
  };

  // Handle click with text selection check
  const handleCardClick = (e, tenant) => {
    // Check if user is selecting text
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      e.stopPropagation();
      return;
    }

    // Check if click target is a copy button or other interactive element
    if (e.target.closest('.copy-button') || e.target.closest('button')) {
      e.stopPropagation();
      return;
    }

    // Only navigate if not selecting text and not clicking interactive elements
    handleTenantNavigation(tenant);
  };

  const getLandlordInfo = (apartment) => {
    if (apartment.landlord) {
      return {
        name: apartment.landlord.company_name || apartment.landlord.name || 'Not specified',
        contact_name: apartment.landlord.name || '',
        email: apartment.landlord.email || '',
        phone: apartment.landlord.phone || ''
      };
    }

    return {
      name: apartment.landlordName || 'Not specified',
      contact_name: '',
      email: apartment.landlordEmail || '',
      phone: apartment.landlordPhone || ''
    };
  };

  const landlordInfo = getLandlordInfo(apartment);

  const formatDate = (date) => {
    if (!date) return 'Not set';
    try {
      return new Date(date).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      'vacant': { label: 'Vacant', color: 'default' },
      'occupied': { label: 'Occupied', color: 'success' },
      'contract_sent': { label: 'Contract Sent', color: 'warning' },
      'maintenance': { label: 'Maintenance', color: 'error' }
    };

    const config = statusConfig[status] || { label: status, color: 'default' };

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        sx={{ fontWeight: 'bold' }}
      />
    );
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
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ApartmentIcon color="primary" />
          <Typography variant="h6" component="div">
            {apartment.address || 'Property Details'}
          </Typography>
          {getStatusChip(apartment.status)}
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: 'grey.500' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ mt: 1 }}>
          <Grid container spacing={3}>

            {/* Property Information */}
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
                Property Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      <LocationIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                      Full Address
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ userSelect: 'text', cursor: 'text' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {apartment.address || 'Not set'}
                    </Typography>
                    <Tooltip title="Copy address">
                      <IconButton
                        size="small"
                        className="copy-button"
                        onClick={() => handleCopyToClipboard(apartment.address, 'Address')}
                        sx={{ mt: 1 }}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      <BedIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                      Rooms
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {apartment.rooms || 0}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      <SquareFootIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                      Size
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {apartment.size || 0} m²
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      <PeopleIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                      Max Occupancy
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {maxOccupancy}
                    </Typography>
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
                          Property Model
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {apartment.model === 'management' ? 'Management' : 'Rental'}
                        </Typography>
                      </Box>
                    </Grid>

                    {apartment.model === 'management' && (
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Management Fee
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            €{apartment.managementFee || 0}
                          </Typography>
                        </Box>
                      </Grid>
                    )}

                    {apartment.model === 'rental' && (
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Rent Cost
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            €{apartment.rentCost || 0}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Grid>

            {/* Dates Information */}
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

            {/* Current Tenants Section */}
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

              {tenants.length === 0 ? (
                <Box sx={{
                  p: 3,
                  textAlign: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'grey.50'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    No tenants currently assigned to this property
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {tenants.map((tenant, index) => (
                    <Grid item xs={12} sm={6} key={tenant.id || index}>
                      <Card
                        variant="outlined"
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: 2,
                            borderColor: 'primary.light'
                          },
                          userSelect: 'text',
                          cursor: onGoToTenant ? 'pointer' : 'default'
                        }}
                        onClick={(e) => handleCardClick(e, tenant)}
                        onMouseDown={handleMouseDown}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                            <Avatar
                              sx={{
                                bgcolor: 'primary.main',
                                width: 48,
                                height: 48,
                                fontSize: '1.1rem'
                              }}
                            >
                              {getTenantInitials(tenant)}
                            </Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight={600}
                                  sx={{
                                    wordBreak: 'break-word',
                                    userSelect: 'text'
                                  }}
                                >
                                  {getTenantDisplayName(tenant)}
                                </Typography>

                                {onGoToTenant && (
                                  <Tooltip title="View tenant details">
                                    <IconButton
                                      size="small"
                                      className="copy-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTenantNavigation(tenant);
                                      }}
                                      sx={{ color: 'primary.main' }}
                                    >
                                      <ViewIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          </Box>

                          <Stack spacing={1}>
                            {/* Email with copy button */}
                            {tenant.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                  <EmailIcon fontSize="small" color="action" />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      userSelect: 'text',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                  >
                                    {tenant.email}
                                  </Typography>
                                </Box>
                                <Tooltip title="Copy email">
                                  <IconButton
                                    size="small"
                                    className="copy-button"
                                    onClick={() => handleCopyToClipboard(tenant.email, 'Email')}
                                    sx={{ color: 'text.secondary' }}
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}

                            {/* Phone with copy button */}
                            {tenant.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ userSelect: 'text' }}
                                  >
                                    {tenant.phone}
                                  </Typography>
                                </Box>
                                <Tooltip title="Copy phone">
                                  <IconButton
                                    size="small"
                                    className="copy-button"
                                    onClick={() => handleCopyToClipboard(tenant.phone, 'Phone')}
                                    sx={{ color: 'text.secondary' }}
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}

                            {/* Additional tenant details if available */}
                            {tenant.bornOn && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PersonIcon fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ userSelect: 'text' }}
                                >
                                  Born: {formatDate(tenant.bornOn)}
                                </Typography>
                              </Box>
                            )}
                          </Stack>

                          {/* Navigation hint - only show if onGoToTenant is available */}
                          {onGoToTenant && (
                            <Box sx={{
                              mt: 2,
                              pt: 1,
                              borderTop: '1px solid',
                              borderColor: 'divider',
                              textAlign: 'center'
                            }}>
                              <Typography variant="caption" color="text.secondary">
                                💡 Select text to copy • Click 👁️ to view details
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Grid>

            {/* Landlord Information - Always visible to users */}
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
                <BusinessIcon color="primary" fontSize="small" />
                Landlord Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Company/Name
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ userSelect: 'text' }}
                    >
                      {landlordInfo.name}
                    </Typography>
                    {landlordInfo.name !== 'Not specified' && (
                      <Tooltip title="Copy landlord name">
                        <IconButton
                          size="small"
                          className="copy-button"
                          onClick={() => handleCopyToClipboard(landlordInfo.name, 'Landlord Name')}
                          sx={{ mt: 1, color: 'text.secondary' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Grid>

                {landlordInfo.contact_name && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Contact Person
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ userSelect: 'text' }}
                      >
                        {landlordInfo.contact_name}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {landlordInfo.email && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        <EmailIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        Email
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          userSelect: 'text',
                          wordBreak: 'break-all'
                        }}
                      >
                        {landlordInfo.email}
                      </Typography>
                      <Tooltip title="Copy email">
                        <IconButton
                          size="small"
                          className="copy-button"
                          onClick={() => handleCopyToClipboard(landlordInfo.email, 'Landlord Email')}
                          sx={{ mt: 1, color: 'text.secondary' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                )}

                {landlordInfo.phone && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        <PhoneIcon fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        Phone
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ userSelect: 'text' }}
                      >
                        {landlordInfo.phone}
                      </Typography>
                      <Tooltip title="Copy phone">
                        <IconButton
                          size="small"
                          className="copy-button"
                          onClick={() => handleCopyToClipboard(landlordInfo.phone, 'Landlord Phone')}
                          sx={{ mt: 1, color: 'text.secondary' }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Grid>

            {/* Additional Notes */}
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
                <Box sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
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
          </Grid>
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

// Helper function to format dates
const formatDate = (date) => {
  if (!date) return 'Not set';
  try {
    return new Date(date).toLocaleDateString('en-GB');
  } catch {
    return 'Invalid date';
  }
};

export default ApartmentDetailsDialog;
