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
    try {
      const response = await api.get('/list');
      setApartments(response.data);
      setFilteredApartments(response.data);
    } catch (error) {
      console.error(error);
      showNotification('Error loading apartment list', 'error');
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

    // Translate Hebrew status values to English if needed
    if (status === 'מושכר') {
      color = 'success';
      displayStatus = 'Rented';
    } else if (status === 'פנוי') {
      color = 'primary';
      displayStatus = 'Available';
    } else if (status === 'חוזה נשלח') {
      color = 'warning';
      displayStatus = 'Contract Sent';
    }

    return (
      <Chip
        label={displayStatus || 'Unknown'}
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
                <Typography variant="h6">{selectedApartment.address}</Typography>
              </DialogTitle>

              <DialogContent dividers>
                {/* Additional apartment details can go here */}
                <Typography variant="body1">
                  {selectedApartment.rooms} rooms | {selectedApartment.size} sqm
                </Typography>
              </DialogContent>

              <DialogActions>
                <Button onClick={() => setDetailsOpen(false)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default ApartmentList;
