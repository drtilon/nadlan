// ApartmentDetailsDialog.jsx - FIXED VERSION with copyable tenant info
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
  Apartment as ApartmentIcon
} from '@mui/icons-material';

function ApartmentDetailsDialog({
  apartment,
  open,
  onClose,
  onGenerateContract,
  onExtendContract,
  onOpenContractManagement,
  onGoToTenant,
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
      // You could add a notification here if showNotification is available
    } catch (err) {
      console.error('Failed to copy text: ', err);
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
        name: apartment.landlord.name || 'Not specified',
        email: apartment.landlord.email || '',
        phone: apartment.landlord.phone || ''
      };
    }

    return {
      name: apartment.landlordName || 'Not specified',
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
                <Grid item xs={12} sm={6} md={3}>
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
                          userSelect: 'text' // Allow text selection
                        }}
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
                                    userSelect: 'text' // Explicitly allow text selection
                                  }}
                                >
                                  {getTenantDisplayName(tenant)}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  {/* Copy Name Button */}
                                  <Tooltip title="Copy name">
                                    <IconButton
                                      size="small"
                                      className="copy-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyToClipboard(getTenantDisplayName(tenant), 'Name');
                                      }}
                                      sx={{ color: 'text.secondary' }}
                                    >
                                      <CopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {/* View Details Button */}
                                  {onGoToTenant && (
                                    <Tooltip title="View tenant details">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTenantNavigation(tenant);
                                        }}
                                      >
                                        <ViewIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </Box>
                              {tenant.isPrimary && (
                                <Chip
                                  label="Primary Tenant"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ mb: 1 }}
                                />
                              )}
                            </Box>
                          </Box>

                          {/* Contact Information - Made Copyable */}
                          <Stack spacing={1.5}>
                            {tenant.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    flexGrow: 1,
                                    userSelect: 'text',
                                    wordBreak: 'break-all'
                                  }}
                                >
                                  {tenant.email}
                                </Typography>
                                <Tooltip title="Copy email">
                                  <IconButton
                                    size="small"
                                    className="copy-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyToClipboard(tenant.email, 'Email');
                                    }}
                                    sx={{ color: 'text.secondary' }}
                                  >
                                    <CopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}

                            {tenant.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    flexGrow: 1,
                                    userSelect: 'text'
                                  }}
                                >
                                  {tenant.phone}
                                </Typography>
                                <Tooltip title="Copy phone">
                                  <IconButton
                                    size="small"
                                    className="copy-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyToClipboard(tenant.phone, 'Phone');
                                    }}
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

            {/* Landlord Information - Also made copyable */}
            {(landlordInfo.name !== 'Not specified' || landlordInfo.email || landlordInfo.phone) && (
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
                  Landlord Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                          Name
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ userSelect: 'text' }}
                        >
                          {landlordInfo.name || 'Not provided'}
                        </Typography>
                      </Box>
                      {landlordInfo.name && landlordInfo.name !== 'Not specified' && (
                        <Tooltip title="Copy name">
                          <IconButton
                            size="small"
                            className="copy-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToClipboard(landlordInfo.name, 'Landlord Name');
                            }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
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
                          {landlordInfo.email || 'Not provided'}
                        </Typography>
                      </Box>
                      {landlordInfo.email && (
                        <Tooltip title="Copy email">
                          <IconButton
                            size="small"
                            className="copy-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToClipboard(landlordInfo.email, 'Landlord Email');
                            }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                          Phone
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={500}
                          sx={{ userSelect: 'text' }}
                        >
                          {landlordInfo.phone || 'Not provided'}
                        </Typography>
                      </Box>
                      {landlordInfo.phone && (
                        <Tooltip title="Copy phone">
                          <IconButton
                            size="small"
                            className="copy-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToClipboard(landlordInfo.phone, 'Landlord Phone');
                            }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
            )}

            {/* Additional Notes */}
            {apartment.notes && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
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

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 1, textTransform: 'none' }}
        >
          Close
        </Button>

        {apartment?.contractEndDate && (
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

        <Button
          onClick={onOpenContractManagement}
          variant="outlined"
          color="secondary"
          startIcon={<BusinessIcon />}
          sx={{ borderRadius: 1, textTransform: 'none' }}
        >
          Manage Contracts
        </Button>

        {isAdmin && (
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
