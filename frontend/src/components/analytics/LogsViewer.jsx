// components/LogsViewer.jsx - Redesigned with user-centric activity timeline
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Alert,
  Chip,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Stack,
  LinearProgress,
  Divider,
  Avatar,
  Tooltip,
  Grid,
  Card,
  CardContent,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
  Switch,
  FormControlLabel,
  Collapse,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  DeleteSweep as ClearIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Home as HomeIcon,
  Apartment as ApartmentIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as SuccessIcon,
  Cancel as FailedIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminIcon,
  PersonOutline as UserIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import api from '../../utils/api';
import AssessmentIcon from '@mui/icons-material/Assessment';

// ─── Pagination Actions ──────────────────────────────────────────────────────
function TablePaginationActions({ count, page, rowsPerPage, onPageChange }) {
  const totalPages = Math.ceil(count / rowsPerPage);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton onClick={(e) => onPageChange(e, 0)} disabled={page === 0} size="small">
        <FirstPageIcon fontSize="small" />
      </IconButton>
      <IconButton onClick={(e) => onPageChange(e, page - 1)} disabled={page === 0} size="small">
        <KeyboardArrowLeft fontSize="small" />
      </IconButton>
      <Typography variant="body2" sx={{ mx: 1, minWidth: 80, textAlign: 'center' }}>
        {page + 1} / {totalPages || 1}
      </Typography>
      <IconButton onClick={(e) => onPageChange(e, page + 1)} disabled={page >= totalPages - 1} size="small">
        <KeyboardArrowRight fontSize="small" />
      </IconButton>
      <IconButton onClick={(e) => onPageChange(e, Math.max(0, totalPages - 1))} disabled={page >= totalPages - 1} size="small">
        <LastPageIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ─── Action Config ───────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  create: { icon: AddIcon, color: '#2e7d32', bg: '#e8f5e9', label: 'Created' },
  add: { icon: AddIcon, color: '#2e7d32', bg: '#e8f5e9', label: 'Added' },
  create_individual: { icon: AddIcon, color: '#2e7d32', bg: '#e8f5e9', label: 'Created' },
  add_individual_payment: { icon: PaymentIcon, color: '#2e7d32', bg: '#e8f5e9', label: 'Added Payment' },
  update: { icon: EditIcon, color: '#1565c0', bg: '#e3f2fd', label: 'Updated' },
  edit: { icon: EditIcon, color: '#1565c0', bg: '#e3f2fd', label: 'Edited' },
  delete: { icon: DeleteIcon, color: '#c62828', bg: '#ffebee', label: 'Deleted' },
  login: { icon: LoginIcon, color: '#6a1b9a', bg: '#f3e5f5', label: 'Logged in' },
  logout: { icon: LogoutIcon, color: '#78909c', bg: '#eceff1', label: 'Logged out' },
  list: { icon: ViewIcon, color: '#546e7a', bg: '#eceff1', label: 'Viewed list' },
  view: { icon: ViewIcon, color: '#546e7a', bg: '#eceff1', label: 'Viewed' },
  approve: { icon: SuccessIcon, color: '#2e7d32', bg: '#e8f5e9', label: 'Approved' },
  update_role: { icon: AdminIcon, color: '#e65100', bg: '#fff3e0', label: 'Changed role' },
  change_password: { icon: SecurityIcon, color: '#e65100', bg: '#fff3e0', label: 'Changed password' },
  export: { icon: DownloadIcon, color: '#0277bd', bg: '#e1f5fe', label: 'Exported' },
  import: { icon: DownloadIcon, color: '#0277bd', bg: '#e1f5fe', label: 'Imported' },
};

const ENTITY_CONFIG = {
  apartment: { icon: ApartmentIcon, color: '#1565c0', label: 'Apartment' },
  tenant: { icon: PeopleIcon, color: '#2e7d32', label: 'Tenant' },
  landlord: { icon: BusinessIcon, color: '#6a1b9a', label: 'Landlord' },
  payment: { icon: PaymentIcon, color: '#e65100', label: 'Payment' },
  contract: { icon: AssignmentIcon, color: '#00695c', label: 'Contract' },
  user: { icon: PersonIcon, color: '#37474f', label: 'User' },
  auth: { icon: SecurityIcon, color: '#6a1b9a', label: 'Auth' },
};

const USER_COLORS = [
  '#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100',
  '#00695c', '#283593', '#ad1457', '#4527a0', '#00838f',
];

