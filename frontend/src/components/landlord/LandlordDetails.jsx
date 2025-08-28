// src/components/LandlordDetails.jsx - FIXED VERSION with working apartment details dialog
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
import ApartmentDetailsDialog from '../apartment/ApartmentDetailsDialog';

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

  // FIXED: Handle apartment view by fetching full apartment data (like TenantsPanel)
  const handleViewApartment = async (apartment) => {
    try {
      // Get full apartment details from the API
      const response = await api.get(`/apartment/${apartment.id}`);
      const fullApartment = response.data;

      // Calculate expiry status (exactly like TenantsPanel)
      const calculateExpiryStatus = (contractEndDate) => {
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

      // Add expiryStatus to apartment object
      fullApartment.expiryStatus = calculateExpiryStatus(fullApartment.contractEndDate);

      setSelectedApartment(fullApartment);
      setApartmentDetailsOpen(true);
    } catch (error) {
      console.error('Error showing apartment details:', error);
      showNotification('Failed to load apartment details', 'error');
    }
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
      link.setAttribute('download', `contract-${apartmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('Contract generated and downloaded successfully', 'success');
    } catch (error) {
      console.error('Error generating contract:', error);
      showNotification('Failed to generate contract', 'error');
    }
  };

  // Helper functions
  const formatCurrency = (amount) => {
    if (!amount) return '€0';
    return `€${parseFloat(amount).toLocaleString()}`;
  };

  const calculateTotalRent = (apartments) => {
    if (!apartments || apartments.length === 0) return 0;
    return apartments.reduce((total, apt) => total + (parseFloat(apt.rent) || 0), 0);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  if (!landlord) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Landlord not found
        </Alert>
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
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Landlord Details
          </Typography>
        </Box>

        {/* Landlord Info Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {landlord.name}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                      {landlord.company_name}
                    </Typography>
                  </Box>
                </Box>

                <Stack spacing={1}>
                  {landlord.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.email}</Typography>
                    </Box>
                  )}
                  {landlord.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.phone}</Typography>
                    </Box>
                  )}
                  {landlord.company_address && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.company_address}</Typography>
                    </Box>
                  )}
                  {landlord.iban && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <BankIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">{landlord.iban}</Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Portfolio Overview
                </Typography>
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

              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Properties Section */}
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Properties ({landlord.apartments ? landlord.apartments.length : 0})
        </Typography>

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

      {/* Apartment Details Dialog - FIXED with proper props */}
      <ApartmentDetailsDialog
        open={apartmentDetailsOpen}
        onClose={handleCloseApartmentDetails}
        apartment={selectedApartment}
        onEdit={() => {
          // Optional: Add edit functionality if needed
          showNotification('Edit functionality would open apartment edit dialog', 'info');
        }}
        onGoToPayments={handleGoToPayments}
        onGenerateContract={handleGenerateContract}
        onExtendContract={() => {
          // Optional: Add extend contract functionality if needed
          showNotification('Contract extension functionality would be implemented here', 'info');
        }}
        onOpenContractManagement={() => {
          // Optional: Add contract management if needed
          showNotification('Contract management would open here', 'info');
        }}
        onGoToTenant={handleGoToTenant}
        showNotification={showNotification}
        isAdmin={true}
      />
    </>
  );
}

export default LandlordDetails;
