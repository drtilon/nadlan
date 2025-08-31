// components/LogsViewer.jsx - Optimized with pagination and performance improvements
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  CardHeader,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  Skeleton,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DeleteSweep as ClearIcon,
  Person as PersonIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Source as SourceIcon,
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
  FilterAlt as AdvancedFilterIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight
} from '@mui/icons-material';
import api from '../../utils/api';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// Custom pagination actions component
function TablePaginationActions(props) {
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label="first page"
      >
        <FirstPageIcon />
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <KeyboardArrowLeft />
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        <KeyboardArrowRight />
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="last page"
      >
        <LastPageIcon />
      </IconButton>
    </Box>
  );
}

function LogsViewer({ showNotification }) {
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  // Data state
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [viewMode, setViewMode] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  
  // UI state
  const [expandedRows, setExpandedRows] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [logDetailsOpen, setLogDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Metadata state
  const [users, setUsers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [logStats, setLogStats] = useState(null);

  // Debounce search term to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchTerm, logLevel, userFilter, viewMode, entityFilter, actionFilter, activeTab]);

  // Fetch logs with pagination
  const fetchLogs = useCallback(async (pageNum = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Pagination parameters
      params.append('page', pageNum.toString());
      params.append('limit', rowsPerPage.toString());
      
      // Filter parameters
      if (viewMode !== 'all') {
        params.append('type', viewMode);
      }
      
      if (logLevel !== 'all') {
        params.append('level', logLevel);
      }
      
      if (entityFilter !== 'all') {
        params.append('entity_type', entityFilter);
      }
      
      if (userFilter !== 'all') {
        params.append('user_id', userFilter);
      }
      
      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }
      
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      
      // Time period filters
      if (activeTab === 1) {
        params.append('hours', '1');
      } else if (activeTab === 2) {
        params.append('hours', '24');
      } else if (activeTab === 3) {
        params.append('hours', '168'); // 7 days
      }

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
      
      // Update filter options if metadata is available
      if (metadata.entityTypes) {
        setEntityTypes(metadata.entityTypes);
      }
      if (metadata.actionTypes) {
        setActionTypes(metadata.actionTypes);
      }
      
      // Set users for filtering
      if (users.length === 0) {
        setUsers(usersResponse.data || []);
      }
      
    } catch (error) {
      console.error('Error fetching logs:', error);
      showNotification('Error fetching log data', 'error');
    } finally {
      setLoading(false);
      if (initialLoading) {
        setInitialLoading(false);
      }
    }
  }, [page, rowsPerPage, viewMode, logLevel, userFilter, entityFilter, actionFilter, activeTab, debouncedSearchTerm, users.length, initialLoading]);

  // Fetch log statistics
  const fetchLogStats = useCallback(async () => {
    try {
      const response = await api.get('/logs/stats');
      setLogStats(response.data);
    } catch (error) {
      console.error('Error fetching log statistics:', error);
      showNotification('Error fetching log statistics', 'error');
    }
  }, [showNotification]);

  // Initial load
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
        if (showStats) {
          fetchLogStats();
        }
      }, 10000); // Refresh every 10 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh, showStats, fetchLogs, fetchLogStats, refreshInterval]);

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Toggle row expansion
  const toggleRowExpanded = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      await api.delete(`/logs?type=${viewMode}`);
      showNotification(`${viewMode === 'all' ? 'All' : viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} logs cleared successfully`, 'success');
      fetchLogs();
      if (showStats) {
        fetchLogStats();
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      showNotification('Error clearing logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Download logs
  const downloadLogs = async (format = 'json') => {
    try {
      setIsDownloading(true);
      
      // Get all logs for download (without pagination)
      const params = new URLSearchParams();
      params.append('limit', '10000'); // Large limit for export
      
      if (viewMode !== 'all') params.append('type', viewMode);
      if (logLevel !== 'all') params.append('level', logLevel);
      if (entityFilter !== 'all') params.append('entity_type', entityFilter);
      if (userFilter !== 'all') params.append('user_id', userFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      
      const response = await api.get(`/logs?${params.toString()}`);
      const allLogs = Array.isArray(response.data) ? response.data : response.data.logs || [];
      
      // Create file content
      let content;
      let filename;
      let mimeType;
      
      if (format === 'json') {
        content = JSON.stringify(allLogs, null, 2);
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else if (format === 'csv') {
        const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'status', 'user', 'details'];
        const csvRows = [headers.join(',')];
        
        for (const log of allLogs) {
          const row = [
            log.timestamp || '',
            log.action || '',
            log.entity_type || '',
            log.entity_id || '',
            log.status || '',
            log.user ? log.user.username : '',
            log.details ? JSON.stringify(log.details).replace(/,/g, ';') : ''
          ];
          csvRows.push(row.join(','));
        }
        
        content = csvRows.join('\n');
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }
      
      // Create and download file
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
      console.error('Error downloading logs:', error);
      showNotification('Error downloading logs', 'error');
    } finally {
      setIsDownloading(false);
      handleMenuClose();
    }
  };

  // Menu handlers
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Show log details modal
  const showLogDetails = (log) => {
    setSelectedLog(log);
    setLogDetailsOpen(true);
  };

  const closeLogDetails = () => {
    setLogDetailsOpen(false);
    setSelectedLog(null);
  };

  // Copy log to clipboard
  const copyLogToClipboard = (log) => {
    try {
      const logContent = JSON.stringify(log, null, 2);
      navigator.clipboard.writeText(logContent);
      showNotification('Log copied to clipboard', 'success');
    } catch (error) {
      console.error('Error copying log:', error);
      showNotification('Error copying log to clipboard', 'error');
    }
  };

  // Toggle statistics view
  const toggleStatsView = () => {
    const newShowStats = !showStats;
    setShowStats(newShowStats);
    if (newShowStats) {
      fetchLogStats();
    }
  };

  // Helper functions for rendering (same as original)
  const getUserDisplay = (user) => {
    if (!user) return null;
    
    return (
      <Tooltip title={`User ID: ${user.id || 'Unknown'}`}>
        <Chip
          avatar={
            <Avatar sx={{ bgcolor: user.role === 'admin' ? 'primary.main' : 'success.main' }}>
              {user.username ? user.username.charAt(0).toUpperCase() : <PersonIcon fontSize="small" />}
            </Avatar>
          }
          label={user.username || 'Unknown User'}
          size="small"
          variant="outlined"
          color={user.role === 'admin' ? 'primary' : 'success'}
        />
      </Tooltip>
    );
  };

  const getLogLevelChip = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return <Chip icon={<ErrorIcon />} label="Error" size="small" color="error" />;
      case 'warning':
        return <Chip icon={<WarningIcon />} label="Warning" size="small" color="warning" />;
      case 'info':
        return <Chip icon={<InfoIcon />} label="Info" size="small" color="info" />;
      default:
        return <Chip label={level || 'Unknown'} size="small" />;
    }
  };

  const getEntityIcon = (entityType) => {
    switch (entityType?.toLowerCase()) {
      case 'apartment':
        return <ApartmentIcon fontSize="small" />;
      case 'tenant':
        return <PeopleIcon fontSize="small" />;
      case 'landlord':
        return <BusinessIcon fontSize="small" />;
      case 'payment':
        return <PaymentIcon fontSize="small" />;
      case 'contract':
        return <AssignmentIcon fontSize="small" />;
      case 'user':
        return <PersonIcon fontSize="small" />;
      case 'auth':
        return <InfoIcon fontSize="small" />;
      default:
        return <SourceIcon fontSize="small" />;
    }
  };

  const getActionChip = (action, status) => {
    let icon = <InfoIcon fontSize="small" />;
    let color = "primary";
    
    switch (action?.toLowerCase()) {
      case 'create':
      case 'add':
        icon = <AddIcon fontSize="small" />;
        color = "success";
        break;
      case 'update':
      case 'edit':
        icon = <EditIcon fontSize="small" />;
        color = "info";
        break;
      case 'delete':
        icon = <DeleteIcon fontSize="small" />;
        color = "error";
        break;
      case 'login':
        icon = <PersonIcon fontSize="small" />;
        color = "primary";
        break;
      case 'logout':
        icon = <PersonIcon fontSize="small" />;
        color = "default";
        break;
    }
    
    if (status === 'failed') {
      color = "error";
    }
    
    return (
      <Chip 
        icon={icon} 
        label={action} 
        size="small" 
        color={color}
        variant={status === 'failed' ? "outlined" : "filled"}
      />
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  const formatMessage = (log, isExpanded) => {
    if (log.log_type === 'app' && log.message) {
      if (!isExpanded && log.message.length > 80) {
        return `${log.message.substring(0, 80)}...`;
      }
      return log.message;
    }
    
    if (log.log_type === 'activity') {
      const entity = log.entity_type ? log.entity_type : 'unknown';
      const entityId = log.entity_id ? log.entity_id : '';
      const action = log.action ? log.action : 'performed action on';
      const status = log.status ? (log.status === 'failed' ? 'failed to' : '') : '';
      
      return `${status} ${action} ${entity} ${entityId}`;
    }
    
    return log.message || 'No message';
  };

  const getPrimaryColumn = (log) => {
    if (log.log_type === 'app') {
      return (
        <TableCell sx={{ wordBreak: 'break-word' }}>
          {formatMessage(log, expandedRows[log.id])}
        </TableCell>
      );
    } else {
      return (
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getActionChip(log.action, log.status)}
            <Typography variant="body2" sx={{ ml: 1 }}>
              {log.entity_type && (
                <Chip
                  icon={getEntityIcon(log.entity_type)}
                  label={log.entity_type}
                  size="small"
                  variant="outlined"
                />
              )}
              {log.entity_id && (
                <Typography component="span" variant="body2" sx={{ ml: 1 }}>
                  ID: {log.entity_id}
                </Typography>
              )}
            </Typography>
          </Box>
        </TableCell>
      );
    }
  };

  // Memoized pagination info
  const paginationInfo = useMemo(() => {
    const start = page * rowsPerPage + 1;
    const end = Math.min((page + 1) * rowsPerPage, totalCount);
    return `${start}-${end} of ${totalCount}`;
  }, [page, rowsPerPage, totalCount]);

  if (initialLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <AssessmentIcon sx={{ fontSize: 32 }} />
            <Typography variant="h4">System Activity Logs!</Typography>
          </Box>
          
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={60} />
            <Skeleton variant="rectangular" height={40} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton variant="rectangular" width={200} height={40} />
              <Skeleton variant="rectangular" width={150} height={40} />
              <Skeleton variant="rectangular" width={150} height={40} />
            </Box>
            {[...Array(10)].map((_, index) => (
              <Skeleton key={index} variant="rectangular" height={60} />
            ))}
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ fontSize: 32 }} /> System Activity Logs
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label="Auto-refresh"
            />
            
            <Button
              variant="outlined"
              startIcon={<AnalyticsIcon />}
              onClick={toggleStatsView}
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchLogs()}
              disabled={loading}
            >
              Refresh
            </Button>
            
            <Button
              variant="outlined"
              color="primary"
              startIcon={<MoreVertIcon />}
              onClick={handleMenuOpen}
            >
              Options
            </Button>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={() => downloadLogs('json')} disabled={isDownloading}>
                <ListItemIcon>
                  <DownloadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Download as JSON</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => downloadLogs('csv')} disabled={isDownloading}>
                <ListItemIcon>
                  <DownloadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Download as CSV</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleClearLogs} disabled={loading}>
                <ListItemIcon>
                  <ClearIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Clear Logs</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        
        {/* Log Statistics Panel */}
        {showStats && logStats && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Log Statistics</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardHeader title="Log Counts" />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Application Logs:</Typography>
                        <Typography fontWeight="bold">{logStats.total_logs.app}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Activity Logs:</Typography>
                        <Typography fontWeight="bold">{logStats.total_logs.activity}</Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Total Logs:</Typography>
                        <Typography fontWeight="bold">{logStats.total_logs.total}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardHeader title="Most Active Users" />
                  <CardContent>
                    <Stack spacing={1}>
                      {logStats.user_activity && logStats.user_activity.slice(0, 5).map((user, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '0.75rem' }}>
                              {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                            </Avatar>
                            <Typography variant="body2">{user.username}</Typography>
                          </Box>
                          <Chip 
                            label={user.total_actions} 
                            size="small" 
                            color="primary"
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardHeader title="Actions by Entity Type" />
                  <CardContent>
                    <Stack spacing={1}>
                      {logStats.entity_distribution && Object.entries(logStats.entity_distribution)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([entity, count], index) => (
                          <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getEntityIcon(entity)}
                              <Typography variant="body2" sx={{ ml: 1 }}>{entity}</Typography>
                            </Box>
                            <Chip 
                              label={count} 
                              size="small" 
                              color="secondary"
                            />
                          </Box>
                        ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        )}
        
        {/* Filters */}
        <Box sx={{ mb: 3 }}>
          <Tabs 
            value={viewMode === 'all' ? 0 : viewMode === 'app' ? 1 : 2}
            onChange={(e, val) => setViewMode(val === 0 ? 'all' : val === 1 ? 'app' : 'activity')}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab label="All Logs" />
            <Tab label="Application Logs" />
            <Tab label="User Activity" />
          </Tabs>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                placeholder="Search logs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>User</InputLabel>
                <Select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  label="User"
                >
                  <MenuItem value="all">All Users</MenuItem>
                  {users.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.username || `ID: ${user.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {viewMode === 'activity' && (
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Entity Type</InputLabel>
                  <Select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    label="Entity Type"
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    {entityTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {viewMode === 'activity' && (
              <Grid item xs={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    label="Action"
                  >
                    <MenuItem value="all">All Actions</MenuItem>
                    {actionTypes.map(action => (
                      <MenuItem key={action} value={action}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Box>
        
        {/* Time period tabs */}
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="All Time" />
            <Tab label="Last Hour" />
            <Tab label="Last 24 Hours" />
            <Tab label="Last 7 Days" />
          </Tabs>
        </Box>
        
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        
        {/* Pagination Info */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {paginationInfo}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Rows per page:
            </Typography>
            <FormControl size="small">
              <Select
                value={rowsPerPage}
                onChange={handleChangeRowsPerPage}
                variant="outlined"
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
        
        {totalCount === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No logs found matching your criteria.
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width="18%">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarIcon fontSize="small" />
                        Timestamp
                      </Box>
                    </TableCell>
                    
                    {viewMode !== 'activity' && (
                      <TableCell width="12%">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ErrorIcon fontSize="small" />
                          Level
                        </Box>
                      </TableCell>
                    )}
                    
                    <TableCell width="15%">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" />
                        User
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      {viewMode === 'activity' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <InfoIcon fontSize="small" />
                          Action / Entity
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SourceIcon fontSize="small" />
                          Message
                        </Box>
                      )}
                    </TableCell>
                    
                    <TableCell align="right" width="5%">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log, index) => {
                    const logId = log.id || `${page}-${index}`;
                    const isExpanded = expandedRows[logId] || false;
                    
                    return (
                      <React.Fragment key={logId}>
                        <TableRow 
                          hover 
                          sx={{ 
                            cursor: 'pointer',
                            bgcolor: isExpanded ? 'action.hover' : 'inherit'
                          }}
                          onClick={() => toggleRowExpanded(logId)}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          
                          {viewMode !== 'activity' && (
                            <TableCell>{getLogLevelChip(log.level)}</TableCell>
                          )}
                          
                          <TableCell>{getUserDisplay(log.user) || 'System'}</TableCell>
                          
                          {getPrimaryColumn(log)}
                          
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpanded(logId);
                              }}
                            >
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyLogToClipboard(log);
                              }}
                              title="Copy log details"
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={viewMode === 'activity' ? 4 : 5} sx={{ bgcolor: 'rgba(0, 0, 0, 0.02)', p: 0 }}>
                              <Box sx={{ p: 3 }}>
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      Event Details
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                                      <Stack spacing={1.5}>
                                        <Box>
                                          <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                                          <Typography variant="body2">{formatTimestamp(log.timestamp)}</Typography>
                                        </Box>
                                        
                                        {log.level && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Level</Typography>
                                            <Box>{getLogLevelChip(log.level)}</Box>
                                          </Box>
                                        )}
                                        
                                        {log.logger && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Source</Typography>
                                            <Typography variant="body2">{log.logger}</Typography>
                                          </Box>
                                        )}
                                        
                                        {log.action && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Action</Typography>
                                            <Box>{getActionChip(log.action, log.status)}</Box>
                                          </Box>
                                        )}
                                        
                                        {log.entity_type && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Entity Type</Typography>
                                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                              {getEntityIcon(log.entity_type)}
                                              {log.entity_type}
                                            </Typography>
                                          </Box>
                                        )}
                                        
                                        {log.entity_id && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Entity ID</Typography>
                                            <Typography variant="body2">{log.entity_id}</Typography>
                                          </Box>
                                        )}
                                        
                                        {log.ip_address && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">IP Address</Typography>
                                            <Typography variant="body2">{log.ip_address}</Typography>
                                          </Box>
                                        )}
                                        
                                        {log.user && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">User</Typography>
                                            <Box sx={{ mt: 0.5 }}>
                                              {getUserDisplay(log.user)}
                                              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                                ID: {log.user.id} • Role: {log.user.role || 'unknown'}
                                              </Typography>
                                            </Box>
                                          </Box>
                                        )}
                                        
                                        {log.status && (
                                          <Box>
                                            <Typography variant="caption" color="text.secondary">Status</Typography>
                                            <Typography variant="body2">
                                              <Chip 
                                                label={log.status} 
                                                size="small" 
                                                color={log.status === 'success' ? 'success' : 'error'} 
                                              />
                                            </Typography>
                                          </Box>
                                        )}
                                      </Stack>
                                    </Paper>
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      {log.log_type === 'activity' ? 'Details' : 'Message'}
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2, height: '100%' }}>
                                      {log.log_type === 'activity' && log.details ? (
                                        <Box>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Additional Information
                                          </Typography>
                                          <Typography
                                            variant="body2"
                                            component="pre"
                                            sx={{
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'break-word',
                                              overflowY: 'auto',
                                              maxHeight: '200px',
                                              fontFamily: 'monospace'
                                            }}
                                          >
                                            {JSON.stringify(log.details, null, 2)}
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <Typography 
                                          variant="body2" 
                                          component="pre" 
                                          sx={{ 
                                            whiteSpace: 'pre-wrap', 
                                            wordBreak: 'break-word',
                                            overflowY: 'auto',
                                            maxHeight: '200px',
                                            fontFamily: 'monospace'
                                          }}
                                        >
                                          {log.message || 'No message content'}
                                        </Typography>
                                      )}
                                    </Paper>
                                  </Grid>
                                  
                                  {(log.stack_trace || log.error) && (
                                    <Grid item xs={12}>
                                      <Typography variant="subtitle2" gutterBottom>
                                        {log.error ? 'Error' : 'Stack Trace'}
                                      </Typography>
                                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'error.light', color: 'error.dark' }}>
                                        {log.error && (
                                          <Typography 
                                            variant="body2" 
                                            sx={{ mb: 2, fontWeight: 'bold' }}
                                          >
                                            {log.error}
                                          </Typography>
                                        )}
                                        <Typography 
                                          variant="body2" 
                                          component="pre" 
                                          sx={{ 
                                            whiteSpace: 'pre-wrap', 
                                            wordBreak: 'break-word',
                                            overflowY: 'auto',
                                            maxHeight: '300px',
                                            fontFamily: 'monospace'
                                          }}
                                        >
                                          {log.stack_trace || 'No stack trace available'}
                                        </Typography>
                                      </Paper>
                                    </Grid>
                                  )}
                                  
                                  {log.additional_data && (
                                    <Grid item xs={12}>
                                      <Typography variant="subtitle2" gutterBottom>
                                        Additional Data
                                      </Typography>
                                      <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Typography 
                                          variant="body2" 
                                          component="pre" 
                                          sx={{ 
                                            whiteSpace: 'pre-wrap', 
                                            wordBreak: 'break-word',
                                            overflowY: 'auto',
                                            maxHeight: '300px',
                                            fontFamily: 'monospace'
                                          }}
                                        >
                                          {typeof log.additional_data === 'object' 
                                            ? JSON.stringify(log.additional_data, null, 2)
                                            : log.additional_data}
                                        </Typography>
                                      </Paper>
                                    </Grid>
                                  )}
                                </Grid>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              ActionsComponent={TablePaginationActions}
              sx={{ mt: 2 }}
            />
          </>
        )}
      </Paper>
      
      {/* Dialog for displaying log details */}
      <Dialog
        open={logDetailsOpen}
        onClose={closeLogDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Log Details
          <IconButton
            aria-label="close"
            onClick={closeLogDetails}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <ClearIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {selectedLog.log_type === 'activity' 
                  ? `${selectedLog.action} ${selectedLog.entity_type || ''} at ${formatTimestamp(selectedLog.timestamp)}`
                  : `Log Entry at ${formatTimestamp(selectedLog.timestamp)}`}
              </Typography>
              
              <Typography variant="body2" component="pre" sx={{ 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'monospace',
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                p: 2,
                borderRadius: 1,
                overflowX: 'auto'
              }}>
                {JSON.stringify(selectedLog, null, 2)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedLog && (
            <Button 
              startIcon={<CopyIcon />}
              onClick={() => copyLogToClipboard(selectedLog)}
            >
              Copy to Clipboard
            </Button>
          )}
          <Button onClick={closeLogDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default LogsViewer;
