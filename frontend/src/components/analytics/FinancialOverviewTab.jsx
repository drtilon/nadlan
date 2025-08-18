// src/components/FinancialOverviewTab.jsx - COMPLETE FIXED VERSION
import React from 'react';
import {
  Box,
  Typography,
  Card,
  Grid,
  CircularProgress,
  Alert,
  Chip,
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
import {
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

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

const MetricCard = ({ title, value, icon, color, subtitle, isLoading }) => (
  <Card sx={{ p: 3, textAlign: 'center', borderRadius: 3, boxShadow: 3, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
      <Box sx={{ mr: 1, color: color }}>
        {icon}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {title}
      </Typography>
    </Box>

    {isLoading ? (
      <CircularProgress size={24} />
    ) : (
      <>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color, mb: 1 }}>
          {formatCurrency(value)}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </>
    )}
  </Card>
);

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

  // Check if all values are zero to show debug info
  const allZeros = (
    (financialData.current_month?.collected || 0) === 0 &&
    (financialData.current_month?.net_profit || 0) === 0 &&
    (financialData.current_month?.outstanding || 0) === 0
  );

  // Debug information
  const debugInfo = financialData.debug_info;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Debug Info Card - Show when all values are zero */}
      {allZeros && debugInfo && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          icon={<InfoIcon />}
        >
          <Typography variant="h6" sx={{ mb: 1 }}>
            Debug Information
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`Total Apartments: ${debugInfo.total_apartments}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`With Contracts: ${debugInfo.apartments_with_contracts}`}
              size="small"
              variant="outlined"
              color={debugInfo.apartments_with_contracts > 0 ? "success" : "error"}
            />
            <Chip
              label={`With Payments: ${debugInfo.apartments_with_payments}`}
              size="small"
              variant="outlined"
              color={debugInfo.apartments_with_payments > 0 ? "success" : "error"}
            />
            <Chip
              label={`Year: ${debugInfo.year_queried}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Month: ${debugInfo.current_month}`}
              size="small"
              variant="outlined"
            />
          </Box>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {debugInfo.apartments_with_contracts === 0 &&
              "No apartments have active contract periods. Payments are only counted for apartments with active contracts."
            }
            {debugInfo.apartments_with_contracts > 0 && debugInfo.apartments_with_payments === 0 &&
              "Apartments have contracts but no payments found for the current period."
            }
          </Typography>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Current Month Collected"
            value={financialData.current_month?.collected || 0}
            icon={<AccountBalanceIcon />}
            color={COLORS.success}
            subtitle="From active contracts only"
            isLoading={loading}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <MetricCard
            title="Net Profit This Month"
            value={financialData.current_month?.net_profit || 0}
            icon={<TrendingUpIcon />}
            color={COLORS.primary}
            subtitle="Expected monthly profit from management and rental model"
            isLoading={loading}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <MetricCard
            title="Current Month Outstanding"
            value={financialData.current_month?.outstanding || 0}
            icon={<WarningIcon />}
            color={COLORS.error}
            subtitle="Across all active contracts"
            isLoading={loading}
          />
        </Grid>
      </Grid>

      {/* Monthly Trend Chart */}
      <Card sx={{ p: 3, borderRadius: 3, boxShadow: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Monthly Collection Trends ({selectedYear})
          </Typography>
          {financialData.monthly_breakdown && (
            <Typography variant="body2" color="textSecondary">
              Total Year: {formatCurrency(
                financialData.monthly_breakdown.reduce((sum, month) => sum + (month.collected || 0), 0)
              )}
            </Typography>
          )}
        </Box>

        {financialData.monthly_breakdown && financialData.monthly_breakdown.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={financialData.monthly_breakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tickFormatter={(value) => `€${(value / 1000).toFixed(1)}k`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(value), name]}
                labelStyle={{ color: '#333' }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="collected"
                stroke={COLORS.success}
                strokeWidth={3}
                name="Monthly Collections"
                dot={{ fill: COLORS.success, strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: COLORS.success, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="net_profit"
                stroke={COLORS.primary}
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Expected Profit"
                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography variant="body1" color="textSecondary">
              No monthly data available for chart
            </Typography>
          </Box>
        )}
      </Card>

      {/* Additional Info Card */}
      {debugInfo && (
        <Card sx={{ p: 2, mt: 3, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
          <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center' }}>
            <strong>Contract Period System:</strong> This dashboard only counts payments that belong to active contract periods.
            Ensure your apartments have active contracts (like "APT3-2025-08") for accurate financial tracking.
          </Typography>
        </Card>
      )}
    </Box>
  );
}

export default FinancialOverviewTab;
