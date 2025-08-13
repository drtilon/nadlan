import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Apartment as ApartmentIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../utils/api';

function ContractManager({ showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredApartments, setFilteredApartments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [contractNotes, setContractNotes] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);

  // Fetch apartments on component mount
  useEffect(() => {
    fetchApartments();
  }, []);

  // Filter apartments based on search query
  useEffect(() => {
    if (searchQuery && Array.isArray(apartments)) {
      const filtered = apartments.filter(apt =>
        apt.address && apt.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredApartments(filtered);
    } else {
      setFilteredApartments(Array.isArray(apartments) ? apartments : []);
    }
  }, [searchQuery, apartments]);

  // Fetch list of apartments
  const fetchApartments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/list');
      console.log('Apartments API response:', response.data); // Debug log

      // Ensure we always have an array
      const apartmentsData = Array.isArray(response.data) ? response.data : [];
      setApartments(apartmentsData);
      setFilteredApartments(apartmentsData);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      showNotification('Failed to load apartments', 'error');
      // Set empty arrays on error
      setApartments([]);
      setFilteredApartments([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch contracts for a specific apartment
  const fetchContracts = async (apartmentId) => {
    setLoading(true);
    try {
      console.log('Fetching contracts for apartment:', apartmentId); // Debug log
      const response = await api.get(`/documents/contracts/${apartmentId}`);
      console.log('Contracts API response:', response.data); // Debug log

      // Ensure we always have an array
      const contractsData = Array.isArray(response.data) ? response.data : [];
      setContracts(contractsData);

      // Find and set the selected apartment object
      const selected = Array.isArray(apartments) ? apartments.find(apt => apt.id === apartmentId) : null;
      setSelectedApartment(selected || null);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      showNotification('Failed to load contracts', 'error');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle apartment selection
  const handleApartmentSelect = (apartmentId) => {
    console.log('Selected apartment ID:', apartmentId); // Debug log
    fetchContracts(apartmentId);
  };

  // Handle file input change
  const handleFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
  };

  // Handle contract notes change
  const handleNotesChange = (event) => {
    setContractNotes(event.target.value);
  };

  // Open upload dialog
  const handleOpenUploadDialog = () => {
    setSelectedFiles([]);
    setContractNotes('');
    setUploadDialogOpen(true);
  };

  // Close upload dialog
  const handleCloseUploadDialog = () => {
    setUploadDialogOpen(false);
  };

  // Upload contract files
  const handleUploadContracts = async () => {
    if (!selectedFiles.length || !selectedApartment) {
      showNotification('Please select files and an apartment', 'error');
      return;
    }

    setUploading(true);
    try {
      // Create form data for file upload
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('apartmentId', selectedApartment.id);
      formData.append('notes', contractNotes);

      await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotification('Contract(s) uploaded successfully', 'success');
      setUploadDialogOpen(false);

      // Refresh contracts list
      fetchContracts(selectedApartment.id);
    } catch (error) {
      console.error('Error uploading contracts:', error);
      showNotification('Failed to upload contracts', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Download a contract
  const handleDownloadContract = async (contract) => {
    try {
      const response = await api.get(`/documents/download/${contract.id}`, {
        responseType: 'blob'
      });

      // Create a URL for the blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', contract.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading contract:', error);
      showNotification('Failed to download contract', 'error');
    }
  };

  // Delete a contract
  const handleDeleteContract = async (contract) => {
    if (!window.confirm(`Are you sure you want to delete ${contract.fileName}?`)) {
      return;
    }

    try {
      await api.delete(`/documents/contracts/${contract.id}`);
      showNotification('Contract deleted successfully', 'success');

      // Refresh contracts list
      fetchContracts(selectedApartment.id);
    } catch (error) {
      console.error('Error deleting contract:', error);
      showNotification('Failed to delete contract', 'error');
    }
  };

  // Open contract preview dialog
  const handleViewContract = (contract) => {
    setSelectedContract(contract);
    setViewDialogOpen(true);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get tenant names for display
  const getTenantNames = (apartment) => {
    if (!apartment.tenants) return 'No tenants';

    if (typeof apartment.tenants === 'string') {
      return apartment.tenants;
    }

    if (Array.isArray(apartment.tenants)) {
      return apartment.tenants
        .map(t => t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim())
        .filter(name => name)
        .join(', ') || 'No tenants';
    }

    return 'No tenants';
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <DescriptionIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
        <Typography variant="h5" component="h2">
          Contract Manager
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* Left side - Apartment Selection */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <ApartmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Properties
                </Typography>

                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={fetchApartments} disabled={loading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              <TextField
                fullWidth
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
                }}
                sx={{ mb: 2 }}
              />

              {loading ? (
                <Box display="flex" justifyContent="center" my={4}>
                  <CircularProgress />
                </Box>
              ) : Array.isArray(filteredApartments) && filteredApartments.length > 0 ? (
                <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                  {filteredApartments.map((apartment) => (
                    <Card
                      key={apartment.id}
                      variant="outlined"
                      sx={{
                        mb: 1,
                        cursor: 'pointer',
                        bgcolor: selectedApartment?.id === apartment.id ? 'primary.light' : 'background.paper',
                        '&:hover': {
                          boxShadow: 1,
                          bgcolor: selectedApartment?.id === apartment.id ? 'primary.light' : 'action.hover'
                        }
                      }}
                      onClick={() => handleApartmentSelect(apartment.id)}
                    >
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography fontWeight={selectedApartment?.id === apartment.id ? 'bold' : 'normal'}>
                          {apartment.address || 'Unknown Address'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getTenantNames(apartment)}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  {loading ? 'Loading properties...' : 'No properties found'}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right side - Contracts List & Actions */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  <DescriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  {selectedApartment ? `Contracts for ${selectedApartment.address}` : 'Contracts'}
                </Typography>

                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={handleOpenUploadDialog}
                  disabled={!selectedApartment}
                  size="small"
                >
                  Upload Contract
                </Button>
              </Box>

              {loading ? (
                <Box display="flex" justifyContent="center" my={4}>
                  <CircularProgress />
                </Box>
              ) : selectedApartment ? (
                contracts.length > 0 ? (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>File Name</TableCell>
                          <TableCell>Upload Date</TableCell>
                          <TableCell>Size</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Notes</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contracts.map((contract) => (
                          <TableRow key={contract.id} hover>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <DescriptionIcon fontSize="small" sx={{ mr: 1 }} />
                                <Typography variant="body2">{contract.fileName}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{formatDate(contract.uploadDate)}</TableCell>
                            <TableCell>{formatFileSize(contract.fileSize)}</TableCell>
                            <TableCell>
                              <Chip
                                label={contract.fileType || 'Unknown'}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{
                                  maxWidth: '150px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {contract.notes || 'No notes'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="View">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewContract(contract)}
                                  sx={{ color: 'primary.main' }}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDownloadContract(contract)}
                                  sx={{ color: 'success.main' }}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteContract(contract)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">
                    No contracts found for this property. Click "Upload Contract" to add contracts.
                  </Alert>
                )
              ) : (
                <Alert severity="info">
                  Please select a property to view and manage its contracts.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={handleCloseUploadDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              <UploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Upload Contracts
            </Typography>
            <IconButton onClick={handleCloseUploadDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedApartment && (
            <Box mb={3}>
              <Typography variant="subtitle1" gutterBottom>
                Selected Property:
              </Typography>
              <Chip
                icon={<ApartmentIcon />}
                label={selectedApartment.address}
                color="primary"
              />
            </Box>
          )}

          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              mb: 3
            }}
          >
            <input
              accept="application/pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              id="contained-button-file"
              multiple
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="contained-button-file">
              <Button
                variant="contained"
                component="span"
                startIcon={<AddIcon />}
              >
                Select Files
              </Button>
            </label>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Supported formats: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG
            </Typography>

            {selectedFiles.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Selected Files:
                </Typography>
                <Stack spacing={1}>
                  {selectedFiles.map((file, index) => (
                    <Chip
                      key={index}
                      label={`${file.name} (${formatFileSize(file.size)})`}
                      onDelete={() => {
                        const newFiles = [...selectedFiles];
                        newFiles.splice(index, 1);
                        setSelectedFiles(newFiles);
                      }}
                      sx={{ justifyContent: 'space-between' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>

          <TextField
            label="Notes (optional)"
            multiline
            rows={3}
            fullWidth
            value={contractNotes}
            onChange={handleNotesChange}
            placeholder="Add notes about these contracts..."
            variant="outlined"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseUploadDialog} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUploadContracts}
            disabled={selectedFiles.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={24} /> : <UploadIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Contract Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedContract?.fileName}
            </Typography>
            <IconButton onClick={() => setViewDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedContract && (
            <>
              <Box mb={2}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Upload Date:</Typography>
                    <Typography variant="body2">{formatDate(selectedContract.uploadDate)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">File Size:</Typography>
                    <Typography variant="body2">{formatFileSize(selectedContract.fileSize)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">File Type:</Typography>
                    <Typography variant="body2">{selectedContract.fileType || 'Unknown'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Apartment:</Typography>
                    <Typography variant="body2">{selectedApartment?.address}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2">Notes:</Typography>
                    <Typography variant="body2">{selectedContract.notes || 'No notes'}</Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Contract preview area */}
              <Box
                sx={{
                  height: '60vh',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  backgroundColor: 'grey.50'
                }}
              >
                <DescriptionIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" mb={2} color="text.secondary">
                  Preview not available for this file type.
                </Typography>
                <Typography variant="body2" mb={3} color="text.secondary">
                  Use the download button to view the full document.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleDownloadContract(selectedContract)}
                >
                  Download File
                </Button>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
          {selectedContract && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownloadContract(selectedContract)}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default ContractManager;
