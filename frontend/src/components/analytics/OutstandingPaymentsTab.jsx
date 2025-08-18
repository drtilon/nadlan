import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
      console.log('Fetching details for apartment:', apartment.apartment_id);

      const detailsResponse = await api.get(`/analytics/apartment-outstanding-details/${apartment.apartment_id}`, {
        params: { period_type: 'current_month' }
      });

      console.log('API Response:', detailsResponse.data);
      setDetailDialog({ open: true, apartment, details: detailsResponse.data });

    } catch (error) {
      console.error('Error fetching apartment details:', error);

      // IMPROVED FALLBACK DATA with correct calculations
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
      const currentYear = currentDate.getFullYear();

      // Use data from the apartment object passed from the table
      const monthlyRent = apartment.monthly_rent || 0;
      const paidThisMonth = apartment.paid_this_month || 0;
      const totalOutstanding = apartment.total_outstanding || 0;

      // Calculate expected amount (for current month, it's just the monthly rent)
      const expectedAmount = monthlyRent;

      // Calculate collection rate
      const collectionRate = expectedAmount > 0 ?
        ((paidThisMonth / expectedAmount) * 100) : 100;

      // Create tenant breakdown
      const tenantBreakdown = apartment.tenants && apartment.tenants.length > 0 ?
        apartment.tenants.map(tenantName => {
          const tenantCount = apartment.tenants.length;
          const rentPerTenant = expectedAmount / tenantCount;
          const paidPerTenant = paidThisMonth / tenantCount;
          const outstandingPerTenant = Math.max(0, rentPerTenant - paidPerTenant);

          return {
            tenant_id: null, // We don't have tenant IDs in the apartment data
            tenant_name: tenantName,
            total_paid: paidPerTenant,
            total_due: rentPerTenant,
            outstanding: outstandingPerTenant,
            payment_count: paidPerTenant > 0 ? 1 : 0, // Estimate based on payment
            payments: paidPerTenant > 0 ? [{
              id: null,
              amount: paidPerTenant,
              date: new Date().toISOString().split('T')[0], // Today's date as estimate
              status: 'paid'
            }] : []
          };
        }) : [{
          tenant_id: null,
          tenant_name: "Unknown Tenant",
          total_paid: paidThisMonth,
          total_due: expectedAmount,
          outstanding: totalOutstanding,
          payment_count: paidThisMonth > 0 ? 1 : 0,
          payments: paidThisMonth > 0 ? [{
            id: null,
            amount: paidThisMonth,
            date: new Date().toISOString().split('T')[0],
            status: 'paid'
          }] : []
        }];

      const fallbackDetails = {
        apartment: {
          id: apartment.apartment_id,
          address: apartment.address,
          monthly_rent: monthlyRent,
          status: apartment.status
        },
        period: {
          type: 'current_month',
          label: `${currentMonth} ${currentYear}`,
          start_date: new Date(currentYear, currentDate.getMonth(), 1).toISOString().split('T')[0],
          end_date: new Date(currentYear, currentDate.getMonth() + 1, 0).toISOString().split('T')[0]
        },
        summary: {
          expected_amount: expectedAmount,
          total_paid: paidThisMonth,
          total_outstanding: totalOutstanding,
          collection_rate: collectionRate,
          payment_count: paidThisMonth > 0 ? 1 : 0
        },
        tenant_breakdown: tenantBreakdown,
        debug_info: {
          source: 'fallback',
          apartment_data: apartment
        }
      };

      console.log('Using fallback data:', fallbackDetails);
      setDetailDialog({ open: true, apartment, details: fallbackDetails });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRowClick = (apartment) => {
    fetchApartmentPaymentDetails(apartment);
  };

  // Navigation function for tenant clicks
  const handleTenantClick = (tenantId, tenantName) => {
    if (tenantId) {
      navigate(`/tenants/${tenantId}`);
    } else {
      // If no tenant ID, search for tenant by name
      navigate(`/tenants?search=${encodeURIComponent(tenantName)}`);
    }
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
              <MenuItem value="paid_desc">Paid This Month (High to Low)</MenuItem>
              <MenuItem value="paid_asc">Paid This Month (Low to High)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md="auto">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: COLORS.muted }}>
            <CalendarIcon fontSize="small" />
            <Typography variant="body2" fontWeight={500}>
              {data?.summary?.period_label || 'Current Period'}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      {data?.summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{
              p: 3,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="body2" color={COLORS.muted} fontWeight={500}>
                Total Outstanding
              </Typography>
              <Typography variant="h5" fontWeight={600} color={COLORS.error}>
                {formatCurrency(data.summary.total_outstanding)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{
              p: 3,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="body2" color={COLORS.muted} fontWeight={500}>
                Paid This Month
              </Typography>
              <Typography variant="h5" fontWeight={600} color={COLORS.success}>
                {formatCurrency(data.summary.total_paid_this_month)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{
              p: 3,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="body2" color={COLORS.muted} fontWeight={500}>
                Collection Rate
              </Typography>
              <Typography variant="h5" fontWeight={600} color={data.summary.collection_rate >= 80 ? COLORS.success : COLORS.warning}>
                {data.summary.collection_rate?.toFixed(1)}%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{
              p: 3,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="body2" color={COLORS.muted} fontWeight={500}>
                Apartments with Debt
              </Typography>
              <Typography variant="h5" fontWeight={600} color={COLORS.text}>
                {data.summary.apartments_with_debt}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Main Table */}
      <Paper sx={{
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        bgcolor: COLORS.surface
      }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{
                bgcolor: COLORS.background,
                '& th': {
                  fontWeight: 600,
                  color: COLORS.text,
                  py: 2,
                  px: 3,
                  borderBottom: `2px solid ${COLORS.border}`
                }
              }}>
                <TableCell>Apartment</TableCell>
                <TableCell>Tenants</TableCell>
                <TableCell align="right">Monthly Rent</TableCell>
                <TableCell align="right">Paid This Month</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} sx={{ color: COLORS.primary }} />
                    <Typography color={COLORS.muted} sx={{ mt: 2 }} fontWeight={500}>
                      Loading outstanding payments...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : data?.apartments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
                    <Typography variant="h6" color={COLORS.text} fontWeight={500}>
                      No Outstanding Payments
                    </Typography>
                    <Typography color={COLORS.muted}>
                      All apartments are current with their payments
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data?.apartments?.map((apartment, index) => (
                  <TableRow
                    key={apartment.apartment_id}
                    sx={{
                      '&:hover': { bgcolor: COLORS.background },
                      '& td': {
                        py: 2,
                        px: 3,
                        borderBottom: `1px solid ${COLORS.border}`
                      },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleRowClick(apartment)}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500} color={COLORS.text}>
                          {apartment.address}
                        </Typography>
                        <Typography variant="caption" color={COLORS.muted}>
                          ID: {apartment.apartment_id}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {apartment.tenants && apartment.tenants.length > 0 ? (
                          apartment.tenants.map((tenant, idx) => (
                            <Chip
                              key={idx}
                              label={tenant}
                              size="small"
                              variant="outlined"
                              sx={{
                                maxWidth: 200,
                                borderColor: COLORS.border,
                                color: COLORS.text,
                                cursor: 'pointer',
                                '&:hover': {
                                  borderColor: COLORS.primary,
                                  bgcolor: COLORS.background
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTenantClick(null, tenant);
                              }}
                            />
                          ))
                        ) : (
                          <Typography variant="caption" color={COLORS.muted}>
                            No tenants assigned
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} color={COLORS.text}>
                        {formatCurrency(apartment.monthly_rent)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        color={apartment.paid_this_month > 0 ? COLORS.success : COLORS.muted}
                      >
                        {formatCurrency(apartment.paid_this_month)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Typography
                          variant="body2"
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Debug Info (remove in production) */}
              {detailDialog.details.debug_info && (
                <Box sx={{ p: 2, bgcolor: '#f3f4f6', borderRadius: 1, fontSize: '0.75rem' }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    Debug: {JSON.stringify(detailDialog.details.debug_info, null, 2)}
                  </Typography>
                </Box>
              )}

              {/* Payment Summary Cards */}
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: COLORS.text }}
                >
                  <CalendarIcon sx={{ color: COLORS.muted }} />
                  Payment Summary - {detailDialog.details.period?.label || 'Current Period'}
                </Typography>
                <Grid container spacing={3}>
                  {[
                    {
                      title: 'Expected Amount',
                      value: formatCurrency(detailDialog.details.summary?.expected_amount || 0),
                      color: COLORS.text,
                      borderColor: COLORS.border
                    },
                    {
                      title: 'Total Paid',
                      value: formatCurrency(detailDialog.details.summary?.total_paid || 0),
                      color: COLORS.success,
                      borderColor: COLORS.success
                    },
                    {
                      title: 'Outstanding',
                      value: formatCurrency(detailDialog.details.summary?.total_outstanding || 0),
                      color: (detailDialog.details.summary?.total_outstanding || 0) > 0 ? COLORS.error : COLORS.success,
                      borderColor: (detailDialog.details.summary?.total_outstanding || 0) > 0 ? COLORS.error : COLORS.success
                    },
                    {
                      title: 'Collection Rate',
                      value: `${(detailDialog.details.summary?.collection_rate || 0).toFixed(1)}%`,
                      color: (detailDialog.details.summary?.collection_rate || 0) >= 80 ? COLORS.success : COLORS.warning,
                      borderColor: (detailDialog.details.summary?.collection_rate || 0) >= 80 ? COLORS.success : COLORS.warning
                    }
                  ].map((item, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
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
                  Tenant Breakdown ({detailDialog.details.tenant_breakdown?.length || 0} tenants)
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
                          <TableCell align="center">Payments</TableCell>
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
                                  cursor: tenant.tenant_id ? 'pointer' : 'default',
                                  '&:hover': { color: tenant.tenant_id ? COLORS.primary : COLORS.text }
                                }}
                                onClick={() => {
                                  if (tenant.tenant_id) {
                                    handleTenantClick(tenant.tenant_id, tenant.tenant_name);
                                    setDetailDialog({ open: false, apartment: null, details: null });
                                  }
                                }}
                                role={tenant.tenant_id ? "button" : "text"}
                                tabIndex={tenant.tenant_id ? 0 : -1}
                                aria-label={tenant.tenant_id ? `View profile for ${tenant.tenant_name}` : undefined}
                              >
                                {tenant.tenant_name}
                                {!tenant.tenant_id && (
                                  <Typography variant="caption" color={COLORS.muted} sx={{ ml: 1 }}>
                                    (estimated)
                                  </Typography>
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${tenant.payment_count || 0} payments`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  borderColor: (tenant.payment_count || 0) > 0 ? COLORS.success : COLORS.warning,
                                  color: (tenant.payment_count || 0) > 0 ? COLORS.success : COLORS.warning,
                                  fontWeight: 500
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={COLORS.text} fontWeight={500}>
                                {formatCurrency(tenant.total_due || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={COLORS.success} fontWeight={500}>
                                {formatCurrency(tenant.total_paid || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                color={(tenant.outstanding || 0) > 0 ? COLORS.error : COLORS.success}
                                fontWeight={600}
                              >
                                {formatCurrency(tenant.outstanding || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              {tenant.payments && tenant.payments.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {tenant.payments.slice(0, 3).map((payment, paymentIndex) => (
                                    <Chip
                                      key={paymentIndex}
                                      label={`${formatCurrency(payment.amount)} - ${formatDate(payment.date)}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        fontSize: '0.75rem',
                                        borderColor: payment.status === 'paid' ? COLORS.success : COLORS.warning,
                                        color: payment.status === 'paid' ? COLORS.success : COLORS.warning,
                                        fontWeight: 500
                                      }}
                                    />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="caption" color={COLORS.muted}>
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
