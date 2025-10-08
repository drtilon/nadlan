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
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CalendarToday as CalendarIcon,
  BarChart as BarChartIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import api from '../../utils/api';

const COLORS = {
  primary: '#1976d2',
  secondary: '#dc2626',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  background: '#f5f5f5',
  text: '#1a202c',
  muted: '#6b7280',
  border: '#e2e8f0',
  surface: '#ffffff',
  highlight: '#e3f2fd'
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
  let label, color, bgcolor;
  if (amount === 0) {
    label = 'Paid';
    color = COLORS.success;
    bgcolor = '#e8f5e9';
  } else if (amount < 500) {
    label = `Low (€${amount})`;
    color = '#0288d1';
    bgcolor = '#e3f2fd';
  } else if (amount < 1000) {
    label = `Medium (€${amount})`;
    color = COLORS.warning;
    bgcolor = '#fff3e0';
  } else {
    label = `High (€${amount})`;
    color = COLORS.error;
    bgcolor = '#ffebee';
  }
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        color,
        bgcolor,
        fontWeight: 500,
        border: 'none',
        borderRadius: '16px'
      }}
    />
  );
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
  handleOutstandingRowsPerPageChange
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(outstandingData);
  const [loading, setLoading] = useState(outstandingLoading);
  const [detailDialog, setDetailDialog] = useState({ open: false, apartment: null, details: null });
  const [detailLoading, setDetailLoading] = useState(false);
  const [showOnlyDebt, setShowOnlyDebt] = useState(false);

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

      const monthlyRent = apartment.monthly_rent || 0;
      const paidThisMonth = apartment.paid_this_month || 0;
      const totalOutstanding = apartment.total_outstanding || 0;
      const expectedAmount = monthlyRent;
      const collectionRate = expectedAmount > 0 ? ((paidThisMonth / expectedAmount) * 100) : 100;

      const tenantBreakdown = apartment.tenants && apartment.tenants.length > 0 ?
        apartment.tenants.map(tenantName => {
          const tenantCount = apartment.tenants.length;
          const rentPerTenant = expectedAmount / tenantCount;
          const paidPerTenant = paidThisMonth / tenantCount;
          const outstandingPerTenant = Math.max(0, rentPerTenant - paidPerTenant);

          return {
            tenant_id: null,
            tenant_name: tenantName,
            total_paid: paidPerTenant,
            total_due: rentPerTenant,
            outstanding: outstandingPerTenant,
            payment_count: paidPerTenant > 0 ? 1 : 0,
            payments: paidPerTenant > 0 ? [{
              id: null,
              amount: paidPerTenant,
              date: new Date().toISOString().split('T')[0],
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

  const handleTenantClick = (tenantId, tenantName) => {
    if (tenantId) {
      navigate(`/tenants/${tenantId}`);
    } else {
      navigate(`/tenants?search=${encodeURIComponent(tenantName)}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [outstandingSearch, outstandingSort, outstandingPage, outstandingRowsPerPage]);

  const filteredApartments = data?.apartments?.filter(apartment => !showOnlyDebt || apartment.total_outstanding > 0) || [];

  return (
    <Box sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 } }}>
      {/* Controls Row */}
      <Grid container spacing={2} sx={{ mb: 4 }} alignItems="center">
        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="h5" fontWeight={700} color={COLORS.text}>
            Payments: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by apartment or tenant"
            value={outstandingSearch}
            onChange={(e) => setOutstandingSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: COLORS.muted }} />
                </InputAdornment>
              ),
            }}
            sx={{
              bgcolor: COLORS.surface,
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: COLORS.border },
                '&:hover fieldset': { borderColor: COLORS.primary },
                '&.Mui-focused fieldset': { borderColor: COLORS.primary }
              }
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: COLORS.muted }}>Sort By</InputLabel>
            <Select
              value={outstandingSort}
              label="Sort By"
              onChange={(e) => setOutstandingSort(e.target.value)}
              sx={{
                bgcolor: COLORS.surface,
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.primary }
              }}
            >
              <MenuItem value="outstanding_desc">Outstanding: High to Low</MenuItem>
              <MenuItem value="outstanding_asc">Outstanding: Low to High</MenuItem>
              <MenuItem value="address_asc">Address: A-Z</MenuItem>
              <MenuItem value="rent_desc">Rent: High to Low</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: COLORS.muted }}>Filter</InputLabel>
            <Select
              value={showOnlyDebt ? 'debt' : 'all'}
              label="Filter"
              onChange={(e) => setShowOnlyDebt(e.target.value === 'debt')}
              sx={{
                bgcolor: COLORS.surface,
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.primary }
              }}
            >
              <MenuItem value="all">All Apartments</MenuItem>
              <MenuItem value="debt">Unpaid Only</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Summary Cards */}
      {data?.summary && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            {
              title: 'Total Outstanding',
              value: formatCurrency(data.summary.total_outstanding),
              color: COLORS.error,
              icon: <WarningIcon />
            },
            {
              title: 'Paid This Month',
              value: formatCurrency(data.summary.total_paid_this_month),
              color: COLORS.success,
              icon: <CalendarIcon />
            },
            {
              title: 'Outstanding This Month',
              value: formatCurrency(data.summary.total_outstanding),
              color: data.summary.total_outstanding > 0 ? COLORS.error : COLORS.success,
              icon: <WarningIcon />
            },
            {
              title: 'Apartments with Debt',
              value: data.summary.apartments_with_debt,
              color: COLORS.text,
              icon: <BarChartIcon />
            }
          ].map((item, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }
                }}
              >
                {item.icon}
                <Box>
                  <Typography variant="caption" color={COLORS.muted} fontWeight={500}>
                    {item.title}
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color={item.color}>
                    {item.value}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Main Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: COLORS.surface }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{
                bgcolor: COLORS.background,
                '& th': {
                  fontWeight: 600,
                  color: COLORS.text,
                  py: 2,
                  px: 2,
                  borderBottom: `2px solid ${COLORS.border}`
                }
              }}>
                <TableCell>Apartment</TableCell>
                <TableCell>Tenants</TableCell>
                <TableCell align="right">Monthly Rent</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Outstanding</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} sx={{ color: COLORS.primary }} />
                    <Typography color={COLORS.muted} sx={{ mt: 2 }}>
                      Loading payments...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredApartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
                    <Typography variant="h6" color={COLORS.text}>
                      No Outstanding Payments
                    </Typography>
                    <Typography color={COLORS.muted}>
                      All apartments are current with their payments
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredApartments.map((apartment, index) => (
                  <TableRow
                    key={apartment.apartment_id}
                    sx={{
                      '&:hover': { bgcolor: COLORS.highlight },
                      '& td': { py: 1.5, px: 2 },
                      backgroundColor: apartment.total_outstanding > 0 ? '#ffebee' : 'inherit'
                    }}
                    onClick={() => handleRowClick(apartment)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} color={COLORS.text}>
                        {apartment.address}
                      </Typography>
                      <Typography variant="caption" color={COLORS.muted}>
                        ID: {apartment.apartment_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {apartment.tenants && apartment.tenants.length > 0 ? (
                          apartment.tenants.map((tenant, idx) => (
                            <Tooltip key={idx} title="View Tenant Profile">
                              <Chip
                                label={tenant}
                                size="small"
                                sx={{
                                  bgcolor: COLORS.surface,
                                  borderColor: COLORS.border,
                                  color: COLORS.text,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: COLORS.highlight,
                                    borderColor: COLORS.primary
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTenantClick(null, tenant);
                                }}
                              />
                            </Tooltip>
                          ))
                        ) : (
                          <Typography variant="caption" color={COLORS.muted}>
                            No tenants
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500}>
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
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(apartment);
                          }}
                          sx={{ color: COLORS.primary }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
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
            '& .MuiTablePagination-toolbar': { px: 2, py: 1 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              color: COLORS.muted
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
          sx: { borderRadius: 2, bgcolor: COLORS.surface }
        }}
      >
        <DialogTitle sx={{
          bgcolor: COLORS.background,
          py: 3,
          px: 4,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <InfoIcon sx={{ color: COLORS.primary, fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Apartment Payment Details
            </Typography>
            <Typography variant="subtitle2" color={COLORS.muted}>
              {detailDialog.apartment?.address || 'Unknown Address'} - {detailDialog.details?.period?.label || 'Current Month'}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          {detailLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <CircularProgress size={40} sx={{ color: COLORS.primary, mb: 2 }} />
              <Typography color={COLORS.muted}>Loading details...</Typography>
            </Box>
          ) : detailDialog.details ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Payment Summary */}
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CalendarIcon sx={{ color: COLORS.muted }} />
                  Payment Overview
                </Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      title: 'Expected',
                      value: formatCurrency(detailDialog.details.summary?.expected_amount || 0),
                      color: COLORS.text
                    },
                    {
                      title: 'Paid',
                      value: formatCurrency(detailDialog.details.summary?.total_paid || 0),
                      color: COLORS.success
                    },
                    {
                      title: 'Outstanding',
                      value: formatCurrency(detailDialog.details.summary?.total_outstanding || 0),
                      color: (detailDialog.details.summary?.total_outstanding || 0) > 0 ? COLORS.error : COLORS.success
                    },
                    {
                      title: 'Collection Rate',
                      value: `${(detailDialog.details.summary?.collection_rate || 0).toFixed(1)}%`,
                      color: (detailDialog.details.summary?.collection_rate || 0) >= 80 ? COLORS.success : COLORS.warning
                    }
                  ].map((item, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                      <Paper
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: COLORS.surface,
                          border: `1px solid ${COLORS.border}`,
                          textAlign: 'center',
                          transition: 'transform 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }
                        }}
                      >
                        <Typography variant="caption" color={COLORS.muted}>
                          {item.title}
                        </Typography>
                        <Typography variant="h6" fontWeight={600} color={item.color}>
                          {item.value}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Tenant Breakdown */}
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <BarChartIcon sx={{ color: COLORS.muted }} />
                  Tenant Breakdown ({detailDialog.details.tenant_breakdown?.length || 0})
                </Typography>
                {detailDialog.details.tenant_breakdown && detailDialog.details.tenant_breakdown.length > 0 ? (
                  <TableContainer component={Paper} sx={{ borderRadius: 2, bgcolor: COLORS.surface }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{
                          bgcolor: COLORS.background,
                          '& th': { fontWeight: 600, py: 2, px: 2 }
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
                              '&:hover': { bgcolor: COLORS.highlight },
                              '& td': { py: 1.5, px: 2 }
                            }}
                          >
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                sx={{
                                  cursor: tenant.tenant_id ? 'pointer' : 'default',
                                  '&:hover': { color: tenant.tenant_id ? COLORS.primary : COLORS.text }
                                }}
                                onClick={() => tenant.tenant_id && handleTenantClick(tenant.tenant_id, tenant.tenant_name)}
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
                                sx={{
                                  bgcolor: (tenant.payment_count || 0) > 0 ? '#e8f5e9' : '#fff3e0',
                                  color: (tenant.payment_count || 0) > 0 ? COLORS.success : COLORS.warning
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={500}>
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
                                fontWeight={600}
                                color={(tenant.outstanding || 0) > 0 ? COLORS.error : COLORS.success}
                              >
                                {formatCurrency(tenant.outstanding || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              {tenant.payments && tenant.payments.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {tenant.payments.slice(0, 3).map((payment, paymentIndex) => (
                                    <Chip
                                      key={paymentIndex}
                                      label={`${formatCurrency(payment.amount)} - ${formatDate(payment.date)}`}
                                      size="small"
                                      sx={{
                                        bgcolor: payment.status === 'paid' ? '#e8f5e9' : '#fff3e0',
                                        color: payment.status === 'paid' ? COLORS.success : COLORS.warning
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
                  <Paper sx={{ p: 4, borderRadius: 2, bgcolor: COLORS.surface, textAlign: 'center' }}>
                    <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
                    <Typography variant="h6" color={COLORS.text}>
                      No Tenant Data Available
                    </Typography>
                    <Typography variant="body2" color={COLORS.muted}>
                      Unable to load tenant payment details
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
              <WarningIcon sx={{ fontSize: 40, color: COLORS.warning, mb: 2 }} />
              <Typography variant="h6" color={COLORS.text}>
                No Payment Details Available
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: COLORS.background, borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            onClick={() => setDetailDialog({ open: false, apartment: null, details: null })}
            variant="contained"
            sx={{
              borderRadius: 2,
              px: 4,
              bgcolor: COLORS.primary,
              '&:hover': { bgcolor: '#1565c0' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OutstandingPaymentsTab;
