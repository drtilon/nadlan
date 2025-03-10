// components/LogsViewer.jsx
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
  Divider
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
  DeleteSweep as ClearIcon
} from '@mui/icons-material';
import api from '../utils/api';
import AssessmentIcon from '@mui/icons-material/Assessment';

function LogsViewer({ showNotification }) {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [expandedRows, setExpandedRows] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fetch logs from server
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/logs');
      const logsData = Array.isArray(response.data) ? response.data : response.data.logs || [];
      
      // Sort logs by timestamp (newest first)
      const sortedLogs = logsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(sortedLogs);
      applyFilters(sortedLogs, searchTerm, logLevel, activeTab);
    } catch (error) {
      console.error('Error fetching logs:', error);
      showNotification('Error fetching log data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to logs
  const applyFilters = (logsData, search, level, tab) => {
    let filtered = [...logsData];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message?.toLowerCase().includes(searchLower) || 
        log.logger?.toLowerCase().includes(searchLower) ||
        log.level?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply level filter
    if (level !== 'all') {
      filtered = filtered.filter(log => log.level?.toLowerCase() === level.toLowerCase());
    }
    
    // Apply tab filter (time periods)
    const now = new Date();
    if (tab === 1) { // Last hour
      const hourAgo = new Date(now - (60 * 60 * 1000));
      filtered = filtered.filter(log => new Date(log.timestamp) >= hourAgo);
    } else if (tab === 2) { // Last 24 hours
      const dayAgo = new Date(now - (24 * 60 * 60 * 1000));
      filtered = filtered.filter(log => new Date(log.timestamp) >= dayAgo);
    } else if (tab === 3) { // Last 7 days
      const weekAgo = new Date(now - (7 * 24 * 60 * 60 * 1000));
      filtered = filtered.filter(log => new Date(log.timestamp) >= weekAgo);
    }
    
    setFilteredLogs(filtered);
  };

  // Initialize component
  useEffect(() => {
    fetchLogs();
    
    // Clean up any existing interval on unmount
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Effect for search term changes
  useEffect(() => {
    applyFilters(logs, searchTerm, logLevel, activeTab);
  }, [searchTerm, logLevel, activeTab, logs]);

  // Effect for auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
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
  }, [autoRefresh]);

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

  // Clear all logs
  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      await api.delete('/logs');
      showNotification('Logs cleared successfully', 'success');
      setLogs([]);
      setFilteredLogs([]);
    } catch (error) {
      console.error('Error clearing logs:', error);
      showNotification('Error clearing logs', 'error');
    } finally {
      setLoading(false);
    }
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Server Logs
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLogs}
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
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClearLogs}
              disabled={loading || logs.length === 0}
            >
              Clear Logs
            </Button>
          </Box>
        </Box>
        
        {/* Filters and Search */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            placeholder="Search logs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1 }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Level</InputLabel>
            <Select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              label="Level"
            >
              <MenuItem value="all">All Levels</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </Select>
          </FormControl>
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
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((log, index) => {
                  const isExpanded = expandedRows[log.id || index] || false;
                  
                  return (
                    <React.Fragment key={log.id || index}>
                      <TableRow hover>
                        <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                        <TableCell>{getLogLevelChip(log.level)}</TableCell>
                        <TableCell>{log.logger || 'Unknown'}</TableCell>
                        <TableCell>
                          {log.message?.length > 100 && !isExpanded
                            ? `${log.message.substring(0, 100)}...`
                            : log.message}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpanded(log.id || index)}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                      
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                            <Box sx={{ p: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Full Message:
                              </Typography>
                              <Typography variant="body2" component="pre" sx={{ 
                                whiteSpace: 'pre-wrap', 
                                wordBreak: 'break-word',
                                p: 1,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                maxHeight: '300px',
                                overflow: 'auto'
                              }}>
                                {log.message}
                              </Typography>
                              
                              {log.stack_trace && (
                                <>
                                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                    Stack Trace:
                                  </Typography>
                                  <Typography variant="body2" component="pre" sx={{ 
                                    whiteSpace: 'pre-wrap', 
                                    wordBreak: 'break-word',
                                    p: 1,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    color: 'error.main',
                                    maxHeight: '300px',
                                    overflow: 'auto'
                                  }}>
                                    {log.stack_trace}
                                  </Typography>
                                </>
                              )}
                              
                              {log.additional_data && (
                                <>
                                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                    Additional Data:
                                  </Typography>
                                  <Typography variant="body2" component="pre" sx={{ 
                                    whiteSpace: 'pre-wrap', 
                                    wordBreak: 'break-word',
                                    p: 1,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                    maxHeight: '300px',
                                    overflow: 'auto'
                                  }}>
                                    {typeof log.additional_data === 'object' 
                                      ? JSON.stringify(log.additional_data, null, 2)
                                      : log.additional_data}
                                  </Typography>
                                </>
                              )}
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
          
          {logs.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLogs}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default LogsViewer;
