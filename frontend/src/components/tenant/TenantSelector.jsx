import React from 'react';
import {
  Box,
  Typography,
  Button,
  Autocomplete,
  TextField,
  Chip,
  Avatar,
  Tooltip
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

function TenantSelector({
  tenantData,
  availableTenants,
  addedTenantIds,
  loading,
  onTenantSelection,
  onSetTenantAsPrimary,
  onRemoveTenant,
  onOpenTenantForm
}) {
  const getTenantDisplayName = (tenant) => {
    if (tenant.firstName && tenant.lastName) {
      return `${tenant.firstName} ${tenant.lastName}`;
    } else if (tenant.name) {
      return tenant.name;
    } else {
      return 'Unnamed Tenant';
    }
  };

  const getTenantTooltip = (tenant) => {
    const parts = [];
    if (tenant.email) parts.push(`Email: ${tenant.email}`);
    if (tenant.phone) parts.push(`Phone: ${tenant.phone}`);
    if (tenant.apartment_address && tenant.apartment_id !== tenant.currentApartmentId) {
      parts.push(`Current apartment: ${tenant.apartment_address}`);
    }
    return parts.length > 0 ? parts.join('\n') : 'No contact information';
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {tenantData.map((tenant, index) => (
          <Tooltip
            key={index}
            title={getTenantTooltip(tenant)}
            placement="top"
          >
            <Chip
              avatar={
                <Avatar
                  sx={{
                    bgcolor: tenant.isPrimary ? 'primary.main' : 'default'
                  }}
                >
                  <PersonIcon />
                </Avatar>
              }
              label={getTenantDisplayName(tenant)}
              onDelete={() => onRemoveTenant(index)}
              onClick={() => onSetTenantAsPrimary(index)}
              color={tenant.isPrimary ? "primary" : "default"}
              variant={tenant.isPrimary ? "filled" : "outlined"}
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>
        ))}
        {tenantData.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No tenants assigned to this apartment
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Autocomplete
          options={availableTenants.filter(
            tenant => !tenantData.some(t => t.id === tenant.id)
          )}
          getOptionLabel={(option) => {
            if (option.firstName && option.lastName) {
              return `${option.firstName} ${option.lastName}`;
            }
            return option.name || 'Unnamed Tenant';
          }}
          onChange={(event, newValue) => onTenantSelection(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add existing tenant"
              variant="outlined"
              fullWidth
              placeholder="Search and select a tenant"
            />
          )}
          loading={loading}
          loadingText="Loading tenants..."
          noOptionsText="No tenants found or all tenants already added"
          sx={{ flexGrow: 1 }}
          value={null} // Reset value after selection
        />

        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonIcon />}
          onClick={onOpenTenantForm}
          sx={{ whiteSpace: 'nowrap' }}
        >
          New Tenant
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Select from existing tenants or create a new one. Click on a tenant chip to mark as primary.
      </Typography>
    </Box>
  );
}

export default TenantSelector;
