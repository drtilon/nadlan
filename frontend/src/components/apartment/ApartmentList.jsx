import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  IconButton,
  Avatar,
  Divider,
  Skeleton,
  Tooltip,
  Container,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  FormControl,
  Select,
  Stack
} from '@mui/material';

// Icons
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
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

import api, { getUserData } from '../../utils/api';
import ApartmentCard from './ApartmentCard';
import ApartmentDetailsDialog from './ApartmentDetailsDialog';
import ContractExtensionDialog from '../contract/ContractExtensionDialog';
import ContractManagementDialog from '../contract/ContractManagementDialog';
import { APARTMENT_STATUS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '../../utils/constants';

function ApartmentList({ onEdit, onGoToPayments, showNotification }) {
  // Core state
  const [displayedApartments, setDisplayedApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI state
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
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

  // Fetch apartments with pagination
  const fetchApartments = useCallback(async (page = 1, size = pageSize, search = '', sort = sortBy, refresh = false) => {
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
      // Build query parameters
      const params = new URLSearchParams({
        page: (page - 1).toString(), // Backend uses 0-based indexing
        limit: size.toString(),
        sort: sort,
        ...(search && { search: search.trim() })
      });

      const response = await api.get(`/list?${params}`);

      if (response.data && response.data.apartments) {
        const processedApartments = response.data.apartments.map(apartment => ({
          ...apartment,
          // Normalize status
          status: normalizeStatus(apartment.status),
          displayStatus: apartment.status,
          // Get contract end date from current contract or fallback
          contractEndDate: getContractEndDate(apartment),
          // Get move in date from current contract or fallback
          moveInDate: getMoveInDate(apartment),
          // Get current tenants from contract periods
          tenants: getCurrentTenants(apartment),
          // Calculate expiry status
          expiryStatus: getExpiryStatus(getContractEndDate(apartment))
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

  // Helper functions
  const normalizeStatus = (status) => {
    if (!status) return 'vacant';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('occupied') || statusLower.includes('rented')) return 'occupied';
    if (statusLower.includes('vacant') || statusLower.includes('available')) return 'vacant';
    if (statusLower.includes('contract') && statusLower.includes('sent')) return 'contract_sent';
    return status;
  };

  const getContractEndDate = (apartment) => {
    if (apartment.current_contract?.end_date) {
      return apartment.current_contract.end_date;
    }
    return apartment.contractEndDate;
  };

  const getMoveInDate = (apartment) => {
    if (apartment.current_contract?.start_date) {
      return apartment.current_contract.start_date;
    }
    return apartment.moveInDate;
  };

  const getCurrentTenants = (apartment) => {
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

  const getExpiryStatus = (contractEndDate) => {
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

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchApartments(1, pageSize, searchTerm, sortBy);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchApartments, pageSize, sortBy]);

  // Handle page changes
  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    fetchApartments(newPage, pageSize, searchTerm, sortBy);
  }, [fetchApartments, pageSize, searchTerm, sortBy]);

  // Handle page size changes
  const handlePageSizeChange = useCallback((event) => {
    const newPageSize = event.target.value;
    setPageSize(newPageSize);
    setCurrentPage(1);
    fetchApartments(1, newPageSize, searchTerm, sortBy);
  }, [fetchApartments, searchTerm, sortBy]);

  // Handle sort changes
  const handleSortChange = useCallback((newSortBy) => {
    setSortBy(newSortBy);
    setCurrentPage(1);
    setFilterMenuAnchor(null);
    fetchApartments(1, pageSize, searchTerm, newSortBy);
  }, [fetchApartments, pageSize, searchTerm]);

  // Handle search input changes
  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  // Handle contract extension
  const handleExtendContract = async (apartmentId, newEndDate) => {
    setIsExtendingContract(true);
    try {
      const formattedDate = newEndDate.toISOString().split('T')[0];

      await api.put(`/apartments/${apartmentId}/extend-contract`, {
        contractEndDate: formattedDate
      });

      showNotification('Contract extended successfully', 'success');
      await fetchApartments(currentPage, pageSize, searchTerm, sortBy, true);
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
      const response = await api.post('/documents/createContract', {
        apartmentId: apartmentId
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const apartment = displayedApartments.find(apt => apt.id === apartmentId);
      const fileName = `Rental_Contract_${apartment ? apartment.address.replace(/[^a-zA-Z0-9]/g, '_') : 'Apartment'}.docx`;

      link.href = url;
      link.setAttribute('download', fileName);
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

  // Initial load
  useEffect(() => {
    fetchApartments(1, pageSize, '', sortBy);
  }, []);

  // Utility functions
  const handleFilterClick = (event) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleRefresh = () => {
    fetchApartments(currentPage, pageSize, searchTerm, sortBy, true);
  };

  const openDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
  };

  const openExtendContractDialog = (apartment) => {
    setSelectedApartmentForExtension(apartment);
    setExtendContractOpen(true);
  };

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  if (isLoading && !isRefreshing) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
        </Box>
        <Grid container spacing={3}>
          {Array.from({ length: pageSize }, (_, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: 4,
          gap: 2
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            letterSpacing: '-0.5px'
          }}
        >
          Properties {isRefreshing && <RefreshIcon sx={{ ml: 1, fontSize: '1.5rem', animation: 'spin 1s linear infinite' }} />}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', md: 'auto' }
          }}
        >
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 500,
              height: '48px',
              borderColor: 'divider'
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<ApartmentIcon />}
            onClick={() => onEdit(null)}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: 'primary.main',
              px: 3,
              height: '48px',
              boxShadow: 2
            }}
          >
            Add Property
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 4,
          width: '100%'
        }}
      >
        <TextField
          fullWidth
          placeholder="Search by address"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 1,
              height: '48px',
              backgroundColor: 'background.paper',
              '& fieldset': {
                borderColor: 'divider'
              }
            }
          }}
          sx={{ flexGrow: 1 }}
        />

        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={handleFilterClick}
          sx={{
            borderRadius: 1,
            textTransform: 'none',
            fontWeight: 500,
            height: '48px',
            minWidth: '140px',
            borderColor: 'divider'
          }}
        >
          Sort: {sortBy === 'expiry' ? 'Expiry' : 'A-Z'}
        </Button>

        <Menu
          anchorEl={filterMenuAnchor}
          open={Boolean(filterMenuAnchor)}
          onClose={handleFilterClose}
          PaperProps={{
            sx: {
              borderRadius: 1,
              minWidth: 200,
              mt: 1
            }
          }}
        >
          <MenuItem
            onClick={() => handleSortChange('expiry')}
            selected={sortBy === 'expiry'}
          >
            <ListItemIcon>
              <DateRangeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              By Expiry Date
              {sortBy === 'expiry' && <CheckIcon sx={{ ml: 1, fontSize: '1rem' }} />}
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => handleSortChange('alphabetical')}
            selected={sortBy === 'alphabetical'}
          >
            <ListItemIcon>
              <SortByAlphaIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Alphabetical (A-Z)
              {sortBy === 'alphabetical' && <CheckIcon sx={{ ml: 1, fontSize: '1rem' }} />}
            </ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {/* Results Summary and Page Size Control */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {startIndex}-{endIndex} of {totalCount} properties
          </Typography>
          {searchTerm && (
            <Chip
              label={`Search: "${searchTerm}"`}
              size="small"
              onDelete={() => setSearchTerm('')}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Show:
          </Typography>
          <FormControl size="small">
            <Select
              value={pageSize}
              onChange={handlePageSizeChange}
              sx={{ minWidth: 80 }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Expiry Status Summary */}
      {sortBy === 'expiry' && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ borderRadius: 1 }}>
            <Typography variant="body2">
              Properties are sorted by contract expiry: <strong style={{ color: '#d32f2f' }}>Expired</strong> contracts first,
              then <strong style={{ color: '#ed6c02' }}>expiring within 30 days</strong>, followed by valid contracts.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Apartments Grid */}
      {displayedApartments.length === 0 ? (
        <Box
          sx={{
            py: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            backgroundColor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          <ApartmentIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary" align="center">
            {searchTerm ? 'No properties match your search' : 'No properties found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
            {searchTerm ? 'Try different search terms' : 'Add your first property to get started'}
          </Typography>
          {!searchTerm && isAdmin && (
            <Button
              variant="contained"
              startIcon={<ApartmentIcon />}
              onClick={() => onEdit(null)}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                px: 3
              }}
            >
              Add Property
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {displayedApartments.map((apartment) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={apartment.id}>
                <ApartmentCard
                  apartment={apartment}
                  onEdit={onEdit}
                  onGoToPayments={onGoToPayments}
                  onGenerateContract={handleGenerateContract}
                  onOpenDetails={openDetails}
                  isAdmin={isAdmin}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
              <Stack spacing={2} alignItems="center">
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: 1,
                      fontWeight: 500
                    }
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  Page {currentPage} of {totalPages}
                </Typography>
              </Stack>
            </Box>
          )}
        </>
      )}

      {/* Details Dialog */}
      <ApartmentDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        apartment={selectedApartment}
        onEdit={onEdit}
        onGoToPayments={onGoToPayments}
        onGenerateContract={handleGenerateContract}
        onExtendContract={openExtendContractDialog}
        onOpenContractManagement={() => setContractDialogOpen(true)}
        isAdmin={isAdmin}
      />

      {/* Contract Extension Dialog */}
      <ContractExtensionDialog
        open={extendContractOpen}
        onClose={() => {
          setExtendContractOpen(false);
          setSelectedApartmentForExtension(null);
        }}
        apartment={selectedApartmentForExtension}
        onExtend={handleExtendContract}
        isSubmitting={isExtendingContract}
      />

      {/* Contract Management Dialog */}
      <ContractManagementDialog
        open={contractDialogOpen}
        onClose={() => setContractDialogOpen(false)}
        apartment={selectedApartment}
        showNotification={showNotification}
        onContractChange={() => fetchApartments(currentPage, pageSize, searchTerm, sortBy, true)}
      />

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </Container>
  );
}

export default ApartmentList;
