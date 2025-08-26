// utils/filterConstants.js - Constants for apartment filtering

export const FILTER_OPTIONS = {
  GENDERS: [
    { value: 'Female', label: 'Female' },
    { value: 'Male', label: 'Male' },
    { value: 'Mixed', label: 'Mixed' }
  ],

  ROOMS: [
    { value: '1', label: '1 Room' },
    { value: '2', label: '2 Rooms' },
    { value: '3', label: '3 Rooms' },
    { value: '4', label: '4 Rooms' },
    { value: '5+', label: '5+ Rooms' }
  ],

  SIZE_RANGES: [
    { value: '<50', label: 'Under 50 m²' },
    { value: '50–100', label: '50-100 m²' },
    { value: '100–150', label: '100-150 m²' },
    { value: '150+', label: '150+ m²' }
  ],

  FLOORS: [
    { value: 'EG', label: 'Ground Floor (EG)' },
    { value: '1OG', label: '1st Floor (1OG)' },
    { value: '2OG', label: '2nd Floor (2OG)' },
    { value: '3OG', label: '3rd Floor (3OG)' },
    { value: '4OG', label: '4th Floor (4OG)' },
    { value: 'DG', label: 'Top Floor (DG)' }
  ],

  STATUSES: [
    { value: 'Available', label: 'Available' },
    { value: 'Occupied', label: 'Occupied' },
    { value: 'Expiring', label: 'Expiring Soon' }
  ]
};

export const FILTER_LABELS = {
  landlord: 'Landlord',
  state: 'State',
  city: 'City',
  zip_code: 'Zip Code',
  gender: 'Gender Preference',
  rooms: 'Rooms',
  size_range: 'Size (m²)',
  floor: 'Floor',
  status: 'Status'
};

export const SORT_OPTIONS = [
  { value: 'expiry', label: 'Contract Expiry', icon: 'DateRange' },
  { value: 'alphabetical', label: 'Alphabetical (A-Z)', icon: 'SortByAlpha' },
  { value: 'occupancy', label: 'Occupancy Level', icon: 'People' },
  { value: 'city', label: 'City', icon: 'LocationOn' },
  { value: 'rent', label: 'Rent Amount', icon: 'Payment' },
  { value: 'landlord', label: 'Landlord', icon: 'Business' },
  { value: 'rooms', label: 'Room Count', icon: 'Bed' },
  { value: 'size', label: 'Size (m²)', icon: 'SquareFoot' }
];

// Helper function to get display value for filters
export const getFilterDisplayValue = (filterKey, value, filterOptions) => {
  if (!value) return '';

  switch (filterKey) {
    case 'landlord':
    case 'state':
    case 'city':
    case 'zip_code':
      return value;

    case 'gender':
      return FILTER_OPTIONS.GENDERS.find(g => g.value === value)?.label || value;

    case 'rooms':
      return FILTER_OPTIONS.ROOMS.find(r => r.value === value)?.label || value;

    case 'size_range':
      return FILTER_OPTIONS.SIZE_RANGES.find(s => s.value === value)?.label || value;

    case 'floor':
      return FILTER_OPTIONS.FLOORS.find(f => f.value === value)?.label || value;

    case 'status':
      return FILTER_OPTIONS.STATUSES.find(s => s.value === value)?.label || value;

    default:
      return value;
  }
};

// Helper function to get filter label
export const getFilterLabel = (filterKey) => {
  return FILTER_LABELS[filterKey] || filterKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};
