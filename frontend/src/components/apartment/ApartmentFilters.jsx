import React, { useState } from 'react';
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
  Clear as ClearIcon
} from '@mui/icons-material';

import { FILTER_OPTIONS, getFilterDisplayValue, getFilterLabel } from '../../utils/filterConstants';

const ApartmentFilters = ({
  filters: initialFilters,
  filterOptions,
  onFilterChange,
  onClearAllFilters,
  searchTerm
}) => {
  const [localFilters, setLocalFilters] = useState(initialFilters);

  const getActiveFilterCount = () => Object.values(initialFilters).filter(value => value && value.trim()).length + (searchTerm ? 1 : 0);

  const handleLocalChange = (key, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApply = () => {
    Object.entries(localFilters).forEach(([key, value]) => onFilterChange(key, value));
  };

  const handleCancel = () => setLocalFilters(initialFilters);

  const handleClear = () => {
    setLocalFilters({});
    onClearAllFilters();
  };

  const FilterDropdown = ({ label, value, options, filterKey, icon }) => (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select value={value || ''} onChange={(e) => handleLocalChange(filterKey, e.target.value)} label={label} startAdornment={icon && <InputAdornment position="start">{icon}</InputAdornment>} sx={{ '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1 } }}>
        <MenuItem value=""><em>All {label}</em></MenuItem>
        {options.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </Select>
    </FormControl>
  );

  const FilterTextField = ({ label, value, filterKey, icon }) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={value || ''}
      onChange={(e) => handleLocalChange(filterKey, e.target.value)}
      InputProps={{ startAdornment: icon ? <InputAdornment position="start">{icon}</InputAdornment> : null }}
      variant="outlined"
      autoFocus={filterKey === 'landlord'} // Focus on "Landlord" field by default
    />
  );

  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>Filter Properties</Typography>
        <Button variant="outlined" size="small" startIcon={<ClearIcon />} onClick={handleClear} disabled={getActiveFilterCount() === 0} sx={{ textTransform: 'none' }}>Clear All Filters</Button>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}><FilterTextField label="Landlord" value={localFilters.landlord} filterKey="landlord" icon={<BusinessIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterTextField label="State" value={localFilters.state} filterKey="state" icon={<LocationOnIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterTextField label="City" value={localFilters.city} filterKey="city" icon={<LocationOnIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterTextField label="Zip Code" value={localFilters.zip_code} filterKey="zip_code" /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterDropdown label="Gender Preference" value={localFilters.gender} options={FILTER_OPTIONS.GENDERS.map(g => g.value)} filterKey="gender" icon={<PeopleIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterDropdown label="Rooms" value={localFilters.rooms} options={FILTER_OPTIONS.ROOMS.map(r => r.value)} filterKey="rooms" icon={<BedIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterDropdown label="Size (m²)" value={localFilters.size_range} options={FILTER_OPTIONS.SIZE_RANGES.map(s => s.value)} filterKey="size_range" icon={<SquareFootIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterDropdown label="Floor" value={localFilters.floor} options={filterOptions.floors} filterKey="floor" icon={<HomeIcon fontSize="small" />} /></Grid>
        <Grid item xs={12} sm={6} md={3}><FilterDropdown label="Status" value={localFilters.status} options={FILTER_OPTIONS.STATUSES.map(s => s.value)} filterKey="status" icon={<EventIcon fontSize="small" />} /></Grid>
      </Grid>
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleApply} sx={{ textTransform: 'none' }}>Apply Filters</Button>
      </Box>
      {getActiveFilterCount() > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Active Filters ({getActiveFilterCount()}):</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {searchTerm && <Chip label={`Search: "${searchTerm}"`} size="small" onDelete={() => onFilterChange('search', '')} color="primary" variant="outlined" deleteIcon={<ClearIcon fontSize="small" />} />}
            {Object.entries(initialFilters).map(([key, value]) => value && <Chip key={key} label={`${getFilterLabel(key)}: ${getFilterDisplayValue(key, value, filterOptions)}`} size="small" onDelete={() => onFilterChange(key, '')} color="primary" variant="outlined" deleteIcon={<ClearIcon fontSize="small" />} />)}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ApartmentFilters;
