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
  People as PeopleIcon,
  Bed as BedIcon,
  SquareFoot as SquareFootIcon,
  Event as EventIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
  Schedule as ScheduleIcon
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
      icon = <ErrorIcon sx={{ fontSize: '0.75rem' }} />;
    } else if (expiryStatus.status === 'expiring_soon') {
      color = 'warning';
      displayStatus = `Expires in ${expiryStatus.daysUntilExpiry} days`;
      icon = <WarningIcon sx={{ fontSize: '0.75rem' }} />;
    }
  }

  return (
    <Chip
      icon={icon}
      label={displayStatus}
      size="small"
      sx={{
        height: 24,
        fontSize: '0.75rem',
        fontWeight: 500,
        bgcolor: color === 'error' ? 'error.main' :
                color === 'warning' ? 'warning.main' :
                color === 'success' ? 'success.main' :
                color === 'primary' ? 'primary.main' : 'grey.300',
        color: color === 'default' ? 'text.primary' : 'white',
        '& .MuiChip-icon': {
          fontSize: '0.75rem',
          color: 'inherit'
        }
      }}
    />
  );
};

// Contract expiry display component
const ContractExpiryDisplay = ({ contractEndDate }) => {
  if (!contractEndDate) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ScheduleIcon sx={{ fontSize: '0.75rem', color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          No contract end date
        </Typography>
      </Box>
    );
  }

  const getExpiryStatus = (contractEndDate) => {
    const endDate = new Date(contractEndDate);
    const today = new Date();
    const timeDiff = endDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      return { status: 'expired', daysUntilExpiry, color: 'error.main' };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'critical', daysUntilExpiry, color: 'error.main' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring_soon', daysUntilExpiry, color: 'warning.main' };
    } else {
      return { status: 'valid', daysUntilExpiry, color: 'success.main' };
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const expiryStatus = getExpiryStatus(contractEndDate);

  let displayText = '';
  if (expiryStatus.status === 'expired') {
    displayText = `Expired ${Math.abs(expiryStatus.daysUntilExpiry)} days ago`;
  } else if (expiryStatus.status === 'critical') {
    displayText = `Expires in ${expiryStatus.daysUntilExpiry} days`;
  } else if (expiryStatus.status === 'expiring_soon') {
    displayText = `Expires in ${expiryStatus.daysUntilExpiry} days`;
  } else {
    displayText = `Expires ${formatDate(contractEndDate)}`;
  }

  return (
    <Tooltip title={`Contract expires: ${formatDate(contractEndDate)}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ScheduleIcon sx={{ fontSize: '0.75rem', color: expiryStatus.color }} />
        <Typography
          variant="caption"
          sx={{
            color: expiryStatus.color,
            fontWeight: expiryStatus.status === 'expired' || expiryStatus.status === 'critical' ? 600 : 400
          }}
        >
          {displayText}
        </Typography>
      </Box>
    </Tooltip>
  );
};

// Occupancy indicator component
const OccupancyIndicator = ({ currentCount, maxOccupancy, isFull }) => {
  const percentage = maxOccupancy > 0 ? (currentCount / maxOccupancy) * 100 : 0;

  return (
    <Tooltip title={`Occupancy: ${currentCount}/${maxOccupancy} tenants`}>
      <Chip
        label={`${currentCount}/${maxOccupancy}`}
        size="small"
        icon={<PeopleIcon />}
        sx={{
          height: 24,
          fontSize: '0.75rem',
          fontWeight: 500,
          bgcolor: isFull ? 'error.light' :
                   percentage >= 80 ? 'warning.light' :
                   percentage >= 50 ? 'info.light' : 'success.light',
          color: isFull ? 'error.dark' :
                 percentage >= 80 ? 'warning.dark' :
                 percentage >= 50 ? 'info.dark' : 'success.dark',
          border: '1px solid',
          borderColor: isFull ? 'error.main' :
                      percentage >= 80 ? 'warning.main' :
                      percentage >= 50 ? 'info.main' : 'success.main',
          '& .MuiChip-icon': {
            fontSize: '0.75rem',
            color: 'inherit'
          }
        }}
      />
    </Tooltip>
  );
};

// Gender badge component
const GenderBadge = ({ genderPreference }) => {
  if (!genderPreference || genderPreference === 'mixed') {
    return (
      <Chip
        label="Mixed"
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          bgcolor: 'info.light',
          color: 'info.dark'
        }}
      />
    );
  }

  return (
    <Chip
      label={genderPreference === 'male' ? 'Male' : 'Female'}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.7rem',
        bgcolor: genderPreference === 'male' ? 'primary.light' : 'secondary.light',
        color: genderPreference === 'male' ? 'primary.dark' : 'secondary.dark'
      }}
    />
  );
};

function ApartmentCard({
  apartment,
  onEdit,
  onGoToPayments,
  onGenerateContract,
  onOpenDetails,
  onGoToTenant,
  isAdmin
}) {
  const [tenantMenuAnchor, setTenantMenuAnchor] = useState(null);

  const getAddressInitial = (address) => {
    if (apartment.landlord?.company_name) {
      return apartment.landlord.company_name.charAt(0).toUpperCase();
    }
    if (apartment.landlord?.name) {
      return apartment.landlord.name.charAt(0).toUpperCase();
    }
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

  const getTenantDisplayName = (tenant) => {
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    }
    return tenant.name || 'Unnamed Tenant';
  };

  // Get data for display
  const tenants = apartment.tenants || [];
  const currentTenantCount = apartment.current_tenant_count || tenants.length;
  const maxOccupancy = apartment.maxOccupancy || 1;
  const isFull = apartment.is_full || currentTenantCount >= maxOccupancy;

  // Build address string
  const getFullAddress = () => {
    const parts = [];
    if (apartment.street_name && apartment.house_number) {
      parts.push(`${apartment.street_name} ${apartment.house_number}`);
    } else if (apartment.address) {
      parts.push(apartment.address);
    }

    const locationParts = [];
    if (apartment.zip_code) locationParts.push(apartment.zip_code);
    if (apartment.city) locationParts.push(apartment.city);
    if (apartment.state) locationParts.push(apartment.state);
    if (apartment.country && apartment.country !== 'Israel') locationParts.push(apartment.country);

    if (locationParts.length > 0) {
      parts.push(locationParts.join(', '));
    }

    return parts.join('\n');
  };

  const getBuildingInfo = () => {
    const parts = [];
    if (apartment.building) parts.push(`Building ${apartment.building}`);
    if (apartment.floor) parts.push(`Floor ${apartment.floor}`);
    if (apartment.side) parts.push(`Apt ${apartment.side}`);
    return parts.join(', ');
  };

  const getPropertyName = () => {
    if (apartment.name) return apartment.name;
    if (apartment.street_name) return apartment.street_name;
    return 'Property';
  };

  const getPropertyId = () => {
    return apartment.id ? `ID-${apartment.id}` : 'N/A';
  };

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
        cursor: 'pointer',
        '&:hover': {
          boxShadow: 2,
          transform: 'translateY(-2px)',
          borderColor: 'primary.main',
        },
        backgroundColor: '#fff'
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          p: 2,
          pb: 1,
          background: apartment.expiryStatus?.status === 'expired'
            ? 'linear-gradient(to right, rgba(211, 47, 47, 0.03), rgba(211, 47, 47, 0))'
            : apartment.expiryStatus?.status === 'expiring_soon'
              ? 'linear-gradient(to right, rgba(237, 108, 2, 0.03), rgba(237, 108, 2, 0))'
              : 'linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0))',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        {/* Top Landlord (centered) */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'primary.main'
            }}
          >
            {apartment.landlord?.company_name || apartment.landlord?.name || 'No Landlord'}
          </Typography>
        </Box>

        {/* Middle top (4 centered lines) */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {apartment.street_name && apartment.house_number
              ? `${apartment.street_name} ${apartment.house_number}`
              : apartment.address || 'No Address'
            }
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {[apartment.zip_code, apartment.city, apartment.state, apartment.country]
              .filter(Boolean).join(', ') || 'Location not specified'}
          </Typography>

          {getBuildingInfo() && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {getBuildingInfo()}
            </Typography>
          )}

          {/* Contract Expiry Display - NEW ADDITION */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <ContractExpiryDisplay contractEndDate={apartment.contractEndDate} />
          </Box>

          {/* Notice bar (badges): status, tenants_count/tenants_capacity, gender */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {getStatusChip(apartment.status, apartment.contractEndDate)}
            <OccupancyIndicator
              currentCount={currentTenantCount}
              maxOccupancy={maxOccupancy}
              isFull={isFull}
            />
            <GenderBadge genderPreference={apartment.genderPreference} />
          </Box>
        </Box>
      </Box>

      <CardContent sx={{ p: 2, pt: 1 }}>
        {/* Middle bottom (3 lines with headers and values) */}

        {/* Line 1: Property name · Property ID · Capacity */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Property name
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Property ID
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Capacity
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getPropertyName()}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {getPropertyId()}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {maxOccupancy}
            </Typography>
          </Box>
        </Box>

        {/* Line 2: Rooms · Size (m²) · Tenants */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Rooms
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Size (m²)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Tenants
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {apartment.rooms || apartment.bedrooms || 0}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {apartment.size || apartment.area || 0}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {currentTenantCount}
            </Typography>
          </Box>
        </Box>

        {/* Line 3: Gender · Monthly rent */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Gender
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Monthly rent
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {apartment.genderPreference === 'mixed' ? 'Mixed' :
               apartment.genderPreference === 'male' ? 'Male' :
               apartment.genderPreference === 'female' ? 'Female' : 'Mixed'}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              €{apartment.rent ? parseFloat(apartment.rent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </Typography>
          </Box>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Go to Payments">
              <IconButton
                size="small"
                onClick={handlePaymentClick}
                sx={{ color: 'success.main' }}
              >
                <PaymentIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Generate Contract">
              <IconButton
                size="small"
                onClick={handleGenerateContractClick}
                sx={{ color: 'info.main' }}
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
          </Box>

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
