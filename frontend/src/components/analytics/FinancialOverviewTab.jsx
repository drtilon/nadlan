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
  console.log('FinancialOverviewTab received data:', financialData); // Debug log

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

  // FIXED: Handle both API response structures
  const currentMonth = financialData.current_month || {};
  const monthlyOverview = financialData.monthly_overview || financialData.monthly_breakdown || [];
  const yearlySummary = financialData.yearly_summary || {};
  const debugInfo = financialData.debug_info || {};

  // Check if all values are zero to show debug info
  const allZeros = (
    (currentMonth.collected || currentMonth.actual_revenue || 0) === 0 &&
    (currentMonth.net_profit || 0) === 0 &&
    (currentMonth.outstanding || 0) === 0
  );

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
              label={`Year: ${debugInfo.year_queried || selectedYear}`}
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
            value={currentMonth.collected || currentMonth.actual_revenue || 0}
            icon={<AccountBalanceIcon />}
            color={COLORS.success}
            subtitle="From active contracts only"
            isLoading={loading}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <MetricCard
            title="Net Profit This Month"
            value={currentMonth.net_profit || 0}
            icon={<TrendingUpIcon />}
            color={COLORS.primary}
            subtitle="Expected monthly profit"
            isLoading={loading}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <MetricCard
            title="Current Outstanding"
            value={currentMonth.outstanding || 0}
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
          {monthlyOverview && monthlyOverview.length > 0 && (
            <Typography variant="body2" color="textSecondary">
              Total Year: {formatCurrency(
                monthlyOverview.reduce((sum, month) => sum + (month.collected || month.actual_revenue || 0), 0)
              )}
            </Typography>
          )}
        </Box>

        {monthlyOverview && monthlyOverview.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyOverview}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month_name"
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
              {/* Handle both API response formats for revenue */}
              <Line
                type="monotone"
                dataKey="actual_revenue"
                stroke={COLORS.success}
                strokeWidth={3}
                name="Actual Revenue"
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
              <Line
                type="monotone"
                dataKey="expected"
                stroke={COLORS.warning}
                strokeWidth={2}
                strokeDasharray="3 3"
                name="Expected Revenue"
                dot={{ fill: COLORS.warning, strokeWidth: 2, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expected_revenue"
                stroke={COLORS.warning}
                strokeWidth={2}
                strokeDasharray="3 3"
                name="Expected Revenue"
                dot={{ fill: COLORS.warning, strokeWidth: 2, r: 4 }}
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
            Ensure your apartments have active contracts for accurate financial tracking.
          </Typography>
          {yearlySummary && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`Year Total: ${formatCurrency(yearlySummary.total_actual || yearlySummary.total_collected || 0)}`} size="small" />
              <Chip label={`Collection Rate: ${(yearlySummary.average_collection_rate || 0).toFixed(1)}%`} size="small" />
              <Chip label={`Active Contracts: ${yearlySummary.active_contracts || yearlySummary.total_apartments || 0}`} size="small" />
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}

export default FinancialOverviewTab;
