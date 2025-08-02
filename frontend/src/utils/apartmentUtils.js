import React from 'react';
import { Box } from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material';

// Helper function to check if contract is expired or expiring soon
export const getExpiryStatus = (contractEndDate) => {
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

// Status chip component
export const getStatusChip = (status, contractEndDate) => {
  const expiryStatus = getExpiryStatus(contractEndDate);

  let color = 'default';
  let displayStatus = status;
  let icon = null;

  // First handle the basic status
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

  // Override color based on expiry status for occupied properties
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

// Format currency
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format date
export const formatDate = (dateString) => {
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

// Normalize apartment status
export const normalizeStatus = (status) => {
  if (!status) return 'vacant';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('occupied') || statusLower.includes('rented')) return 'occupied';
  if (statusLower.includes('vacant') || statusLower.includes('available')) return 'vacant';
  if (statusLower.includes('contract') && statusLower.includes('sent')) return 'contract_sent';
  return status;
};

// Get current tenants from apartment (handles both legacy and new contract structure)
export const getCurrentTenants = (apartment) => {
  if (!apartment) return [];

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

// Get contract end date (handles both legacy and new contract structure)
export const getContractEndDate = (apartment) => {
  if (!apartment) return null;

  // If apartment has current_contract
  if (apartment.current_contract?.end_date) {
    return apartment.current_contract.end_date;
  }

  // Fallback to legacy contractEndDate
  return apartment.contractEndDate;
};

// Get move-in date (handles both legacy and new contract structure)
export const getMoveInDate = (apartment) => {
  if (!apartment) return null;

  // If apartment has current_contract
  if (apartment.current_contract?.start_date) {
    return apartment.current_contract.start_date;
  }

  // Fallback to legacy moveInDate
  return apartment.moveInDate;
};
