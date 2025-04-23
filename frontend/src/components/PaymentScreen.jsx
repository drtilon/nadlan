import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Divider,
  Box,
  Alert,
  Tab,
  Tabs,
  Chip,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  LinearProgress,
  Collapse,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Badge
} from '@mui/material';
import {
  KeyboardArrowUp as ExpandLessIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  RefreshOutlined as RefreshIcon,
  PaymentOutlined as PaymentIcon,
  AccountBalanceWalletOutlined as WalletIcon,
  SaveOutlined as SaveIcon,
  ReceiptOutlined as ReceiptIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  CalendarMonth as CalendarIcon,
  CheckCircleOutline as CheckIcon,
  HistoryOutlined as HistoryIcon,
  Close as CloseIcon,
  EditOutlined as EditIcon,
  CheckCircle as PaidIcon,
  Cancel as UnpaidIcon,
  Error as PartialIcon
} from '@mui/icons-material';
import api from '../utils/api';

// Define the months for payment management
const MONTH_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Colors for payment status
const STATUS_COLORS = {
  paid: '#4caf50',
  partial: '#ff9800',
  not_paid: '#f44336',
  not_applicable: '#9e9e9e'
};

function PaymentScreen({ showNotification, initialApartment, isAdmin = true }) {
  const { apartmentId } = useParams();
  const theme = useTheme();
  const [selectedApartment, setSelectedApartment] = useState(apartmentId || '');
  const [apartments, setApartments] = useState([]);
  const [paymentData, setPaymentData] = useState({});
  const [apartmentDetails, setApartmentDetails] = useState(null);
  const [totalRent, setTotalRent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState('');
  const [expandedMonths, setExpandedMonths] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [receiptsDialogOpen, setReceiptsDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [activeMonths, setActiveMonths] = useState([]);

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  useEffect(() => {
    setCurrentMonth(MONTH_LIST[currentMonthIndex]);
  }, [currentMonthIndex]);

  useEffect(() => {
    const fetchApartments = async () => {
      try {
        setLoading(true);
        const response = await api.get('/list');
        setApartments(response.data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        showNotification('Error fetching apartments', 'error');
        setLoading(false);
      }
    };
    fetchApartments();
  }, [showNotification]);

  const parseTenantNames = (apartmentData) => {
    if (!apartmentData?.tenants) return [];
    if (typeof apartmentData.tenants === 'string') {
      return apartmentData.tenants
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
    } else if (Array.isArray(apartmentData.tenants)) {
      return apartmentData.tenants.map(tenant => {
        if (typeof tenant === 'object' && tenant !== null) {
          return tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || '';
        }
        return typeof tenant === 'string' ? tenant : '';
      }).filter(name => name);
    }
    return [];
  };

  const calculateActiveMonths = (apartmentData) => {
    if (!apartmentData.moveInDate && !apartmentData.contractEndDate) {
      return MONTH_LIST;
    }
    const activeMonths = [];
    let startMonth = 0;
    let endMonth = 11;
    const moveInDate = apartmentData.moveInDate ? new Date(apartmentData.moveInDate) : null;
    const contractEndDate = apartmentData.contractEndDate ? new Date(apartmentData.contractEndDate) : null;
    if (moveInDate && moveInDate.getFullYear() === selectedYear) {
      startMonth = moveInDate.getMonth();
    } else if (moveInDate && selectedYear < moveInDate.getFullYear()) {
      return [];
    }
    if (contractEndDate && contractEndDate.getFullYear() === selectedYear) {
      endMonth = contractEndDate.getMonth();
    } else if (contractEndDate && selectedYear > contractEndDate.getFullYear()) {
      return [];
    }
    for (let i = startMonth; i <= endMonth; i++) {
      activeMonths.push(MONTH_LIST[i]);
    }
    return activeMonths;
  };

  const calculateAvailableYears = (apartmentData, paymentData) => {
    const years = new Set();
    years.add(currentYear);
    if (apartmentData.moveInDate) {
      const moveInYear = new Date(apartmentData.moveInDate).getFullYear();
      years.add(moveInYear);
    }
    if (apartmentData.contractEndDate) {
      const endYear = new Date(apartmentData.contractEndDate).getFullYear();
      years.add(endYear);
    }
    if (apartmentData.moveInDate && apartmentData.contractEndDate) {
      const startYear = new Date(apartmentData.moveInDate).getFullYear();
      const endYear = new Date(apartmentData.contractEndDate).getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        years.add(year);
      }
    }
    paymentHistory.forEach(payment => {
      if (payment.year) {
        years.add(parseInt(payment.year));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const autoLoadTenantsForAllMonths = (apartmentData, currentPaymentData, rentAmount, activeMonthsList) => {
    const tenantNames = parseTenantNames(apartmentData);
    if (tenantNames.length === 0) {
      showNotification('No tenants found for this apartment. Please add tenants first.', 'warning');
      return currentPaymentData;
    }
    const updatedPaymentData = { ...currentPaymentData };
    const amountPerTenant = tenantNames.length > 0 ? rentAmount / tenantNames.length : 0;
    for (const month of MONTH_LIST) {
      const isActive = activeMonthsList.includes(month);
      const existingMonthData = updatedPaymentData[month] || {
        status: isActive ? 'not_paid' : 'not_applicable',
        extraPayments: {
          internet: 0,
          electricity: 0,
          other: 0
        },
        year: selectedYear,
        isActive: isActive
      };
      const existingTenants = existingMonthData.tenants || [];
      const updatedTenants = tenantNames.map((name) => {
        const foundTenant = existingTenants.find((t) => t.name === name);
        return foundTenant || {
          name,
          paid: false,
          amountDue: isActive ? amountPerTenant : 0,
          amountPaid: 0
        };
      });
      updatedPaymentData[month] = {
        ...existingMonthData,
        tenants: updatedTenants,
        status: isActive ? determinePaymentStatus(updatedTenants) : 'not_applicable',
        year: selectedYear,
        isActive: isActive
      };
    }
    return updatedPaymentData;
  };

  useEffect(() => {
    if (!selectedApartment) return;
    const fetchApartmentData = async () => {
      try {
        setLoading(true);
        const apartmentResponse = await api.get(`/apartment/${selectedApartment}`);
        setApartmentDetails(apartmentResponse.data);
        let rentValue = 0;
        const apartmentData = apartmentResponse.data;
        if (apartmentData.rent !== undefined && apartmentData.rent !== null) {
          rentValue = parseFloat(apartmentData.rent);
        } else if (apartmentData.model === 'rental' && apartmentData.rentCost !== undefined) {
          rentValue = parseFloat(apartmentData.rentCost);
        }
        setTotalRent(rentValue);
        try {
          const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
          setPaymentHistory(historyResponse.data || []);
          const yearsArray = calculateAvailableYears(apartmentResponse.data, historyResponse.data);
          setAvailableYears(yearsArray);
          const activeMonthsList = calculateActiveMonths(apartmentResponse.data);
          setActiveMonths(activeMonthsList);
          try {
            const paymentResponse = await api.get(`/payments/${selectedApartment}?year=${selectedYear}`);
            const processedData = {};
            for (const month of MONTH_LIST) {
              const isActive = activeMonthsList.includes(month);
              const monthData = paymentResponse.data.payments[month] || {
                status: isActive ? 'not_paid' : 'not_applicable',
                tenants: [],
                extraPayments: {
                  internet: 0,
                  electricity: 0,
                  other: 0
                },
                year: selectedYear,
                isActive: isActive
              };
              
              // Process tenant data consistently
              if (monthData.tenants) {
                monthData.tenants = monthData.tenants.map((tenant) => ({
                  ...tenant,
                  name: tenant.name || '',
                  paid: Boolean(tenant.paid), // Ensure paid is a boolean
                  amountDue: parseFloat(tenant.amountDue) || 0,
                  amountPaid: parseFloat(tenant.amountPaid) || 0,
                }));
                
                // Recalculate status based on tenant payment data
                if (isActive) {
                  monthData.status = determinePaymentStatus(monthData.tenants);
                }
              } else {
                monthData.tenants = [];
              }
              
              // Ensure extraPayments is properly formatted
              if (!monthData.extraPayments) {
                monthData.extraPayments = {
                  internet: parseFloat(monthData.internet) || 0,
                  electricity: parseFloat(monthData.electricity) || 0,
                  other: parseFloat(monthData.other) || 0,
                };
              } else {
                monthData.extraPayments = {
                  internet: parseFloat(monthData.extraPayments.internet) || 0,
                  electricity: parseFloat(monthData.extraPayments.electricity) || 0,
                  other: parseFloat(monthData.extraPayments.other) || 0,
                };
              }
              
              monthData.isActive = isActive;
              if (!isActive) {
                monthData.status = 'not_applicable';
              }
              processedData[month] = monthData;
            }
            
            const updatedData = autoLoadTenantsForAllMonths(
              apartmentResponse.data,
              processedData,
              rentValue,
              activeMonthsList
            );
            setPaymentData(updatedData);
          } catch (error) {
            console.error('Error fetching payment data:', error);
            const defaultData = {};
            for (const month of MONTH_LIST) {
              const isActive = activeMonthsList.includes(month);
              defaultData[month] = {
                status: isActive ? 'not_paid' : 'not_applicable',
                tenants: [],
                extraPayments: {
                  internet: 0,
                  electricity: 0,
                  other: 0
                },
                year: selectedYear,
                isActive: isActive
              };
            }
            const updatedData = autoLoadTenantsForAllMonths(
              apartmentResponse.data,
              defaultData,
              rentValue,
              activeMonthsList
            );
            setPaymentData(updatedData);
          }
        } catch (error) {
          console.error('Error fetching payment history:', error);
          setPaymentHistory([]);
          const yearsArray = calculateAvailableYears(apartmentResponse.data, []);
          setAvailableYears(yearsArray);
          const activeMonthsList = calculateActiveMonths(apartmentResponse.data);
          setActiveMonths(activeMonthsList);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching apartment data:', error);
        showNotification('Error loading apartment data. Please try again.', 'error');
        setLoading(false);
      }
    };
    fetchApartmentData();
  }, [selectedApartment, selectedYear, showNotification]);

  const handleYearChange = (event) => {
    setSelectedYear(parseInt(event.target.value));
  };

  const calculateRemainingAmount = (month) => {
    if (!paymentData[month]?.tenants || !paymentData[month]?.isActive) return 0;
    let totalPaid = 0;
    if (paymentData[month].tenants && Array.isArray(paymentData[month].tenants)) {
      totalPaid = paymentData[month].tenants.reduce(
        (sum, tenant) => sum + (parseFloat(tenant.amountPaid) || 0),
        0
      );
    }
    return Math.max(0, totalRent - totalPaid).toFixed(2);
  };

  const calculatePaymentPercentage = (month) => {
    if (!paymentData[month]?.tenants || !paymentData[month]?.isActive || totalRent === 0) return 0;
    const totalPaid = paymentData[month].tenants.reduce(
      (sum, tenant) => sum + (parseFloat(tenant.amountPaid) || 0),
      0
    );
    return Math.min(100, Math.round((totalPaid / totalRent) * 100));
  };

  const determinePaymentStatus = (tenants) => {
    if (!tenants || !Array.isArray(tenants) || !tenants.length) return 'not_paid';
    
    const allPaid = tenants.every((tenant) => {
      // A tenant is considered paid if either:
      // 1. The "paid" flag is true OR
      // 2. amountPaid >= amountDue (and amountDue is positive)
      return tenant.paid || 
             (parseFloat(tenant.amountPaid) >= parseFloat(tenant.amountDue) && 
              parseFloat(tenant.amountDue) > 0);
    });
    
    if (allPaid) return 'paid';
    
    const anyPaid = tenants.some((tenant) => {
      return tenant.paid || parseFloat(tenant.amountPaid) > 0;
    });
    
    return anyPaid ? 'partial' : 'not_paid';
  };

  const formatTenantList = () => {
    if (!apartmentDetails?.tenants) return 'None registered';
    if (Array.isArray(apartmentDetails.tenants)) {
      return apartmentDetails.tenants.map(tenant => {
        if (typeof tenant === 'object' && tenant !== null) {
          return tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim();
        }
        return typeof tenant === 'string' ? tenant : '';
      }).filter(name => name).join(', ') || 'None registered';
    }
    return typeof apartmentDetails.tenants === 'string'
      ? apartmentDetails.tenants
      : 'None registered';
  };

  const splitRentEvenly = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    if (!paymentData[month]?.isActive) {
      showNotification('This month is outside the contract period', 'warning');
      return;
    }
    const amountPerTenant = totalRent / tenants.length;
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        amountDue: amountPerTenant,
        amountPaid: tenant.paid ? amountPerTenant : tenant.amountPaid
      }));
      
      // Recalculate status after updating tenants
      const newStatus = determinePaymentStatus(updatedTenants);
      
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants,
          status: newStatus
        }
      };
    });
    showNotification(`Rent split evenly: ${formatCurrency(amountPerTenant)} per tenant`, 'success');
  };

  const markAllAsPaid = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    if (!paymentData[month]?.isActive) {
      showNotification('This month is outside the contract period', 'warning');
      return;
    }
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        paid: true,
        amountPaid: tenant.amountDue
      }));
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants,
          status: 'paid'
        }
      };
    });
    showNotification(`All tenants marked as paid for ${month}`, 'success');
  };

  const markAllAsUnpaid = (month) => {
    const tenants = paymentData[month]?.tenants || [];
    if (tenants.length === 0) {
      showNotification('No tenants available for this month', 'warning');
      return;
    }
    if (!paymentData[month]?.isActive) {
      showNotification('This month is outside the contract period', 'warning');
      return;
    }
    setPaymentData((prev) => {
      const updatedTenants = tenants.map((tenant) => ({
        ...tenant,
        paid: false,
        amountPaid: 0
      }));
      return {
        ...prev,
        [month]: {
          ...prev[month],
          tenants: updatedTenants,
          status: 'not_paid'
        }
      };
    });
    showNotification(`All tenants marked as unpaid for ${month}`, 'success');
  };

  const handlePaymentChange = (month, field, value) => {
    if (!paymentData[month]?.isActive) return;
    setPaymentData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value
      }
    }));
  };

  const handleTenantStatusChange = (month, tenantIndex, checked) => {
    if (!paymentData[month]?.isActive) return;
    
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updated = { 
            ...tenant, 
            paid: checked,
            // When marked as paid, set amountPaid to amountDue
            amountPaid: checked ? tenant.amountDue : tenant.amountPaid
          };
          return updated;
        }
        return tenant;
      });
      
      // Recalculate status based on updated tenant data
      const newStatus = determinePaymentStatus(updatedTenants);
      
      return {
        ...prev,
        [month]: {
          ...monthData,
          tenants: updatedTenants,
          status: newStatus
        }
      };
    });
  };

  const handleTenantAmountChange = (month, tenantIndex, field, value) => {
    if (!paymentData[month]?.isActive) return;
    const numValue = parseFloat(value) || 0;
    setPaymentData((prev) => {
      const monthData = prev[month];
      const updatedTenants = monthData.tenants.map((tenant, index) => {
        if (index === tenantIndex) {
          const updatedTenant = { ...tenant, [field]: numValue };
          if (field === 'amountPaid') {
            updatedTenant.paid = numValue >= tenant.amountDue;
          } else if (field === 'amountDue') {
            updatedTenant.paid = tenant.amountPaid >= numValue;
          }
          return updatedTenant;
        }
        return tenant;
      });
      
      // Recalculate status based on updated tenant data
      const newStatus = determinePaymentStatus(updatedTenants);
      
      return {
        ...prev,
        [month]: {
          ...monthData,
          tenants: updatedTenants,
          status: newStatus
        }
      };
    });
  };

  const handleExtraPaymentChange = (month, field, value) => {
    if (!paymentData[month]?.isActive) return;
    const numValue = parseFloat(value) || 0;
    setPaymentData((prev) => ({
      ...prev,
      [month]: {
        ...prev[month],
        extraPayments: {
          ...prev[month].extraPayments,
          [field]: numValue
        }
      }
    }));
  };

  const toggleMonthExpanded = (month) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month]
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      const formattedData = {
        payments: {},
        year: selectedYear
      };
      
      for (const month of MONTH_LIST) {
        const monthObj = paymentData[month];
        if (!monthObj) continue;
        
        const formattedTenants = (monthObj.tenants || []).map(tenant => ({
          name: tenant.name,
          paid: Boolean(tenant.paid), // Ensure paid is a boolean
          amountDue: parseFloat(tenant.amountDue) || 0,
          amountPaid: parseFloat(tenant.amountPaid) || 0
        }));
        
        // Recalculate status before saving to ensure it's correct
        const status = monthObj.isActive ? determinePaymentStatus(formattedTenants) : 'not_applicable';
        
        formattedData.payments[month] = {
          status: status, // Use recalculated status
          tenants: formattedTenants,
          extraPayments: {
            internet: parseFloat(monthObj.extraPayments?.internet) || 0,
            electricity: parseFloat(monthObj.extraPayments?.electricity) || 0,
            other: parseFloat(monthObj.extraPayments?.other) || 0
          },
          internet: parseFloat(monthObj.extraPayments?.internet) || 0,
          electricity: parseFloat(monthObj.extraPayments?.electricity) || 0,
          other: parseFloat(monthObj.extraPayments?.other) || 0,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          year: selectedYear,
          isActive: monthObj.isActive
        };
      }
      
      await api.post(`/payments/${selectedApartment}`, formattedData);
      showNotification(`Payment data for ${selectedYear} saved successfully!`, 'success');
      try {
        const historyResponse = await api.get(`/payment-history/${selectedApartment}`);
        setPaymentHistory(historyResponse.data || []);
        if (apartmentDetails) {
          const yearsArray = calculateAvailableYears(apartmentDetails, historyResponse.data);
          setAvailableYears(yearsArray);
        }
      } catch (error) {
        console.error('Error fetching payment history:', error);
      }
      setIsSaving(false);
    } catch (error) {
      console.error(error);
      showNotification(`Error saving payment data: ${error.message || 'Unknown error'}`, 'error');
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getPaymentMethodText = (method) => {
    const methodMap = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      credit_card: 'Credit Card',
      check: 'Check',
      other: 'Other'
    };
    return methodMap[method] || method;
  };

  const generateReceipt = (month) => {
    showNotification(`Receipt generation for ${month} is not implemented yet`, 'info');
  };

  const getMonthStatus = (month) => {
    const monthIndex = MONTH_LIST.indexOf(month);
    const currentMonthIndex = new Date().getMonth();
    if (selectedYear < currentYear) return 'past';
    if (selectedYear > currentYear) return 'future';
    if (monthIndex < currentMonthIndex) return 'past';
    if (monthIndex === currentMonthIndex) return 'current';
    return 'future';
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, md: 4 },
        mt: 3,
        borderRadius: 2,
        boxShadow: theme.shadows[3],
        background: theme.palette.background.paper,
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: theme.shadows[5],
        },
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 4,
          fontWeight: 600,
          color: theme.palette.text.primary,
        }}
      >
        <WalletIcon sx={{ mr: 1, fontSize: 32, color: theme.palette.primary.main }} />
        Payment Management
      </Typography>

      {/* Apartment and Year Selection */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={5}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="apartment-select-label">Select Apartment</InputLabel>
            <Select
              labelId="apartment-select-label"
              value={selectedApartment}
              label="Select Apartment"
              onChange={(e) => setSelectedApartment(e.target.value)}
              disabled={loading || isSaving}
              sx={{
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
              }}
            >
              {apartments.map((apartment) => (
                <MenuItem key={apartment.id} value={apartment.id}>
                  {apartment.address}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth variant="outlined">
            <InputLabel id="year-select-label">Year</InputLabel>
            <Select
              labelId="year-select-label"
              value={selectedYear}
              label="Year"
              onChange={handleYearChange}
              disabled={loading || isSaving}
              sx={{
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
              }}
            >
              {availableYears.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
              {availableYears.length === 0 && (
                <MenuItem value={currentYear}>{currentYear}</MenuItem>
              )}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="flex-end"
            sx={{ height: '100%', alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
              sx={{
                borderRadius: 1,
                textTransform: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: theme.palette.primary.light,
                  color: theme.palette.primary.contrastText,
                },
              }}
            >
              {showHistory ? 'Hide History' : 'Payment History'}
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {loading && (
        <LinearProgress
          sx={{
            mb: 3,
            borderRadius: 2,
            height: 6,
            backgroundColor: theme.palette.grey[300],
          }}
        />
      )}

      {selectedApartment && !loading && (
        <>
          {totalRent === 0 && (
            <Alert
              severity="warning"
              sx={{
                mb: 3,
                borderRadius: 1,
                bgcolor: theme.palette.warning.light,
                color: theme.palette.warning.contrastText,
              }}
            >
              Rent is not defined for this apartment. Please set the rent in the apartment details.
            </Alert>
          )}

          {apartmentDetails && activeMonths.length === 0 && (
            <Alert
              severity="info"
              sx={{
                mb: 3,
                borderRadius: 1,
                bgcolor: theme.palette.info.light,
                color: theme.palette.info.contrastText,
              }}
            >
              The selected year {selectedYear} is outside the apartment's contract period.
              {apartmentDetails.moveInDate && apartmentDetails.contractEndDate && (
                ` Contract is from ${formatDate(apartmentDetails.moveInDate)} to ${formatDate(apartmentDetails.contractEndDate)}.`
              )}
            </Alert>
          )}

          {apartmentDetails && (
            <Card
              sx={{
                mb: 4,
                borderRadius: 2,
                boxShadow: theme.shadows[2],
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                    >
                      {apartmentDetails.address}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, lineHeight: 1.6 }}
                    >
                      <strong>Model:</strong> {apartmentDetails.model || 'Not specified'}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      <strong>Tenants:</strong> {formatTenantList()}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      <strong>Contract Period:</strong>{' '}
                      {apartmentDetails.moveInDate
                        ? formatDate(apartmentDetails.moveInDate)
                        : 'Not specified'}{' '}
                      {apartmentDetails.contractEndDate
                        ? ` to ${formatDate(apartmentDetails.contractEndDate)}`
                        : '(No end date)'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                      <Typography
                        variant="h6"
                        sx={{ color: theme.palette.primary.main, fontWeight: 500 }}
                      >
                        {formatCurrency(totalRent)}
                        <Typography component="span" variant="body2">
                          /month
                        </Typography>
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1, lineHeight: 1.6 }}
                      >
                        <strong>Active Months ({selectedYear}):</strong>{' '}
                        {activeMonths.length > 0 ? activeMonths.join(', ') : 'None for selected year'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          <Collapse in={showHistory} timeout={400}>
            <Paper
              sx={{
                p: 3,
                mb: 4,
                borderRadius: 2,
                boxShadow: theme.shadows[2],
                background: theme.palette.background.default,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                >
                  Payment History
                </Typography>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const historyResponse = await api.get(
                        `/payment-history/${selectedApartment}`
                      );
                      setPaymentHistory(historyResponse.data || []);
                      setLoading(false);
                    } catch (error) {
                      console.error('Error fetching payment history:', error);
                      setLoading(false);
                    }
                  }}
                  sx={{
                    borderRadius: 1,
                    textTransform: 'none',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light,
                      color: theme.palette.primary.contrastText,
                    },
                  }}
                >
                  Refresh
                </Button>
              </Box>

              {paymentHistory.length === 0 ? (
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 1,
                    bgcolor: theme.palette.info.light,
                    color: theme.palette.info.contrastText,
                  }}
                >
                  No payment history available for this apartment.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: theme.palette.grey[100] }}>
                        <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Month</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Year</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          Amount Due
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          Amount Paid
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paymentHistory.map((record, index) => (
                        <TableRow
                          key={index}
                          hover
                          sx={{
                            bgcolor: index % 2 === 0 ? theme.palette.background.paper : theme.palette.grey[50],
                            transition: 'background-color 0.3s ease',
                          }}
                        >
                          <TableCell>{formatDate(record.paymentDate)}</TableCell>
                          <TableCell>{record.month}</TableCell>
                          <TableCell>{record.year || currentYear}</TableCell>
                          <TableCell>
                            <Chip
                              label={
                                record.status === 'paid'
                                  ? 'Paid'
                                  : record.status === 'partial'
                                  ? 'Partial'
                                  : 'Not Paid'
                              }
                              size="small"
                              sx={{
                                bgcolor: STATUS_COLORS[record.status],
                                color: 'white',
                                fontWeight: 500,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(record.amountDue || 0)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(record.amountPaid || 0)}
                          </TableCell>
                          <TableCell>{getPaymentMethodText(record.paymentMethod)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Collapse>

          <Card
            sx={{
              mb: 4,
              borderRadius: 2,
              borderLeft: 4,
              borderColor: theme.palette.primary.main,
              boxShadow: theme.shadows[2],
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                  >
                    {currentMonth} {selectedYear} Payment Entry
                  </Typography>
                </Box>
              }
              action={
                <Chip
                  label={
                    paymentData[currentMonth]?.status === 'paid'
                      ? 'Paid'
                      : paymentData[currentMonth]?.status === 'partial'
                      ? 'Partial'
                      : paymentData[currentMonth]?.status === 'not_applicable'
                      ? 'Not Applicable'
                      : 'Not Paid'
                  }
                  color={
                    paymentData[currentMonth]?.status === 'paid'
                      ? 'success'
                      : paymentData[currentMonth]?.status === 'partial'
                      ? 'warning'
                      : paymentData[currentMonth]?.status === 'not_applicable'
                      ? 'default'
                      : 'error'
                  }
                  sx={{ fontWeight: 500 }}
                />
              }
              sx={{ bgcolor: theme.palette.grey[100], py: 2 }}
            />
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              {!paymentData[currentMonth]?.isActive ? (
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 1,
                    bgcolor: theme.palette.info.light,
                    color: theme.palette.info.contrastText,
                  }}
                >
                  This month is outside the apartment's contract period. No payment is required.
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, color: theme.palette.text.secondary }}
                        >
                          Payment Progress
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, color: theme.palette.text.secondary }}
                        >
                          {calculatePaymentPercentage(currentMonth)}% collected
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={calculatePaymentPercentage(currentMonth)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: theme.palette.grey[300],
                          '& .MuiLinearProgress-bar': {
                            backgroundColor:
                              paymentData[currentMonth]?.status === 'paid'
                                ? STATUS_COLORS.paid
                                : paymentData[currentMonth]?.status === 'partial'
                                ? STATUS_COLORS.partial
                                : STATUS_COLORS.not_paid,
                            transition: 'width 0.5s ease',
                          },
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                        >
                          Remaining: {formatCurrency(calculateRemainingAmount(currentMonth))}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                    >
                      Tenant Payments
                    </Typography>

                    {!paymentData[currentMonth]?.tenants ||
                    paymentData[currentMonth]?.tenants.length === 0 ? (
                      <Alert
                        severity="info"
                        sx={{
                          borderRadius: 1,
                          bgcolor: theme.palette.info.light,
                          color: theme.palette.info.contrastText,
                        }}
                      >
                        No tenants available for this apartment. Please add tenants to the apartment
                        first.
                      </Alert>
                    ) : (
                      <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ borderRadius: 1, boxShadow: theme.shadows[1] }}
                      >
                        <Table>
                          <TableHead>
                            <TableRow sx={{ bgcolor: theme.palette.grey[100] }}>
                              <TableCell sx={{ fontWeight: 600 }}>Tenant</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                Amount Due
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                Amount Paid
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                Actions
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paymentData[currentMonth]?.tenants.map((tenant, index) => (
                              <TableRow
                                key={index}
                                sx={{
                                  bgcolor:
                                    index % 2 === 0 ? theme.palette.background.paper : theme.palette.grey[50],
                                  transition: 'background-color 0.3s ease',
                                  '&:hover': {
                                    bgcolor: theme.palette.action.hover,
                                  },
                                }}
                              >
                                <TableCell sx={{ fontWeight: 500 }}>{tenant.name}</TableCell>
                                <TableCell align="right">
                                  <TextField
                                    size="small"
                                    variant="outlined"
                                    type="number"
                                    value={tenant.amountDue || 0}
                                    onChange={(e) =>
                                      handleTenantAmountChange(
                                        currentMonth,
                                        index,
                                        'amountDue',
                                        e.target.value
                                      )
                                    }
                                    InputProps={{
                                      startAdornment: (
                                        <Typography variant="caption" sx={{ mr: 0.5 }}>
                                          €
                                        </Typography>
                                      ),
                                    }}
                                    sx={{
                                      width: '120px',
                                      '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                        transition: 'all 0.3s ease',
                                      },
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <TextField
                                    size="small"
                                    variant="outlined"
                                    type="number"
                                    value={tenant.amountPaid || 0}
                                    onChange={(e) =>
                                      handleTenantAmountChange(
                                        currentMonth,
                                        index,
                                        'amountPaid',
                                        e.target.value
                                      )
                                    }
                                    error={tenant.amountPaid < tenant.amountDue}
                                    InputProps={{
                                      startAdornment: (
                                        <Typography variant="caption" sx={{ mr: 0.5 }}>
                                          €
                                        </Typography>
                                      ),
                                    }}
                                    sx={{
                                      width: '120px',
                                      '& .MuiOutlinedInput-root': {
                                        borderRadius: 1,
                                        transition: 'all 0.3s ease',
                                      },
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Switch
                                      checked={tenant.paid}
                                      onChange={(e) =>
                                        handleTenantStatusChange(currentMonth, index, e.target.checked)
                                      }
                                      color="success"
                                      sx={{
                                        '& .MuiSwitch-track': {
                                          transition: 'background-color 0.3s ease',
                                        },
                                      }}
                                    />
                                    <Chip
                                      label={
                                        tenant.paid
                                          ? 'Paid'
                                          : tenant.amountPaid > 0
                                          ? 'Partial'
                                          : 'Unpaid'
                                      }
                                      size="small"
                                      sx={{
                                        bgcolor: tenant.paid
                                          ? STATUS_COLORS.paid
                                          : tenant.amountPaid > 0
                                          ? STATUS_COLORS.partial
                                          : STATUS_COLORS.not_paid,
                                        color: 'white',
                                        ml: 1,
                                        fontWeight: 500,
                                      }}
                                    />
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <Tooltip title={tenant.paid ? 'Mark as Unpaid' : 'Mark as Paid'}>
                                    <IconButton
                                      size="small"
                                      color={tenant.paid ? 'error' : 'success'}
                                      onClick={() =>
                                        handleTenantStatusChange(currentMonth, index, !tenant.paid)
                                      }
                                      sx={{
                                        transition: 'color 0.3s ease',
                                        '&:hover': {
                                          color: tenant.paid
                                            ? theme.palette.error.dark
                                            : theme.palette.success.dark,
                                        },
                                      }}
                                    >
                                      {tenant.paid ? (
                                        <UnpaidIcon fontSize="small" />
                                      ) : (
                                        <PaidIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ mt: 3, fontWeight: 600, color: theme.palette.text.primary }}
                    >
                      Additional Costs
                    </Typography>
                    <Grid container spacing={2}>
                      {['internet', 'electricity', 'other'].map((field) => (
                        <Grid item xs={12} md={4} key={field}>
                          <TextField
                            fullWidth
                            label={
                              field.charAt(0).toUpperCase() +
                              field.slice(1).replace('other', 'Other Expenses')
                            }
                            variant="outlined"
                            type="number"
                            value={paymentData[currentMonth]?.extraPayments?.[field] || 0}
                            onChange={(e) => handleExtraPaymentChange(currentMonth, field, e.target.value)}
                            InputProps={{
                              startAdornment: (
                                <Typography variant="caption" sx={{ mr: 0.5 }}>
                                  €
                                </Typography>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 1,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: theme.palette.action.hover,
                                },
                              },
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ mt: 3, fontWeight: 600, color: theme.palette.text.primary }}
                    >
                      Payment Details
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Payment Date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="payment-method-label">Payment Method</InputLabel>
                          <Select
                            labelId="payment-method-label"
                            value={paymentMethod}
                            label="Payment Method"
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            sx={{
                              borderRadius: 1,
                              '& .MuiOutlinedInput-root': {
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  backgroundColor: theme.palette.action.hover,
                                },
                              },
                            }}
                          >
                            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                            <MenuItem value="cash">Cash</MenuItem>
                            <MenuItem value="credit_card">Credit Card</MenuItem>
                            <MenuItem value="check">Check</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      sx={{ mt: 3, fontWeight: 600, color: theme.palette.text.primary }}
                    >
                      Quick Actions
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PaymentIcon />}
                        onClick={() => splitRentEvenly(currentMonth)}
                        disabled={!paymentData[currentMonth]?.tenants?.length}
                        sx={{
                          borderRadius: 1,
                          textTransform: 'none',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: theme.palette.primary.light,
                            color: theme.palette.primary.contrastText,
                          },
                        }}
                      >
                        Split Rent Evenly
                      </Button>
                      <Button
                        variant="outlined"
                        color="success"
                        startIcon={<PaidIcon />}
                        onClick={() => markAllAsPaid(currentMonth)}
                        disabled={!paymentData[currentMonth]?.tenants?.length}
                        sx={{
                          borderRadius: 1,
                          textTransform: 'none',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: theme.palette.success.light,
                            color: theme.palette.success.contrastText,
                          },
                        }}
                      >
                        Mark All Paid
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<UnpaidIcon />}
                        onClick={() => markAllAsUnpaid(currentMonth)}
                        disabled={!paymentData[currentMonth]?.tenants?.length}
                        sx={{
                          borderRadius: 1,
                          textTransform: 'none',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            backgroundColor: theme.palette.error.light,
                            color: theme.palette.error.contrastText,
                          },
                        }}
                      >
                        Mark All Unpaid
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmit}
              startIcon={
                isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />
              }
              disabled={loading || isSaving || activeMonths.length === 0}
              sx={{
                borderRadius: 1,
                px: 4,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              {isSaving ? 'Saving...' : `Save Payment Data for ${selectedYear}`}
            </Button>
          </Box>

          <Box sx={{ mt: 5 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontWeight: 600, color: theme.palette.text.primary }}
            >
              Payment Status Overview ({selectedYear})
            </Typography>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 1, boxShadow: theme.shadows[1] }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.grey[100] }}>
                    <TableCell sx={{ fontWeight: 600 }}>Month</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Expected
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Collected
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Progress
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      Active
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MONTH_LIST.map((month) => {
                    const monthStatus = getMonthStatus(month);
                    const percentage = calculatePaymentPercentage(month);
                    const isActive = paymentData[month]?.isActive || false;
                    return (
                      <TableRow
                        key={month}
                        sx={{
                          bgcolor: MONTH_LIST.indexOf(month) % 2 === 0 ? theme.palette.background.paper : theme.palette.grey[50],                          opacity: isActive ? 1 : 0.6,
                          transition: 'background-color 0.3s ease, opacity 0.3s ease',
                          '&:hover': {
                            bgcolor: theme.palette.action.hover,
                            cursor: 'pointer',
                          },
                        }}
                        onClick={() => setCurrentMonth(month)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {monthStatus === 'current' && selectedYear === currentYear && (
                              <Chip
                                label="Current"
                                color="primary"
                                size="small"
                                sx={{ mr: 1, fontWeight: 500 }}
                              />
                            )}
                            {month}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {isActive ? formatCurrency(totalRent) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {isActive
                            ? formatCurrency(totalRent - calculateRemainingAmount(month))
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {isActive ? (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box sx={{ width: '100%', mr: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={percentage}
                                  sx={{
                                    height: 6,
                                    borderRadius: 4,
                                    backgroundColor: theme.palette.grey[300],
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor:
                                        percentage === 100
                                          ? STATUS_COLORS.paid
                                          : percentage > 0
                                          ? STATUS_COLORS.partial
                                          : STATUS_COLORS.not_paid,
                                      transition: 'width 0.5s ease',
                                    },
                                  }}
                                />
                              </Box>
                              <Box sx={{ minWidth: 35 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ color: theme.palette.text.secondary }}
                                >
                                  {percentage}%
                                </Typography>
                              </Box>
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              !isActive
                                ? 'Not Applicable'
                                : paymentData[month]?.status === 'paid'
                                ? 'Paid'
                                : paymentData[month]?.status === 'partial'
                                ? 'Partial'
                                : 'Not Paid'
                            }
                            size="small"
                            sx={{
                              bgcolor: !isActive
                                ? STATUS_COLORS.not_applicable
                                : paymentData[month]?.status === 'paid'
                                ? STATUS_COLORS.paid
                                : paymentData[month]?.status === 'partial'
                                ? STATUS_COLORS.partial
                                : STATUS_COLORS.not_paid,
                              color: 'white',
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {isActive ? (
                            <CheckIcon color="success" />
                          ) : (
                            <CloseIcon color="disabled" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}
    </Paper>
  );
}

export default PaymentScreen;
