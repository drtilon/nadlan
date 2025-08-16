// src/components/AnalyticsPanel.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Backdrop,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Card,
  CardContent,
  Grid,
  Container,
  Snackbar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Assessment as AssessmentIcon,
  Error as ErrorIcon,
  Receipt as ReceiptIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import api from '../../utils/api';
import FinancialOverviewTab from './FinancialOverviewTab';
import OutstandingPaymentsTab from './OutstandingPaymentsTab';
import NetProfitTab from './NetProfitTab';
import AnalyticsApartmentDetailsDialog from './AnalyticsApartmentDetailsDialog';

const COLORS = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  background: '#f5f5f5',
};

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function AnalyticsPanel() {
  // Main state
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Financial data
  const [financialData, setFinancialData] = useState(null);

  // Outstanding payments data
  const [outstandingData, setOutstandingData] = useState(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingRowsPerPage, setOutstandingRowsPerPage] = useState(10);
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [outstandingSort, setOutstandingSort] = useState('outstanding_desc');

  // Net profit data
  const [netProfitData, setNetProfitData] = useState(null);
  const [netProfitLoading, setNetProfitLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Dialog state
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // FIXED: Simplified financial data fetch
  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching financial data for year:', selectedYear);

      const response = await api.get('/analytics/financial-overview', {
        params: { year: selectedYear },
        timeout: 30000, // 30 second timeout
      });

      console.log('Financial data response:', response.data);
      setFinancialData(response.data);

      // Show success message if data was fetched
      if (response.data && response.data.current_month) {
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
      console.error('Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(`Failed to load financial overview: ${errorMessage}`);

      // Set default empty data to prevent crashes
      setFinancialData({
        current_month: { collected: 0, net_profit: 0, outstanding: 0 },
        outstanding: { total_amount: 0 },
        monthly_breakdown: [],
        debug_info: {
          total_apartments: 0,
          apartments_with_contracts: 0,
          apartments_with_payments: 0,
          year_queried: selectedYear,
          current_month: new Date().toLocaleString('default', { month: 'long' })
        }
      });
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const fetchOutstandingPayments = useCallback(async () => {
    try {
      setOutstandingLoading(true);
      setError(null);

      console.log('Fetching outstanding payments with params:', {
        page: outstandingPage,
        limit: outstandingRowsPerPage,
        year: selectedYear,
        search: outstandingSearch,
        sort: outstandingSort
      });

      const response = await api.get('/analytics/outstanding-payments', {
        params: {
          page: outstandingPage,
          limit: outstandingRowsPerPage,
          year: selectedYear,
          search: outstandingSearch,
          sort: outstandingSort
        },
        timeout: 30000,
      });

      console.log('Outstanding payments response:', response.data);
      setOutstandingData(response.data);
    } catch (err) {
      console.error('Error fetching outstanding data:', err);
      console.error('Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(`Failed to load outstanding payments: ${errorMessage}`);

      // Set default empty data
      setOutstandingData({
        apartments: [],
        pagination: {
          current_page: 1,
          total_pages: 0,
          total_items: 0,
          items_per_page: outstandingRowsPerPage,
          has_next_page: false,
          has_prev_page: false,
        },
        summary: {
          total_outstanding: 0,
          apartments_with_debt: 0,
        }
      });
    } finally {
      setOutstandingLoading(false);
    }
  }, [outstandingPage, outstandingRowsPerPage, selectedYear, outstandingSearch, outstandingSort]);

  const fetchNetProfitData = useCallback(async () => {
    try {
      setNetProfitLoading(true);
      setError(null);

      console.log('Fetching net profit data with params:', {
        year: selectedYear,
        month: selectedMonth
      });

      const response = await api.get('/analytics/net-profit-detailed', {
        params: {
          year: selectedYear,
          month: selectedMonth
        },
        timeout: 30000,
      });

      console.log('Net profit data response:', response.data);
      setNetProfitData(response.data);
    } catch (err) {
      console.error('Error fetching net profit data:', err);
      console.error('Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(`Failed to load net profit analysis: ${errorMessage}`);

      // Set default empty data
      setNetProfitData({
        apartments: [],
        pagination: {
          current_page: 0,
          total_pages: 0,
          total_items: 0,
        },
        summary: {
          total_apartments: 0,
          total_monthly_rent: 0,
          total_monthly_profit: 0,
        }
      });
    } finally {
      setNetProfitLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const fetchApartmentDetails = useCallback(async (apartmentId) => {
    try {
      setDetailsLoading(true);
      setError(null);

      console.log('Fetching apartment details for ID:', apartmentId);

      const response = await api.get(`/analytics/apartment-outstanding-details/${apartmentId}`, {
        params: {
          period_type: 'current_month',
          year: selectedYear
        },
        timeout: 30000,
      });

      console.log('Apartment details response:', response.data);
      setApartmentDetails(response.data);

    } catch (err) {
      console.error('Error fetching apartment details:', err);
      console.error('Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(`Failed to load apartment details: ${errorMessage}`);

      // Set fallback data
      setApartmentDetails({
        apartment: {
          id: apartmentId,
          address: selectedApartment?.address || 'N/A',
          monthly_rent: selectedApartment?.monthly_rent || selectedApartment?.rent || 0,
          status: selectedApartment?.status || 'unknown'
        },
        period: {
          type: 'current_month',
          label: 'Current Month'
        },
        summary: {
          expected_amount: 0,
          total_outstanding: selectedApartment?.total_outstanding || 0,
          total_paid: 0,
          collection_rate: 0
        },
        tenant_breakdown: []
      });
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedApartment, selectedYear]);

  // Effects
  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchOutstandingPayments();
    }
  }, [activeTab, fetchOutstandingPayments]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchNetProfitData();
    }
  }, [activeTab, fetchNetProfitData]);

  // Event handlers
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
  };

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value);
  };

  const handleOpenDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
    fetchApartmentDetails(apartment.apartment_id || apartment.id);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedApartment(null);
    setApartmentDetails(null);
  };

  const handleOutstandingPageChange = (newPage) => {
    setOutstandingPage(newPage);
  };

  const handleOutstandingRowsPerPageChange = (newRowsPerPage) => {
    setOutstandingRowsPerPage(newRowsPerPage);
    setOutstandingPage(1);
  };

  const handleOutstandingSearchChange = (searchTerm) => {
    setOutstandingSearch(searchTerm);
    setOutstandingPage(1);
  };

  const handleOutstandingSortChange = (sortOption) => {
    setOutstandingSort(sortOption);
  };

  const handleRefresh = () => {
    if (activeTab === 0) {
      fetchFinancialData();
    } else if (activeTab === 1) {
      fetchOutstandingPayments();
    } else if (activeTab === 2) {
      fetchNetProfitData();
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Generate month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  return (
    <Container maxWidth="xl">
      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* Loading Backdrop */}
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading Analytics Data...
          </Typography>
        </Box>
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight={600} color={COLORS.primary}>
          Analytics Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Refresh Button */}
          <IconButton
            onClick={handleRefresh}
            color="primary"
            disabled={loading}
            title="Refresh current tab data"
          >
            <RefreshIcon />
          </IconButton>

          {/* Year Selector */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select value={selectedYear} onChange={handleYearChange} label="Year">
              {yearOptions.map(year => (
                <MenuItem key={year} value={year}>{year}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Month Selector - Only show for Net Profit tab */}
          {activeTab === 2 && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Month</InputLabel>
              <Select value={selectedMonth} onChange={handleMonthChange} label="Month">
                {monthOptions.map(month => (
                  <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            label="Financial Overview"
            icon={<AssessmentIcon />}
            iconPosition="start"
          />
          <Tab
            label="Outstanding Payments"
            icon={<ErrorIcon />}
            iconPosition="start"
          />
          <Tab
            label="Net Profit Analysis"
            icon={<ReceiptIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <FinancialOverviewTab
          loading={loading}
          financialData={financialData}
          selectedYear={selectedYear}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <OutstandingPaymentsTab
          outstandingData={outstandingData}
          outstandingLoading={outstandingLoading}
          outstandingPage={outstandingPage}
          outstandingRowsPerPage={outstandingRowsPerPage}
          outstandingSearch={outstandingSearch}
          outstandingSort={outstandingSort}
          setOutstandingSearch={setOutstandingSearch}
          setOutstandingSort={setOutstandingSort}
          handleOutstandingPageChange={handleOutstandingPageChange}
          handleOutstandingRowsPerPageChange={handleOutstandingRowsPerPageChange}
          handleOpenDetails={handleOpenDetails}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <NetProfitTab
          netProfitData={netProfitData}
          netProfitLoading={netProfitLoading}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      </TabPanel>

      {/* Apartment Details Dialog */}
      <AnalyticsApartmentDetailsDialog
        detailsOpen={detailsOpen}
        selectedApartment={selectedApartment}
        apartmentDetails={apartmentDetails}
        detailsLoading={detailsLoading}
        selectedYear={selectedYear}
        handleCloseDetails={handleCloseDetails}
      />

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          Analytics data refreshed successfully!
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default AnalyticsPanel;
