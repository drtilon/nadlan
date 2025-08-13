// ContractExtensionDialog.jsx - Create this as a new file
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Alert,
  IconButton
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';

const ContractExtensionDialog = ({
  open,
  onClose,
  apartment,
  onExtend,
  isSubmitting = false
}) => {
  const [extensionMonths, setExtensionMonths] = useState(12);
  const [customDate, setCustomDate] = useState('');
  const [extensionType, setExtensionType] = useState('months'); // 'months' or 'custom'

  // Calculate new end date based on current end date + months
  const calculateNewEndDate = () => {
    if (!apartment?.contractEndDate) return null;

    const currentEndDate = new Date(apartment.contractEndDate);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);

    return newEndDate;
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString();
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleExtend = () => {
    let newEndDate;

    if (extensionType === 'custom') {
      if (!customDate) {
        alert('Please select a new end date');
        return;
      }
      newEndDate = new Date(customDate);
    } else {
      newEndDate = calculateNewEndDate();
    }

    if (!newEndDate) {
      alert('Unable to calculate new end date');
      return;
    }

    // Call the parent function with the new end date
    onExtend(apartment.id, newEndDate);
  };

  const handleClose = () => {
    // Reset form when closing
    setExtensionMonths(12);
    setCustomDate('');
    setExtensionType('months');
    onClose();
  };

  const newEndDate = extensionType === 'months' ? calculateNewEndDate() : (customDate ? new Date(customDate) : null);
  const currentEndDate = apartment?.contractEndDate ? new Date(apartment.contractEndDate) : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
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
          <AccessTimeIcon />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Extend Contract Period
          </Typography>
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={handleClose}
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {apartment && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>{apartment.address}</strong>
              </Typography>
              <Typography variant="caption" display="block">
                Current contract ends: {currentEndDate ? formatDate(currentEndDate) : 'No end date set'}
              </Typography>
            </Alert>

            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Extension Type</InputLabel>
                <Select
                  value={extensionType}
                  onChange={(e) => setExtensionType(e.target.value)}
                  label="Extension Type"
                >
                  <MenuItem value="months">Extend by months</MenuItem>
                  <MenuItem value="custom">Set custom end date</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {extensionType === 'months' ? (
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Extend by</InputLabel>
                  <Select
                    value={extensionMonths}
                    onChange={(e) => setExtensionMonths(e.target.value)}
                    label="Extend by"
                  >
                    <MenuItem value={1}>1 month</MenuItem>
                    <MenuItem value={3}>3 months</MenuItem>
                    <MenuItem value={6}>6 months</MenuItem>
                    <MenuItem value={12}>12 months (1 year)</MenuItem>
                    <MenuItem value={24}>24 months (2 years)</MenuItem>
                    <MenuItem value={36}>36 months (3 years)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            ) : (
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="New Contract End Date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: currentEndDate ? formatDateForInput(currentEndDate) : undefined
                  }}
                />
              </Box>
            )}

            {newEndDate && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>New contract end date:</strong> {formatDate(newEndDate)}
                </Typography>
                {currentEndDate && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Extension period: {Math.round((newEndDate - currentEndDate) / (1000 * 60 * 60 * 24))} days
                  </Typography>
                )}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          startIcon={<CloseIcon />}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleExtend}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={isSubmitting || !newEndDate}
        >
          {isSubmitting ? 'Extending...' : 'Extend Contract'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContractExtensionDialog;
