// src/components/LandlordDetails.jsx
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
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Business as BusinessIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
  Apartment as ApartmentIcon,
  Edit as EditIcon,
  AccountBalance as BankIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Visibility as ViewIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function LandlordDetails({ landlordId, onBack, showNotification }) {
  const [landlord, setLandlord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleViewApartment = (apartmentId) => {
    // Navigate to apartment details
    navigate(`/dashboard`);
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
            Landlord not found or error loading data
          </Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ mt: 2 }}
          >
            Back to Landlords
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header with back button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
          >
            Back to Landlords List
          </Button>
          <Typography variant="h5" component="h1">
            Landlord Details
          </Typography>
        </Box>

        {/* Landlord Profile Card */}
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    bgcolor: 'primary.main',
                    fontSize: '2.5rem'
                  }}
                >
                  {landlord.company_name ? landlord.company_name.charAt(0).toUpperCase() : <BusinessIcon fontSize="large" />}
                </Avatar>
              </Grid>
              <Grid item xs={12} md={5}>
                <Typography variant="h5" gutterBottom>
                  {landlord.company_name}
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                  {landlord.name}
                </Typography>
                <Stack spacing={1.5}>
                  {landlord.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon color="action" />
                      <Typography variant="body1">{landlord.email}</Typography>
                    </Box>
                  )}
                  {landlord.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhoneIcon color="action" />
                      <Typography variant="body1">{landlord.phone}</Typography>
                    </Box>
                  )}
                  {landlord.company_address && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationIcon color="action" />
                      <Typography variant="body1">{landlord.company_address}</Typography>
                    </Box>
                  )}
                  {landlord.iban && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BankIcon color="action" />
                      <Typography variant="body1">IBAN: {landlord.iban}</Typography>
                    </Box>
                  )}
                </Stack>
              </Grid>

              <Grid item xs={12} md={5}>
                <Typography variant="h6" gutterBottom>
                  Property Summary
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
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

        {/* Tabs for different sections */}
        <Box sx={{ width: '100%', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<ApartmentIcon />} label="Properties" />
            <Tab icon={<MoneyIcon />} label="Financial Summary" />
            <Tab icon={<PieChartIcon />} label="Analytics" />
          </Tabs>
        </Box>

        {/* Properties Tab */}
        {activeTab === 0 && (
          <>
            {!landlord.apartments || landlord.apartments.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No properties are currently assigned to this landlord.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                      <TableCell>Property Address</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Monthly Rent</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {landlord.apartments.map((apartment) => (
                      <TableRow key={apartment.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <HomeIcon fontSize="small" color="primary" />
                            <Typography variant="body1" fontWeight="medium">{apartment.address}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={apartment.status || 'Unknown'}
                            color={
                              apartment.status === 'occupied' ? 'success' :
                                apartment.status === 'vacant' ? 'primary' :
                                  'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(apartment.rent)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Property">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleViewApartment(apartment.id)}
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
          </>
        )}

        {/* Financial Summary Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Here we would display financial summary data like total rent collected, outstanding balances, payment history, etc.
            </Alert>

            <Typography variant="h6" gutterBottom>
              Monthly Income Overview
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText', height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      Total Monthly Revenue
                    </Typography>
                    <Typography variant="h3" component="div">
                      {formatCurrency(calculateTotalRent(landlord.apartments))}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      From {landlord.apartments?.length || 0} properties
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText', height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      Average Per Property
                    </Typography>
                    <Typography variant="h3" component="div">
                      {formatCurrency(
                        landlord.apartments && landlord.apartments.length > 0
                          ? calculateTotalRent(landlord.apartments) / landlord.apartments.length
                          : 0
                      )}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Monthly average
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" component="div">
                      Pending Payments
                    </Typography>
                    <Typography variant="h3" component="div">
                      {formatCurrency(0)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Current month
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Analytics Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            <Alert severity="info">
              This section would display landlord-specific analytics like occupancy rates,
              payment performance over time, and property value trends.
            </Alert>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default LandlordDetails;
