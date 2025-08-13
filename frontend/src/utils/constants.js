// Apartment status constants
export const APARTMENT_STATUS = {
  OCCUPIED: 'occupied',
  VACANT: 'vacant',
  CONTRACT_SENT: 'contract_sent'
};

// Pagination constants
export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];

// Sort options
export const SORT_OPTIONS = {
  EXPIRY: 'expiry',
  ALPHABETICAL: 'alphabetical'
};

// Contract status constants
export const CONTRACT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  TERMINATED: 'terminated',
  PENDING: 'pending'
};

// Property model constants
export const PROPERTY_MODELS = {
  MANAGEMENT: 'management',
  RENTAL: 'rental'
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

// API endpoints
export const API_ENDPOINTS = {
  APARTMENTS: '/list',
  LANDLORDS: '/landlords',
  TENANTS: '/tenants',
  PAYMENTS: '/payments',
  CONTRACTS: '/contracts',
  DOCUMENTS: '/documents'
};
