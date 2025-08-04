import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Payment as PaymentIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  Bed as BedIcon,
  SquareFoot as SquareFootIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

// Import utility functions locally
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
      icon = <ErrorIcon sx={{ fontSize: '0.8rem' }} />;
    } else if (expiryStatus.status === 'expiring_soon') {
      color = 'warning';
      displayStatus = `Expires in ${expiryStatus.daysUntilExpiry} days`;
      icon = <WarningIcon sx={{ fontSize: '0.8rem' }} />;
    }
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
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
      {icon}
      {displayStatus}
    </Box>
  );
};

function ApartmentCard({
  apartment,
  onEdit,
  onGoToPayments,
  onGenerateContract,
  onOpenDetails,
  onGoToTenant, // New prop for tenant navigation
  isAdmin
}) {
  const [tenantMenuAnchor, setTenantMenuAnchor] = useState(null);

  const getAddressInitial = (address) => {
    return address && address.charAt(0).toUpperCase();
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(apartment);
  };

  const handlePaymentClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGoToPayments(apartment.id);
  };

  const handleGenerateContractClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGenerateContract(apartment.id);
  };

  const handleDetailsClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenDetails(apartment);
  };

  const handleTenantMenuClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTenantMenuAnchor(e.currentTarget);
  };

  const handleTenantMenuClose = () => {
    setTenantMenuAnchor(null);
  };

  const handleTenantClick = (tenant) => {
    handleTenantMenuClose();
    if (onGoToTenant && tenant.id) {
      onGoToTenant(tenant.id);
    }
  };

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

  const getTenantDisplayName = (tenant) => {
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    }
    return tenant.name || 'Unnamed Tenant';
  };

  const tenants = apartment.tenants || [];
  const hasTenants = tenants.length > 0;

  return (
    <Card
      elevation={0}
      onClick={() => onOpenDetails(apartment)}
      sx={{
        borderRadius: 2,
        height: '100%',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        border: '1px solid',
        borderColor: apartment.expiryStatus?.status === 'expired'
          ? 'error.main'
          : apartment.expiryStatus?.status === 'expiring_soon'
            ? 'warning.main'
            : 'divider',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-4px)',
          borderColor: apartment.expiryStatus?.status === 'expired'
            ? 'error.main'
            : apartment.expiryStatus?.status === 'expiring_soon'
              ? 'warning.main'
              : 'primary.main'
        },
        cursor: 'pointer'
      }}
    >
      <Box
        sx={{
          p: 2,
          background: apartment.expiryStatus?.status === 'expired'
            ? 'linear-gradient(to right, rgba(211, 47, 47, 0.05), rgba(211, 47, 47, 0))'
            : apartment.expiryStatus?.status === 'expiring_soon'
              ? 'linear-gradient(to right, rgba(237, 108, 2, 0.05), rgba(237, 108, 2, 0))'
              : 'linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0))',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '80%' }}>
          <Avatar
            sx={{
              backgroundColor: apartment.expiryStatus?.status === 'expired'
                ? 'error.main'
                : apartment.expiryStatus?.status === 'expiring_soon'
                  ? 'warning.main'
                  : 'primary.main',
              width: 36,
              height: 36
            }}
          >
            {getAddressInitial(apartment.address)}
          </Avatar>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              fontSize: '0.95rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {apartment.address}
          </Typography>
        </Box>
        {getStatusChip(apartment.status, apartment.contractEndDate)}
      </Box>

      <CardContent sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
            <BedIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
            <Typography variant="body2" color="text.secondary">
              {apartment.rooms} rooms
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
            <SquareFootIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
            <Typography variant="body2" color="text.secondary">
              {apartment.size} m²
            </Typography>
          </Box>
          {apartment.moveInDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <EventIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
              <Typography variant="body2" color="text.secondary">
                {new Date(apartment.moveInDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
          {apartment.contractEndDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
              <AccessTimeIcon
                fontSize="small"
                sx={{
                  color: apartment.expiryStatus?.status === 'expired'
                    ? 'error.main'
                    : apartment.expiryStatus?.status === 'expiring_soon'
                      ? 'warning.main'
                      : 'text.secondary',
                  fontSize: '1rem'
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: apartment.expiryStatus?.status === 'expired'
                    ? 'error.main'
                    : apartment.expiryStatus?.status === 'expiring_soon'
                      ? 'warning.main'
                      : 'text.secondary'
                }}
              >
                Expires: {new Date(apartment.contractEndDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}

          {/* Enhanced Tenants Section */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem', mt: 0.5 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {hasTenants ? (
                <Box>
                  {/* Show tenant names or clickable chips */}
                  {onGoToTenant ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {tenants.slice(0, 2).map((tenant) => (
                        <Chip
                          key={tenant.id}
                          label={getTenantDisplayName(tenant)}
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTenantClick(tenant);
                          }}
                          sx={{
                            fontSize: '0.7rem',
                            height: '20px',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'primary.50',
                              borderColor: 'primary.main'
                            }
                          }}
                        />
                      ))}
                      {tenants.length > 2 && (
                        <IconButton
                          size="small"
                          onClick={handleTenantMenuClick}
                          sx={{
                            width: 20,
                            height: 20,
                            color: 'text.secondary',
                            '&:hover': { color: 'primary.main' }
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {formatTenantNames(tenants)}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tenants assigned
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 1
          }}
        >
          <Box
            onClick={handlePaymentClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              borderRadius: 1,
              py: 0.5,
              px: 1,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <PaymentIcon fontSize="small" color="primary" />
            <Typography
              variant="body2"
              color="primary"
              sx={{
                fontWeight: 500,
                fontSize: '0.8rem',
                userSelect: 'none'
              }}
            >
              Payments
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Generate Contract">
              <IconButton
                size="small"
                onClick={handleGenerateContractClick}
                sx={{ color: 'success.main' }}
              >
                <DescriptionIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {isAdmin && (
              <Tooltip title="Edit Property">
                <IconButton
                  size="small"
                  onClick={handleEditClick}
                  sx={{ color: 'primary.main' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Button
              size="small"
              variant="outlined"
              onClick={handleDetailsClick}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8rem',
                minWidth: 0,
                borderColor: 'divider'
              }}
            >
              Details
            </Button>
          </Box>
        </Box>
      </CardContent>

      {/* Tenant Menu for overflow tenants */}
      <Menu
        anchorEl={tenantMenuAnchor}
        open={Boolean(tenantMenuAnchor)}
        onClose={handleTenantMenuClose}
        PaperProps={{
          sx: {
            maxWidth: 250,
            borderRadius: 1
          }
        }}
      >
        {tenants.slice(2).map((tenant) => (
          <MenuItem
            key={tenant.id}
            onClick={() => handleTenantClick(tenant)}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={getTenantDisplayName(tenant)}
              secondary={tenant.email || 'No email'}
            />
            <ViewIcon fontSize="small" color="action" sx={{ ml: 1 }} />
          </MenuItem>
        ))}
      </Menu>
    </Card>
  );
}

export default ApartmentCard;
