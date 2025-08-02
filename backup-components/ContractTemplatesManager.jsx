// src/components/ContractTemplatesManager.jsx
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
  FormControlLabel,
  Switch,
  Card,
  CardContent
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CloudUpload as UploadIcon,
  Description as DescriptionIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import api from '../utils/api';

function ContractTemplatesManager({ showNotification, onTemplatesUpdated }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available contract templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/documents/templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching contract templates:', error);
      showNotification('Failed to load contract templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Notify parent component when templates are updated
  const notifyTemplatesUpdated = () => {
    if (onTemplatesUpdated) {
      onTemplatesUpdated();
    }
  };

  const handleOpenDialog = (template = null) => {
    if (template) {
      // Edit mode
      setFormData({
        name: template.name || '',
        description: template.description || '',
        isDefault: template.isDefault || false
      });
      setEditMode(true);
      setEditId(template.id);
    } else {
      // Add mode
      setFormData({
        name: '',
        description: '',
        isDefault: false
      });
      setEditMode(false);
      setEditId(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setUploadDialogOpen(false);
    setSelectedFile(null);
  };

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'isDefault' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      showNotification('Template name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editMode) {
        // Update existing template
        await api.put(`/documents/templates/${editId}`, formData);
        showNotification('Template updated successfully', 'success');
      } else {
        // Add new template
        await api.post('/documents/templates', formData);
        showNotification('Template added successfully', 'success');
      }

      // Refresh the template list
      fetchTemplates();
      // Notify parent component
      notifyTemplatesUpdated();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving template:', error);
      showNotification('Error saving template', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadTemplate = async () => {
    if (!selectedFile) {
      showNotification('Please select a file to upload', 'error');
      return;
    }

    if (!formData.name) {
      showNotification('Template name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fileFormData = new FormData();
      fileFormData.append('file', selectedFile);
      fileFormData.append('name', formData.name);
      fileFormData.append('description', formData.description);
      fileFormData.append('isDefault', formData.isDefault);

      // Upload new template
      await api.post('/documents/templates/upload', fileFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotification('Template uploaded successfully', 'success');
      fetchTemplates();
      // Notify parent component
      notifyTemplatesUpdated();
      handleCloseDialog();
    } catch (error) {
      console.error('Error uploading template:', error);
      showNotification('Error uploading template', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.delete(`/documents/templates/${id}`);
      showNotification('Template deleted successfully', 'success');
      fetchTemplates();
      // Notify parent component
      notifyTemplatesUpdated();
    } catch (error) {
      console.error('Error deleting template:', error);
      showNotification('Error deleting template', 'error');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.put(`/documents/templates/${id}/default`, { isDefault: true });
      showNotification('Default template updated', 'success');
      fetchTemplates();
      // Notify parent component
      notifyTemplatesUpdated();
    } catch (error) {
      console.error('Error setting default template:', error);
      showNotification('Error updating default template', 'error');
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <DescriptionIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
        <Typography variant="h5" component="h2">
          Manage Contract Templates
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Template
        </Button>

        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => {
            setFormData({
              name: '',
              description: '',
              isDefault: false
            });
            setUploadDialogOpen(true);
          }}
        >
          Upload Template
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Alert severity="info" sx={{ mt: 3 }}>
          No contract templates found. Click "Add Template" to create one.
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Template Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DescriptionIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1">{template.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{template.description}</TableCell>
                  <TableCell>
                    {template.is_default ? (
                      <Chip label="Default" color="success" size="small" icon={<CheckIcon />} />
                    ) : (
                      <Chip label="Optional" variant="outlined" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      {!template.is_default && (
                        <Tooltip title="Set as Default">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleSetDefault(template.id)}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenDialog(template)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteTemplate(template.id)}
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

      {/* Add/Edit Template Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Contract Template' : 'Add Contract Template'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" noValidate sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Template Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={3}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={handleChange}
                  name="isDefault"
                />
              }
              label="Set as Default Template"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} /> : editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Template Dialog */}
      <Dialog open={uploadDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Contract Template</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 2 }}>
            Upload a DOCX file with placeholders. Supported placeholders like {'{TENANT_NAME}'},
            {'{ADDRESS}'}, etc. will be automatically replaced.
          </Alert>
          <Box component="form" noValidate sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Template Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={3}
            />
            <Box sx={{ mt: 3, mb: 2 }}>
              <input
                accept=".docx"
                style={{ display: 'none' }}
                id="template-file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="template-file-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  fullWidth
                >
                  {selectedFile ? selectedFile.name : 'Choose Template File (.docx)'}
                </Button>
              </label>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={handleChange}
                  name="isDefault"
                />
              }
              label="Set as Default Template"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleUploadTemplate}
            variant="contained"
            disabled={isSubmitting || !selectedFile}
          >
            {isSubmitting ? <CircularProgress size={24} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default ContractTemplatesManager;
