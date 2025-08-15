import React from 'react';
import {
  Typography,
  Box,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import {
  Home as HomeIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  Euro as EuroIcon,
} from '@mui/icons-material';

const COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  background: '#f5f5f5',
  text: '#333'
};

const formatCurrency = (amount) => {
  if (amount == null) return '€0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('$', '€');
};

const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Invalid date';
  }
};

const getStatusChip = (status) => {
  const statusConfig = {
    'paid': { label: 'Paid', color: 'success' },
    'partial': { label: 'Partial', color: 'warning' },
    'not_paid': { label: 'Not Paid', color: 'error' },
    'unknown': { label: 'Unknown', color: 'default' }
  };

  const config = statusConfig[status] || statusConfig['unknown'];
  return <Chip label={config.label} color={config.color} size="small" />;
};

function AnalyticsApartmentDetailsDialog({
  detailsOpen,
  selectedApartment,
  apartmentDetails,
  detailsLoading,
  selectedYear,
  handleCloseDetails
}) {

  return (
    <Dialog
      open={detailsOpen}
      onClose={handleCloseDetails}
      maxWidth="xl"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HomeIcon />
          <Typography variant="h6">
            Apartment Details - {selectedApartment?.address || 'N/A'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {detailsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : apartmentDetails ? (
          <Box sx={{ p: 1 }}>
            {/* Apartment Info Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <HomeIcon sx={{ fontSize: 40, color: COLORS.primary, mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">Address</Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {apartmentDetails.apartment?.address || 'N/A'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <EuroIcon sx={{ fontSize: 40, color: COLORS.success, mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">Monthly Rent</Typography>
                    <Typography variant="h6" fontWeight={600}>
                      {formatCurrency(apartmentDetails.apartment?.rent || 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <CalendarIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">Contract Period</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(apartmentDetails.apartment?.contract_start)}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      to {formatDate(apartmentDetails.apartment?.contract_end)}
                    </Typography>
                    {apartmentDetails.contract_period && (
                      <Typography variant="caption" color="textSecondary">
                        ({apartmentDetails.contract_period.total_months} months)
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <PeopleIcon sx={{ fontSize: 40, color: COLORS.secondary, mb: 1 }} />
                    <Typography variant="body2" color="textSecondary">Tenants</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {apartmentDetails.apartment?.tenants?.length || 0} tenant(s)
                    </Typography>
                    {apartmentDetails.apartment?.tenants?.slice(0, 2).map((tenant, index) => (
                      <Typography key={index} variant="caption" display="block">
                        {tenant.name}
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Summary Cards */}
            {apartmentDetails.summary && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="primary" fontWeight={600}>
                      {formatCurrency(apartmentDetails.summary.total_due || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Due (Full Contract)
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="success.main" fontWeight={600}>
                      {formatCurrency(apartmentDetails.summary.total_paid || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Paid
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="error" fontWeight={600}>
                      {formatCurrency(apartmentDetails.summary.total_outstanding || 0)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total Outstanding
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h6" color="warning.main" fontWeight={600}>
                      {Math.round(apartmentDetails.summary.payment_completion_rate || 0)}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Payment Rate
                    </Typography>
                  </Card>
                </Grid>
              </Grid>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Monthly Payment Details */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Monthly Payment Breakdown (Full Contract Period)
            </Typography>

            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: COLORS.background }}>
                    <TableCell><strong>Month</strong></TableCell>
                    <TableCell align="right"><strong>Due</strong></TableCell>
                    <TableCell align="right"><strong>Paid</strong></TableCell>
                    <TableCell align="right"><strong>Outstanding</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="center"><strong>Payments</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apartmentDetails.monthly_details?.length > 0 ? (
                    apartmentDetails.monthly_details.map((month) => (
                      <TableRow key={month.month} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {month.month}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatCurrency(month.due || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={month.paid > 0 ? 'success.main' : 'text.secondary'}
                            fontWeight={month.paid > 0 ? 600 : 400}
                          >
                            {formatCurrency(month.paid || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={(month.outstanding || 0) > 0 ? 'error' : 'success'}
                            fontWeight={(month.outstanding || 0) > 0 ? 600 : 400}
                          >
                            {formatCurrency(month.outstanding || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {getStatusChip(month.status)}
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {month.payment_count || 0} payment{(month.payment_count || 0) !== 1 ? 's' : ''}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body1" color="textSecondary">
                          No monthly details available for this apartment
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="textSecondary">
              No details available
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCloseDetails} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AnalyticsApartmentDetailsDialog;
