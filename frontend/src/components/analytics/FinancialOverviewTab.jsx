// src/components/FinancialOverviewTab.jsx - SIMPLIFIED VERSION
import React from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

function FinancialOverviewTab({ loading, financialData, selectedYear }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!financialData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Typography variant="body1" color="textSecondary">
          No financial data available
        </Typography>
      </Box>
    );
  }

  // Calculate current month outstanding
  const currentMonthOutstanding = financialData.outstanding?.total_amount || 0;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Key Metrics Cards - Only 3 cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', borderRadius: 3, boxShadow: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.success }}>
              {formatCurrency(financialData.current_month?.collected || 0)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Current Month Collected
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', borderRadius: 3, boxShadow: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.primary }}>
              {formatCurrency(financialData.current_month?.net_profit || 0)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Net Profit Should be This Month
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', borderRadius: 3, boxShadow: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: COLORS.error }}>
              {formatCurrency(currentMonthOutstanding)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Current Month Outstanding
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Monthly Trend Chart - Only the payments graph */}
      <Card sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
          Monthly Collection Trends ({selectedYear})
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={financialData.monthly_breakdown || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(1)}k`} />
            <Tooltip formatter={(value) => [formatCurrency(value), '']} />
            <Legend />
            <Line
              type="monotone"
              dataKey="collected"
              stroke={COLORS.success}
              strokeWidth={2}
              name="Monthly Collections"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </Box>
  );
}

export default FinancialOverviewTab;
