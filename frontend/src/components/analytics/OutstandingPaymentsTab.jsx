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
  const [allTimeOutstanding, setAllTimeOutstanding] = useState(0);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [periodType, setPeriodType] = useState('current_month');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getAvailableYears = () => {
    const years = [];
    const startYear = 2020;
    const endYear = currentDate.getFullYear();
    for (let year = endYear; year >= startYear; year--) {
      years.push(year);
    }
    return years;
  };

  useEffect(() => {
    setData(outstandingData);
    setLoading(outstandingLoading);
  }, [outstandingData, outstandingLoading]);

  const fetchAllTimeOutstanding = async () => {
    try {
      const response = await api.get('/analytics/outstanding-payments', {
        params: {
          period_type: 'all_time',
          limit: 1
        }
      });
      setAllTimeOutstanding(response.data?.summary?.total_outstanding || 0);
    } catch (error) {
      console.error('Error fetching all-time outstanding:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        page: outstandingPage,
        limit: outstandingRowsPerPage,
        sort: outstandingSort
      };

      if (periodType === 'current_month') {
        params.period_type = 'current_month';
      } else if (periodType === 'specific_month') {
        params.period_type = 'specific_month';
        params.month = selectedMonth;
        params.year = selectedYear;
      }

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
      const detailParams = {
        period_type: periodType
      };

      if (periodType === 'specific_month') {
        detailParams.month = selectedMonth;
        detailParams.year = selectedYear;
      }

      const detailsResponse = await api.get(`/analytics/apartment-outstanding-details/${apartment.apartment_id}`, {
        params: detailParams
      });
      setDetailDialog({ open: true, apartment, details: detailsResponse.data });
    } catch (error) {
      console.error('Error fetching apartment details:', error);
      const currentDate = new Date();
      const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
      const currentYear = currentDate.getFullYear();

      const monthlyRent = apartment.monthly_rent || 0;
      const paidThisMonth = apartment.paid_this_month || 0;
      const outstandingThisMonth = apartment.outstanding_this_month || 0;
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
          outstanding: outstandingThisMonth,
          payment_count: paidThisMonth > 0 ? 1 : 0,
          payments: paidThisMonth > 0 ? [{
            id: null,
            amount: paidThisMonth,
            date: new Date().toISOString().split('T')[0],
            status: 'paid'
          }] : []
        }];

      setDetailDialog({
        open: true,
        apartment,
        details: {
          apartment: {
            id: apartment.apartment_id,
            address: apartment.address
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
            total_outstanding: outstandingThisMonth,
            collection_rate: collectionRate
          },
          tenant_breakdown: tenantBreakdown
        }
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRowClick = (apartment) => {
    fetchApartmentPaymentDetails(apartment);
  };

  const handleTenantClick = (e, tenantId, tenantName) => {
    e.stopPropagation();
    if (tenantId) {
      navigate(`/tenants/${tenantId}`);
    } else {
      navigate(`/tenants?search=${encodeURIComponent(tenantName)}`);
    }
  };

  const handlePeriodTypeChange = (newPeriodType) => {
    setPeriodType(newPeriodType);
  };

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  useEffect(() => {
    fetchData();
    fetchAllTimeOutstanding();
  }, [outstandingPage, outstandingRowsPerPage, outstandingSearch, outstandingSort, periodType, selectedMonth, selectedYear]);

  const filteredData = showOnlyDebt && data?.apartments
    ? { ...data, apartments: data.apartments.filter(apt => apt.total_outstanding > 0) }
    : data;

  const getSelectedPeriodLabel = () => {
    if (periodType === 'current_month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else {
      return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    }
  };

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            title: 'Total Outstanding (All Time)',
            value: formatCurrency(allTimeOutstanding),
            color: COLORS.error,
            bgcolor: '#ffebee',
            icon: <WarningIcon sx={{ fontSize: 28, color: COLORS.error }} />
          },
          {
            title: `Outstanding (${getSelectedPeriodLabel()})`,
            value: formatCurrency(data?.summary?.total_outstanding || 0),
            color: COLORS.warning,
            bgcolor: '#fff3e0',
            icon: <CalendarIcon sx={{ fontSize: 28, color: COLORS.warning }} />
          },
          {
            title: `Collected (${getSelectedPeriodLabel()})`,
            value: formatCurrency(data?.summary?.total_collected || 0),
            color: COLORS.success,
            bgcolor: '#e8f5e9',
            icon: <BarChartIcon sx={{ fontSize: 28, color: COLORS.success }} />
          }
        ].map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: `1px solid ${COLORS.border}`,
                bgcolor: card.bgcolor,
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography variant="subtitle2" color={COLORS.muted} fontWeight={600}>
                  {card.title}
                </Typography>
                {card.icon}
              </Box>
              <Typography variant="h4" fontWeight={700} color={card.color}>
                {card.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters & Actions */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: `1px solid ${COLORS.border}` }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Period Type</InputLabel>
              <Select
                value={periodType}
                label="Period Type"
                onChange={(e) => handlePeriodTypeChange(e.target.value)}
              >
                <MenuItem value="current_month">Current Month</MenuItem>
                <MenuItem value="specific_month">Specific Month</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {periodType === 'specific_month' && (
            <>
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={selectedMonth}
                    label="Month"
                    onChange={(e) => handleMonthChange(e.target.value)}
                  >
                    {monthNames.map((month, index) => (
                      <MenuItem key={index + 1} value={index + 1}>
                        {month}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(e) => handleYearChange(e.target.value)}
                  >
                    {getAvailableYears().map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          <Grid item xs={12} md={periodType === 'specific_month' ? 3 : 4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by address..."
              value={outstandingSearch}
              onChange={(e) => setOutstandingSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: COLORS.muted }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': { bgcolor: COLORS.surface }
              }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={outstandingSort}
                label="Sort By"
                onChange={(e) => setOutstandingSort(e.target.value)}
              >
                <MenuItem value="outstanding_desc">Outstanding (High to Low)</MenuItem>
                <MenuItem value="outstanding_asc">Outstanding (Low to High)</MenuItem>
                <MenuItem value="address_asc">Address (A-Z)</MenuItem>
                <MenuItem value="address_desc">Address (Z-A)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant={showOnlyDebt ? 'contained' : 'outlined'}
              onClick={() => setShowOnlyDebt(!showOnlyDebt)}
              sx={{
                height: '40px',
                bgcolor: showOnlyDebt ? COLORS.error : 'transparent',
                color: showOnlyDebt ? '#fff' : COLORS.error,
                borderColor: COLORS.error,
                '&:hover': {
                  bgcolor: showOnlyDebt ? COLORS.error : 'rgba(211, 47, 47, 0.04)',
                  borderColor: COLORS.error,
                  opacity: 0.9
                }
              }}
            >
              {showOnlyDebt ? 'Show All' : 'Only Debts'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: COLORS.background }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: COLORS.text }}>Apartment</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: COLORS.text }}>Expected</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: COLORS.text }}>Collected</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: COLORS.text }}>Outstanding</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: COLORS.text }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: COLORS.text }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={40} sx={{ color: COLORS.primary }} />
                  </TableCell>
                </TableRow>
              ) : !filteredData?.apartments || filteredData.apartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color={COLORS.muted}>No outstanding payments found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.apartments.map((apartment) => (
                  <TableRow
                    key={apartment.apartment_id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: COLORS.highlight },
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <TableCell onClick={() => handleRowClick(apartment)}>
                      <Typography variant="body2" fontWeight={600}>
                        {apartment.address || 'N/A'}
                      </Typography>
                      {apartment.tenants && apartment.tenants.length > 0 && (
                        <Typography variant="caption" color={COLORS.muted}>
                          {apartment.tenants.join(', ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(apartment)}>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(apartment.total_expected || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(apartment)}>
                      <Typography variant="body2" fontWeight={600} color={COLORS.success}>
                        {formatCurrency(apartment.total_collected || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleRowClick(apartment)}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={(apartment.total_outstanding || 0) > 0 ? COLORS.error : COLORS.success}
                      >
                        {formatCurrency(apartment.total_outstanding || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={() => handleRowClick(apartment)}>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
                  ].map((item, idx) => (
                    <Grid item xs={6} sm={3} key={idx}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: COLORS.background,
                          borderRadius: 2,
                          border: `1px solid ${COLORS.border}`
                        }}
                      >
                        <Typography variant="caption" color={COLORS.muted} sx={{ mb: 0.5, display: 'block' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="h6" fontWeight={700} color={item.color}>
                          {item.value}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Tenant Breakdown */}
              {detailDialog.details.tenant_breakdown && detailDialog.details.tenant_breakdown.length > 0 && (
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <InfoIcon sx={{ color: COLORS.muted }} />
                    Tenant Payment Breakdown
                  </Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${COLORS.border}` }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: COLORS.background }}>
                        <TableRow>
                          <TableCell><Typography variant="subtitle2" fontWeight={700}>Tenant</Typography></TableCell>
                          <TableCell align="right"><Typography variant="subtitle2" fontWeight={700}>Due</Typography></TableCell>
                          <TableCell align="right"><Typography variant="subtitle2" fontWeight={700}>Paid</Typography></TableCell>
                          <TableCell align="right"><Typography variant="subtitle2" fontWeight={700}>Outstanding</Typography></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {detailDialog.details.tenant_breakdown.map((tenant, idx) => (
                          <TableRow
                            key={idx}
                            hover
                            onClick={(e) => handleTenantClick(e, tenant.tenant_id, tenant.tenant_name)}
                            sx={{
                              cursor: tenant.tenant_id ? 'pointer' : 'default',
                              '&:hover': { bgcolor: tenant.tenant_id ? COLORS.highlight : 'inherit' }
                            }}
                          >
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  color: tenant.tenant_id ? COLORS.primary : COLORS.text,
                                  textDecoration: 'none',
                                  '&:hover': { textDecoration: tenant.tenant_id ? 'underline' : 'none' }
                                }}
                              >
                                {tenant.tenant_name || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2">
                                {formatCurrency(tenant.total_due || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={COLORS.success}>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          ) : (
            <Typography color={COLORS.muted} align="center">No details available</Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            onClick={() => setDetailDialog({ open: false, apartment: null, details: null })}
            sx={{ color: COLORS.muted }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setDetailDialog({ open: false, apartment: null, details: null });
              navigate(`/payments/${detailDialog.apartment?.apartment_id}`);
            }}
            sx={{
              bgcolor: COLORS.primary,
              '&:hover': { bgcolor: COLORS.primary, opacity: 0.9 }
            }}
          >
            View Apartment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OutstandingPaymentsTab;
