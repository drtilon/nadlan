import React, { useState, useEffect } from 'react';
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
  ListItemText
} from '@mui/material';

// Icons
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import PaymentIcon from '@mui/icons-material/Payment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
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
import api, { getUserData } from '../utils/api';

// Function to fetch landlord data
const fetchLandlordData = async (landlordId) => {
  try {
    const response = await api.get(`/landlords/${landlordId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching landlord data:', error);
    return null;
  }
};

function ApartmentList({ onEdit, onGoToPayments, showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [landlordData, setLandlordData] = useState({});
  const [sortBy, setSortBy] = useState('expiry'); // 'expiry' or 'alphabetical'
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);

  // Get user data to check if admin
  const userData = getUserData();
  const isAdmin = userData && userData.role === 'admin';

  // Helper function to check if contract is expired or expiring soon
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

  // Enhanced status chip with expiry colors
  const getStatusChip = (status, contractEndDate) => {
    const expiryStatus = getExpiryStatus(contractEndDate);
    
    let color = 'default';
    let displayStatus = status;
    let icon = null;
    
    // First handle the basic status
    switch (status) {
      case 'occupied':
        color = 'success';
        displayStatus = 'Occupied';
        break;
      case 'vacant':
        color = 'primary';
        displayStatus = 'Vacant';
        break;
      case 'contract_sent':
        color = 'warning';
        displayStatus = 'Contract Sent';
        break;
      case 'מושכר':
      case 'Rented':
        color = 'success';
        displayStatus = 'Occupied';
        break;
      case 'פנוי':
      case 'Available':
        color = 'primary';
        displayStatus = 'Vacant';
        break;
      case 'חוזה נשלח':
        color = 'warning';
        displayStatus = 'Contract Sent';
        break;
      default:
        displayStatus = status || 'Unknown';
    }

    // Override color based on expiry status for occupied properties
    if (status === 'occupied' || status === 'מושכר' || status === 'Rented') {
      if (expiryStatus.status === 'expired') {
        color = 'error';
        displayStatus = 'Expired';
        icon = <ErrorIcon sx={{ fontSize: '0.8rem' }} />;
      } else if (expiryStatus.status === 'expiring_soon') {
        color = 'warning';
        displayStatus = `Expires in ${expiryStatus.daysUntilExpiry} days`;
        icon = <WarningIcon sx={{ fontSize: '0.8rem' }} />;
      }
    }

    return (
      <Chip
        label={displayStatus}
        color={color}
        size="small"
        icon={icon}
        sx={{
          fontWeight: '500',
          borderRadius: '8px',
          fontSize: '0.75rem',
          height: '24px',
          '& .MuiChip-icon': {
            fontSize: '0.8rem'
          }
        }}
      />
    );
  };

  const fetchApartments = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      showNotification('Authentication required. Please log in again.', 'error');
      setIsLoading(false);
      return;
    }
    try {
      const response = await api.get('/list');
      const normalizedApartments = await Promise.all(
        response.data.map(async (apartment) => {
          let normalizedStatus = apartment.status;
          if (apartment.status === 'מושכר' || apartment.status === 'Rented') {
            normalizedStatus = 'occupied';
          } else if (apartment.status === 'פנוי' || apartment.status === 'Available') {
            normalizedStatus = 'vacant';
          } else if (apartment.status === 'חוזה נשלח' || apartment.status === 'Contract Sent') {
            normalizedStatus = 'contract_sent';
          }

          // Fetch landlord data if only landlord_id is provided
          let landlordInfo = {};
          if (apartment.landlord_id && !apartment.landlord) {
            const landlord = await fetchLandlordData(apartment.landlord_id);
            landlordInfo = landlord || {};
            setLandlordData(prev => ({
              ...prev,
              [apartment.landlord_id]: landlordInfo
            }));
          }

          return {
            ...apartment,
            status: normalizedStatus,
            displayStatus: apartment.status,
            landlord: apartment.landlord || landlordInfo,
            expiryStatus: getExpiryStatus(apartment.contractEndDate)
          };
        })
      );
      setApartments(normalizedApartments);
    } catch (error) {
      console.error(error);
      if (error.response && error.response.status === 401) {
        showNotification('Your session has expired. Please log in again.', 'error');
      } else {
        showNotification('Error loading apartment list', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Sort and filter apartments
  const sortAndFilterApartments = () => {
    let filtered = apartments;

    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(apartment =>
        apartment.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy === 'alphabetical') {
      filtered = [...filtered].sort((a, b) => 
        a.address.localeCompare(b.address)
      );
    } else if (sortBy === 'expiry') {
      filtered = [...filtered].sort((a, b) => {
        // First, sort by expiry status priority
        const statusPriority = {
          'expired': 1,
          'expiring_soon': 2,
          'valid': 3,
          'no_date': 4
        };
        
        const aPriority = statusPriority[a.expiryStatus.status] || 5;
        const bPriority = statusPriority[b.expiryStatus.status] || 5;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // If same status, sort by days until expiry (ascending for expired/expiring, descending for valid)
        if (a.expiryStatus.daysUntilExpiry !== null && b.expiryStatus.daysUntilExpiry !== null) {
          if (a.expiryStatus.status === 'expired' || a.expiryStatus.status === 'expiring_soon') {
            return a.expiryStatus.daysUntilExpiry - b.expiryStatus.daysUntilExpiry;
          } else {
            return b.expiryStatus.daysUntilExpiry - a.expiryStatus.daysUntilExpiry;
          }
        }
        
        // Finally, sort alphabetically
        return a.address.localeCompare(b.address);
      });
    }

    setFilteredApartments(filtered);
  };

  const handleGenerateContract = (apartmentId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setDetailsOpen(false);
    generateContract(apartmentId);
  };

  const generateContract = async (apartmentId) => {
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
      const apartment = apartments.find(apt => apt.id === apartmentId);
      const fileName = `Rental_Contract_${apartment ? (apartment.address || 'Apartment') : 'Apartment'}.docx`;

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);
      showNotification('Failed to generate contract', 'error');
    }
  };

  useEffect(() => {
    fetchApartments();
  }, []);

  useEffect(() => {
    sortAndFilterApartments();
  }, [searchTerm, apartments, sortBy]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterClick = (event) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
    handleFilterClose();
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/export', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'apartments.xlsx');
      document.body.appendChild(link);
      link.click();
      showNotification('File exported successfully');
    } catch (error) {
      console.error(error);
      showNotification('Error exporting file', 'error');
    }
  };

  const openDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
  };

  const getAddressInitial = (address) => {
    return address && address.charAt(0).toUpperCase();
  };

  const handleEditClick = (apartment, e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(apartment);
  };

  const handlePaymentClick = (apartmentId, e) => {
    e.preventDefault();
    e.stopPropagation();
    onGoToPayments(apartmentId);
  };

  const handleDetailsClick = (apartment, e) => {
    e.preventDefault();
    e.stopPropagation();
    openDetails(apartment);
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  };

  const getLandlordInfo = (apartment) => {
    if (apartment.landlord) {
      return {
        name: apartment.landlord.name || 'Not specified',
        email: apartment.landlord.email || '',
        phone: apartment.landlord.phone || ''
      };
    }

    if (apartment.landlord_id && landlordData[apartment.landlord_id]) {
      return {
        name: landlordData[apartment.landlord_id].name || 'Not specified',
        email: landlordData[apartment.landlord_id].email || '',
        phone: landlordData[apartment.landlord_id].phone || ''
      };
    }

    return {
      name: apartment.landlordName || 'Not specified',
      email: apartment.landlordEmail || '',
      phone: apartment.landlordPhone || ''
    };
  };

  const LandlordSection = ({ apartment }) => {
    const landlordInfo = getLandlordInfo(apartment);

    return (
      <Grid item xs={12} sx={{ mt: 2 }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <PersonIcon color="primary" fontSize="small" />
          Landlord Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Name
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {landlordInfo.name}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Email
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {landlordInfo.email || 'Not provided'}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Phone
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {landlordInfo.phone || 'Not provided'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Grid>
    );
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item}>
              <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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
          Properties
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
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 500,
              borderWidth: 1.5,
              px: 3,
              height: '48px'
            }}
          >
            Export
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
            minWidth: '120px',
            borderColor: 'divider'
          }}
        >
          Sort: {sortBy === 'expiry' ? 'Expiry Date' : 'A-Z'}
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

      {filteredApartments.length === 0 ? (
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
        <Grid container spacing={3}>
          {filteredApartments.map((apartment) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={apartment.id}>
              <Card
                elevation={0}
                onClick={() => openDetails(apartment)}
                sx={{
                  borderRadius: 2,
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  border: '1px solid',
                  borderColor: apartment.expiryStatus.status === 'expired' 
                    ? 'error.main' 
                    : apartment.expiryStatus.status === 'expiring_soon' 
                      ? 'warning.main' 
                      : 'divider',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-4px)',
                    borderColor: apartment.expiryStatus.status === 'expired' 
                      ? 'error.main' 
                      : apartment.expiryStatus.status === 'expiring_soon' 
                        ? 'warning.main' 
                        : 'primary.main'
                  },
                  cursor: 'pointer'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    background: apartment.expiryStatus.status === 'expired' 
                      ? 'linear-gradient(to right, rgba(211, 47, 47, 0.05), rgba(211, 47, 47, 0))' 
                      : apartment.expiryStatus.status === 'expiring_soon' 
                        ? 'linear-gradient(to right, rgba(237, 108, 2, 0.05), rgba(237, 108, 2, 0))' 
                        : 'linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0))',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, maxWidth: '80%' }}>
                    <Avatar
                      sx={{
                        backgroundColor: apartment.expiryStatus.status === 'expired' 
                          ? 'error.main' 
                          : apartment.expiryStatus.status === 'expiring_soon' 
                            ? 'warning.main' 
                            : 'primary.main',
                        width: 36,
                        height: 36
                      }}
                    >
                      {getAddressInitial(apartment.address)}
                    </Avatar>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {apartment.address}
                    </Typography>
                  </Box>
                  {getStatusChip(apartment.status, apartment.contractEndDate)}
                </Box>

                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                      <BedIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                      <Typography variant="body2" color="text.secondary">
                        {apartment.rooms} rooms
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                      <SquareFootIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                      <Typography variant="body2" color="text.secondary">
                        {apartment.size} m²
                      </Typography>
                    </Box>
                    {apartment.moveInDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                        <EventIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(apartment.moveInDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                    {apartment.contractEndDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                        <AccessTimeIcon 
                          fontSize="small" 
                          sx={{ 
                            color: apartment.expiryStatus.status === 'expired' 
                              ? 'error.main' 
                              : apartment.expiryStatus.status === 'expiring_soon' 
                                ? 'warning.main' 
                                : 'text.secondary', 
                            fontSize: '1rem' 
                          }} 
                        />
                        <Typography 
                          variant="body2" 
                          sx={{
                            color: apartment.expiryStatus.status === 'expired' 
                              ? 'error.main' 
                              : apartment.expiryStatus.status === 'expiring_soon' 
                                ? 'warning.main' 
                                : 'text.secondary'
                          }}
                        >
                          Expires: {new Date(apartment.contractEndDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    )}
                    {apartment.tenants && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: '1rem', mt: 0.5 }} />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {Array.isArray(apartment.tenants)
                            ? apartment.tenants.map(t => t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : t.name).join(', ')
                            : apartment.tenants}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Divider sx={{ my: 2 }} />

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mt: 1
                    }}
                  >
                    <Box
                      onClick={(e) => handlePaymentClick(apartment.id, e)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        borderRadius: 1,
                        py: 0.5,
                        px: 1,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <PaymentIcon fontSize="small" color="primary" />
                      <Typography
                        variant="body2"
                        color="primary"
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.8rem',
                          userSelect: 'none'
                        }}
                      >
                        Payments
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Generate Contract">
                        <IconButton
                          size="small"
                          onClick={(e) => handleGenerateContract(apartment.id, e)}
                          sx={{ color: 'success.main' }}
                        >
                          <DescriptionIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Edit Property">
                        <IconButton
                          size="small"
                          onClick={(e) => handleEditClick(apartment, e)}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => handleDetailsClick(apartment, e)}
                        sx={{
                          borderRadius: 1,
                          textTransform: 'none',
                          fontWeight: 500,
                          fontSize: '0.8rem',
                          minWidth: 0,
                          borderColor: 'divider'
                        }}
                      >
                        Details
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
      >
        {selectedApartment && (
          <>
            <DialogTitle
              sx={{
                p: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LocationOnIcon />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedApartment.address}
                </Typography>
              </Box>
              <IconButton
                edge="end"
                color="inherit"
                onClick={() => setDetailsOpen(false)}
                aria-label="close"
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  bgcolor: 'background.default',
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status:
                  </Typography>
                  {getStatusChip(selectedApartment.status, selectedApartment.contractEndDate)}
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {isAdmin && (
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      variant="outlined"
                      onClick={() => {
                        setDetailsOpen(false);
                        onEdit(selectedApartment);
                      }}
                      sx={{
                        borderRadius: 1,
                        textTransform: 'none'
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="small"
                    startIcon={<PaymentIcon />}
                    variant="contained"
                    onClick={() => {
                      setDetailsOpen(false);
                      onGoToPayments(selectedApartment.id);
                    }}
                    sx={{
                      borderRadius: 1,
                      textTransform: 'none'
                    }}
                  >
                    Payments
                  </Button>
                </Box>
              </Box>

              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  {/* Property Details Section */}
                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <HomeIcon color="primary" fontSize="small" />
                      Property Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Property Size
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {selectedApartment.size} m²
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Rooms
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {selectedApartment.rooms}
                          </Typography>
                        </Box>
                      </Grid>
                      {isAdmin && (
                        <Grid item xs={12} sm={6} md={3}>
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                              Property Model
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {selectedApartment.model === 'management'
                                ? 'Property Management'
                                : selectedApartment.model === 'rental'
                                  ? 'Rental Property'
                                  : selectedApartment.model || 'Not specified'}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Monthly Rent
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {formatCurrency(selectedApartment.rent)}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Contract Details Section */}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}
                    >
                      <AccessTimeIcon color="primary" fontSize="small" />
                      Contract Timeline
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Move-In Date
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {formatDate(selectedApartment.moveInDate)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ 
                          p: 2, 
                          border: '1px solid', 
                          borderColor: selectedApartment.expiryStatus.status === 'expired' 
                            ? 'error.main' 
                            : selectedApartment.expiryStatus.status === 'expiring_soon' 
                              ? 'warning.main' 
                              : 'divider', 
                          borderRadius: 1,
                          bgcolor: selectedApartment.expiryStatus.status === 'expired' 
                            ? 'error.50' 
                            : selectedApartment.expiryStatus.status === 'expiring_soon' 
                              ? 'warning.50' 
                              : 'inherit'
                        }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Contract End Date
                          </Typography>
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{
                              color: selectedApartment.expiryStatus.status === 'expired' 
                                ? 'error.main' 
                                : selectedApartment.expiryStatus.status === 'expiring_soon' 
                                  ? 'warning.main' 
                                  : 'inherit'
                            }}
                          >
                            {formatDate(selectedApartment.contractEndDate)}
                            {selectedApartment.expiryStatus.status === 'expired' && (
                              <Typography variant="caption" display="block" color="error.main">
                                Expired {Math.abs(selectedApartment.expiryStatus.daysUntilExpiry)} days ago
                              </Typography>
                            )}
                            {selectedApartment.expiryStatus.status === 'expiring_soon' && (
                              <Typography variant="caption" display="block" color="warning.main">
                                Expires in {selectedApartment.expiryStatus.daysUntilExpiry} days
                              </Typography>
                            )}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Tenant Information */}
                  {selectedApartment.tenants && (
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          mb: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        <PersonIcon color="primary" fontSize="small" />
                        Tenant Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                              Tenants
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {Array.isArray(selectedApartment.tenants)
                                ? selectedApartment.tenants.map(t => t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : t.name).join(', ')
                                : selectedApartment.tenants}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Grid>
                  )}

                  {/* Landlord Information */}
                  {isAdmin && <LandlordSection apartment={selectedApartment} />}
                </Grid>
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setDetailsOpen(false)}
                variant="outlined"
                sx={{ borderRadius: 1, textTransform: 'none' }}
              >
                Close
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => handleGenerateContract(selectedApartment.id)}
                  variant="contained"
                  startIcon={<DescriptionIcon />}
                  sx={{ borderRadius: 1, textTransform: 'none' }}
                >
                  Generate Contract
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default ApartmentList;
