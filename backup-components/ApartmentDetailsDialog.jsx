import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  LocationOn as LocationOnIcon,
  Edit as EditIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  AccessTime as AccessTimeIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Person as PersonIcon
} from '@mui/icons-material';
// Import utility functions locally since apartmentUtils might not exist yet
const getStatusChip = (status, contractEndDate) => {
  const getExpiryStatus = (contractEndDate) => {
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

  const expiryStatus = getExpiryStatus(contractEndDate);

  let color = 'default';
  let displayStatus = status;
  let icon = null;

  switch (status) {
    case 'occupied':
      color = 'success';
      displayStatus = 'Occupied';
      break;
    case 'vacant':
      color = 'primary';
      displayStatus = 'Vacant';
      break;
    case 'contract_sent':
      color = 'warning';
      displayStatus = 'Contract Sent';
      break;
    default:
      displayStatus = status || 'Unknown';
  }

  if (status === 'occupied') {
    if (expiryStatus.status === 'expired') {
      color = 'error';
      displayStatus = 'Expired';
    } else if (expiryStatus.status === 'expiring_soon') {
      color = 'warning';
      displayStatus = `Expires in ${expiryStatus.daysUntilExpiry} days`;
    }
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.5,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 500,
        bgcolor: color === 'error' ? 'error.main' :
                color === 'warning' ? 'warning.main' :
                color === 'success' ? 'success.main' :
                color === 'primary' ? 'primary.main' : 'grey.300',
        color: color === 'default' ? 'text.primary' : 'white'
      }}
    >
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
  isAdmin
}) {
  if (!apartment) return null;

  const formatTenantNames = (tenants) => {
    if (!tenants || !Array.isArray(tenants) || tenants.length === 0) {
      return 'No tenants assigned';
    }

    return tenants.map(tenant => {
      if (tenant.firstName && tenant.lastName) {
        return `${tenant.firstName} ${tenant.lastName}`;
      }
      return tenant.name || 'Unnamed Tenant';
    }).join(', ');
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
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle
        sx={{
          p: 3,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LocationOnIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {apartment.address}
          </Typography>
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Status:
            </Typography>
            {getStatusChip(apartment.status, apartment.contractEndDate)}
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
                      Property Size
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {apartment.size} m²
                    </Typography>
                  </Box>
                </Grid>
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
                {isAdmin && apartment.model && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Property Model
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {apartment.model === 'management'
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
                        : 'inherit'
                  }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      Contract End Date
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        color: apartment.expiryStatus?.status === 'expired'
                          ? 'error.main'
                          : apartment.expiryStatus?.status === 'expiring_soon'
                            ? 'warning.main'
                            : 'inherit'
                      }}
                    >
                      {formatDate(apartment.contractEndDate)}
                      {apartment.expiryStatus?.status === 'expired' && (
                        <Typography variant="caption" display="block" color="error.main">
                          Expired {Math.abs(apartment.expiryStatus.daysUntilExpiry)} days ago
                        </Typography>
                      )}
                      {apartment.expiryStatus?.status === 'expiring_soon' && (
                        <Typography variant="caption" display="block" color="warning.main">
                          Expires in {apartment.expiryStatus.daysUntilExpiry} days
                        </Typography>
                      )}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* Tenant Information */}
            {apartment.tenants && apartment.tenants.length > 0 && (
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
                  <PersonIcon color="primary" fontSize="small" />
                  Tenant Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                        Tenants
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatTenantNames(apartment.tenants)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
            )}

            {/* Landlord Information */}
            {isAdmin && (
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
                        {landlordInfo.name}
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
