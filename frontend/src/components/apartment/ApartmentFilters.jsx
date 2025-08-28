import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Button,
  Chip,
  Paper,
  TextField
} from '@mui/material';
import {
  Business as BusinessIcon,
  LocationOn as LocationOnIcon,
  People as PeopleIcon,
  Bed as BedIcon,
  SquareFoot as SquareFootIcon,
  Home as HomeIcon,
  Event as EventIcon,
  Clear as ClearIcon,
  Search as SearchIcon
} from '@mui/icons-material';

import { FILTER_OPTIONS, getFilterDisplayValue, getFilterLabel } from '../../utils/filterConstants';

const ApartmentFilters = ({
  filters: initialFilters,
  filterOptions,
  onFilterChange,
  onClearAllFilters,
  searchTerm
}) => {
  const [localFilters, setLocalFilters] = useState(initialFilters || {});

  // Update local filters when initial filters change
  useEffect(() => {
    setLocalFilters(initialFilters || {});
  }, [initialFilters]);

  const getActiveFilterCount = () => {
    const filterCount = Object.values(initialFilters || {}).filter(value => value && value.toString().trim()).length;
    const searchCount = searchTerm ? 1 : 0;
    return filterCount + searchCount;
  };

  const handleLocalChange = (key, value) => {
    // Only update local state, don't trigger API calls
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApply = () => {
    // Apply all local filters to the parent component
    Object.entries(localFilters).forEach(([key, value]) => {
      onFilterChange(key, value);
    });
  };

  const handleCancel = () => {
    // Reset local filters to match the applied filters
    setLocalFilters(initialFilters || {});
  };

  const handleClear = () => {
    // Clear both local and applied filters
    setLocalFilters({});
    onClearAllFilters();
  };

  const handleIndividualClear = (key) => {
    // Clear individual filter both locally and applied
    setLocalFilters(prev => ({
      ...prev,
      [key]: ''
    }));
    onFilterChange(key, '');
  };

  const FilterDropdown = ({ label, value, options, filterKey, icon }) => (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={(e) => handleLocalChange(filterKey, e.target.value)}
        label={label}
        startAdornment={icon && <InputAdornment position="start">{icon}</InputAdornment>}
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }
        }}
      >
        <MenuItem value=""><em>All {label}</em></MenuItem>
        {options && options.map(option => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const FilterTextField = ({ label, value, filterKey, icon, placeholder }) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => handleLocalChange(filterKey, e.target.value)}
      InputProps={{
        startAdornment: icon ? <InputAdornment position="start">{icon}</InputAdornment> : null
      }}
      variant="outlined"
    />
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        backgroundColor: 'background.paper'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Filter Properties
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ClearIcon />}
          onClick={handleClear}
          disabled={getActiveFilterCount() === 0}
          sx={{ textTransform: 'none' }}
        >
          Clear All Filters
        </Button>
      </Box>

      {/* Filter Grid */}
      <Grid container spacing={2}>
        {/* Row 1: Location Filters */}
        <Grid item xs={12} sm={6} md={3}>
          <FilterTextField
            label="Landlord"
            value={localFilters.landlord}
            filterKey="landlord"
            icon={<BusinessIcon fontSize="small" />}
            placeholder="Search by landlord name or company"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterTextField
            label="City"
            value={localFilters.city}
            filterKey="city"
            icon={<LocationOnIcon fontSize="small" />}
            placeholder="Enter city name"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterTextField
            label="State"
            value={localFilters.state}
            filterKey="state"
            icon={<LocationOnIcon fontSize="small" />}
            placeholder="Enter state name"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterTextField
            label="Zip Code"
            value={localFilters.zip_code}
            filterKey="zip_code"
            placeholder="Enter zip code"
          />
        </Grid>

        {/* Row 2: Property Filters */}
        <Grid item xs={12} sm={6} md={3}>
          <FilterDropdown
            label="Rooms"
            value={localFilters.rooms}
            options={filterOptions?.rooms || ['1', '2', '3', '4', '5', '6+']}
            filterKey="rooms"
            icon={<BedIcon fontSize="small" />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterDropdown
            label="Size (m²)"
            value={localFilters.size_range}
            options={FILTER_OPTIONS.SIZE_RANGES.map(s => s.value)}
            filterKey="size_range"
            icon={<SquareFootIcon fontSize="small" />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterDropdown
            label="Floor"
            value={localFilters.floor}
            options={filterOptions?.floors || []}
            filterKey="floor"
            icon={<HomeIcon fontSize="small" />}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FilterDropdown
            label="Gender Preference"
            value={localFilters.gender}
            options={FILTER_OPTIONS.GENDERS.map(g => g.value)}
            filterKey="gender"
            icon={<PeopleIcon fontSize="small" />}
          />
        </Grid>

        {/* Row 3: Status Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FilterDropdown
            label="Status"
            value={localFilters.status}
            options={FILTER_OPTIONS.STATUSES.map(s => s.value)}
            filterKey="status"
            icon={<EventIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={handleCancel}
          sx={{ textTransform: 'none' }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          sx={{ textTransform: 'none' }}
        >
          Apply Filters
        </Button>
      </Box>

      {/* Active Filters Display */}
      {getActiveFilterCount() > 0 && (
        <Box sx={{
          mt: 3,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Active Filters ({getActiveFilterCount()}):
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {/* Search Term Chip */}
            {searchTerm && (
              <Chip
                label={`Search: "${searchTerm}"`}
                size="small"
                onDelete={() => onFilterChange('search', '')}
                color="primary"
                variant="outlined"
                deleteIcon={<ClearIcon fontSize="small" />}
              />
            )}

            {/* Filter Chips */}
            {Object.entries(initialFilters || {}).map(([key, value]) =>
              value && value.toString().trim() ? (
                <Chip
                  key={key}
                  label={`${getFilterLabel(key)}: ${getFilterDisplayValue(key, value, filterOptions)}`}
                  size="small"
                  onDelete={() => handleIndividualClear(key)}
                  color="primary"
                  variant="outlined"
                  deleteIcon={<ClearIcon fontSize="small" />}
                />
              ) : null
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ApartmentFilters;
