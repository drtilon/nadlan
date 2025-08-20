// CSVPaymentProcessor.jsx - Admin-only CSV Payment Processing Component
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Tooltip,
  Stack,
  Badge,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';

// Icons
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';

import api, { apiHelpers } from '../../utils/api';

const CSVPaymentProcessor = ({ showNotification }) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [grokStatus, setGrokStatus] = useState({ configured: false, checking: true });

  // Processing results
  const [results, setResults] = useState(null);
  const [matchedPayments, setMatchedPayments] = useState([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState([]);
  const [insertErrors, setInsertErrors] = useState([]);

  // Configuration
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [autoInsert, setAutoInsert] = useState(true);

  // Manual matching dialog
  const [manualMatchDialog, setManualMatchDialog] = useState({
    open: false,
    payment: null,
    selectedApartment: '',
    selectedTenant: '',
    apartments: []
  });

  // View states
  const [expandedSections, setExpandedSections] = useState({
    matched: true,
    unmatched: true,
    errors: false
  });

  // Check Grok AI status on component mount
  useEffect(() => {
    checkGrokStatus();
  }, []);

  const checkGrokStatus = async () => {
    try {
      const response = await api.get('/grok-status');
      setGrokStatus({ ...response.data, checking: false });
    } catch (error) {
      console.error('Error checking Grok status:', error);
      setGrokStatus({ configured: false, checking: false, error: error.message });
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();

      if (!allowedTypes.includes(selectedFile.type) && !['csv', 'txt'].includes(fileExtension)) {
        showNotification('Please select a CSV or TXT file', 'error');
        return;
      }

      // Validate file size (50MB limit)
      if (selectedFile.size > 50 * 1024 * 1024) {
        showNotification('File too large. Maximum size is 50MB', 'error');
        return;
      }

      setFile(selectedFile);
      setUploadStep(1);
      setResults(null);
    }
  };

  // Process CSV file with Grok AI
  const processCSVFile = async () => {
    if (!file) {
      showNotification('Please select a file first', 'error');
      return;
    }

    setProcessing(true);
    setUploadStep(2);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('confidence_threshold', confidenceThreshold.toString());
      formData.append('auto_insert', autoInsert.toString());

      const response = await api.post('/process-csv-payments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000 // 5 minutes timeout for large files
      });

      const data = response.data;
      setResults(data);
      setMatchedPayments(data.matched_payments || []);
      setUnmatchedPayments(data.unmatched_payments || []);
      setInsertErrors(data.insert_errors || []);
      setUploadStep(3);

      // Show summary notification
      showNotification(
        `Processing complete: ${data.summary?.matched || 0} matched, ${data.summary?.unmatched || 0} unmatched, ${data.summary?.inserted || 0} inserted`,
        data.summary?.errors > 0 ? 'warning' : 'success'
      );

    } catch (error) {
      console.error('Error processing CSV:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error processing CSV file';
      showNotification(errorMessage, 'error');
      setUploadStep(1);
    } finally {
      setProcessing(false);
    }
  };

  // Handle manual matching
  const handleManualMatch = async (payment) => {
    try {
      // Get apartments for dropdown
      const response = await api.get('/apartments/all');

      setManualMatchDialog({
        open: true,
        payment,
        selectedApartment: '',
        selectedTenant: '',
        apartments: response.data || []
      });
    } catch (error) {
      showNotification('Error loading apartments', 'error');
    }
  };

  // Submit manual match
  const submitManualMatch = async () => {
    const { payment, selectedApartment, selectedTenant } = manualMatchDialog;

    if (!selectedApartment || !selectedTenant) {
      showNotification('Please select both apartment and tenant', 'error');
      return;
    }

    try {
      const matchData = {
        apartment_id: selectedApartment,
        tenant_id: selectedTenant,
        amount: payment.amount,
        date: payment.date,
        reference: payment.reference || '',
        tenant_from_grok: payment.tenant_from_grok || '',
        confidence: payment.confidence || 0
      };

      await api.post('/manual-match-payment', matchData);

      // Move payment from unmatched to matched
      const updatedPayment = {
        ...payment,
        matched_apartment: manualMatchDialog.apartments.find(a => a.id === selectedApartment)?.address,
        matched_tenant: 'Manually matched',
        confidence: 1.0,
        inserted: true
      };

      setMatchedPayments(prev => [...prev, updatedPayment]);
      setUnmatchedPayments(prev => prev.filter(p => p.index !== payment.index));

      setManualMatchDialog({ open: false, payment: null, selectedApartment: '', selectedTenant: '', apartments: [] });
      showNotification('Payment manually matched successfully', 'success');

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Error matching payment';
      showNotification(errorMessage, 'error');
    }
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  // Get step content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return 'Select CSV file containing bank transactions';
      case 1:
        return 'Configure processing settings';
      case 2:
        return 'Processing with Grok AI...';
      case 3:
        return 'Review and manage results';
      default:
        return 'Unknown step';
    }
  };

  if (grokStatus.checking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!grokStatus.configured) {
    return (
      <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Grok AI Not Configured
          </Typography>
          <Typography color="text.secondary" paragraph>
            The Grok AI integration is not properly configured. Please contact your system administrator to set up the GROK_API_KEY environment variable.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={checkGrokStatus}
          >
            Check Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmartToyIcon sx={{ fontSize: 36 }} />
          CSV Payment Processor
          <Chip
            label="Grok AI Powered"
            color="primary"
            variant="outlined"
            size="small"
          />
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload bank CSV files to automatically extract and match rent payments using AI
        </Typography>
      </Box>

      {/* Progress Stepper */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Stepper activeStep={uploadStep} orientation="horizontal">
            {['Select File', 'Configure', 'Process', 'Review'].map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {uploadStep < 3 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {getStepContent(uploadStep)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            {/* File Upload */}
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: 'center', py: 3, border: '2px dashed #ddd', borderRadius: 2 }}>
                <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Upload CSV File
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Bank statement CSV with transaction data
                </Typography>

                <input
                  accept=".csv,.txt"
                  style={{ display: 'none' }}
                  id="csv-upload"
                  type="file"
                  onChange={handleFileSelect}
                />
                <label htmlFor="csv-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadFileIcon />}
                    disabled={processing}
                  >
                    Select File
                  </Button>
                </label>

                {file && (
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`}
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Settings */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Processing Settings
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <Typography gutterBottom>
                  Confidence Threshold: {(confidenceThreshold * 100).toFixed(0)}%
                </Typography>
                <Box sx={{ px: 1 }}>
                  <input
                    type="range"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Higher values require more confident matches
                </Typography>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={autoInsert}
                    onChange={(e) => setAutoInsert(e.target.checked)}
                    color="primary"
                  />
                }
                label="Auto-insert matched payments"
                sx={{ mb: 2 }}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={processCSVFile}
                disabled={!file || processing}
                startIcon={processing ? <CircularProgress size={20} /> : <SmartToyIcon />}
              >
                {processing ? 'Processing with Grok AI...' : 'Process with Grok AI'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Processing Progress */}
      {processing && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <SmartToyIcon color="primary" />
              <Typography variant="h6">
                Grok AI is analyzing your CSV file...
              </Typography>
            </Box>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This may take a few moments for large files
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {results && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" color="primary">
                    {results.summary?.grok_extracted || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Payments Found by Grok AI
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h4" color="success.main">
                    {results.summary?.matched || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Successfully Matched
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h4" color="warning.main">
                    {results.summary?.unmatched || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Need Manual Review
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <PaymentIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h4" color="info.main">
                    {results.summary?.inserted || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inserted to Database
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Processing Info */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Processing Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    File Size
                  </Typography>
                  <Typography variant="body1">
                    {results.processing_info?.file_size_mb || 0} MB
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Grok API Calls
                  </Typography>
                  <Typography variant="body1">
                    {results.processing_info?.grok_api_calls || 0}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount Found
                  </Typography>
                  <Typography variant="body1">
                    €{results.processing_info?.total_amount_found?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Date Range
                  </Typography>
                  <Typography variant="body1">
                    {results.processing_info?.date_range?.earliest ?
                      `${new Date(results.processing_info.date_range.earliest).toLocaleDateString()} - ${new Date(results.processing_info.date_range.latest).toLocaleDateString()}` :
                      'N/A'
                    }
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Results Tabs */}
          <Card>
            <CardContent>
              <Tabs
                value={activeTab}
                onChange={(e, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
              >
                <Tab
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon />
                      Matched Payments
                      <Badge badgeContent={matchedPayments.length} color="success" />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningIcon />
                      Unmatched Payments
                      <Badge badgeContent={unmatchedPayments.length} color="warning" />
                    </Box>
                  }
                />
                {insertErrors.length > 0 && (
                  <Tab
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon />
                        Errors
                        <Badge badgeContent={insertErrors.length} color="error" />
                      </Box>
                    }
                  />
                )}
              </Tabs>

              {/* Matched Payments Tab */}
              {activeTab === 0 && (
                <Box>
                  {matchedPayments.length === 0 ? (
                    <Alert severity="info">
                      No matched payments found
                    </Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Amount</TableCell>
                            <TableCell>Tenant (Grok AI)</TableCell>
                            <TableCell>Matched Tenant</TableCell>
                            <TableCell>Apartment</TableCell>
                            <TableCell>Confidence</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {matchedPayments.map((payment, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {new Date(payment.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="bold">
                                  €{payment.amount.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>{payment.tenant_from_grok || 'N/A'}</TableCell>
                              <TableCell>{payment.matched_tenant}</TableCell>
                              <TableCell>{payment.matched_apartment}</TableCell>
                              <TableCell>
                                <Chip
                                  label={`${(payment.confidence * 100).toFixed(0)}%`}
                                  color={getConfidenceColor(payment.confidence)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={payment.inserted ? 'Inserted' : 'Pending'}
                                  color={payment.inserted ? 'success' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Unmatched Payments Tab */}
              {activeTab === 1 && (
                <Box>
                  {unmatchedPayments.length === 0 ? (
                    <Alert severity="success">
                      All payments have been successfully matched!
                    </Alert>
                  ) : (
                    <>
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        <AlertTitle>Manual Review Required</AlertTitle>
                        These payments could not be automatically matched. Please review and manually assign them.
                      </Alert>

                      <TableContainer component={Paper} variant="outlined">
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Amount</TableCell>
                              <TableCell>Tenant (Grok AI)</TableCell>
                              <TableCell>Reference</TableCell>
                              <TableCell>Confidence</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {unmatchedPayments.map((payment, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {new Date(payment.date).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold">
                                    €{payment.amount.toFixed(2)}
                                  </Typography>
                                </TableCell>
                                <TableCell>{payment.tenant_from_grok || 'Unknown'}</TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                                    {payment.reference || 'N/A'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={`${(payment.confidence * 100).toFixed(0)}%`}
                                    color={getConfidenceColor(payment.confidence)}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditIcon />}
                                    onClick={() => handleManualMatch(payment)}
                                  >
                                    Manual Match
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </Box>
              )}

              {/* Errors Tab */}
              {activeTab === 2 && insertErrors.length > 0 && (
                <Box>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <AlertTitle>Database Insertion Errors</AlertTitle>
                    The following payments could not be inserted into the database.
                  </Alert>

                  <List>
                    {insertErrors.map((error, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          <ErrorIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Row ${error.row_number || error.index}: ${error.error}`}
                          secondary={`Amount: €${error.payment_data?.amount || 0} - Date: ${error.payment_data?.date || 'N/A'}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Manual Match Dialog */}
      <Dialog
        open={manualMatchDialog.open}
        onClose={() => setManualMatchDialog({ ...manualMatchDialog, open: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Manual Payment Matching
        </DialogTitle>
        <DialogContent>
          {manualMatchDialog.payment && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Payment Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    €{manualMatchDialog.payment.amount?.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">
                    {new Date(manualMatchDialog.payment.date).toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Tenant (from Grok AI)</Typography>
                  <Typography variant="body1">
                    {manualMatchDialog.payment.tenant_from_grok || 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Reference</Typography>
                  <Typography variant="body1">
                    {manualMatchDialog.payment.reference || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Apartment</InputLabel>
                <Select
                  value={manualMatchDialog.selectedApartment}
                  label="Select Apartment"
                  onChange={(e) => setManualMatchDialog({
                    ...manualMatchDialog,
                    selectedApartment: e.target.value,
                    selectedTenant: '' // Reset tenant when apartment changes
                  })}
                >
                  {manualMatchDialog.apartments.map((apartment) => (
                    <MenuItem key={apartment.id} value={apartment.id}>
                      <Box>
                        <Typography variant="body1">{apartment.address}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {apartment.tenants || 'No tenants'}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tenant Name"
                value={manualMatchDialog.selectedTenant}
                onChange={(e) => setManualMatchDialog({
                  ...manualMatchDialog,
                  selectedTenant: e.target.value
                })}
                placeholder="Enter tenant name"
                helperText="Enter the name of the tenant who made this payment"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setManualMatchDialog({ ...manualMatchDialog, open: false })}
            startIcon={<CancelIcon />}
          >
            Cancel
          </Button>
          <Button
            onClick={submitManualMatch}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!manualMatchDialog.selectedApartment || !manualMatchDialog.selectedTenant}
          >
            Match Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CSVPaymentProcessor;
