// TenantSelector.jsx - Complete fixed version
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Avatar,
  Tooltip,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

function TenantSelector({
  tenantData = [],
  availableTenants = [],
  addedTenantIds = new Set(),
  loading = false,
  onTenantSelection,
  onSetTenantAsPrimary,
  onRemoveTenant,
  onOpenTenantForm,
  disabled = false
}) {
  // Utility function to get tenant display name
  const getTenantDisplayName = (tenant) => {
    if (!tenant) return 'Unknown Tenant';

    // Try different name formats
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    }
    if (tenant.name) {
      return tenant.name;
    }
    return 'Unnamed Tenant';
  };

  // Utility function to generate tooltip content
  const getTenantTooltip = (tenant) => {
    if (!tenant) return '';
    const parts = [];
    if (tenant.email) parts.push(`Email: ${tenant.email}`);
    if (tenant.phone) parts.push(`Phone: ${tenant.phone}`);
    if (tenant.apartment_address) {
      parts.push(`Current apartment: ${tenant.apartment_address}`);
    }
    if (tenant.isPrimary) parts.push('Primary Tenant');
    return parts.length > 0 ? parts.join('\n') : 'No additional information';
  };

  // Ensure arrays are safe before filtering
  const safeTenantData = Array.isArray(tenantData) ? tenantData : [];
  const safeAvailableTenants = Array.isArray(availableTenants) ? availableTenants : [];

  // Filter available tenants to exclude already added ones
  const filteredAvailableTenants = safeAvailableTenants.filter(tenant => {
    if (!tenant || !tenant.id) return false;

    // Don't show tenants that are already added
    if (addedTenantIds.has(tenant.id)) return false;

    // Don't show tenants that are already in the current tenant list
    if (safeTenantData.some(t => t.id === tenant.id)) return false;

    return true;
  });

  // Handle tenant selection from autocomplete
  const handleTenantSelect = (event, selectedTenant) => {
    if (selectedTenant && onTenantSelection) {
      console.log('Tenant selected from autocomplete:', selectedTenant);
      onTenantSelection(selectedTenant);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
        Assigned Tenants ({safeTenantData.length})
      </Typography>

      {/* Display assigned tenants as chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {safeTenantData.map((tenant, index) => (
          <Tooltip key={tenant.id || index} title={getTenantTooltip(tenant)} placement="top">
            <Chip
              avatar={
                <Avatar
                  sx={{
                    bgcolor: tenant.isPrimary ? 'primary.main' : 'grey.400',
                    width: 28,
                    height: 28,
                    fontSize: '0.75rem'
                  }}
                >
                  <PersonIcon fontSize="small" />
                </Avatar>
              }
              label={getTenantDisplayName(tenant)}
              onDelete={() => onRemoveTenant && onRemoveTenant(index)}
              onClick={() => onSetTenantAsPrimary && onSetTenantAsPrimary(index)}
              color={tenant.isPrimary ? 'primary' : 'default'}
              variant={tenant.isPrimary ? 'filled' : 'outlined'}
              sx={{
                cursor: 'pointer',
                '& .MuiChip-deleteIcon': {
                  color: 'inherit'
                }
              }}
            />
          </Tooltip>
        ))}
        {safeTenantData.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No tenants assigned to this apartment
          </Typography>
        )}
      </Box>

      {/* Tenant selection and new tenant button */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Autocomplete
          fullWidth
          options={filteredAvailableTenants}
          getOptionLabel={(option) => getTenantDisplayName(option)}
          onChange={handleTenantSelect}
          disabled={disabled || loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add existing tenant"
              variant="outlined"
              placeholder="Search and select a tenant"
              disabled={disabled || loading}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Box>
                <Typography variant="body1">{getTenantDisplayName(option)}</Typography>
                {option.email && (
                  <Typography variant="caption" color="text.secondary">
                    {option.email}
                  </Typography>
                )}
                {option.apartment_address && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Currently in: {option.apartment_address}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          loading={loading}
          loadingText="Loading tenants..."
          noOptionsText={
            filteredAvailableTenants.length === 0 && safeAvailableTenants.length > 0
              ? 'All available tenants already added'
              : 'No available tenants found'
          }
          value={null} // Always reset after selection
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />

        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonIcon />}
          onClick={() => onOpenTenantForm && onOpenTenantForm()}
          sx={{ whiteSpace: 'nowrap' }}
          disabled={disabled || loading}
        >
          New Tenant
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Select from existing tenants or create a new one. Click on a tenant chip to mark as primary.
        {disabled && " Maximum occupancy reached."}
      </Typography>
    </Box>
  );
}

export default TenantSelector;
