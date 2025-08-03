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
  Email as EmailIcon,
  Phone as PhoneIcon,
  CreditCard as IbanIcon,
  Cake as BirthdayIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

// Status Chip Component
const StatusChip = ({ status, expiryStatus }) => {
  const getStatusConfig = (status, expiryStatus) => {
    const statusLower = status?.toLowerCase() || '';

    if (expiryStatus?.status === 'expired') {
      return { color: 'error', icon: '🚫', displayStatus: 'Contract Expired' };
    }
    if (expiryStatus?.status === 'expiring_soon') {
      return { color: 'warning', icon: '⚠️', displayStatus: 'Expiring Soon' };
    }
    if (statusLower.includes('occupied') || statusLower.includes('rented')) {
      return { color: 'success', icon: '🏠', displayStatus: 'Occupied' };
    }
    if (statusLower.includes('vacant') || statusLower.includes('available')) {
      return { color: 'default', icon: '🔓', displayStatus: 'Vacant' };
    }
    if (statusLower.includes('contract') && statusLower.includes('sent')) {
      return { color: 'warning', icon: '📄', displayStatus: 'Contract Sent' };
    }
    return { color: 'default', icon: '❓', displayStatus: status || 'Unknown' };
  };

  const { color, icon, displayStatus } = getStatusConfig(status, expiryStatus);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: 2,
        fontSize: '0.875rem',
        fontWeight: 600,
        bgcolor: color === 'error' ? 'error.main' :
                color === 'warning' ? 'warning.main' :
                color === 'success' ? 'success.main' :
                color === 'primary' ? 'primary.main' : 'grey.300',
        color: color === 'default' ? 'text.primary' : 'white'
      }}
    >
      {icon}
      {displayStatus}
    </Box>
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
          alignItems: 'center',
          p: 3,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <StatusChip status={apartment.status} expiryStatus={apartment.expiryStatus} />
            {apartment.expiryStatus && (
              <Chip
                label={apartment.expiryStatus.daysRemaining >= 0
                  ? `${apartment.expiryStatus.daysRemaining} days left`
                  : `Expired ${Math.abs(apartment.expiryStatus.daysRemaining)} days ago`
                }
                color={apartment.expiryStatus.status === 'expired' ? 'error' : 'warning'}
                size="small"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
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
                  borderRadius: 1,
                  textTransform: 'none'
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
                borderRadius: 1,
                textTransform: 'none'
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
                Current Tenants ({tenants.length})
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