function getUserColor(userId) {
  if (!userId || userId === 'system') return '#78909c';
  const idx = (typeof userId === 'number' ? userId : String(userId).charCodeAt(0)) % USER_COLORS.length;
  return USER_COLORS[idx];
}

// ─── Main Component ──────────────────────────────────────────────────────────
function LogsViewer({ showNotification }) {
  const theme = useTheme();

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [viewMode, setViewMode] = useState('activity');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);

  // UI
  const [expandedCards, setExpandedCards] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Metadata
  const [users, setUsers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, userFilter, viewMode, entityFilter, actionFilter, activeTab]);

  // Fetch logs
  const fetchLogs = useCallback(async (pageNum = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', rowsPerPage.toString());

      if (viewMode !== 'all') params.append('type', viewMode);
      if (entityFilter !== 'all') params.append('entity_type', entityFilter);
      if (userFilter !== 'all') params.append('user_id', userFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

      if (activeTab === 1) params.append('hours', '1');
      else if (activeTab === 2) params.append('hours', '24');
      else if (activeTab === 3) params.append('hours', '168');

      const [logsResponse, usersResponse] = await Promise.all([
        api.get(`/logs?${params.toString()}`),
        users.length === 0 ? api.get('/adminPanel/users') : Promise.resolve({ data: users })
      ]);

      const responseData = logsResponse.data;
      const logsData = Array.isArray(responseData) ? responseData : responseData.logs || [];
      const total = responseData.total || logsData.length;
      const metadata = responseData.metadata || {};

      setLogs(logsData);
      setTotalCount(total);

      if (metadata.entityTypes) setEntityTypes(metadata.entityTypes);
      if (metadata.actionTypes) setActionTypes(metadata.actionTypes);
      if (users.length === 0) setUsers(usersResponse.data || []);

    } catch (error) {
      console.error('Error fetching logs:', error);
      showNotification('Error fetching log data', 'error');
    } finally {
      setLoading(false);
      if (initialLoading) setInitialLoading(false);
    }
  }, [page, rowsPerPage, viewMode, userFilter, entityFilter, actionFilter, activeTab, debouncedSearchTerm, users.length, initialLoading]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => fetchLogs(), 10000);
      setRefreshInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    return () => { if (refreshInterval) clearInterval(refreshInterval); };
  }, [autoRefresh, fetchLogs]);

  // Handlers
  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) return;
    setLoading(true);
    try {
      await api.delete(`/logs?type=${viewMode}`);
      showNotification('Logs cleared successfully', 'success');
      fetchLogs();
    } catch (error) {
      showNotification('Error clearing logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = async (format = 'json') => {
    try {
      setIsDownloading(true);
      const params = new URLSearchParams();
      params.append('limit', '10000');
      if (viewMode !== 'all') params.append('type', viewMode);
      if (entityFilter !== 'all') params.append('entity_type', entityFilter);
      if (userFilter !== 'all') params.append('user_id', userFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);

      const response = await api.get(`/logs?${params.toString()}`);
      const allLogs = Array.isArray(response.data) ? response.data : response.data.logs || [];

      let content, filename, mimeType;
      if (format === 'json') {
        content = JSON.stringify(allLogs, null, 2);
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'status', 'user', 'details'];
        const csvRows = [headers.join(',')];
        for (const log of allLogs) {
          csvRows.push([
            log.timestamp || '', log.action || '', log.entity_type || '',
            log.entity_id || '', log.status || '',
            log.user ? log.user.username : '',
            log.details ? JSON.stringify(log.details).replace(/,/g, ';') : ''
          ].join(','));
        }
        content = csvRows.join('\n');
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('Logs downloaded successfully', 'success');
    } catch (error) {
      showNotification('Error downloading logs', 'error');
    } finally {
      setIsDownloading(false);
      setAnchorEl(null);
    }
  };

  const copyLogToClipboard = (log) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      showNotification('Log copied to clipboard', 'success');
    } catch {
      showNotification('Error copying log', 'error');
    }
  };

  // ─── Helper Renderers ──────────────────────────────────────────────────────

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let relative;
      if (mins < 1) relative = 'just now';
      else if (mins < 60) relative = `${mins}m ago`;
      else if (hours < 24) relative = `${hours}h ago`;
      else if (days < 7) relative = `${days}d ago`;
      else relative = date.toLocaleDateString();

      return {
        relative,
        full: date.toLocaleString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: date.toLocaleDateString(),
      };
    } catch {
      return { relative: timestamp, full: timestamp, time: '', date: '' };
    }
  };

  const getActionConfig = (action) => {
    return ACTION_CONFIG[action?.toLowerCase()] || {
      icon: InfoIcon,
      color: '#546e7a',
      bg: '#eceff1',
      label: action || 'Unknown'
    };
  };

  const getEntityConfig = (entityType) => {
    return ENTITY_CONFIG[entityType?.toLowerCase()] || {
      icon: InfoIcon,
      color: '#546e7a',
      label: entityType || 'Unknown'
    };
  };

  const buildDescription = (log) => {
    const action = log.action?.toLowerCase() || '';
    const entityConfig = getEntityConfig(log.entity_type);
    const entityLabel = entityConfig.label;
    const details = log.details || {};

    // Use the pre-built message if it's meaningful and doesn't start with "system"
    if (log.message && !log.message.toLowerCase().startsWith('system performed')) {
      // Clean up the message - remove the username prefix since we show it separately
      const username = log.user?.username || '';
      let msg = log.message;
      if (username && msg.startsWith(username + ' ')) {
        msg = msg.substring(username.length + 1);
      }
      // Capitalize first letter
      return msg.charAt(0).toUpperCase() + msg.slice(1);
    }

    // Build description from components
    const actionConfig = getActionConfig(action);
    let desc = actionConfig.label;

    if (log.entity_type && action !== 'login' && action !== 'logout') {
      desc += ` ${entityLabel}`;
    }

    if (log.entity_id && action !== 'login' && action !== 'logout') {
      desc += ` #${log.entity_id}`;
    }

    // Add contextual details
    const extras = [];
    if (details.tenant_name) extras.push(details.tenant_name);
    if (details.apartment_address) extras.push(details.apartment_address);
    if (details.amount) extras.push(`Amount: ${details.amount}`);
    if (details.contract_number) extras.push(`Contract: ${details.contract_number}`);
    if (details.reason) extras.push(details.reason);

    if (extras.length > 0) {
      desc += ` - ${extras.join(', ')}`;
    }

    return desc;
  };

  // ─── Group logs by date ────────────────────────────────────────────────────
  const groupedLogs = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      const ts = formatTimestamp(log.timestamp);
      const dateKey = ts.date || 'Unknown Date';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return groups;
  }, [logs]);

  // ─── Render: Activity Card ─────────────────────────────────────────────────
  const renderActivityCard = (log, index) => {
    const logId = log.id || `${page}-${index}`;
    const isExpanded = expandedCards[logId] || false;
    const actionConfig = getActionConfig(log.action);
    const entityConfig = getEntityConfig(log.entity_type);
    const ActionIcon = actionConfig.icon;
    const EntityIcon = entityConfig.icon;
    const ts = formatTimestamp(log.timestamp);
    const username = log.user?.username || 'System';
    const userColor = getUserColor(log.user?.id);
    const isFailed = log.status === 'failed';
    const description = buildDescription(log);

    return (
      <Box key={logId} sx={{ position: 'relative', pl: { xs: 2, sm: 6 }, mb: 0.5 }}>
        {/* Timeline dot */}
        <Box sx={{
          display: { xs: 'none', sm: 'flex' },
          position: 'absolute',
          left: 20,
          top: 16,
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: isFailed ? '#ffebee' : actionConfig.bg,
          border: `2px solid ${isFailed ? '#c62828' : actionConfig.color}`,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <ActionIcon sx={{ fontSize: 14, color: isFailed ? '#c62828' : actionConfig.color }} />
        </Box>

        {/* Card */}
        <Paper
          variant="outlined"
          onClick={() => toggleCard(logId)}
          sx={{
            p: 1.5,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            borderColor: isExpanded ? actionConfig.color : 'divider',
            borderLeft: `3px solid ${isFailed ? '#c62828' : actionConfig.color}`,
            bgcolor: isExpanded
              ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)')
              : 'background.paper',
            '&:hover': {
              borderColor: actionConfig.color,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.015)',
            },
          }}
        >
          {/* Main row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            {/* User avatar */}
            <Tooltip title={`${username} (${log.user?.role || 'unknown'})`}>
              <Avatar sx={{
                width: 32,
                height: 32,
                bgcolor: userColor,
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
                mt: 0.25,
              }}>
                {username.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Top line: user + action description */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.25 }}>
                <Typography variant="body2" fontWeight={600} sx={{ color: userColor }}>
                  {username}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 100,
                }}>
                  {description}
                </Typography>
              </Box>

              {/* Bottom line: chips + time */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {log.entity_type && (
                  <Chip
                    icon={<EntityIcon sx={{ fontSize: '14px !important' }} />}
                    label={entityConfig.label}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      bgcolor: `${entityConfig.color}14`,
                      color: entityConfig.color,
                      border: `1px solid ${entityConfig.color}30`,
                      '& .MuiChip-icon': { color: entityConfig.color },
                    }}
                  />
                )}
                {isFailed && (
                  <Chip
                    icon={<FailedIcon sx={{ fontSize: '14px !important' }} />}
                    label="Failed"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      bgcolor: '#ffebee',
                      color: '#c62828',
                      border: '1px solid #ef9a9a',
                      '& .MuiChip-icon': { color: '#c62828' },
                    }}
                  />
                )}
                {log.entity_id && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                    ID: {log.entity_id}
                  </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Tooltip title={ts.full}>
                  <Typography variant="caption" color="text.disabled" sx={{
                    display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem', whiteSpace: 'nowrap',
                  }}>
                    <ScheduleIcon sx={{ fontSize: 12 }} />
                    {ts.relative}
                  </Typography>
                </Tooltip>
              </Box>
            </Box>

            {/* Expand icon */}
            <IconButton size="small" sx={{ mt: -0.5, opacity: 0.4 }}>
              <ExpandMoreIcon sx={{
                fontSize: 18,
                transform: isExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }} />
            </IconButton>
          </Box>

          {/* Expanded details */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={2}>
                {/* Left: Event info */}
                <Grid item xs={12} md={6}>
                  <Stack spacing={1}>
                    <DetailRow label="Timestamp" value={ts.full} />
                    <DetailRow label="Action" value={
                      <Chip
                        icon={<ActionIcon sx={{ fontSize: '14px !important' }} />}
                        label={actionConfig.label}
                        size="small"
                        sx={{
                          bgcolor: isFailed ? '#ffebee' : actionConfig.bg,
                          color: isFailed ? '#c62828' : actionConfig.color,
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: isFailed ? '#c62828' : actionConfig.color },
                        }}
                      />
                    } />
                    {log.entity_type && (
                      <DetailRow label="Entity" value={`${entityConfig.label}${log.entity_id ? ` #${log.entity_id}` : ''}`} />
                    )}
                    <DetailRow label="User" value={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 20, height: 20, bgcolor: userColor, fontSize: '0.65rem' }}>
                          {username.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{username}</Typography>
                        {log.user?.role && (
                          <Chip label={log.user.role} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    } />
                    <DetailRow label="Status" value={
                      <Chip
                        icon={isFailed ? <FailedIcon sx={{ fontSize: '14px !important' }} /> : <SuccessIcon sx={{ fontSize: '14px !important' }} />}
                        label={log.status || 'success'}
                        size="small"
                        color={isFailed ? 'error' : 'success'}
                        variant="outlined"
                        sx={{ '& .MuiChip-icon': { color: 'inherit' } }}
                      />
                    } />
                    {log.ip_address && <DetailRow label="IP Address" value={log.ip_address} />}
                  </Stack>
                </Grid>

                {/* Right: Details JSON */}
                <Grid item xs={12} md={6}>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                        Details
                      </Typography>
                      <Paper variant="outlined" sx={{
                        p: 1.5,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8f9fa',
                        maxHeight: 200,
                        overflow: 'auto',
                      }}>
                        {Object.entries(log.details).map(([key, value]) => (
                          <Box key={key} sx={{ display: 'flex', gap: 1, mb: 0.5, fontSize: '0.8rem' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100, fontWeight: 500 }}>
                              {key.replace(/_/g, ' ')}:
                            </Typography>
                            <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </Typography>
                          </Box>
                        ))}
                      </Paper>
                    </Box>
                  )}

                  {/* App log message */}
                  {log.log_type === 'app' && log.message && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                        Message
                      </Typography>
                      <Paper variant="outlined" sx={{
                        p: 1.5,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8f9fa',
                        maxHeight: 200,
                        overflow: 'auto',
                      }}>
                        <Typography variant="body2" component="pre" sx={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem', m: 0,
                        }}>
                          {log.message}
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* Error info */}
                  {(log.error || log.stack_trace) && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="error" fontWeight={600} gutterBottom sx={{ display: 'block', mb: 0.5 }}>
                        Error Details
                      </Typography>
                      <Paper variant="outlined" sx={{
                        p: 1.5, bgcolor: '#fff5f5', borderColor: '#ffcdd2', maxHeight: 150, overflow: 'auto',
                      }}>
                        <Typography variant="body2" component="pre" sx={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem', m: 0, color: '#c62828',
                        }}>
                          {log.error || ''}{log.stack_trace ? `\n${log.stack_trace}` : ''}
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </Grid>
              </Grid>

              {/* Copy button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  size="small"
                  startIcon={<CopyIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={(e) => { e.stopPropagation(); copyLogToClipboard(log); }}
                  sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                >
                  Copy raw log
                </Button>
              </Box>
            </Box>
          </Collapse>
        </Paper>
      </Box>
    );
  };

  // ─── Render: App Log Card (for app logs view) ──────────────────────────────
  const renderAppLogCard = (log, index) => {
    const logId = log.id || `${page}-${index}`;
    const isExpanded = expandedCards[logId] || false;
    const ts = formatTimestamp(log.timestamp);
    const level = (log.level || 'info').toLowerCase();

    const levelConfig = {
      error: { color: '#c62828', bg: '#ffebee', icon: ErrorIcon },
      warning: { color: '#e65100', bg: '#fff3e0', icon: WarningIcon },
      info: { color: '#1565c0', bg: '#e3f2fd', icon: InfoIcon },
    };
    const cfg = levelConfig[level] || levelConfig.info;
    const LevelIcon = cfg.icon;

    return (
      <Box key={logId} sx={{ mb: 0.5 }}>
        <Paper
          variant="outlined"
          onClick={() => toggleCard(logId)}
          sx={{
            p: 1.5,
            cursor: 'pointer',
            borderLeft: `3px solid ${cfg.color}`,
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.015)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<LevelIcon sx={{ fontSize: '14px !important' }} />}
              label={level.toUpperCase()}
              size="small"
              sx={{
                height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: cfg.bg, color: cfg.color,
                '& .MuiChip-icon': { color: cfg.color },
              }}
            />
            <Typography variant="body2" color="text.primary" sx={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {log.message || 'No message'}
            </Typography>
            {log.logger && (
              <Chip label={log.logger} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            )}
            <Tooltip title={ts.full}>
              <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                {ts.relative}
              </Typography>
            </Tooltip>
          </Box>

          <Collapse in={isExpanded}>
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <Paper variant="outlined" sx={{
                p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8f9fa',
              }}>
                <Typography variant="body2" component="pre" sx={{
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.75rem', m: 0,
                }}>
                  {log.message}
                </Typography>
              </Paper>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.disabled">{ts.full}</Typography>
                <Button
                  size="small"
                  startIcon={<CopyIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={(e) => { e.stopPropagation(); copyLogToClipboard(log); }}
                  sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                >
                  Copy
                </Button>
              </Box>
            </Box>
          </Collapse>
        </Paper>
      </Box>
    );
  };

  // ─── LOADING STATE ─────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <TimelineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={600}>Activity Log</Typography>
          </Box>
          <Stack spacing={1}>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        </Paper>
      </Container>
    );
  }

  // ─── MAIN RENDER ───────────────────────────────────────────────────────────
  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      {/* Header */}
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TimelineIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={600}>Activity Log</Typography>
            <Chip
              label={`${totalCount} entries`}
              size="small"
              sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} size="small" />}
              label={<Typography variant="caption">Auto-refresh</Typography>}
              sx={{ mr: 0 }}
            />
            <IconButton size="small" onClick={() => fetchLogs()} disabled={loading} title="Refresh">
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} title="More options">
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={() => downloadLogs('json')} disabled={isDownloading}>
                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Download JSON</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => downloadLogs('csv')} disabled={isDownloading}>
                <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Download CSV</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleClearLogs} disabled={loading}>
                <ListItemIcon><ClearIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Clear Logs</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Log type tabs */}
        <Tabs
          value={viewMode === 'activity' ? 0 : viewMode === 'app' ? 1 : 2}
          onChange={(e, val) => setViewMode(val === 0 ? 'activity' : val === 1 ? 'app' : 'all')}
          sx={{ mt: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none', fontSize: '0.85rem' } }}
        >
          <Tab icon={<PeopleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="User Activity" />
          <Tab icon={<AssessmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="App Logs" />
          <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="All" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        {/* Search + toggle filters */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 20 }} /></InputAdornment>,
            }}
          />

          {/* Time period pills */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {['All Time', '1h', '24h', '7d'].map((label, idx) => (
              <Chip
                key={idx}
                label={label}
                size="small"
                onClick={() => setActiveTab(idx)}
                sx={{
                  fontWeight: activeTab === idx ? 600 : 400,
                  bgcolor: activeTab === idx ? 'primary.main' : 'transparent',
                  color: activeTab === idx ? 'white' : 'text.secondary',
                  border: activeTab === idx ? 'none' : '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: activeTab === idx ? 'primary.dark' : 'action.hover' },
                }}
              />
            ))}
          </Box>

          <Button
            size="small"
            startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters ? 'contained' : 'outlined'}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Filters
          </Button>
        </Box>

        {/* Advanced filters */}
        <Collapse in={showFilters}>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>User</InputLabel>
              <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} label="User">
                <MenuItem value="all">All Users</MenuItem>
                {users.map(user => (
                  <MenuItem key={user.id} value={user.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 20, height: 20, bgcolor: getUserColor(user.id), fontSize: '0.6rem' }}>
                        {(user.username || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      {user.username || `ID: ${user.id}`}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {viewMode !== 'app' && (
              <>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Entity</InputLabel>
                  <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} label="Entity">
                    <MenuItem value="all">All Types</MenuItem>
                    {entityTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        {(ENTITY_CONFIG[type?.toLowerCase()]?.label) || type.charAt(0).toUpperCase() + type.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Action</InputLabel>
                  <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} label="Action">
                    <MenuItem value="all">All Actions</MenuItem>
                    {actionTypes.map(action => (
                      <MenuItem key={action} value={action}>
                        {(ACTION_CONFIG[action?.toLowerCase()]?.label) || action.charAt(0).toUpperCase() + action.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {/* Active filters chips */}
            {(userFilter !== 'all' || entityFilter !== 'all' || actionFilter !== 'all') && (
              <Button
                size="small"
                onClick={() => { setUserFilter('all'); setEntityFilter('all'); setActionFilter('all'); }}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'error.main' }}
              >
                Clear filters
              </Button>
            )}
          </Box>
        </Collapse>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}

      {/* Logs content */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {totalCount === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <TimelineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No logs found matching your criteria
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 1.5 }}>
            {/* Timeline connector line */}
            <Box sx={{ position: 'relative' }}>
              <Box sx={{
                display: { xs: 'none', sm: 'block' },
                position: 'absolute',
                left: 33,
                top: 0,
                bottom: 0,
                width: 2,
                bgcolor: 'divider',
                zIndex: 0,
              }} />

              {viewMode === 'app' ? (
                // App logs: simple list
                logs.map((log, index) => renderAppLogCard(log, index))
              ) : (
                // Activity logs: grouped by date with timeline
                Object.entries(groupedLogs).map(([date, dateLogs]) => (
                  <Box key={date}>
                    {/* Date header */}
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      pl: { xs: 0, sm: 6 },
                      position: 'relative',
                    }}>
                      <Box sx={{
                        display: { xs: 'none', sm: 'flex' },
                        position: 'absolute',
                        left: 16,
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}>
                        <TimeIcon sx={{ fontSize: 18, color: 'white' }} />
                      </Box>
                      <Chip
                        label={date}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontSize: '0.75rem',
                        }}
                      />
                      <Divider sx={{ flex: 1 }} />
                    </Box>

                    {dateLogs.map((log, index) => renderActivityCard(log, index))}
                  </Box>
                ))
              )}
            </Box>
          </Box>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa',
          }}>
            <Typography variant="caption" color="text.secondary">
              {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalCount)} of {totalCount}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <Select value={rowsPerPage} onChange={handleChangeRowsPerPage} variant="outlined" sx={{ fontSize: '0.8rem' }}>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>

              <TablePaginationActions
                count={totalCount}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={handleChangePage}
              />
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

// ─── Detail Row Helper ───────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, fontWeight: 500, mt: 0.25 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>
        {typeof value === 'string' ? (
          <Typography variant="body2">{value}</Typography>
        ) : value}
      </Box>
    </Box>
  );
}

export default LogsViewer;
