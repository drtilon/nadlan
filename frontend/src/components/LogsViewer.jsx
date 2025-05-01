// components/LogsViewer.jsx - Improved with comprehensive activity tracking
import React, { useState, useEffect } from 'react';
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
  ListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
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
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import api from '../utils/api';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AnalyticsIcon from '@mui/icons-material/Analytics';

function LogsViewer({ showNotification }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'app', 'activity'
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [logStats, setLogStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [logDetailsOpen, setLogDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [entityTypes, setEntityTypes] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch logs from server
  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Prepare query parameters
      const params = new URLSearchParams();
      
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
      
      // Tab filters (time periods)
      if (activeTab === 1) {
        params.append('hours', '1');
      } else if (activeTab === 2) {
        params.append('hours', '24');
      } else if (activeTab === 3) {
        params.append('hours', '168'); // 7 days
      }
      
      const [logsResponse, usersResponse] = await Promise.all([
        api.get(`/logs?${params.toString()}`),
        api.get('/adminPanel/users')
      ]);
      
      const logsData = Array.isArray(logsResponse.data) ? logsResponse.data : logsResponse.data.logs || [];
      
      // Extract available entity types and action types for filters
      if (logsData.length > 0) {
        const entities = [...new Set(logsData
          .filter(log => log.entity_type)
          .map(log => log.entity_type))];
        
        const actions = [...new Set(logsData
          .filter(log => log.action)
          .map(log => log.action))];
          
        setEntityTypes(entities);
        setActionTypes(actions);
      }
      
      setLogs(logsData);
      setFilteredLogs(logsData);
      
      // Set users for filtering
      setUsers(usersResponse.data || []);
      
      // Apply search filter if exists
      if (searchTerm) {
        applySearchFilter(logsData, searchTerm);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      showNotification('Error fetching log data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch log statistics
  const fetchLogStats = async () => {
    try {
      const response = await api.get('/logs/stats');
      setLogStats(response.data);
    } catch (error) {
      console.error('Error fetching log statistics:', error);
      showNotification('Error fetching log statistics', 'error');
    }
  };

  // Apply search filter
  const applySearchFilter = (logsData, search) => {
    if (!search) {
      setFilteredLogs(logsData);
      return;
    }
    
    const searchLower = search.toLowerCase();
    const filtered = logsData.filter(log => {
      // Check various fields based on log type
      const isAppLog = log.log_type === 'app';
      
      if (isAppLog) {
        // App log fields
        return (
          (log.message && log.message.toLowerCase().includes(searchLower)) ||
          (log.logger && log.logger.toLowerCase().includes(searchLower)) ||
          (log.level && log.level.toLowerCase().includes(searchLower))
        );
      } else {
        // Activity log fields
        return (
          (log.action && log.action.toLowerCase().includes(searchLower)) ||
          (log.entity_type && log.entity_type.toLowerCase().includes(searchLower)) ||
          (log.entity_id && log.entity_id.toString().includes(searchLower)) ||
          (log.status && log.status.toLowerCase().includes(searchLower)) ||
          (log.message && log.message.toLowerCase().includes(searchLower)) ||
          (log.user && log.user.username && log.user.username.toLowerCase().includes(searchLower)) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
        );
      }
    });
    
    setFilteredLogs(filtered);
  };

  // Download logs
  const downloadLogs = async (format = 'json') => {
    try {
      setIsDownloading(true);
      
      // Create file content
      let content;
      let filename;
      let mimeType;
      
      if (format === 'json') {
        content = JSON.stringify(filteredLogs, null, 2);
        filename = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else if (format === 'csv') {
        // Convert logs to CSV format
        const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'status', 'user', 'details'];
        const csvRows = [headers.join(',')];
        
        for (const log of filteredLogs) {
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
      } else {
        throw new Error('Invalid format');
      }
      
      // Create a blob and download link
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

  // Initialize component
  useEffect(() => {
    fetchLogs();
    fetchLogStats();
    
    // Clean up any existing interval on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Effect for search term changes
  useEffect(() => {
    if (logs.length > 0) {
      applySearchFilter(logs, searchTerm);
    }
  }, [searchTerm]);

  // Effect for filter criteria changes (except search)
  useEffect(() => {
    fetchLogs();
  }, [viewMode, logLevel, userFilter, entityFilter, actionFilter, activeTab]);

  // Effect for auto-refresh
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
  }, [autoRefresh, showStats]);

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
      fetchLogStats();
    } catch (error) {
      console.error('Error clearing logs:', error);
      showNotification('Error clearing logs', 'error');
    } finally {
      setLoading(false);
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

  // Get user display from user object
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

  // Get log level chip
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

  // Get entity icon
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

  // Get action chip
  const getActionChip = (action, status) => {
    // Icons for different actions
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
    
    // Adjust color based on status
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

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  // Format message for display
  const formatMessage = (log, isExpanded) => {
    // For app logs
    if (log.log_type === 'app' && log.message) {
      if (!isExpanded && log.message.length > 80) {
        return `${log.message.substring(0, 80)}...`;
      }
      return log.message;
    }
    
    // For activity logs
    if (log.log_type === 'activity') {
      const entity = log.entity_type ? log.entity_type : 'unknown';
      const entityId = log.entity_id ? log.entity_id : '';
      const action = log.action ? log.action : 'performed action on';
      const status = log.status ? (log.status === 'failed' ? 'failed to' : '') : '';
      
      return `${status} ${action} ${entity} ${entityId}`;
    }
    
    return log.message || 'No message';
  };

  // Get the primary column to display
  const getPrimaryColumn = (log) => {
    if (log.log_type === 'app') {
      return (
        <TableCell sx={{ wordBreak: 'break-word' }}>
          {formatMessage(log, expandedRows[log.id])}
        </TableCell>
      );
    } else {
      // Activity log
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

  // Toggle statistics view
  const toggleStatsView = () => {
    const newShowStats = !showStats;
    setShowStats(newShowStats);
    if (newShowStats) {
      fetchLogStats();
    }
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
    handleMenuClose();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssessmentIcon sx={{ fontSize: 32 }} /> System Activity Logs
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
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
              onClick={() => {
                fetchLogs();
                if (showStats) fetchLogStats();
              }}
              disabled={loading}
            >
              Refresh
            </Button>
            
            <FormControl variant="outlined" size="small">
              <InputLabel>Auto-refresh</InputLabel>
              <Select
                value={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.value)}
                label="Auto-refresh"
              >
                <MenuItem value={false}>Off</MenuItem>
                <MenuItem value={true}>On (10s)</MenuItem>
              </Select>
            </FormControl>
            
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
              <MenuItem onClick={() => downloadLogs('json')} disabled={isDownloading || filteredLogs.length === 0}>
                <ListItemIcon>
                  <DownloadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Download as JSON</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => downloadLogs('csv')} disabled={isDownloading || filteredLogs.length === 0}>
                <ListItemIcon>
                  <DownloadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Download as CSV</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleClearLogs} disabled={loading || filteredLogs.length === 0}>
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
              {/* Total counts */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ height: '100%' }}>
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
              
              {/* User activity */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ height: '100%' }}>
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
              
              {/* Entity distribution */}
              <Grid item xs={12} md={4}>
                <Card variant="outlined" sx={{ height: '100%' }}>
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
                <InputLabel>Level</InputLabel>
                <Select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  label="Level"
                  disabled={viewMode === 'activity'}
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
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
                    {/* Dynamic entity types from actual data */}
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
                    {/* Dynamic action types from actual data */}
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
        
        {filteredLogs.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No logs found matching your criteria.
          </Alert>
        ) : (
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
                {filteredLogs.map((log, index) => {
                  const isExpanded = expandedRows[log.id || index] || false;
                  
                  return (
                    <React.Fragment key={log.id || index}>
                      <TableRow 
                        hover 
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: isExpanded ? 'action.hover' : 'inherit'
                        }}
                        onClick={() => toggleRowExpanded(log.id || index)}
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
                              toggleRowExpanded(log.id || index);
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
        )}
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total logs: {filteredLogs.length} {logs.length !== filteredLogs.length && `(filtered from ${logs.length})`}
          </Typography>
          
          <Stack direction="row" spacing={2}>
            {viewMode === 'activity' && filteredLogs.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => downloadLogs('json')}
                disabled={isDownloading}
                size="small"
              >
                Export
              </Button>
            )}
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                fetchLogs();
                if (showStats) fetchLogStats();
              }}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
          </Stack>
        </Box>
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
