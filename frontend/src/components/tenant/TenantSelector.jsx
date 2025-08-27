// TenantSelector.jsx - FIXED VERSION removing primary tenant concept and React key warning
import React from 'react';
import {
  Typography,
  Autocomplete,
  TextField,
  Button,
  Box,
  Chip,
  IconButton,
  CircularProgress,
  Paper,
  Divider
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';

const TenantSelector = ({
  tenantData,
  availableTenants,
  addedTenantIds,
  loading,
  onTenantSelection,
  // REMOVED: onSetTenantAsPrimary - no more primary tenant concept
  onRemoveTenant,
  onOpenTenantForm
}) => {
  // Filter out already selected tenants
  const filteredTenants = availableTenants.filter(tenant =>
    tenant.id && !addedTenantIds.has(tenant.id)
  );

  // FIXED: Handle autocomplete option rendering without spreading key
  const renderOption = (props, option) => {
    // Extract key from props to avoid spreading it
    const { key, ...otherProps } = props;

    return (
      <Box
        key={key} // Pass key directly to JSX
        {...otherProps} // Spread remaining props without key
        component="li"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1
        }}
      >
        <PersonIcon sx={{ color: 'action.active', fontSize: '1.2rem' }} />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {option.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {option.email}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderInput = (params) => (
    <TextField
      {...params}
      variant="outlined"
      placeholder="Search and select a tenant..."
      InputProps={{
        ...params.InputProps,
        startAdornment: (
          <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
        ),
        endAdornment: (
          <>
            {loading ? <CircularProgress size={20} /> : null}
            {params.InputProps.endAdornment}
          </>
        ),
      }}
    />
  );

  return (
    <Box>
      {/* Tenant Selection Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 2
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Add Tenants
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={onOpenTenantForm}
          size="small"
          sx={{ textTransform: 'none' }}
        >
          Create New Tenant
        </Button>
      </Box>

      {/* Tenant Selection Autocomplete - FIXED VERSION */}
      <Autocomplete
        options={filteredTenants}
        getOptionLabel={(option) => option.name || ''}
        value={null}
        onChange={(event, newValue) => {
          if (newValue) {
            onTenantSelection(newValue);
          }
        }}
        loading={loading}
        renderOption={renderOption} // Use our fixed render function
        renderInput={renderInput}
        noOptionsText={loading ? "Loading..." : "No available tenants found"}
        sx={{ mb: 3 }}
        clearOnSelect={true}
        disableClearable={false}
      />

      {/* Current Tenants List */}
      {tenantData.length > 0 && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Selected Tenants ({tenantData.length})
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tenantData.map((tenant, index) => (
              <Paper
                key={tenant.id || `temp-${index}`}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <PersonIcon sx={{ color: 'action.active' }} />

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim()}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                      {tenant.email && (
                        <Chip
                          label={tenant.email}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      )}
                      {tenant.phone && (
                        <Chip
                          label={tenant.phone}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      )}
                      {tenant.isExistingTenant && (
                        <Chip
                          label="Existing Tenant"
                          size="small"
                          color="info"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* REMOVED: Primary tenant toggle button - no more primary tenants

                  <IconButton
                    onClick={() => onSetTenantAsPrimary(index)}
                    size="small"
                    sx={{
                      color: tenant.isPrimary ? 'warning.main' : 'action.active',
                      '&:hover': {
                        backgroundColor: tenant.isPrimary ? 'warning.light' : 'action.hover'
                      }
                    }}
                    title={tenant.isPrimary ? 'Primary Tenant' : 'Set as Primary'}
                  >
                    {tenant.isPrimary ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>

                  */}

                  <IconButton
                    onClick={() => onRemoveTenant(index)}
                    size="small"
                    sx={{
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light',
                        color: 'error.dark'
                      }
                    }}
                    title="Remove Tenant"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* No Tenants Message */}
      {tenantData.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            color: 'text.secondary',
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            mt: 2
          }}
        >
          <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
          <Typography variant="body1">
            No tenants added yet
          </Typography>
          <Typography variant="caption">
            Use the search above to add existing tenants or create new ones
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TenantSelector;
