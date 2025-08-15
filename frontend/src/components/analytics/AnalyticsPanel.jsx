// src/components/AnalyticsPanel.jsx - SIMPLIFIED VERSION (No Rental Model Controls)
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
} from '@mui/material';
import {
  Close as CloseIcon,
  Assessment as AssessmentIcon,
  Error as ErrorIcon,
  Receipt as ReceiptIcon
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

  // Financial data
  const [financialData, setFinancialData] = useState(null);

  // Outstanding payments data
  const [outstandingData, setOutstandingData] = useState(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingRowsPerPage, setOutstandingRowsPerPage] = useState(10);
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [outstandingSort, setOutstandingSort] = useState('outstanding_desc');

  // Net profit data - using default values (no UI controls)
  const [netProfitData, setNetProfitData] = useState(null);
  const [netProfitLoading, setNetProfitLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Fixed rental model settings (no UI controls)
  const rentalModel = 'percentage';
  const ownerPercentage = 80.0;
  const deltaAmount = 500.0;

  // Dialog state
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch functions
  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching financial data for year:', selectedYear);

      const response = await api.get('/analytics/financial-overview', {
        params: {
          year: selectedYear,
          rental_model: rentalModel,
          owner_percentage: ownerPercentage,
          delta_amount: deltaAmount
        }
      });

      console.log('Financial data response:', response.data);
      setFinancialData(response.data);
    } catch (err) {
      console.error('Error fetching financial data:', err);
      console.error('Error response:', err.response?.data);
      setError('Failed to load financial overview: ' + (err.response?.data?.message || err.message));
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
        }
      });

      console.log('Outstanding payments response:', response.data);
      setOutstandingData(response.data);
    } catch (err) {
      console.error('Error fetching outstanding data:', err);
      console.error('Error response:', err.response?.data);
      setError('Failed to load outstanding payments: ' + (err.response?.data?.message || err.message));
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
        month: selectedMonth,
        rental_model: rentalModel,
        owner_percentage: ownerPercentage,
        delta_amount: deltaAmount
      });

      const response = await api.get('/analytics/net-profit-detailed', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          rental_model: rentalModel,
          owner_percentage: ownerPercentage,
          delta_amount: deltaAmount
        }
      });

      console.log('Net profit data response:', response.data);
      setNetProfitData(response.data);
    } catch (err) {
      console.error('Error fetching net profit data:', err);
      console.error('Error response:', err.response?.data);
      setError('Failed to load net profit analysis: ' + (err.response?.data?.message || err.message));
    } finally {
      setNetProfitLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  const fetchApartmentDetails = useCallback(async (apartmentId) => {
    try {
      setDetailsLoading(true);
      setError(null);

      console.log('Fetching apartment details for ID:', apartmentId);

      const response = await api.get(`/analytics/apartment-details/${apartmentId}`);

      console.log('Apartment details response:', response.data);
      setApartmentDetails(response.data);

    } catch (err) {
      console.error('Error fetching apartment details:', err);
      console.error('Error response:', err.response?.data);

      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(`Failed to load apartment details: ${errorMessage}`);

      setApartmentDetails({
        apartment: {
          id: apartmentId,
          address: selectedApartment?.address || 'N/A',
          rent: selectedApartment?.monthly_rent || selectedApartment?.rent || 0,
          status: selectedApartment?.status || 'unknown'
        },
        payments: [],
        summary: {
          total_payments: 0,
          total_outstanding: selectedApartment?.outstanding || 0,
          last_payment_date: null,
          payment_history_months: 0
        }
      });
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedApartment]);

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
          {error}
        </Alert>
      )}

      {/* Loading Backdrop */}
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight={600} color={COLORS.primary}>
          Analytics Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
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

          {/* REMOVED: All rental model selector controls */}
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
          rentalModel={rentalModel}
          ownerPercentage={ownerPercentage}
          deltaAmount={deltaAmount}
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
    </Container>
  );
}

export default AnalyticsPanel;
