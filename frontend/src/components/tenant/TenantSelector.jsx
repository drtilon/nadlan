// TenantSelector.jsx - Complete fixed version with Gender support
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
    if (tenant.gender) {
      const genderDisplay = tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1).replace('_', ' ');
      parts.push(`Gender: ${genderDisplay}`);
    }
    if (tenant.passport_id) parts.push(`Passport: ${tenant.passport_id}`);
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
                    bgcolor: tenant.isPrimary ? 'primary.main' : 'secondary.main',
                    color: 'white',
                    width: 24,
                    height: 24,
                    fontSize: '0.75rem'
                  }}
                >
                  {getTenantDisplayName(tenant).charAt(0).toUpperCase()}
                </Avatar>
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: tenant.isPrimary ? 'bold' : 'normal' }}>
                    {getTenantDisplayName(tenant)}
                  </Typography>
                  {tenant.gender && (
                    <Typography variant="caption" sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      ml: 0.5
                    }}>
                      ({tenant.gender.charAt(0).toUpperCase()})
                    </Typography>
                  )}
                </Box>
              }
              variant={tenant.isPrimary ? "filled" : "outlined"}
              color={tenant.isPrimary ? "primary" : "default"}
              onDelete={onRemoveTenant ? () => onRemoveTenant(tenant.id) : undefined}
              onClick={onSetTenantAsPrimary ? () => onSetTenantAsPrimary(tenant.id) : undefined}
              sx={{
                cursor: onSetTenantAsPrimary ? 'pointer' : 'default',
                '&:hover': {
                  bgcolor: tenant.isPrimary ? 'primary.dark' : 'action.hover'
                }
              }}
              disabled={disabled}
            />
          </Tooltip>
        ))}
      </Box>

      {/* Add new tenant section */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <Autocomplete
          fullWidth
          options={filteredAvailableTenants}
          getOptionLabel={getTenantDisplayName}
          onChange={handleTenantSelect}
          loading={loading}
          disabled={disabled}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add Existing Tenant"
              variant="outlined"
              size="small"
              placeholder="Search tenants by name..."
            />
          )}
          renderOption={(props, tenant) => (
            <Box component="li" {...props}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  {getTenantDisplayName(tenant).charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {getTenantDisplayName(tenant)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    {tenant.email && (
                      <Typography variant="caption" color="text.secondary">
                        {tenant.email}
                      </Typography>
                    )}
                    {tenant.gender && (
                      <Typography variant="caption" color="text.secondary">
                        {tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1).replace('_', ' ')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
          noOptionsText="No available tenants found"
          sx={{ flex: 1 }}
        />

        <Button
          variant="outlined"
          color="primary"
          onClick={onOpenTenantForm}
          disabled={disabled}
          sx={{ height: 40, whiteSpace: 'nowrap' }}
        >
          Add New Tenant
        </Button>
      </Box>

      {safeTenantData.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Click on a tenant to set as primary. Primary tenants are highlighted and appear first in contracts.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default TenantSelector;
