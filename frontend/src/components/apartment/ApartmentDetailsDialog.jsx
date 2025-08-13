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
  Chip,
  Avatar,
  IconButton,
  Card,
  CardContent,
  Divider,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Payment as PaymentIcon,
  Home as HomeIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CreditCard as IbanIcon,
  Cake as BirthdayIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

// Status Chip Component
const StatusChip = ({ status, expiryStatus }) => {
  const getStatusConfig = (status, expiryStatus) => {
    const statusLower = status?.toLowerCase() || '';

    if (expiryStatus?.status === 'expired') {
      return { color: 'error', icon: <ErrorIcon sx={{ fontSize: '1rem' }} />, displayStatus: 'Contract Expired' };
    }
    if (expiryStatus?.status === 'expiring_soon') {
      return { color: 'warning', icon: <WarningIcon sx={{ fontSize: '1rem' }} />, displayStatus: 'Expiring Soon' };
    }
    if (statusLower.includes('occupied') || statusLower.includes('rented')) {
      return { color: 'success', icon: <HomeIcon sx={{ fontSize: '1rem' }} />, displayStatus: 'Occupied' };
    }
    if (statusLower.includes('vacant') || statusLower.includes('available')) {
      return { color: 'primary', icon: <HomeIcon sx={{ fontSize: '1rem' }} />, displayStatus: 'Vacant' };
    }
    if (statusLower.includes('contract') && statusLower.includes('sent')) {
      return { color: 'warning', icon: <DescriptionIcon sx={{ fontSize: '1rem' }} />, displayStatus: 'Contract Sent' };
    }
    return { color: 'default', icon: <HomeIcon sx={{ fontSize: '1rem' }} />, displayStatus: status || 'Unknown' };
  };

  const { color, icon, displayStatus } = getStatusConfig(status, expiryStatus);

  return (
    <Chip
      icon={icon}
      label={displayStatus}
      color={color}
      sx={{
        fontWeight: 600,
        fontSize: '0.875rem',
        height: 32,
        '& .MuiChip-icon': {
          fontSize: '1rem'
        }
      }}
    />
  );
};

// Occupancy Status Component
const OccupancyStatus = ({ currentCount, maxOccupancy }) => {
  const percentage = maxOccupancy > 0 ? (currentCount / maxOccupancy) * 100 : 0;
  const isFull = currentCount >= maxOccupancy;

  const getOccupancyConfig = () => {
    if (isFull) {
      return { color: 'error', icon: <WarningIcon sx={{ fontSize: '1rem' }} />, status: 'Full Capacity' };
    }
    if (percentage >= 80) {
      return { color: 'warning', icon: <PeopleIcon sx={{ fontSize: '1rem' }} />, status: 'Near Capacity' };
    }
    if (percentage >= 50) {
      return { color: 'info', icon: <PeopleIcon sx={{ fontSize: '1rem' }} />, status: 'Moderate' };
    }
    return { color: 'success', icon: <PeopleIcon sx={{ fontSize: '1rem' }} />, status: 'Available Space' };
  };

  const { color, icon, status } = getOccupancyConfig();

  return (
    <Chip
      icon={icon}
      label={`${currentCount}/${maxOccupancy} - ${status}`}
      color={color}
      variant="outlined"
      sx={{
        fontWeight: 600,
        fontSize: '0.875rem',
        height: 32,
        '& .MuiChip-icon': {
          fontSize: '1rem'
        }
      }}
    />
  );
};

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return 'Not provided';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString();
  } catch (error) {
    return dateString;
  }
};

function ApartmentDetailsDialog({
  open,
  onClose,
  apartment,
  onEdit,
  onGoToPayments,
  onGenerateContract,
  onExtendContract,
  onOpenContractManagement,
  onGoToTenant,
  isAdmin
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

  // Handle tenant click
  const handleTenantClick = (tenant) => {
    if (onGoToTenant) {
      onClose(); // Close the dialog first
      onGoToTenant(tenant.id);
    }
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, maxHeight: '90vh' }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HomeIcon color="primary" />
          <Typography variant="h6" component="span">
            {apartment.address}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Status and Quick Actions */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          p: 3,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {/* Primary Status Row */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusChip status={apartment.status} expiryStatus={apartment.expiryStatus} />
              <OccupancyStatus currentCount={currentTenantCount} maxOccupancy={maxOccupancy} />
            </Box>

            {/* Secondary Status Info */}
            {apartment.expiryStatus && apartment.expiryStatus.daysUntilExpiry !== null && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={apartment.expiryStatus.daysUntilExpiry >= 0
                    ? `${apartment.expiryStatus.daysUntilExpiry} days remaining`
                    : `Expired ${Math.abs(apartment.expiryStatus.daysUntilExpiry)} days ago`
                  }
                  color={apartment.expiryStatus.status === 'expired' ? 'error' : 'warning'}
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
            {isAdmin && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                variant="outlined"
                onClick={() => {
                  onClose();
                  onEdit(apartment);
                }}
                sx={{
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 500,
                  px: 2
                }}
              >
                Edit
              </Button>
            )}
            <Button
              size="small"
              startIcon={<PaymentIcon />}
              variant="contained"
              onClick={() => {
                onClose();
                onGoToPayments(apartment.id);
              }}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                px: 2
              }}
            >
              Payments
            </Button>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Property Details Section */}
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
                      {apartment.rooms}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Size (m²)
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {apartment.size}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Max Occupancy
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {maxOccupancy} people
                    </Typography>
                  </Box>
                </Grid>
                {apartment.model && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Model
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {apartment.model === 'pm'
                          ? 'Property Management'
                          : apartment.model === 'rental'
                            ? 'Rental Property'
                            : apartment.model}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Monthly Rent
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatCurrency(apartment.rent)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* Contract Details Section */}
            <Grid item xs={12} sx={{ mt: 2 }}>
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
                Contract Timeline
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Move-In Date
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
                          cursor: onGoToTenant ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          '&:hover': onGoToTenant ? {
                            boxShadow: 2,
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)'
                          } : {}
                        }}
                        onClick={() => handleTenantClick(tenant)}
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
                                <Typography variant="subtitle1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                                  {getTenantDisplayName(tenant)}
                                </Typography>
                                {onGoToTenant && (
                                  <Tooltip title="View tenant details">
                                    <IconButton size="small" color="primary">
                                      <ViewIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
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

                          <Divider sx={{ my: 1 }} />

                          <Stack spacing={1}>
                            {tenant.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                  {tenant.email}
                                </Typography>
                              </Box>
                            )}
                            {tenant.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {tenant.phone}
                                </Typography>
                              </Box>
                            )}
                            {tenant.bornOn && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BirthdayIcon fontSize="small" color="action" />
                                <Typography variant="body2">
                                  Born: {formatDate(tenant.bornOn)}
                                </Typography>
                              </Box>
                            )}
                            {tenant.refundIban && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IbanIcon fontSize="small" color="action" />
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {tenant.refundIban}
                                </Typography>
                              </Box>
                            )}
                          </Stack>

                          {onGoToTenant && (
                            <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="caption" color="primary.main">
                                Click to view full tenant details →
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

            {/* Landlord Information */}
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
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Name
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {landlordInfo.name || 'Not provided'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Email
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {landlordInfo.email || 'Not provided'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Phone
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {landlordInfo.phone || 'Not provided'}
                      </Typography>
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
                <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
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
