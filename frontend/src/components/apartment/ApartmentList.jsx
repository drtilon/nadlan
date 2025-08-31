import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  Drawer,
  TextField,
  InputAdornment,
  IconButton,
  Container,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  FormControl,
  Select,
  Stack,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Icons
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import People from '@mui/icons-material/People';
import PaymentIcon from '@mui/icons-material/Payment';
import SearchIcon from '@mui/icons-material/Search';
import BedIcon from '@mui/icons-material/Bed';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import CloseIcon from '@mui/icons-material/Close';
import ApartmentIcon from '@mui/icons-material/Apartment';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import FilterListIcon from '@mui/icons-material/FilterList';
import DescriptionIcon from '@mui/icons-material/Description';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import DateRangeIcon from '@mui/icons-material/DateRange';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckIcon from '@mui/icons-material/Check';
import BusinessIcon from '@mui/icons-material/Business';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import ClearIcon from '@mui/icons-material/Clear';

import api, { getUserData } from '../../utils/api';
import ApartmentCard from './ApartmentCard';
import ApartmentDetailsDialog from './ApartmentDetailsDialog';
import ContractExtensionDialog from '../contract/ContractExtensionDialog';
import ContractManagementDialog from '../contract/ContractManagementDialog';
import { APARTMENT_STATUS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '../../utils/constants';
import ApartmentFilters from './ApartmentFilters';
import { FILTER_OPTIONS, getFilterDisplayValue, getFilterLabel } from '../../utils/filterConstants';

function ApartmentList({ onEdit, onGoToPayments, showNotification }) {
  // Core state
  const [displayedApartments, setDisplayedApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI state
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [sortBy, setSortBy] = useState('expiry');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  // Contract dialogs state
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [extendContractOpen, setExtendContractOpen] = useState(false);
  const [selectedApartmentForExtension, setSelectedApartmentForExtension] = useState(null);
  const [isExtendingContract, setIsExtendingContract] = useState(false);

  // Get user data to check if admin
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  // Navigation hook
  const navigate = useNavigate();

  // Debounce utility
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Fetch filter options on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const response = await api.get('/filter-options');
        setFilterOptions(response.data);
      } catch (error) {
        console.error('Error fetching filter options:', error);
        showNotification('Failed to load filter options', 'error');
      }
    }
    fetchFilterOptions();
  }, [showNotification]);

  // Fetch apartments with pagination, search, sort, and filters
  const fetchApartments = useCallback(async (page = 1, size = pageSize, search = '', sort = sortBy, filters = {}, refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      showNotification('Authentication required. Please log in again.', 'error');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      let sortField = sort;
      let sortDir = '1'; // asc by default
      if (sort === 'alphabetical') {
        sortField = 'address';
      }
      if (sort === 'occupancy') {
        sortDir = '-1'; // desc for highest occupancy first
      }
      const sortParam = `${sortField}:${sortDir}`;

      const params = new URLSearchParams({
        page: (page - 1).toString(),
        limit: size.toString(),
        sort: sortParam,
      });

      if (search) {
        params.append('search', search.trim());
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const response = await api.get(`/list?${params.toString()}`);

      if (response.data && response.data.apartments) {
        const processedApartments = response.data.apartments.map(apartment => ({
          ...apartment,
          status: normalizeStatus(apartment.status),
          displayStatus: apartment.status,
          contractEndDate: getContractEndDate(apartment),
          moveInDate: getMoveInDate(apartment),
          tenants: getCurrentTenants(apartment),
          expiryStatus: getExpiryStatus(getContractEndDate(apartment)),
          maxOccupancy: apartment.maxOccupancy || 1,
          current_tenant_count: apartment.current_tenant_count || getCurrentTenants(apartment).length,
          occupancy_ratio: apartment.occupancy_ratio || `${getCurrentTenants(apartment).length}/${apartment.maxOccupancy || 1}`,
          is_full: apartment.is_full || getCurrentTenants(apartment).length >= (apartment.maxOccupancy || 1)
        }));

        setDisplayedApartments(processedApartments);
        setTotalCount(response.data.pagination?.totalItems || response.data.total || processedApartments.length);
      } else {
        console.error('Invalid response structure:', response.data);
        setDisplayedApartments([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching apartments:', error);
      if (error.response && error.response.status === 401) {
        showNotification('Your session has expired. Please log in again.', 'error');
      } else {
        showNotification('Error loading apartment list', 'error');
      }
      setDisplayedApartments([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, sortBy, showNotification]);

  // Debounced fetch function
  const debouncedFetchApartments = useRef(debounce((page, size, search, sort, filters) => {
    fetchApartments(page, size, search, sort, filters);
  }, 300)).current;

  // Helper functions
  const normalizeStatus = (status) => {
    if (!status) return 'vacant';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('occupied') || statusLower.includes('rented')) return 'occupied';
    if (statusLower.includes('vacant') || statusLower.includes('available')) return 'vacant';
    if (statusLower.includes('contract') && statusLower.includes('sent')) return 'contract_sent';
    return status;
  };

  const getContractEndDate = (apartment) => apartment.current_contract?.end_date || apartment.contractEndDate;
  const getMoveInDate = (apartment) => apartment.current_contract?.start_date || apartment.moveInDate;
  const getCurrentTenants = (apartment) => (apartment.current_contract?.tenants?.map(ct => ct.tenant).filter(Boolean) || apartment.tenants || []);
  const getExpiryStatus = (contractEndDate) => {
    if (!contractEndDate) return { status: 'no_date', daysUntilExpiry: null };
    const endDate = new Date(contractEndDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 3600 * 24));
    return daysUntilExpiry < 0 ? { status: 'expired', daysUntilExpiry } : daysUntilExpiry <= 30 ? { status: 'expiring_soon', daysUntilExpiry } : { status: 'valid', daysUntilExpiry };
  };

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    if (key === 'search') {
      setSearchTerm(value);
    } else {
      setFilters(prev => {
        const newFilters = { ...prev };
        if (!value) delete newFilters[key];
        else newFilters[key] = value;
        return newFilters;
      });
    }
    setCurrentPage(1);
  }, []);

  // Handle clear all filters
  const handleClearAllFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  }, []);

  // Trigger debounced search
  useEffect(() => {
    debouncedFetchApartments(1, pageSize, searchTerm, sortBy, filters);
  }, [searchTerm, filters, sortBy, pageSize, debouncedFetchApartments]);

  // Handle page changes
  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    fetchApartments(newPage, pageSize, searchTerm, sortBy, filters);
  }, [fetchApartments, pageSize, searchTerm, sortBy, filters]);

  // Handle page size changes
  const handlePageSizeChange = useCallback((event) => {
    const newPageSize = event.target.value;
    setPageSize(newPageSize);
    setCurrentPage(1);
    fetchApartments(1, newPageSize, searchTerm, sortBy, filters);
  }, [fetchApartments, searchTerm, sortBy, filters]);

  // Handle sort changes
  const handleSortChange = useCallback((newSortBy) => {
    setSortBy(newSortBy);
    setCurrentPage(1);
    setFilterMenuAnchor(null);
    fetchApartments(1, pageSize, searchTerm, newSortBy, filters);
  }, [fetchApartments, pageSize, searchTerm, filters]);

  // Handle search input changes
  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  // Handle contract extension
  const handleExtendContract = async (apartmentId, newEndDate) => {
    setIsExtendingContract(true);
    try {
      await api.put(`/apartments/${apartmentId}/extend-contract`, { contractEndDate: newEndDate.toISOString().split('T')[0] });
      showNotification('Contract extended successfully', 'success');
      await fetchApartments(currentPage, pageSize, searchTerm, sortBy, filters, true);
      setExtendContractOpen(false);
      setSelectedApartmentForExtension(null);
      setDetailsOpen(false);
    } catch (error) {
      console.error('Error extending contract:', error);
      showNotification('Failed to extend contract', 'error');
    } finally {
      setIsExtendingContract(false);
    }
  };

  // Handle contract generation
  const handleGenerateContract = useCallback(async (apartmentId) => {
    try {
      const response = await api.post('/documents/createContract', { apartmentId }, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const apartment = displayedApartments.find(apt => apt.id === apartmentId);
      link.href = url;
      link.setAttribute('download', `Rental_Contract_${apartment?.address.replace(/[^a-zA-Z0-9]/g, '_') || 'Apartment'}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);
      showNotification('Failed to generate contract', 'error');
    }
  }, [displayedApartments, showNotification]);

  // Handle tenant navigation
  const handleGoToTenant = (tenantId) => {
    setContractDialogOpen(false);
    setDetailsOpen(false);
    showNotification('Navigating to tenant details...', 'info');
    navigate(`/tenants/${tenantId}`);
  };

  // Initial load
  useEffect(() => {
    fetchApartments(1, pageSize, '', sortBy, filters);
  }, []);

  // Utility functions
  const handleFilterClick = (event) => setFilterMenuAnchor(event.currentTarget);
  const handleFilterClose = () => setFilterMenuAnchor(null);
  const handleRefresh = () => fetchApartments(currentPage, pageSize, searchTerm, sortBy, filters, true);
  const openDetails = (apartment) => { setSelectedApartment(apartment); setDetailsOpen(true); };
  const openExtendContractDialog = (apartment) => { setSelectedApartmentForExtension(apartment); setExtendContractOpen(true); };

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  // Get sort display text
  const getSortDisplayText = (sortBy) => ({
    expiry: 'Expiry',
    alphabetical: 'A-Z',
    occupancy: 'Occupancy'
  }[sortBy] || 'Default');

  // Get active filter count
  const getActiveFilterCount = () => Object.values(filters).filter(value => value && value.trim()).length + (searchTerm ? 1 : 0);

  if (isLoading && !isRefreshing) {
    return (
      <Container maxWidth={false} sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.5px', fontSize: '2rem' }}>
          Propertiess {isRefreshing && <RefreshIcon sx={{ ml: 1, fontSize: '1.5rem', color: 'primary.main' }} />}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', md: 'auto' } }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={isRefreshing} sx={{ borderRadius: 1, textTransform: 'none', fontWeight: 500, height: '48px', borderColor: 'divider' }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<ApartmentIcon />} onClick={() => onEdit(null)} sx={{ borderRadius: 1, textTransform: 'none', fontWeight: 500, backgroundColor: 'primary.main', px: 3, height: '48px', boxShadow: 2 }}>
            Add Property
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 4, width: '100%' }}>
        <TextField
          fullWidth
          placeholder="Search by address"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
            sx: { borderRadius: 1, height: '48px', backgroundColor: 'background.paper', '& fieldset': { borderColor: 'divider' } }
          }}
          sx={{ flexGrow: 1 }}
          autoFocus // Ensure focus on mount
        />
        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={handleFilterClick} sx={{ borderRadius: 1, textTransform: 'none', fontWeight: 500, height: '48px', minWidth: '140px', borderColor: 'divider' }}>
          Sort: {getSortDisplayText(sortBy)}
        </Button>
        <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => setFilterOpen(true)} sx={{ borderRadius: 1, textTransform: 'none', fontWeight: 500, height: '48px', minWidth: '140px', borderColor: 'divider' }}>
          Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
        </Button>
        <Menu anchorEl={filterMenuAnchor} open={Boolean(filterMenuAnchor)} onClose={handleFilterClose} PaperProps={{ sx: { borderRadius: 1, minWidth: 200, mt: 1 } }}>
          <MenuItem onClick={() => handleSortChange('expiry')} selected={sortBy === 'expiry'}>
            <ListItemIcon><DateRangeIcon fontSize="small" /></ListItemIcon>
            <ListItemText>By Expiry Date{sortBy === 'expiry' && <CheckIcon sx={{ ml: 1, fontSize: '1rem' }} />}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleSortChange('alphabetical')} selected={sortBy === 'alphabetical'}>
            <ListItemIcon><SortByAlphaIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Alphabetical (A-Z){sortBy === 'alphabetical' && <CheckIcon sx={{ ml: 1, fontSize: '1rem' }} />}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleSortChange('occupancy')} selected={sortBy === 'occupancy'}>
            <ListItemIcon><People fontSize="small" /></ListItemIcon>
            <ListItemText>By Occupancy Level{sortBy === 'occupancy' && <CheckIcon sx={{ ml: 1, fontSize: '1rem' }} />}</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">Showing {startIndex}-{endIndex} of {totalCount} properties</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">Show:</Typography>
          <FormControl size="small">
            <Select value={pageSize} onChange={handlePageSizeChange} sx={{ minWidth: 80 }}>
              {PAGE_SIZE_OPTIONS.map(size => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {getActiveFilterCount() > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">Active Filters ({getActiveFilterCount()}):</Typography>
          {searchTerm && <Chip label={`Search: "${searchTerm}"`} size="small" onDelete={() => handleFilterChange('search', '')} color="primary" variant="outlined" deleteIcon={<ClearIcon fontSize="small" />} />}
          {Object.entries(filters).map(([key, value]) => value && <Chip key={key} label={`${getFilterLabel(key)}: ${getFilterDisplayValue(key, value, filterOptions)}`} size="small" onDelete={() => handleFilterChange(key, '')} color="primary" variant="outlined" deleteIcon={<ClearIcon fontSize="small" />} />)}
          <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={handleClearAllFilters} sx={{ textTransform: 'none' }}>Clear All</Button>
        </Box>
      )}

      {displayedApartments.length === 0 ? (
        <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, backgroundColor: 'background.paper', borderRadius: 2, boxShadow: 1, width: '100%' }}>
          <ApartmentIcon sx={{ fontSize: 80, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary" align="center">{searchTerm ? 'No properties match your search' : 'No properties found'}</Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>{searchTerm ? 'Try different search terms' : 'Add your first property to get started'}</Typography>
          {!searchTerm && isAdmin && <Button variant="contained" startIcon={<ApartmentIcon />} onClick={() => onEdit(null)} sx={{ borderRadius: 1, textTransform: 'none', px: 3 }}>Add Property</Button>}
        </Box>
      ) : (
        <>
          <Grid container spacing={4}>
            {displayedApartments.map(apartment => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={apartment.id}>
                <ApartmentCard apartment={apartment} onEdit={onEdit} onGoToPayments={onGoToPayments} onGenerateContract={handleGenerateContract} onOpenDetails={openDetails} onGoToTenant={handleGoToTenant} isAdmin={isAdmin} sx={{ height: '300px' }} />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
              <Stack spacing={2} alignItems="center">
                <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} color="primary" size="large" showFirstButton showLastButton sx={{ '& .MuiPaginationItem-root': { borderRadius: 1, fontWeight: 500 } }} />
                <Typography variant="body2" color="text.secondary">Page {currentPage} of {totalPages}</Typography>
              </Stack>
            </Box>
          )}
        </>
      )}

      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { width: { xs: '100vw', sm: 600 }, borderLeft: '1px solid', borderColor: 'divider' } }} transitionDuration={0}>
        <Box sx={{ p: 3, minWidth: 0 }}>
          <ApartmentFilters filters={filters} filterOptions={filterOptions} onFilterChange={handleFilterChange} onClearAllFilters={handleClearAllFilters} searchTerm={searchTerm} />
        </Box>
      </Drawer>

      <ApartmentDetailsDialog open={detailsOpen} onClose={() => setDetailsOpen(false)} apartment={selectedApartment} onEdit={onEdit} onGoToPayments={onGoToPayments} onGenerateContract={handleGenerateContract} onExtendContract={openExtendContractDialog} onOpenContractManagement={() => setContractDialogOpen(true)} onGoToTenant={handleGoToTenant} isAdmin={isAdmin} />
      <ContractExtensionDialog open={extendContractOpen} onClose={() => { setExtendContractOpen(false); setSelectedApartmentForExtension(null); }} apartment={selectedApartmentForExtension} onExtend={handleExtendContract} isSubmitting={isExtendingContract} />
      <ContractManagementDialog open={contractDialogOpen} onClose={() => setContractDialogOpen(false)} apartment={selectedApartment} showNotification={showNotification} onContractChange={() => fetchApartments(currentPage, pageSize, searchTerm, sortBy, filters, true)} onGoToTenant={handleGoToTenant} />
    </Container>
  );
}

export default ApartmentList;
