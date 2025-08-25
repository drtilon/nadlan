import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  Stack,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';

// Icons
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PaymentIcon from '@mui/icons-material/Payment';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

// IMPORT THE LONG TIMEOUT API
import { createLongTimeoutApi } from '../../utils/api';

const CSVPaymentProcessor = ({ showNotification }) => {
  // State
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [grokStatus, setGrokStatus] = useState({ configured: false, checking: true });

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'matched', 'unmatched'

  // Manual assignment state
  const [assignmentDialog, setAssignmentDialog] = useState({
    open: false,
    transaction: null,
    selectedTenant: null,
    selectedApartment: null,
    customAmount: '',
    notes: '',
    paymentDate: '',
  });

  // Data for dropdowns
  const [tenants, setTenants] = useState([]);
  const [apartments, setApartments] = useState([]);

  // Chunked processing state
  const [processingDetails, setProcessingDetails] = useState({
    tempFileId: null,
    totalChunks: 0,
    processedChunks: 0,
    currentChunk: 0,
    totalTransactions: 0,
    chunkSize: 0,
    paused: false,
    stopped: false,
    originalTransactions: [],
    isChunkedMode: false
  });

  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [processingStartTime, setProcessingStartTime] = useState(null);

  // Load data on component mount
  useEffect(() => {
    checkGrokStatus();
    fetchTenants();
    fetchApartments();
  }, []);

  // Update filtered transactions when transactions or filter changes
  useEffect(() => {
    let filtered = transactions;

    switch (filterStatus) {
      case 'matched':
        filtered = transactions.filter(t => t.confidence > 0.8);
        break;
      case 'unmatched':
        filtered = transactions.filter(t => t.confidence <= 0.8);
        break;
      default:
        filtered = transactions;
    }

    setFilteredTransactions(filtered);
    setPage(0); // Reset to first page when filter changes
  }, [transactions, filterStatus]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/csv-payments/tenants', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(data);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await fetch('/api/csv-payments/apartments', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setApartments(data);
      }
    } catch (error) {
      console.error('Error fetching apartments:', error);
    }
  };

  const checkGrokStatus = async () => {
    try {
      const response = await fetch('/api/csv-payments/grok-status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGrokStatus({
          configured: data.configured,
          api_working: data.api_working,
          fullyOperational: data.configured && data.api_working,
          checking: false
        });
      } else {
        setGrokStatus({ configured: false, checking: false, fullyOperational: false });
      }
    } catch (error) {
      console.error('Error checking Grok status:', error);
      setGrokStatus({ configured: false, checking: false, fullyOperational: false });
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();

      if (!allowedTypes.includes(selectedFile.type) && !['csv', 'txt'].includes(fileExtension)) {
        showNotification('Please select a CSV or TXT file', 'error');
        return;
      }

      if (selectedFile.size > 50 * 1024 * 1024) {
        showNotification('File too large. Maximum size is 50MB', 'error');
        return;
      }

      setFile(selectedFile);
      setResults(null);
      setTransactions([]);
      setPage(0);
      setFilterStatus('all');
      setProcessingDetails({
        tempFileId: null,
        totalChunks: 0,
        processedChunks: 0,
        currentChunk: 0,
        totalTransactions: 0,
        chunkSize: 0,
        paused: false,
        stopped: false,
        originalTransactions: [],
        isChunkedMode: false
      });
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const openAssignmentDialog = (transaction) => {
    const transactionDate = transaction.date || new Date().toISOString().split('T')[0];

    setAssignmentDialog({
      open: true,
      transaction,
      selectedTenant: null,
      selectedApartment: null,
      customAmount: transaction.amount?.toString() || '',
      notes: transaction.reference || '',
      paymentDate: transactionDate,
    });
  };

  const closeAssignmentDialog = () => {
    setAssignmentDialog({
      open: false,
      transaction: null,
      selectedTenant: null,
      selectedApartment: null,
      customAmount: '',
      notes: '',
      paymentDate: '',
    });
  };

  const handleManualAssignment = async () => {
    const { transaction, selectedTenant, selectedApartment, customAmount, notes, paymentDate } = assignmentDialog;

    if (!selectedTenant || !selectedApartment || !customAmount || !paymentDate) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await fetch('/api/csv-payments/manual-assign-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction_data: {
            csv_line: transaction.csv_line,
            sender: transaction.sender,
            original_amount: transaction.amount,
            date: transaction.date,
            reference: transaction.reference
          },
          assignment_data: {
            tenant_id: selectedTenant.id,
            apartment_id: selectedApartment.id,
            amount: parseFloat(customAmount),
            payment_date: paymentDate,
            notes: notes,
            assigned_manually: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Update the transaction in the local state
      setTransactions(prev => prev.map(t =>
        t.csv_line === transaction.csv_line ? {
          ...t,
          suggested_tenant: selectedTenant.name,
          suggested_apartment: selectedApartment.address || selectedApartment.name,
          confidence: 1.0,
          amount: parseFloat(customAmount),
          manually_assigned: true
        } : t
      ));

      showNotification(
        `Payment of €${customAmount} assigned to ${selectedTenant.name} at ${selectedApartment.address || selectedApartment.name}`,
        'success'
      );

      closeAssignmentDialog();

    } catch (error) {
      console.error('Error assigning payment:', error);
      showNotification('Error assigning payment. Please try again.', 'error');
    }
  };

  const processFile = async () => {
    if (!file) {
      showNotification('Please select a file first', 'error');
      return;
    }

    if (!grokStatus.fullyOperational) {
      showNotification('Grok AI is not fully operational', 'error');
      return;
    }

    setProcessing(true);
    setProgress(10);
    setStatus('Uploading file...');
    setProcessingStartTime(Date.now());

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(30);
      setStatus('Detecting CSV columns...');

      // CREATE API INSTANCE WITH LONGER TIMEOUT
      const longTimeoutApi = createLongTimeoutApi();

      // Try the simple endpoint first with longer timeout
      const response = await longTimeoutApi.post('/csv-payments/process-csv-simple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 600000 // 10 minutes
      });

      const data = response.data;

      // Check if it suggests chunked processing
      if (data.suggestion === 'use_chunked_processing') {
        showNotification(
          `Large file detected (${data.line_count} lines). Switching to chunked processing for better performance.`,
          'info'
        );

        // Start chunked processing
        await startChunkedProcessing();
        return;
      }

      // Handle normal processing results
      setProgress(100);
      setStatus('Complete!');
      setResults(data);
      setTransactions(data.manual_review_transactions || []);

      const totalCount = data.summary?.manual_review_count || 0;
      const totalAmount = data.summary?.manual_review_amount || 0;

      showNotification(
        `Found ${totalCount} transactions totaling €${totalAmount.toFixed(2)}`,
        'success'
      );

    } catch (error) {
      console.error('Error processing CSV:', error);

      // Better error handling for timeout
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        showNotification('Processing is taking longer than expected. Try using chunked processing for large files.', 'warning');
      } else if (error.response && error.response.status === 504) {
        showNotification('Server timeout. Large file detected - switching to chunked processing automatically.', 'info');
        // Automatically try chunked processing
        try {
          await startChunkedProcessing();
          return;
        } catch (chunkedError) {
          showNotification('Both processing methods failed. Please try a smaller file.', 'error');
        }
      } else {
        showNotification('Processing failed. Please try again.', 'error');
      }
      setProgress(0);
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const startChunkedProcessing = async () => {
    try {
      setShowProgressDialog(true);
      setProcessingDetails(prev => ({ ...prev, isChunkedMode: true }));

      const formData = new FormData();
      formData.append('file', file);

      setProgress(20);
      setStatus('Analyzing CSV structure for chunked processing...');

      // USE LONGER TIMEOUT API FOR CHUNKED PROCESSING TOO
      const longTimeoutApi = createLongTimeoutApi();

      const response = await longTimeoutApi.post('/csv-payments/process-csv-chunked', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000 // 5 minutes for initial analysis
      });

      const data = response.data;

      if (data.processing_started) {
        setProcessingDetails(prev => ({
          ...prev,
          tempFileId: data.temp_file_id,
          totalChunks: data.total_chunks,
          totalTransactions: data.total_transactions,
          chunkSize: data.chunk_size,
          paused: false,
          stopped: false,
          currentChunk: 0
        }));

        setProgress(30);
        setStatus(`Found ${data.total_transactions} transactions. Starting AI analysis...`);

        // Start processing chunks
        processNextChunk(0, data.total_chunks, data.temp_file_id);
      }

    } catch (error) {
      console.error('Error starting chunked processing:', error);
      showNotification('Failed to start chunked processing. Please try again.', 'error');
      setProcessing(false);
      setShowProgressDialog(false);
      setProgress(0);
      setStatus('');
    }
  };

  const processNextChunk = async (chunkNumber, totalChunks, tempFileId) => {
    if (processingDetails.paused || processingDetails.stopped || chunkNumber >= totalChunks) {
      return;
    }

    try {
      setStatus(`Processing chunk ${chunkNumber + 1} of ${totalChunks}...`);

      // USE STANDARD FETCH WITH LONGER TIMEOUT FOR CHUNK PROCESSING
      const response = await fetch(`/api/csv-payments/process-chunk/${tempFileId}/${chunkNumber}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        // Note: fetch doesn't have timeout, but chunks should be faster
        signal: AbortSignal.timeout(120000) // 2 minutes per chunk
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chunkData = await response.json();

      // Update progress
      const newProgress = 30 + (60 * (chunkNumber + 1) / totalChunks);
      setProgress(newProgress);

      // Update processing details
      setProcessingDetails(prev => ({
        ...prev,
        processedChunks: chunkData.chunk_processed,
        currentChunk: chunkNumber + 1
      }));

      // Add chunk results to transactions
      setTransactions(prev => [...prev, ...chunkData.chunk_results]);

      showNotification(
        `Chunk ${chunkData.chunk_processed}/${totalChunks} complete: ${chunkData.rent_payments_found} payments found`,
        'info'
      );

      // Continue with next chunk or finish
      if (chunkData.processing_complete) {
        finishChunkedProcessing(tempFileId);
      } else {
        // Process next chunk with a small delay
        setTimeout(() => {
          if (!processingDetails.paused && !processingDetails.stopped) {
            processNextChunk(chunkNumber + 1, totalChunks, tempFileId);
          }
        }, 500);
      }

    } catch (error) {
      console.error('Error processing chunk:', error);
      showNotification(`Error processing chunk ${chunkNumber + 1}: ${error.message}`, 'error');

      // Continue with next chunk despite error
      if (chunkNumber + 1 < totalChunks) {
        setTimeout(() => {
          if (!processingDetails.paused && !processingDetails.stopped) {
            processNextChunk(chunkNumber + 1, totalChunks, tempFileId);
          }
        }, 1000);
      } else {
        finishChunkedProcessing(tempFileId);
      }
    }
  };

  const finishChunkedProcessing = async (tempFileId) => {
    try {
      setStatus('Finalizing results...');
      setProgress(90);

      // Get final results
      const response = await fetch(`/api/csv-payments/get-results/${tempFileId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const finalData = await response.json();

        setResults({
          summary: {
            ...finalData.summary,
            file_size_mb: Math.round(file.size / (1024 * 1024) * 100) / 100,
            processing_method: "chunked"
          }
        });

        setTransactions(finalData.rent_payments);

        showNotification(
          `Processing complete! Found ${finalData.summary.total_transactions_found} rent payments totaling €${finalData.summary.total_amount.toFixed(2)}`,
          'success'
        );
      }

      setProgress(100);
      setStatus('Processing complete!');

    } catch (error) {
      console.error('Error finalizing results:', error);
      showNotification('Error finalizing results', 'error');
    } finally {
      setProcessing(false);
      setTimeout(() => {
        setShowProgressDialog(false);
      }, 2000);
    }
  };

  const pauseProcessing = () => {
    setProcessingDetails(prev => ({ ...prev, paused: true }));
    setStatus('Processing paused');
  };

  const resumeProcessing = () => {
    setProcessingDetails(prev => ({ ...prev, paused: false }));
    setStatus('Resuming processing...');
    // Continue processing from current chunk
    const { currentChunk, totalChunks, tempFileId } = processingDetails;
    if (currentChunk < totalChunks) {
      processNextChunk(currentChunk, totalChunks, tempFileId);
    }
  };

  const stopProcessing = () => {
    setProcessingDetails(prev => ({ ...prev, stopped: true }));
    setProcessing(false);
    setShowProgressDialog(false);
    setProgress(0);
    setStatus('Processing stopped');
    showNotification('Processing stopped by user', 'warning');
  };

  const deleteTransaction = async (transaction) => {
    try {
      const response = await fetch('/api/csv-payments/delete-transaction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: transaction.amount,
          date: transaction.date,
          sender: transaction.sender,
          reference: transaction.reference,
          csv_line: transaction.csv_line
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setTransactions(prev => prev.filter(t =>
        t.csv_line !== transaction.csv_line
      ));

      showNotification('Transaction deleted', 'success');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showNotification('Error deleting transaction', 'error');
    }
  };

  // Calculate pagination
  const displayedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PaymentIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          CSV Payment Processor
          <Chip
            label={grokStatus.checking ? 'Checking...' : grokStatus.fullyOperational ? 'AI Ready' : 'AI Issues'}
            color={grokStatus.api_working ? 'success' : 'warning'}
            variant="outlined"
            size="small"
          />
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload CSV files to find potential tenant payments using AI column detection.
          {processingDetails.isChunkedMode && " Large files processed in chunks with real-time progress."}
        </Typography>
      </Box>

      {/* Upload Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ textAlign: 'center', py: 3, border: '2px dashed #ddd', borderRadius: 2 }}>
                <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>Upload CSV File</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Bank statement CSV with transaction data (up to 50MB)
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

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Process File</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                AI will analyze the CSV and automatically choose the best processing method based on file size
              </Typography>

              <Button
                variant="contained"
                startIcon={processing ? <CircularProgress size={20} /> : <SmartToyIcon />}
                onClick={processFile}
                disabled={!file || processing || !grokStatus.fullyOperational}
                fullWidth
                size="large"
              >
                {processing ? 'Processing...' : 'Process with AI'}
              </Button>

              {!grokStatus.fullyOperational && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  AI is not fully operational. Please check configuration.
                </Alert>
              )}

              {/* Progress for simple processing */}
              {processing && !processingDetails.isChunkedMode && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" gutterBottom>{status}</Typography>
                  <LinearProgress variant="determinate" value={progress} />
                  <Typography variant="caption" color="text.secondary">
                    {progress.toFixed(1)}% complete
                  </Typography>
                </Box>
              )}

              {/* Quick Stats for chunked processing */}
              {processingDetails.totalTransactions > 0 && processingDetails.isChunkedMode && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" display="block">
                    Total Transactions: {processingDetails.totalTransactions}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Chunks: {processingDetails.totalChunks} Ã— {processingDetails.chunkSize}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Progress: {processingDetails.processedChunks}/{processingDetails.totalChunks}
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Processing Progress Dialog (for chunked processing) */}
      <Dialog open={showProgressDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SmartToyIcon color="primary" />
            Processing Large CSV File
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>{status}</Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {progress.toFixed(1)}% complete
            </Typography>
          </Box>

          {processingDetails.totalChunks > 0 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h6">{processingDetails.processedChunks}</Typography>
                    <Typography variant="caption">Chunks Done</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h6">{processingDetails.totalChunks}</Typography>
                    <Typography variant="caption">Total Chunks</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h6">{transactions.length}</Typography>
                    <Typography variant="caption">Payments Found</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h6">
                      €{transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(0)}
                    </Typography>
                    <Typography variant="caption">Total Amount</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Real-time transaction preview */}
          {transactions.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Latest Payments Found ({transactions.slice(-5).length} of {transactions.length}):
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Amount</TableCell>
                    <TableCell>Sender</TableCell>
                    <TableCell>Match</TableCell>
                    <TableCell>Line</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.slice(-5).map((transaction, index) => (
                    <TableRow key={index}>
                      <TableCell>€{transaction.amount?.toFixed(2)}</TableCell>
                      <TableCell>{transaction.sender?.substring(0, 20)}...</TableCell>
                      <TableCell>
                        {transaction.suggested_tenant ? (
                          <Chip label={transaction.suggested_tenant} size="small" color="success" />
                        ) : (
                          <Chip label="No match" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>{transaction.csv_line}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {processing && !processingDetails.paused && (
            <Button
              startIcon={<PauseIcon />}
              onClick={pauseProcessing}
              color="warning"
            >
              Pause
            </Button>
          )}
          {processing && processingDetails.paused && (
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={resumeProcessing}
              color="primary"
            >
              Resume
            </Button>
          )}
          <Button
            startIcon={<StopIcon />}
            onClick={stopProcessing}
            color="error"
          >
            Stop
          </Button>
          <Button onClick={() => setShowProgressDialog(false)}>
            Minimize
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Assignment Dialog */}
      <Dialog open={assignmentDialog.open} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonAddIcon color="primary" />
            Manually Assign Payment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Transaction Details */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Transaction Details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Original Sender:</Typography>
                    <Typography variant="body1">{assignmentDialog.transaction?.sender}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Original Amount:</Typography>
                    <Typography variant="body1">€{assignmentDialog.transaction?.amount?.toFixed(2)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Date:</Typography>
                    <Typography variant="body1">{assignmentDialog.transaction?.date}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">CSV Line:</Typography>
                    <Typography variant="body1">{assignmentDialog.transaction?.csv_line}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Reference:</Typography>
                    <Typography variant="body1">{assignmentDialog.transaction?.reference || 'N/A'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Divider sx={{ mb: 3 }} />

            {/* Assignment Form */}
            <Typography variant="h6" gutterBottom>Payment Assignment</Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={tenants}
                  getOptionLabel={(option) => option.name || ''}
                  value={assignmentDialog.selectedTenant}
                  onChange={(event, newValue) => {
                    setAssignmentDialog(prev => ({ ...prev, selectedTenant: newValue }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Tenant *" fullWidth />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email || 'No email'} - {option.apartment_address || 'No apartment'}
                        </Typography>
                      </Box>
                    </li>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={apartments}
                  getOptionLabel={(option) => option.address || option.name || ''}
                  value={assignmentDialog.selectedApartment}
                  onChange={(event, newValue) => {
                    setAssignmentDialog(prev => ({ ...prev, selectedApartment: newValue }));
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Apartment *" fullWidth />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body2">{option.address || option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          €{option.rent || 'N/A'}/month - {option.status}
                        </Typography>
                      </Box>
                    </li>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Payment Amount *"
                  type="number"
                  inputProps={{ step: "0.01", min: "0" }}
                  value={assignmentDialog.customAmount}
                  onChange={(e) => setAssignmentDialog(prev => ({
                    ...prev,
                    customAmount: e.target.value
                  }))}
                  fullWidth
                  helperText="Adjust if different from original amount"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Payment Date *"
                  type="date"
                  value={assignmentDialog.paymentDate}
                  onChange={(e) => setAssignmentDialog(prev => ({
                    ...prev,
                    paymentDate: e.target.value
                  }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Additional Notes"
                  multiline
                  rows={3}
                  value={assignmentDialog.notes}
                  onChange={(e) => setAssignmentDialog(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                  fullWidth
                  placeholder="Any additional notes about this payment..."
                />
              </Grid>
            </Grid>

            {/* Assignment Preview */}
            {assignmentDialog.selectedTenant && assignmentDialog.selectedApartment && assignmentDialog.customAmount && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                <Typography variant="h6" color="success.main" gutterBottom>Assignment Preview</Typography>
                <Typography variant="body2">
                  <strong>€{assignmentDialog.customAmount}</strong> payment from <strong>{assignmentDialog.transaction?.sender}</strong>
                  {' '}will be assigned to <strong>{assignmentDialog.selectedTenant.name}</strong>
                  {' '}for apartment <strong>{assignmentDialog.selectedApartment.address || assignmentDialog.selectedApartment.name}</strong>
                  {' '}on <strong>{assignmentDialog.paymentDate}</strong>
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeAssignmentDialog}
            startIcon={<CancelIcon />}
          >
            Cancel
          </Button>
          <Button
            onClick={handleManualAssignment}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!assignmentDialog.selectedTenant || !assignmentDialog.selectedApartment || !assignmentDialog.customAmount || !assignmentDialog.paymentDate}
          >
            Assign Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Results */}
      {results && (
        <Box>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary.main">
                    {transactions.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rent Payments Found
                  </Typography>
                  <Typography variant="caption" color="primary.main">
                    €{transactions.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="success.main">
                    {transactions.filter(t => t.confidence > 0.8).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Auto-Matched
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {transactions.length > 0 ? Math.round(transactions.filter(t => t.confidence > 0.8).length / transactions.length * 100) : 0}% matched
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="warning.main">
                    {transactions.filter(t => t.confidence <= 0.8 && !t.manually_assigned).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Need Manual Review
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    Requires assignment
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6">
                    {results.summary?.processing_time_seconds || 0}s
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Processing Time
                  </Typography>
                  <Typography variant="caption">
                    {results.summary?.file_size_mb || 0}MB â€¢ {results.summary?.processing_method || 'standard'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Transactions Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Found Transactions
                </Typography>

                {/* Filter Controls */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Filter</InputLabel>
                    <Select
                      value={filterStatus}
                      label="Filter"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="all">All ({transactions.length})</MenuItem>
                      <MenuItem value="matched">Auto-Matched ({transactions.filter(t => t.confidence > 0.8).length})</MenuItem>
                      <MenuItem value="unmatched">Unmatched ({transactions.filter(t => t.confidence <= 0.8).length})</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {transactions.length === 0 ? (
                <Alert severity="info">No rent payments found</Alert>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Sender</TableCell>
                          <TableCell>Reference</TableCell>
                          <TableCell>Assignment Status</TableCell>
                          <TableCell>CSV Line</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayedTransactions.map((transaction, index) => (
                          <TableRow key={`${transaction.csv_line}-${index}`}>
                            <TableCell>
                              <Typography variant="body2">
                                {transaction.date}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                €{transaction.amount?.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {transaction.sender?.substring(0, 25)}
                                {transaction.sender?.length > 25 && '...'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {transaction.reference?.substring(0, 30)}
                                {transaction.reference?.length > 30 && '...'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {transaction.manually_assigned ? (
                                <Stack direction="column" spacing={0.5}>
                                  <Chip
                                    label="Manually Assigned"
                                    color="info"
                                    size="small"
                                  />
                                  <Typography variant="caption">
                                    {transaction.suggested_tenant}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {transaction.suggested_apartment}
                                  </Typography>
                                </Stack>
                              ) : transaction.suggested_tenant ? (
                                <Stack direction="column" spacing={0.5}>
                                  <Chip
                                    label="Auto-Matched"
                                    color="success"
                                    size="small"
                                  />
                                  <Typography variant="caption">
                                    {transaction.suggested_tenant}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {transaction.suggested_apartment}
                                  </Typography>
                                </Stack>
                              ) : (
                                <Stack direction="column" spacing={0.5}>
                                  <Chip
                                    label="Needs Assignment"
                                    color="warning"
                                    size="small"
                                  />
                                  <Typography variant="caption" color="text.secondary">
                                    Click "Assign" to match
                                  </Typography>
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={`Line ${transaction.csv_line}`}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} justifyContent="center">
                                <Tooltip title={transaction.manually_assigned ? "Edit Assignment" : "Assign Payment"}>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => openAssignmentDialog(transaction)}
                                  >
                                    <AssignmentIcon />
                                  </IconButton>
                                </Tooltip>

                                <Tooltip title="Delete Transaction">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => deleteTransaction(transaction)}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination */}
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={filteredTransactions.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handlePageChange}
                    onRowsPerPageChange={handleRowsPerPageChange}
                    labelRowsPerPage="Transactions per page:"
                    showFirstButton
                    showLastButton
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default CSVPaymentProcessor;
