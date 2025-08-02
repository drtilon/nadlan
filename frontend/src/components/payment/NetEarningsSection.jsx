// NetEarningsSection.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Table,
  TableHead,
  TableCell,
  TableBody,
  TableRow,
  TableContainer
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  ShowChart as ChartIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Color constants
const COLORS = {
  revenue: '#4caf50',
  expenses: '#f44336',
  profit: '#2196f3',
  pieColors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#9C27B0']
};

function NetEarningsSection({
  paymentTrends = [],
  expenseData = [],
  apartments = [],
  loading = false,
  onRefresh
}) {
  const [timeframe, setTimeframe] = useState('monthly');
  const [netEarningsData, setNetEarningsData] = useState([]);
  const [summaryData, setSummaryData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    totalProfit: 0,
    profitMargin: 0,
    expenseBreakdown: []
  });

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate net earnings from payment trends and expense data
  useEffect(() => {
    if (loading || !paymentTrends.length || !expenseData.length) return;

    // Process data for different timeframes
    const processData = () => {
      // Monthly view (default)
      if (timeframe === 'monthly') {
        // Combine payment and expense data by month
        const combinedData = paymentTrends.map(monthData => {
          const matchingExpenseData = expenseData.find(exp => exp.month === monthData.month) || {
            internet: 0,
            electricity: 0,
            other: 0,
            total: 0
          };

          const revenue = monthData.collected || 0;
          const expenses = matchingExpenseData.total ||
            (matchingExpenseData.internet || 0) +
            (matchingExpenseData.electricity || 0) +
            (matchingExpenseData.other || 0);

          // Calculate profit for management and rental models
          let managementFees = 0;
          let rentalCosts = 0;

          // Calculate management fees and rental costs
          apartments.forEach(apt => {
            if (apt.model === 'management' && apt.managementFee) {
              managementFees += (apt.rent * (apt.managementFee / 100)) || 0;
            } else if (apt.model === 'rental' && apt.rentCost) {
              rentalCosts += apt.rentCost || 0;
            }
          });

          const profit = revenue - expenses - managementFees - rentalCosts;

          return {
            month: monthData.month,
            revenue,
            expenses,
            managementFees,
            rentalCosts,
            profit,
            profitMargin: revenue > 0 ? ((profit / revenue) * 100) : 0
          };
        });

        setNetEarningsData(combinedData);

        // Calculate summary data
        const totalRevenue = combinedData.reduce((sum, item) => sum + item.revenue, 0);
        const totalExpenses = combinedData.reduce((sum, item) => sum + item.expenses, 0);
        const totalManagementFees = combinedData.reduce((sum, item) => sum + item.managementFees, 0);
        const totalRentalCosts = combinedData.reduce((sum, item) => sum + item.rentalCosts, 0);
        const totalProfit = combinedData.reduce((sum, item) => sum + item.profit, 0);

        // Create expense breakdown for pie chart
        let expenseBreakdown = [
          { name: 'Internet', value: expenseData.reduce((sum, item) => sum + (item.internet || 0), 0) },
          { name: 'Electricity', value: expenseData.reduce((sum, item) => sum + (item.electricity || 0), 0) },
          { name: 'Other Expenses', value: expenseData.reduce((sum, item) => sum + (item.other || 0), 0) },
          { name: 'Management Fees', value: totalManagementFees },
          { name: 'Rental Costs', value: totalRentalCosts }
        ];

        // Filter out zero values
        expenseBreakdown = expenseBreakdown.filter(item => item.value > 0);

        setSummaryData({
          totalRevenue,
          totalExpenses: totalExpenses + totalManagementFees + totalRentalCosts,
          totalProfit,
          profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0,
          expenseBreakdown
        });
      }
      // Quarterly view
      else if (timeframe === 'quarterly') {
        // Group months into quarters
        const quarters = {
          'Q1': ['January', 'February', 'March'],
          'Q2': ['April', 'May', 'June'],
          'Q3': ['July', 'August', 'September'],
          'Q4': ['October', 'November', 'December']
        };

        const quarterlyData = Object.keys(quarters).map(quarter => {
          const monthsInQuarter = quarters[quarter];

          // Sum up revenue and expenses for this quarter
          let revenue = 0;
          let expenses = 0;
          let managementFees = 0;
          let rentalCosts = 0;

          // Calculate management fees and rental costs
          apartments.forEach(apt => {
            if (apt.model === 'management' && apt.managementFee) {
              managementFees += 3 * (apt.rent * (apt.managementFee / 100)) || 0; // 3 months
            } else if (apt.model === 'rental' && apt.rentCost) {
              rentalCosts += 3 * (apt.rentCost || 0); // 3 months
            }
          });

          // Sum up data for the months in this quarter
          monthsInQuarter.forEach(month => {
            const monthPaymentData = paymentTrends.find(data => data.month === month);
            const monthExpenseData = expenseData.find(data => data.month === month);

            if (monthPaymentData) {
              revenue += monthPaymentData.collected || 0;
            }

            if (monthExpenseData) {
              expenses += (monthExpenseData.internet || 0) +
                (monthExpenseData.electricity || 0) +
                (monthExpenseData.other || 0);
            }
          });

          const profit = revenue - expenses - managementFees - rentalCosts;

          return {
            month: quarter, // Use quarter as the label
            revenue,
            expenses,
            managementFees,
            rentalCosts,
            profit,
            profitMargin: revenue > 0 ? ((profit / revenue) * 100) : 0
          };
        });

        setNetEarningsData(quarterlyData);

        // Reuse the monthly summary data as it's already the total for all months
      }
      // Annual view (simply totals)
      else if (timeframe === 'annual') {
        const totalRevenue = paymentTrends.reduce((sum, item) => sum + (item.collected || 0), 0);
        const totalInternetExpense = expenseData.reduce((sum, item) => sum + (item.internet || 0), 0);
        const totalElectricityExpense = expenseData.reduce((sum, item) => sum + (item.electricity || 0), 0);
        const totalOtherExpense = expenseData.reduce((sum, item) => sum + (item.other || 0), 0);
        const totalExpenses = totalInternetExpense + totalElectricityExpense + totalOtherExpense;

        // Calculate annual management fees and rental costs
        let annualManagementFees = 0;
        let annualRentalCosts = 0;

        apartments.forEach(apt => {
          if (apt.model === 'management' && apt.managementFee) {
            annualManagementFees += 12 * (apt.rent * (apt.managementFee / 100)) || 0; // 12 months
          } else if (apt.model === 'rental' && apt.rentCost) {
            annualRentalCosts += 12 * (apt.rentCost || 0); // 12 months
          }
        });

        const totalProfit = totalRevenue - totalExpenses - annualManagementFees - annualRentalCosts;

        // Create an annual data point
        const annualData = [{
          month: 'Annual',
          revenue: totalRevenue,
          expenses: totalExpenses,
          managementFees: annualManagementFees,
          rentalCosts: annualRentalCosts,
          profit: totalProfit,
          profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0
        }];

        setNetEarningsData(annualData);

        // Create expense breakdown for pie chart
        const expenseBreakdown = [
          { name: 'Internet', value: totalInternetExpense },
          { name: 'Electricity', value: totalElectricityExpense },
          { name: 'Other Expenses', value: totalOtherExpense },
          { name: 'Management Fees', value: annualManagementFees },
          { name: 'Rental Costs', value: annualRentalCosts }
        ].filter(item => item.value > 0);

        setSummaryData({
          totalRevenue,
          totalExpenses: totalExpenses + annualManagementFees + annualRentalCosts,
          totalProfit,
          profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0,
          expenseBreakdown
        });
      }
    };

    processData();
  }, [paymentTrends, expenseData, timeframe, apartments, loading]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MoneyIcon color="primary" />
          Net Earnings
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timeframe}
              label="Time Period"
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh data">
            <IconButton onClick={onRefresh} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: COLORS.revenue, color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Total Revenue</Typography>
              <Typography variant="h4">{formatCurrency(summaryData.totalRevenue)}</Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                Total income from all properties
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: COLORS.expenses, color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Total Expenses</Typography>
              <Typography variant="h4">{formatCurrency(summaryData.totalExpenses)}</Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
                All costs including utilities and fees
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: COLORS.profit, color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Net Profit</Typography>
              <Typography variant="h4">{formatCurrency(summaryData.totalProfit)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Profit Margin: {Math.round(summaryData.profitMargin)}%
                </Typography>
                {summaryData.profitMargin > 0 ?
                  <TrendingUpIcon fontSize="small" sx={{ ml: 1 }} /> :
                  <TrendingDownIcon fontSize="small" sx={{ ml: 1 }} />
                }
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Revenue vs Expenses Chart */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Revenue vs Expenses
        </Typography>
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={netEarningsData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar
                name="Revenue"
                dataKey="revenue"
                stackId="a"
                fill={COLORS.revenue}
              />
              <Bar
                name="Expenses"
                dataKey="expenses"
                stackId="b"
                fill={COLORS.expenses}
              />
              {netEarningsData.some(item => item.managementFees > 0) && (
                <Bar
                  name="Management Fees"
                  dataKey="managementFees"
                  stackId="b"
                  fill="#ff9800"
                />
              )}
              {netEarningsData.some(item => item.rentalCosts > 0) && (
                <Bar
                  name="Rental Costs"
                  dataKey="rentalCosts"
                  stackId="b"
                  fill="#9c27b0"
                />
              )}
              <Bar
                name="Profit"
                dataKey="profit"
                fill={COLORS.profit}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Expense Breakdown */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Expense Breakdown
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summaryData.expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {summaryData.expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.pieColors[index % COLORS.pieColors.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle1" gutterBottom>
              Expense Details
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">% of Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryData.expenseBreakdown.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell align="right">{formatCurrency(item.value)}</TableCell>
                      <TableCell align="right">
                        {Math.round((item.value / summaryData.totalExpenses) * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </Box>

      {/* Tips for Financial Optimization */}
      <Box sx={{ mt: 4 }}>
        <Alert
          severity="info"
          icon={<InfoIcon />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Typography variant="subtitle2">Financial Optimization Tips</Typography>
          <Typography variant="body2">
            {summaryData.profitMargin < 20 &&
              "Consider reviewing your property expenses. Your profit margin is below the recommended 20%."}
            {summaryData.profitMargin >= 20 && summaryData.profitMargin < 40 &&
              "Your profit margin is healthy. Look for opportunities to reduce your largest expense categories."}
            {summaryData.profitMargin >= 40 &&
              "Excellent profit margin. Consider investing in additional properties or services."}
          </Typography>
        </Alert>
      </Box>
    </Paper>
  );
}

export default NetEarningsSection;
