// components/ApartmentList.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import HomeIcon from '@mui/icons-material/Home';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import PaymentIcon from '@mui/icons-material/Payment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import api from '../utils/api';

function ApartmentList({ onEdit, onGoToPayments, showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Create a theme with LTR direction
  const ltrTheme = createTheme({
    direction: 'ltr',
  });

  const fetchApartments = async () => {
    setIsLoading(true);

    // Check for token before making the request
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      showNotification('Authentication required. Please log in again.', 'error');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get('/list');

      // Normalize status values to match form options
      const normalizedApartments = response.data.map(apartment => {
        let normalizedStatus = apartment.status;

        // Convert Hebrew status values to valid English option values
        if (apartment.status === 'מושכר' || apartment.status === 'Rented') {
          normalizedStatus = 'occupied';
        } else if (apartment.status === 'פנוי' || apartment.status === 'Available') {
          normalizedStatus = 'vacant';
        } else if (apartment.status === 'חוזה נשלח' || apartment.status === 'Contract Sent') {
          normalizedStatus = 'contract_sent';
        }

        // Return apartment with normalized status
        return {
          ...apartment,
          status: normalizedStatus,
          // Store the display status for UI purposes
          displayStatus: apartment.status
        };
      });

      setApartments(normalizedApartments);
      setFilteredApartments(normalizedApartments);
    } catch (error) {
      console.error(error);
      // If we get a 401, the token might be expired or invalid
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
    // Map internal status values to display values and colors
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
      // Handle legacy values
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
        variant="outlined"
      />
    );
  };

  // Open the details dialog for a selected apartment
  const openDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
  };

  // Get the display status for the details view
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'occupied': return 'Occupied';
      case 'vacant': return 'Vacant';
      case 'contract_sent': return 'Contract Sent';
      default: return status || 'Not specified';
    }
  };

  // Get color for status in details view
  const getStatusColor = (status) => {
    switch (status) {
      case 'occupied': return 'success';
      case 'vacant': return 'primary';
      case 'contract_sent': return 'warning';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={ltrTheme}>
      <Box sx={{ direction: 'ltr' }}>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">Apartment List</Typography>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleExport}
              startIcon={<FileDownloadIcon />}
            >
              Export to Excel
            </Button>
          </Box>

          {/* Search Field */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by address"
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{ textAlign: 'left' }}
              inputProps={{ style: { textAlign: 'left' } }}
            />
          </Box>

          {filteredApartments.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 4 }}>
              {searchTerm ? 'No apartments match your search' : 'No apartments found. Click + to add a new apartment.'}
            </Typography>
          ) : (
            <Grid container spacing={2} direction="row">
              {filteredApartments.map((apartment) => (
                <Grid item xs={12} sm={6} md={4} key={apartment.id}>
                  <Card
                    elevation={2}
                    sx={{
                      height: '100%',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                      }
                    }}
                  >
                    <CardContent>
                      {/* Header row with title on the left and two icons stacked on the right */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }}>
                          {apartment.address}
                        </Typography>

                        {/* Icons in a vertical column */}
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Edit icon */}
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => onEdit(apartment)}
                          >
                            <EditIcon />
                          </IconButton>

                          {/* Payment icon below the edit icon */}
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => onGoToPayments(apartment.id)}
                          >
                            <PaymentIcon />
                          </IconButton>
                        </Box>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {apartment.rooms} rooms | {apartment.size} sqm
                      </Typography>

                      <Divider sx={{ mb: 2 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {getStatusChip(apartment.status)}
                        <Button size="small" onClick={() => openDetails(apartment)}>
                          More Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Apartment Details Dialog */}
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          {selectedApartment && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HomeIcon color="primary" />
                  <Typography variant="h6">{selectedApartment.address}</Typography>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={3}>
                  {/* Property Information */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary" fontWeight="medium">
                      Property Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Property Size
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {selectedApartment.size} square meters
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Number of Rooms
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {selectedApartment.rooms} rooms
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={getStatusDisplay(selectedApartment.status)}
                        color={getStatusColor(selectedApartment.status)}
                        size="small"
                      />
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Property Model
                      </Typography>
                      <Typography variant="body1">
                        {selectedApartment.model === 'management' ? 'Property Management' :
                          selectedApartment.model === 'rental' ? 'Rental Property' :
                            selectedApartment.model || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Contract Details */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary" fontWeight="medium" sx={{ mt: 2 }}>
                      Contract Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Move-In Date
                      </Typography>
                      <Typography variant="body1">
                        {selectedApartment.moveInDate ? new Date(selectedApartment.moveInDate).toLocaleDateString() : 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Contract End Date
                      </Typography>
                      <Typography variant="body1">
                        {selectedApartment.contractEndDate ? new Date(selectedApartment.contractEndDate).toLocaleDateString() : 'Not set'}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Landlord Information */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary" fontWeight="medium" sx={{ mt: 2 }}>
                      Landlord Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Landlord Name
                      </Typography>
                      <Typography variant="body1">
                        {selectedApartment.landlordName || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Landlord Contact
                      </Typography>
                      {selectedApartment.landlordPhone ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PhoneIcon fontSize="small" color="action" />
                          <Typography variant="body1">{selectedApartment.landlordPhone}</Typography>
                        </Box>
                      ) : (
                        <Typography variant="body1">Not specified</Typography>
                      )}
                      {selectedApartment.landlordEmail && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <EmailIcon fontSize="small" color="action" />
                          <Typography variant="body1">{selectedApartment.landlordEmail}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>

                  {/* Tenants */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" color="primary" fontWeight="medium" sx={{ mt: 2 }}>
                      Current Tenants
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                  </Grid>

                  <Grid item xs={12}>
                    {selectedApartment.tenants ? (
                      <Box>
                        {Array.isArray(selectedApartment.tenants) ? (
                          // Handle array of tenant objects
                          selectedApartment.tenants.map((tenant, index) => (
                            <Chip
                              key={tenant.id || index}
                              label={tenant.firstName && tenant.lastName ?
                                `${tenant.firstName} ${tenant.lastName}` :
                                tenant.name || 'Unnamed Tenant'}
                              icon={<PersonIcon />}
                              variant={tenant.isPrimary ? "filled" : "outlined"}
                              color="primary"
                              sx={{ m: 0.5 }}
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
                              sx={{ m: 0.5 }}
                            />
                          ))
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body1" color="text.secondary">
                        No tenants assigned to this apartment
                      </Typography>
                    )}
                  </Grid>

                  {/* Notes */}
                  {selectedApartment.notes && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" color="primary" fontWeight="medium" sx={{ mt: 2 }}>
                          Additional Notes
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                      </Grid>

                      <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="body1">
                            {selectedApartment.notes}
                          </Typography>
                        </Paper>
                      </Grid>
                    </>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setDetailsOpen(false)}
                  variant="contained"
                >
                  Close
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default ApartmentList;
