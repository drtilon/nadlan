// src/components/LandlordsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  LinearProgress,
  Tooltip,
  InputAdornment,
  Alert,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Visibility as ViewIcon,
  CreditCard as IbanIcon
} from '@mui/icons-material';
import api from '../utils/api';
import LandlordDetails from './LandlordDetails';
import EnhancedLandlordForm from './EnhancedLandlordForm';

function LandlordsPanel({ showNotification }) {
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingLandlord, setEditingLandlord] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    iban: '',
    company_address: '',
    notes: ''
  });
  const [filteredLandlords, setFilteredLandlords] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [landlordToDelete, setLandlordToDelete] = useState(null);
  const [selectedLandlord, setSelectedLandlord] = useState(null);

  // Fetch landlords data
  useEffect(() => {
    fetchData();
  }, []);

  // Filter landlords based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredLandlords(landlords);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = landlords.filter(landlord =>
      landlord.name.toLowerCase().includes(query) ||
      landlord.company_name.toLowerCase().includes(query) ||
      (landlord.email && landlord.email.toLowerCase().includes(query)) ||
      (landlord.phone && landlord.phone.toLowerCase().includes(query)) ||
      (landlord.company_address && landlord.company_address.toLowerCase().includes(query))
    );
    setFilteredLandlords(filtered);
  }, [searchQuery, landlords]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch landlords
      const landlordsResponse = await api.get('/landlords/list');
      setLandlords(landlordsResponse.data);
      setFilteredLandlords(landlordsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading landlord data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (landlord = null) => {
    if (landlord) {
      // Edit mode
      setEditingLandlord(landlord);
      setFormData({
        company_name: landlord.company_name || '',
        name: landlord.name || '',
        email: landlord.email || '',
        phone: landlord.phone || '',
        iban: landlord.iban || '',
        company_address: landlord.company_address || '',
        notes: landlord.notes || ''
      });
    } else {
      // Add mode
      setEditingLandlord(null);
      setFormData({
        company_name: '',
        name: '',
        email: '',
        phone: '',
        iban: '',
        company_address: '',
        notes: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!formData.company_name || !formData.name) {
      showNotification('Company name and landlord name are required', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingLandlord) {
        // Update existing landlord
        await api.put(`/landlords/${editingLandlord.id}`, formData);
        showNotification('Landlord updated successfully', 'success');
      } else {
        // Add new landlord
        await api.post('/landlords/add', formData);
        showNotification('Landlord added successfully', 'success');
      }

      fetchData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving landlord:', error);
      showNotification('Error saving landlord data', 'error');
      setFormSubmitting(false);
    }
  };

  const openDeleteConfirmation = (landlord) => {
    setLandlordToDelete(landlord);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteLandlord = async () => {
    if (!landlordToDelete) return;

    setFormSubmitting(true);
    try {
      await api.delete(`/landlords/${landlordToDelete.id}`);
      showNotification('Landlord deleted successfully', 'success');
      fetchData();
      setConfirmDeleteOpen(false);
    } catch (error) {
      console.error('Error deleting landlord:', error);
      if (error.response && error.response.status === 400) {
        showNotification('Cannot delete landlord with associated apartments', 'error');
      } else {
        showNotification('Error deleting landlord', 'error');
      }
    } finally {
      setFormSubmitting(false);
      setLandlordToDelete(null);
    }
  };

  // Handle view landlord details
  const handleViewLandlord = (landlord) => {
    setSelectedLandlord(landlord.id);
  };

  // If a landlord is selected, show landlord details
  if (selectedLandlord) {
    return (
      <LandlordDetails
        landlordId={selectedLandlord}
        onBack={() => setSelectedLandlord(null)}
        showNotification={showNotification}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
            <BusinessIcon sx={{ mr: 1 }} /> Landlord Management
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add New Landlord
          </Button>
        </Box>

        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            placeholder="Search landlords..."
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, maxWidth: 500 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
          </Box>
        ) : (
          <>
            {filteredLandlords.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No landlords found. Add landlords using the button above.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead sx={{ bgcolor: 'primary.light' }}>
                    <TableRow>
                      <TableCell>Company Name</TableCell>
                      <TableCell>Landlord Name</TableCell>
                      <TableCell>Contact Information</TableCell>
                      <TableCell>Properties</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLandlords.map((landlord) => (
                      <TableRow
                        key={landlord.id}
                        hover
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handleViewLandlord(landlord)}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="subtitle1">
                              {landlord.company_name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1">{landlord.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack spacing={1}>
                            {landlord.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography variant="body2">{landlord.email}</Typography>
                              </Box>
                            )}
                            {landlord.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography variant="body2">{landlord.phone}</Typography>
                              </Box>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={<HomeIcon />}
                            label={`${landlord.apartment_count || 0} properties`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="View Details">
                            <IconButton
                              color="info"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewLandlord(landlord);
                              }}
                              size="small"
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Landlord">
                            <IconButton
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDialog(landlord);
                              }}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Landlord">
                            <IconButton
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteConfirmation(landlord);
                              }}
                              size="small"
                              disabled={landlord.apartment_count > 0}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Paper>

      {/* Add/Edit Landlord Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingLandlord ? 'Edit Landlord' : 'Add New Landlord'}
        </DialogTitle>
        <EnhancedLandlordForm
          formData={formData}
          setFormData={setFormData}
          editingLandlord={editingLandlord}
          formSubmitting={formSubmitting}
          handleCloseDialog={handleCloseDialog}
          handleSubmit={handleSubmit}
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography>
            Are you sure you want to delete the landlord "{landlordToDelete?.name}"?
            This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
            <Button
              onClick={() => setConfirmDeleteOpen(false)}
              color="inherit"
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteLandlord}
              color="error"
              variant="contained"
              disabled={formSubmitting}
              startIcon={formSubmitting ? <LinearProgress size={20} /> : <DeleteIcon />}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Container>
  );
}

export default LandlordsPanel;
