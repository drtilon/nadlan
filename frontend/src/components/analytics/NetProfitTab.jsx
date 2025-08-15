// src/components/NetProfitTab.jsx - SIMPLIFIED VERSION WITH PAGINATION
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Pagination,
  Button,
  InputAdornment,
} from '@mui/material';
import { Search, Refresh } from '@mui/icons-material';

const COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  background: '#f5f5f5',
};

const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '€0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

const getStatusChip = (status, profit) => {
  if (status === 'vacant') {
    return <Chip label="Vacant" color="default" size="small" />;
  } else if (profit > 0) {
    return <Chip label="Profitable" color="success" size="small" />;
  } else if (profit === 0) {
    return <Chip label="Break Even" color="warning" size="small" />;
  } else {
    return <Chip label="Loss" color="error" size="small" />;
  }
};

function NetProfitTab() {
  const [netProfitData, setNetProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('profit_desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minProfit, setMinProfit] = useState('');

  const fetchNetProfitData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: sortBy,
        status: statusFilter,
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      if (minProfit && !isNaN(parseFloat(minProfit))) {
        params.append('min_profit', parseFloat(minProfit).toString());
      }

      const response = await fetch(`/api/analytics/detailed-net-profit?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNetProfitData(data);
      } else {
        console.error('Failed to fetch net profit data');
      }
    } catch (error) {
      console.error('Error fetching net profit data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetProfitData();
  }, [page, pageSize, sortBy, statusFilter]);

  const handleSearch = () => {
    setPage(0); // Reset to first page
    fetchNetProfitData();
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage - 1); // MUI Pagination is 1-based, our API is 0-based
  };

  const handlePageSizeChange = (event) => {
    setPageSize(event.target.value);
    setPage(0); // Reset to first page
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSortBy('profit_desc');
    setStatusFilter('all');
    setMinProfit('');
    setPage(0);
  };

  if (loading && !netProfitData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Summary Cards */}
      {netProfitData?.summary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="primary.main" fontWeight={600}>
                {formatCurrency(netProfitData.summary.total_net_profit || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Net Profit
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="success.main" fontWeight={600}>
                {netProfitData.summary.profitable_apartments || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Profitable Apartments
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="info.main" fontWeight={600}>
                {netProfitData.summary.occupied_apartments || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Occupied Apartments
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="warning.main" fontWeight={600}>
                {formatCurrency(netProfitData.summary.average_profit || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Average Profit
              </Typography>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              placeholder="Search by address or tenant"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="profit_desc">Profit (High to Low)</MenuItem>
                <MenuItem value="profit_asc">Profit (Low to High)</MenuItem>
                <MenuItem value="address">Address</MenuItem>
                <MenuItem value="rent_desc">Rent (High to Low)</MenuItem>
                <MenuItem value="collection_rate">Collection Rate</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="profitable">Profitable</MenuItem>
                <MenuItem value="loss">Loss Making</MenuItem>
                <MenuItem value="vacant">Vacant</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Min Profit"
              type="number"
              value={minProfit}
              onChange={(e) => setMinProfit(e.target.value)}
              placeholder="0.00"
            />
          </Grid>
          <Grid item xs={12} md={1}>
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              sx={{ height: '56px' }}
            >
              Search
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={resetFilters}
              sx={{ height: '56px' }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Card>

      {/* Apartment List */}
      <Paper sx={{ borderRadius: 3, boxShadow: 2 }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight={600}>
            Apartment Net Profit Analysis
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Showing {netProfitData?.pagination?.start_index || 0} - {netProfitData?.pagination?.end_index || 0} of {netProfitData?.pagination?.total_items || 0} apartments
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: COLORS.background }}>
                  <TableCell>Apartment</TableCell>
                  <TableCell>Tenants</TableCell>
                  <TableCell align="right">Monthly Rent</TableCell>
                  <TableCell align="right">Collected</TableCell>
                  <TableCell align="right">Net Profit</TableCell>

                  <TableCell align="center">Collection %</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {netProfitData?.apartments && netProfitData.apartments.length > 0 ? (
                  netProfitData.apartments.map((apartment) => (
                    <TableRow
                      key={apartment.apartment_id}
                      hover
                      sx={{
                        '&:hover': {
                          bgcolor: 'action.hover',
                        }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {apartment.address}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {apartment.tenants && apartment.tenants.length > 0
                            ? apartment.tenants.join(', ')
                            : 'No tenants'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(apartment.monthly_rent || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(apartment.collected_amount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={apartment.actual_profit > 0 ? 'success.main' : apartment.actual_profit < 0 ? 'error.main' : 'warning.main'}
                        >
                          {formatCurrency(apartment.actual_profit || 0)}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Typography variant="body2">
                          {apartment.collection_rate?.toFixed(1) || 0}%
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {getStatusChip(apartment.status, apartment.actual_profit || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="textSecondary">
                        No apartments found matching your filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {netProfitData?.pagination && netProfitData.pagination.total_pages > 1 && (
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormControl size="small">
              <InputLabel>Per Page</InputLabel>
              <Select
                value={pageSize}
                label="Per Page"
                onChange={handlePageSizeChange}
                sx={{ minWidth: 100 }}
              >
                {netProfitData.pagination.page_size_options?.map((size) => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Pagination
              count={netProfitData.pagination.total_pages}
              page={page + 1} // MUI Pagination is 1-based
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default NetProfitTab;
