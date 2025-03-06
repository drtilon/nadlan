// components/ApartmentList.jsx
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
  Container
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

import api from '../utils/api';

function ApartmentList({ onEdit, onGoToPayments, showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

      const normalizedApartments = response.data.map(apartment => {
        let normalizedStatus = apartment.status;

        if (apartment.status === 'מושכר' || apartment.status === 'Rented') {
          normalizedStatus = 'occupied';
        } else if (apartment.status === 'פנוי' || apartment.status === 'Available') {
          normalizedStatus = 'vacant';
        } else if (apartment.status === 'חוזה נשלח' || apartment.status === 'Contract Sent') {
          normalizedStatus = 'contract_sent';
        }

        return {
          ...apartment,
          status: normalizedStatus,
          displayStatus: apartment.status
        };
      });

      setApartments(normalizedApartments);
      setFilteredApartments(normalizedApartments);
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

  useEffect(() => {
    fetchApartments();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredApartments(apartments);
    } else {
      const filtered = apartments.filter(apartment =>
        apartment.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredApartments(filtered);
    }
  }, [searchTerm, apartments]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
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

  const getStatusChip = (status) => {
    let color = 'default';
    let displayStatus = status;

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

    return (
      <Chip
        label={displayStatus}
        color={color}
        size="small"
        sx={{
          fontWeight: '500',
          borderRadius: '8px',
          fontSize: '0.75rem',
          height: '24px'
        }}
      />
    );
  };

  const openDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
  };

  const getAddressInitial = (address) => {
    return address && address.charAt(0).toUpperCase();
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
              <Skeleton
                variant="rectangular"
                width="100%"
                height={200}
                sx={{ borderRadius: 2 }}
              />
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

      {/* Search and Filter */}
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
          sx={{
            borderRadius: 1,
            textTransform: 'none',
            fontWeight: 500,
            height: '48px',
            minWidth: '120px',
            borderColor: 'divider'
          }}
        >
          Filters
        </Button>
      </Box>

      {/* Empty State */}
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
          {!searchTerm && (
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
        /* Property Grid */
        <Grid container spacing={3}>
          {filteredApartments.map((apartment) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={apartment.id}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 2,
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-4px)',
                    borderColor: 'transparent'
                  }
                }}
              >
                {/* Property Header */}
                <Box
                  sx={{
                    p: 2,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.02), rgba(0,0,0,0))',
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
                        backgroundColor: 'primary.main',
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

                  {getStatusChip(apartment.status)}
                </Box>

                {/* Property Content */}
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

                  {/* Action Buttons */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mt: 1
                    }}
                  >
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      startIcon={<PaymentIcon fontSize="small" />}
                      onClick={() => onGoToPayments(apartment.id)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.8rem'
                      }}
                    >
                      Payments
                    </Button>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit Property">
                        <IconButton
                          size="small"
                          onClick={() => onEdit(apartment)}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openDetails(apartment)}
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

      {/* Property Details Dialog */}
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
              {/* Property Status Banner */}
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
                  <Chip
                    label={
                      selectedApartment.status === 'occupied' ? 'Occupied' :
                        selectedApartment.status === 'vacant' ? 'Vacant' :
                          selectedApartment.status === 'contract_sent' ? 'Contract Sent' :
                            selectedApartment.status || 'Unknown'
                    }
                    color={
                      selectedApartment.status === 'occupied' ? 'success' :
                        selectedApartment.status === 'vacant' ? 'primary' :
                          selectedApartment.status === 'contract_sent' ? 'warning' :
                            'default'
                    }
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
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

                      <Grid item xs={12} sm={6} md={3}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Property Model
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {selectedApartment.model === 'management' ? 'Property Management' :
                              selectedApartment.model === 'rental' ? 'Rental Property' :
                                selectedApartment.model || 'Not specified'}
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
                            {selectedApartment.moveInDate ? new Date(selectedApartment.moveInDate).toLocaleDateString() : 'Not set'}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Contract End Date
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {selectedApartment.contractEndDate ? new Date(selectedApartment.contractEndDate).toLocaleDateString() : 'Not set'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Landlord Information */}
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

                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 2,
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                          Name
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {selectedApartment.landlordName || 'Not specified'}
                        </Typography>
                      </Box>

                      {selectedApartment.landlordPhone && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Phone
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight={500}>
                              {selectedApartment.landlordPhone}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {selectedApartment.landlordEmail && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Email
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon color="primary" fontSize="small" />
                            <Typography variant="body2" fontWeight={500}>
                              {selectedApartment.landlordEmail}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Grid>

                  {/* Tenants */}
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
                      Current Tenants
                    </Typography>

                    <Box
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}
                    >
                      {selectedApartment.tenants ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {Array.isArray(selectedApartment.tenants) ? (
                            // Handle array of tenant objects
                            selectedApartment.tenants.map((tenant, index) => (
                              <Chip
                                key={tenant.id || index}
                                label={tenant.firstName && tenant.lastName ?
                                  `${tenant.firstName} ${tenant.lastName}` :
                                  tenant.name || 'Unnamed Tenant'}
                                icon={<PersonIcon />}
                                variant="outlined"
                                color="primary"
                                sx={{
                                  borderRadius: 1,
                                  fontWeight: tenant.isPrimary ? 600 : 400
                                }}
                              />
                            ))
                          ) : (
                            // Handle string of comma-separated tenant names
                            selectedApartment.tenants.split(',').map((tenant, index) => (
                              <Chip
                                key={index}
                                label={tenant.trim()}
                                icon={<PersonIcon />}
                                variant="outlined"
                                color="primary"
                                sx={{
                                  borderRadius: 1
                                }}
                              />
                            ))
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No tenants assigned to this property
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  {/* Notes */}
                  {selectedApartment.notes && (
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          mb: 2
                        }}
                      >
                        Notes
                      </Typography>

                      <Box
                        sx={{
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          bgcolor: 'background.default'
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                          {selectedApartment.notes}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                onClick={() => setDetailsOpen(false)}
                variant="outlined"
                sx={{
                  borderRadius: 1,
                  textTransform: 'none',
                  px: 3
                }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default ApartmentList;
