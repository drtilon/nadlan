import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TablePagination,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CalendarToday as CalendarIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const COLORS = {
  primary: '#2563eb',
  secondary: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  background: '#f9fafb',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#ffffff'
};

const formatCurrency = (amount) => {
  if (amount == null) return 'EUR 0';
  return 'EUR ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

const getOutstandingChip = (amount) => {
  let label, color;
  if (amount === 0) {
    label = 'Current';
    color = 'success';
  } else if (amount < 500) {
    label = 'Low';
    color = 'info';
  } else if (amount < 1000) {
    label = 'Medium';
    color = 'warning';
  } else {
    label = 'High';
    color = 'error';
  }
  return <Chip label={label} color={color} size="small" variant="outlined" />;
};

function OutstandingPaymentsTab({
  outstandingData,
  outstandingLoading,
  outstandingPage,
  outstandingRowsPerPage,
  outstandingSearch,
  outstandingSort,
  setOutstandingSearch,
  setOutstandingSort,
  handleOutstandingPageChange,
  handleOutstandingRowsPerPageChange,
  handleOpenDetails
}) {
  const [data, setData] = useState(outstandingData);
  const [loading, setLoading] = useState(outstandingLoading);
  const [detailDialog, setDetailDialog] = useState({ open: false, apartment: null, details: null });
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setData(outstandingData);
    setLoading(outstandingLoading);
  }, [outstandingData, outstandingLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        page: outstandingPage,
        limit: outstandingRowsPerPage,
        period_type: 'current_month',
        sort: outstandingSort
      };
      if (outstandingSearch) params.search = outstandingSearch;
      const response = await api.get('/analytics/outstanding-payments', { params });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching outstanding payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApartmentPaymentDetails = async (apartment) => {
    try {
      setDetailLoading(true);
      const detailsResponse = await api.get(`/analytics/apartment-outstanding-details/${apartment.apartment_id}`, {
        params: { period_type: 'current_month' }
      });
      setDetailDialog({ open: true, apartment, details: detailsResponse.data });
    } catch (error) {
      console.error('Error fetching apartment details:', error);
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
      const currentYear = currentDate.getFullYear();
      const tenantBreakdown = apartment.tenants ? apartment.tenants.map(tenantName => {
        const rentPerTenant = apartment.monthly_rent / apartment.tenants.length;
        return {
          tenant_name: tenantName,
          total_paid: 0,
          total_due: rentPerTenant,
          outstanding: rentPerTenant,
          payment_count: 0,
          payments: []
        };
      }) : [];
      const fallbackDetails = {
        apartment: {
          id: apartment.apartment_id,
          address: apartment.address,
          monthly_rent: apartment.monthly_rent,
          status: apartment.status
        },
        period: {
          type: 'current_month',
          label: `${currentMonth} ${currentYear}`,
          start_date: new Date(currentYear, currentDate.getMonth(), 1).toISOString().split('T')[0],
          end_date: new Date(currentYear, currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
        },
        summary: {
          expected_amount: apartment.monthly_rent || 0,
          total_outstanding: apartment.total_outstanding || 0,
          total_paid: (apartment.monthly_rent || 0) - (apartment.total_outstanding || 0),
          collection_rate: apartment.monthly_rent > 0 ?
            (((apartment.monthly_rent - apartment.total_outstanding) / apartment.monthly_rent) * 100) : 100
        },
        tenant_breakdown: tenantBreakdown
      };
      setDetailDialog({ open: true, apartment, details: fallbackDetails });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRowClick = (apartment) => {
    fetchApartmentPaymentDetails(apartment);
  };

  useEffect(() => {
    fetchData();
  }, [outstandingSearch, outstandingSort, outstandingPage, outstandingRowsPerPage]);

  return (
    <Box sx={{ py: 4, px: { xs: 2, md: 0 } }}>
      {/* Controls Row */}
      <Grid container spacing={3} sx={{ mb: 4 }} alignItems="center">
        <Grid item xs={12} md="auto">
          <Typography variant="h6" color={COLORS.text} fontWeight={600}>
            Current Month: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            size="small"
            fullWidth
            label="Search apartments or tenants"
            value={outstandingSearch}
            onChange={(e) => setOutstandingSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: COLORS.muted }} />
                </InputAdornment>
              ),
            }}
            variant="outlined"
            sx={{
              backgroundColor: COLORS.surface,
              borderRadius: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: COLORS.border },
                '&:hover fieldset': { borderColor: COLORS.primary },
              },
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl size="small" fullWidth variant="outlined">
            <InputLabel sx={{ color: COLORS.muted }}>Sort By</InputLabel>
            <Select
              value={outstandingSort}
              label="Sort By"
              onChange={(e) => setOutstandingSort(e.target.value)}
              sx={{
                backgroundColor: COLORS.surface,
                borderRadius: 1,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.primary },
              }}
            >
              <MenuItem value="outstanding_desc">Outstanding (High to Low)</MenuItem>
              <MenuItem value="outstanding_asc">Outstanding (Low to High)</MenuItem>
              <MenuItem value="address_asc">Address (A-Z)</MenuItem>
              <MenuItem value="rent_desc">Rent (High to Low)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md="auto">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {loading && <CircularProgress size={20} color="primary" />}
            <Typography variant="body2" color={COLORS.muted}>
              {data?.pagination?.total_items || 0} apartments
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Table */}
      <Paper
        sx={{
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          overflow: 'hidden'
        }}
      >
        <TableContainer sx={{ maxHeight: 600, overflowX: 'auto' }}>
          <Table aria-label="outstanding payments table">
            <TableHead>
              <TableRow sx={{
                bgcolor: COLORS.background,
                '& th': {
                  fontWeight: 600,
                  color: COLORS.text,
                  py: 2.5,
                  px: 3,
                  borderBottom: `1px solid ${COLORS.border}`
                }
              }}>
                <TableCell>Apartment Name</TableCell>
                <TableCell>Tenants</TableCell>
                <TableCell align="right">Monthly Rent</TableCell>
                <TableCell align="right">Total Outstanding</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from(new Array(outstandingRowsPerPage)).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from(new Array(5)).map((_, cellIndex) => (
                      <TableCell key={cellIndex} sx={{ py: 3 }}>
                        <CircularProgress size={20} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.apartments || data.apartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, borderBottom: 'none' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <WarningIcon sx={{ fontSize: 40, color: COLORS.muted, mb: 2 }} />
                      <Typography variant="h6" color={COLORS.muted} gutterBottom fontWeight={500}>
                        No Outstanding Payments Found
                      </Typography>
                      <Typography variant="body2" color={COLORS.muted}>
                        All apartments are current for this month
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                data.apartments.map((apartment) => (
                  <TableRow
                    key={apartment.apartment_id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { border: 0 },
                      '& td': {
                        py: 2.5,
                        px: 3,
                        borderBottom: `1px solid ${COLORS.border}`
                      },
                      '&:hover': {
                        bgcolor: COLORS.background
                      }
                    }}
                    onClick={() => handleRowClick(apartment)}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight={500} color={COLORS.text}>
                          {apartment.address}
                        </Typography>
                        <Typography variant="caption" color={COLORS.muted}>
                          ID: {apartment.apartment_id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {apartment.tenants && apartment.tenants.slice(0, 2).map((tenant, index) => (
                          <Typography key={index} variant="body2" color={COLORS.text}>
                            {tenant}
                          </Typography>
                        ))}
                        {apartment.tenants && apartment.tenants.length > 2 && (
                          <Typography variant="caption" color={COLORS.muted}>
                            +{apartment.tenants.length - 2} more
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight={500} color={COLORS.text}>
                        {formatCurrency(apartment.monthly_rent)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                        <Typography
                          variant="body1"
                          fontWeight={600}
                          color={apartment.total_outstanding > 0 ? COLORS.error : COLORS.success}
                        >
                          {formatCurrency(apartment.total_outstanding)}
                        </Typography>
                        {getOutstandingChip(apartment.total_outstanding)}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<InfoIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(apartment);
                        }}
                        aria-label={`View details for ${apartment.address}`}
                        sx={{
                          borderColor: COLORS.border,
                          color: COLORS.primary,
                          px: 2,
                          '&:hover': {
                            borderColor: COLORS.primary,
                            bgcolor: COLORS.background
                          }
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={data?.pagination?.page_size_options || [5, 10, 25]}
          component="div"
          count={data?.pagination?.total_items || 0}
          rowsPerPage={outstandingRowsPerPage}
          page={outstandingPage - 1}
          onPageChange={(e, newPage) => handleOutstandingPageChange(newPage + 1)}
          onRowsPerPageChange={(e) => handleOutstandingRowsPerPageChange(parseInt(e.target.value, 10))}
          sx={{
            borderTop: `1px solid ${COLORS.border}`,
            '& .MuiTablePagination-toolbar': { px: 3, py: 1 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              color: COLORS.muted,
              fontWeight: 500
            }
          }}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialog.open}
        onClose={() => setDetailDialog({ open: false, apartment: null, details: null })}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)',
            backgroundColor: COLORS.surface
          }
        }}
        aria-labelledby="payment-details-dialog-title"
      >
        <DialogTitle
          id="payment-details-dialog-title"
          sx={{
            bgcolor: COLORS.background,
            color: COLORS.text,
            py: 2.5,
            px: 3,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <InfoIcon sx={{ color: COLORS.primary }} />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Payment Details - Current Month
            </Typography>
            <Typography variant="body2" color={COLORS.muted}>
              {detailDialog.apartment?.address || ''}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: COLORS.surface }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <CircularProgress size={40} sx={{ color: COLORS.primary, mb: 2 }} />
              <Typography color={COLORS.muted} fontWeight={500}>
                Loading payment details...
              </Typography>
            </Box>
          ) : detailDialog.details ? (
            <Box>
              {/* Apartment Header */}
              <Box sx={{
                mb: 4,
                borderBottom: `1px solid ${COLORS.border}`,
                pb: 3
              }}>
                <Typography variant="h5" fontWeight={600} color={COLORS.text} gutterBottom>
                  {detailDialog.details.apartment.address}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <Chip
                    icon={<CalendarIcon sx={{ fontSize: 18 }} />}
                    label={`Period: ${detailDialog.details.period.label || 'Current Month'}`}
                    variant="outlined"
                    sx={{
                      borderColor: COLORS.border,
                      color: COLORS.text,
                      fontWeight: 500,
                      bgcolor: 'transparent'
                    }}
                  />
                  <Chip
                    label={`Monthly Rent: ${formatCurrency(detailDialog.details.apartment.monthly_rent)}`}
                    sx={{
                      bgcolor: COLORS.background,
                      color: COLORS.text,
                      fontWeight: 500,
                      border: `1px solid ${COLORS.border}`
                    }}
                  />
                </Box>
              </Box>

              {/* Summary Cards */}
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: COLORS.text }}
                >
                  <BarChartIcon sx={{ color: COLORS.muted }} />
                  Summary
                </Typography>
                <Grid container spacing={3}>
                  {[
                    {
                      title: 'Expected',
                      value: formatCurrency(detailDialog.details.summary.expected_amount),
                      color: COLORS.primary,
                      borderColor: COLORS.primary
                    },
                    {
                      title: 'Paid',
                      value: formatCurrency(detailDialog.details.summary.total_paid),
                      color: COLORS.success,
                      borderColor: COLORS.success
                    },
                    {
                      title: 'Outstanding',
                      value: formatCurrency(detailDialog.details.summary.total_outstanding),
                      color: detailDialog.details.summary.total_outstanding > 0 ? COLORS.error : COLORS.success,
                      borderColor: detailDialog.details.summary.total_outstanding > 0 ? COLORS.error : COLORS.success
                    }
                  ].map((item, index) => (
                    <Grid item xs={12} sm={4} key={index}>
                      <Paper sx={{
                        p: 3,
                        textAlign: 'center',
                        borderRadius: 2,
                        bgcolor: COLORS.surface,
                        border: `1px solid ${item.borderColor}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'box-shadow 0.2s ease',
                        '&:hover': {
                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }
                      }}>
                        <Typography variant="body2" color={COLORS.muted} fontWeight={500}>
                          {item.title}
                        </Typography>
                        <Typography variant="h5" fontWeight={600} color={item.color}>
                          {item.value}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Tenant Breakdown Table */}
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: COLORS.text }}
                >
                  <BarChartIcon sx={{ color: COLORS.muted }} />
                  Tenant Breakdown
                </Typography>

                {detailDialog.details.tenant_breakdown && detailDialog.details.tenant_breakdown.length > 0 ? (
                  <TableContainer component={Paper} sx={{
                    borderRadius: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    bgcolor: COLORS.surface
                  }}>
                    <Table aria-label="tenant breakdown table">
                      <TableHead>
                        <TableRow sx={{
                          bgcolor: COLORS.background,
                          '& th': {
                            fontWeight: 600,
                            color: COLORS.text,
                            py: 2,
                            px: 3,
                            borderBottom: `1px solid ${COLORS.border}`
                          }
                        }}>
                          <TableCell>Tenant</TableCell>
                          <TableCell>Payments</TableCell>
                          <TableCell align="right">Due</TableCell>
                          <TableCell align="right">Paid</TableCell>
                          <TableCell align="right">Outstanding</TableCell>
                          <TableCell align="center">Recent Payments</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailDialog.details.tenant_breakdown.map((tenant, index) => (
                          <TableRow
                            key={index}
                            sx={{
                              '&:last-child td': { borderBottom: 0 },
                              '& td': {
                                py: 2,
                                px: 3,
                                borderBottom: `1px solid ${COLORS.border}`
                              },
                              '&:hover': { bgcolor: COLORS.background }
                            }}
                          >
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color={COLORS.text}
                                sx={{
                                  cursor: 'pointer',
                                  '&:hover': { color: COLORS.primary }
                                }}
                                onClick={() => {
                                  console.log(`Navigate to tenant: ${tenant.tenant_name}`);
                                  alert(`Navigate to ${tenant.tenant_name}'s profile`);
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`View profile for ${tenant.tenant_name}`}
                              >
                                {tenant.tenant_name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={`${tenant.payment_count} payments`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  borderColor: tenant.payment_count > 0 ? COLORS.success : COLORS.warning,
                                  color: tenant.payment_count > 0 ? COLORS.success : COLORS.warning,
                                  fontWeight: 500
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500} color={COLORS.primary}>
                                {formatCurrency(tenant.total_due)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500} color={COLORS.success}>
                                {formatCurrency(tenant.total_paid)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color={tenant.outstanding > 0 ? COLORS.error : COLORS.success}
                              >
                                {formatCurrency(tenant.outstanding)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              {tenant.payments && tenant.payments.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {tenant.payments.slice(0, 3).map((payment, pIndex) => (
                                    <Box
                                      key={pIndex}
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: 1
                                      }}
                                    >
                                      <Typography variant="caption" color={COLORS.text}>
                                        {formatDate(payment.payment_date)}: {formatCurrency(payment.amount_paid)}
                                      </Typography>
                                      <Chip
                                        label={payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          borderColor: payment.status === 'paid' ? COLORS.success : COLORS.warning,
                                          color: payment.status === 'paid' ? COLORS.success : COLORS.warning,
                                          fontWeight: 500
                                        }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="caption" color={COLORS.warning}>
                                  No payments
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Paper sx={{
                    p: 4,
                    textAlign: 'center',
                    bgcolor: COLORS.surface,
                    borderRadius: 2,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
                    <Typography variant="h6" color={COLORS.text} gutterBottom fontWeight={500}>
                      No Tenant Data Available
                    </Typography>
                    <Typography variant="body2" color={COLORS.muted}>
                      Unable to load tenant payment breakdown for this apartment
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
              <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
              <Typography variant="h6" color={COLORS.text} fontWeight={500}>
                No payment details available
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: COLORS.surface, borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            onClick={() => setDetailDialog({ open: false, apartment: null, details: null })}
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 1,
              px: 3,
              py: 1,
              bgcolor: COLORS.primary,
              color: 'white',
              fontWeight: 500,
              '&:hover': {
                bgcolor: '#1d4ed8',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }
            }}
            aria-label="Close details dialog"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OutstandingPaymentsTab;
