// src/components/ContractManager.jsx
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  Description as DescriptionIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Apartment as ApartmentIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import api from '../utils/api';

function ContractManager({ showNotification }) {
  const [contracts, setContracts] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContracts, setFilteredContracts] = useState([]);

  useEffect(() => {
    fetchApartments();
    fetchAllContracts();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredContracts(contracts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contracts.filter(contract =>
      contract.fileName.toLowerCase().includes(query) ||
      contract.apartmentAddress?.toLowerCase().includes(query) ||
      contract.notes?.toLowerCase().includes(query)
    );
    setFilteredContracts(filtered);
  }, [searchQuery, contracts]);

  const fetchApartments = async () => {
    try {
      const response = await api.get('/list');
      setApartments(response.data || []);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      showNotification('Failed to load apartments', 'error');
    }
  };

  const fetchAllContracts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/documents/contracts/search?q=');
      setContracts(response.data || []);
      setFilteredContracts(response.data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      showNotification('Failed to load contracts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    // Validate file types
    const allowedTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'image/jpeg', 'image/jpg', 'image/png'];

    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      showNotification('Invalid file type. Please select PDF, DOC, DOCX, TXT, or image files.', 'error');
      return;
    }

    // Check individual file sizes (50MB limit per file)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      showNotification(`File(s) too large. Maximum size per file is 50MB.`, 'error');
      return;
    }

    // Check total size (100MB limit for all files combined)
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > MAX_TOTAL_SIZE) {
      showNotification(`Total file size too large. Maximum total size is 100MB.`, 'error');
      return;
    }

    setSelectedFiles(files);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedApartment) {
      showNotification('Please select an apartment', 'error');
      return;
    }

    if (selectedFiles.length === 0) {
      showNotification('Please select files to upload', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('apartmentId', selectedApartment);
      formData.append('notes', notes);

      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      showNotification(response.data.message, 'success');
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setSelectedApartment('');
      setNotes('');
      fetchAllContracts();
    } catch (error) {
      console.error('Error uploading contracts:', error);
      if (error.response?.status === 413) {
        showNotification('File too large. Please reduce file size and try again.', 'error');
      } else {
        showNotification(error.response?.data?.message || 'Failed to upload contracts', 'error');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (contractId, fileName) => {
    try {
      const response = await api.get(`/documents/download/${contractId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showNotification('Contract downloaded successfully', 'success');
    } catch (error) {
      console.error('Error downloading contract:', error);
      showNotification('Failed to download contract', 'error');
    }
  };

  const handleDelete = async (contractId) => {
    if (!window.confirm('Are you sure you want to delete this contract?')) {
      return;
    }

    try {
      await api.delete(`/documents/contracts/${contractId}`);
      showNotification('Contract deleted successfully', 'success');
      fetchAllContracts();
    } catch (error) {
      console.error('Error deleting contract:', error);
      showNotification('Failed to delete contract', 'error');
    }
  };

  const handleOpenUploadDialog = () => {
    setSelectedFiles([]);
    setSelectedApartment('');
    setNotes('');
    setUploadDialogOpen(true);
  };

  const handleCloseUploadDialog = () => {
    setUploadDialogOpen(false);
    setSelectedFiles([]);
    setSelectedApartment('');
    setNotes('');
    setUploadProgress(0);
  };

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <DescriptionIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
          <Typography variant="h5" component="h2">
            Contract Manager
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAllContracts}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={handleOpenUploadDialog}
          >
            Upload Contracts
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search contracts by filename, apartment address, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
          }}
        />
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Contracts
              </Typography>
              <Typography variant="h4">
                {contracts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Size
              </Typography>
              <Typography variant="h4">
                {formatFileSize(contracts.reduce((sum, contract) => sum + (contract.fileSize || 0), 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Apartments with Contracts
              </Typography>
              <Typography variant="h4">
                {new Set(contracts.map(c => c.apartment_id)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : filteredContracts.length === 0 ? (
        <Alert severity="info" sx={{ mt: 3 }}>
          {searchQuery ? 'No contracts found matching your search.' : 'No contracts found. Upload some contracts to get started.'}
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Apartment</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Upload Date</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow key={contract.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DescriptionIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body2">{contract.fileName}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ApartmentIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
                      <Typography variant="body2">
                        {contract.apartmentAddress || `Apartment ID: ${contract.apartment_id}`}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{formatFileSize(contract.fileSize || 0)}</TableCell>
                  <TableCell>
                    {contract.uploadDate
                      ? new Date(contract.uploadDate).toLocaleDateString()
                      : 'Unknown'
                    }
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contract.notes || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleDownload(contract.id, contract.fileName)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(contract.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={handleCloseUploadDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2, overflow: 'hidden' }
        }}
      >
        <DialogTitle
          sx={{
            p: 3,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <UploadIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Upload Contracts
            </Typography>
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseUploadDialog}
            aria-label="close"
            size="small"
            disabled={isUploading}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>File Requirements:</strong>
            </Typography>
            <Typography variant="caption" display="block">
              • Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG
            </Typography>
            <Typography variant="caption" display="block">
              • Maximum file size: 50MB per file
            </Typography>
            <Typography variant="caption" display="block">
              • Maximum total size: 100MB for all files combined
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Select Apartment</InputLabel>
                <Select
                  value={selectedApartment}
                  onChange={(e) => setSelectedApartment(e.target.value)}
                  label="Select Apartment"
                  disabled={isUploading}
                >
                  {apartments.map((apartment) => (
                    <MenuItem key={apartment.id} value={apartment.id}>
                      {apartment.address}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <input
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  id="contract-file-upload"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <label htmlFor="contract-file-upload">
                  <Button
                    component="span"
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    fullWidth
                    disabled={isUploading}
                    sx={{ py: 2 }}
                  >
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : 'Choose Files'
                    }
                  </Button>
                </label>
              </Box>

              {selectedFiles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Files:
                  </Typography>
                  {selectedFiles.map((file, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <Box>
                        <Typography variant="body2">{file.name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {formatFileSize(file.size)}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Typography variant="caption" color="textSecondary">
                    Total size: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isUploading}
              />
            </Grid>
          </Grid>

          {isUploading && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                Uploading... {uploadProgress}%
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={handleCloseUploadDialog}
            variant="outlined"
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={isUploading || !selectedApartment || selectedFiles.length === 0}
            startIcon={isUploading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default ContractManager;
