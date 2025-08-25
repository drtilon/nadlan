// src/components/LandlordDetails.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  Box,
  Chip,
  LinearProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Stack,
  Alert
} from '@mui/material';
import {
  Business as BusinessIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  AccountBalance as BankIcon,
  LocationOn as LocationIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog'; // Import the apartment details dialog

function LandlordDetails({ landlordId, onBack, showNotification }) {
  const [landlord, setLandlord] = useState(null);
  const [loading, setLoading] = useState(true);

  // State for apartment details dialog
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [apartmentDetailsOpen, setApartmentDetailsOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchLandlordData();
  }, [landlordId]);

  const fetchLandlordData = async () => {
    setLoading(true);
    try {
      // Fetch landlord details
      const landlordResponse = await api.get(`/landlords/${landlordId}`);
      setLandlord(landlordResponse.data);
    } catch (error) {
      console.error('Error fetching landlord data:', error);
      showNotification('Error loading landlord details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Handle apartment view by opening details dialog
  const handleViewApartment = (apartment) => {
    setSelectedApartment(apartment);
    setApartmentDetailsOpen(true);
  };

  // Handle apartment dialog close
  const handleCloseApartmentDetails = () => {
    setApartmentDetailsOpen(false);
    setSelectedApartment(null);
  };

  // Handle tenant navigation
  const handleGoToTenant = (tenantId) => {
    setApartmentDetailsOpen(false); // Close dialog first
    showNotification('Navigating to tenant details...', 'info');
    navigate(`/tenants/${tenantId}`);
  };

  // Handle payments navigation
  const handleGoToPayments = (apartmentId) => {
    setApartmentDetailsOpen(false); // Close dialog first
    showNotification('Navigating to payments...', 'info');
    navigate(`/payments/${apartmentId}`);
  };

  // Handle contract generation
  const handleGenerateContract = async (apartmentId) => {
    try {
      const response = await api.post(`/generate-contract/${apartmentId}`, {}, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract_${apartmentId}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showNotification('Contract generated successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);
      showNotification('Failed to generate contract', 'error');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate total rent across all properties
  const calculateTotalRent = (apartments) => {
    if (!apartments || !apartments.length) return 0;
    return apartments.reduce((total, apt) => total + (apt.rent || 0), 0);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
            Loading landlord details...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (!landlord) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Alert severity="error">
            Landlord not found or error loading data.
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
            {landlord.company_name}
          </Typography>
        </Box>

        {/* Landlord Overview Card */}
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ width: 60, height: 60, mr: 3, bgcolor: 'primary.main' }}>
                    <BusinessIcon fontSize="large" />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" gutterBottom>
                      {landlord.name}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                      {landlord.company_name}
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.email}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.phone}</Typography>
                    </Box>
                  </Grid>
                  {landlord.company_address && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{landlord.company_address}</Typography>
                      </Box>
                    </Grid>
                  )}
                  {landlord.iban && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <BankIcon sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{landlord.iban}</Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>

                {landlord.notes && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2">{landlord.notes}</Typography>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 1, bgcolor: 'background.paper', boxShadow: 1 }}>
                      <Typography variant="h4" color="primary.main">
                        {landlord.apartments ? landlord.apartments.length : 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Properties
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, borderRadius: 1, bgcolor: 'background.paper', boxShadow: 1 }}>
                      <Typography variant="h4" color="success.main">
                        {formatCurrency(calculateTotalRent(landlord.apartments))}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Monthly Revenue
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<EditIcon />}
                    onClick={() => showNotification('Edit functionality would open a modal here', 'info')}
                  >
                    Edit Landlord
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Properties Section */}
        {!landlord.apartments || landlord.apartments.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No properties are currently assigned to this landlord.
          </Alert>
        ) : (
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Address</TableCell>
                  <TableCell>Rent</TableCell>
                  <TableCell>Rooms</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {landlord.apartments.map((apartment) => (
                  <TableRow key={apartment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {apartment.address}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="success.main" fontWeight={500}>
                        {formatCurrency(apartment.rent)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {apartment.rooms} rooms
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={apartment.status || 'Available'}
                        color={apartment.status === 'occupied' ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton
                          color="primary"
                          onClick={() => handleViewApartment(apartment)}
                          size="small"
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* Apartment Details Dialog */}
      <ApartmentDetailsDialog
        open={apartmentDetailsOpen}
        onClose={handleCloseApartmentDetails}
        apartment={selectedApartment}
        onEdit={() => {}} // Add edit functionality if needed
        onGoToPayments={handleGoToPayments}
        onGenerateContract={handleGenerateContract}
        onExtendContract={() => {}} // Add extend contract functionality if needed
        onOpenContractManagement={() => {}} // Add contract management if needed
        onGoToTenant={handleGoToTenant}
        isAdmin={true} // You might want to pass this as a prop
      />
    </>
  );
}

export default LandlordDetails;
