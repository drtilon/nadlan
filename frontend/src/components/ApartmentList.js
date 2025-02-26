import React, { useState, useEffect } from 'react';
import {
  Paper, Typography, Button, Box, IconButton, Card, CardContent, Grid,
  CircularProgress, Divider, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import api from '../utils/api';

function ApartmentList({ onEdit, showNotification }) {
  const [apartments, setApartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchApartments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/list');
      setApartments(response.data);
    } catch (error) {
      console.error(error);
      showNotification('שגיאה בטעינת רשימת הדירות', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApartments();
  }, []);

  const handleExport = async () => {
    try {
      const response = await api.get('/export', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'apartments.xlsx');
      document.body.appendChild(link);
      link.click();
      showNotification('הקובץ יוצא בהצלחה');
    } catch (error) {
      console.error(error);
      showNotification('שגיאה בייצוא הקובץ', 'error');
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    if (status === 'מושכר') color = 'success';
    else if (status === 'פנוי') color = 'primary';
    else if (status === 'חוזה נשלח') color = 'warning';

    return (
      <Chip
        label={status || 'לא ידוע'}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };

  const openDetails = (apartment) => {
    setSelectedApartment(apartment);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">רשימת דירות</Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleExport}
            startIcon={<FileDownloadIcon />}
          >
            ייצוא ל-Excel
          </Button>
        </Box>

        {apartments.length === 0 ? (
          <Typography align="center" color="textSecondary" sx={{ py: 4 }}>
            לא נמצאו דירות. לחץ על + כדי להוסיף דירה חדשה.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {apartments.map((apartment) => (
              <Grid item xs={12} sm={6} md={4} key={apartment.id}>
                <Card
                  elevation={2}
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" noWrap sx={{ maxWidth: '70%' }}>
                        {apartment.address}
                      </Typography>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onEdit(apartment)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {apartment.rooms} חדרים | {apartment.size} מ"ר
                    </Typography>

                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {getStatusChip(apartment.status)}
                      <Button
                        size="small"
                        onClick={() => openDetails(apartment)}
                      >
                        פרטים נוספים
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Apartment Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedApartment && (
          <>
            <DialogTitle>
              <Typography variant="h6">{selectedApartment.address}</Typography>
            </DialogTitle>

            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">פרטי נכס</Typography>
                  <Typography variant="body1">מספר חדרים: {selectedApartment.rooms}</Typography>
                  <Typography variant="body1">גודל: {selectedApartment.size} מ"ר</Typography>
                  <Typography variant="body1">סטטוס: {selectedApartment.status}</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">פרטי תשלום</Typography>
                  <Typography variant="body1">שכ"ד חודשי: ₪{selectedApartment.rent}</Typography>
                  <Typography variant="body1">פיקדון: ₪{selectedApartment.deposit}</Typography>
                  <Typography variant="body1">IBAN: {selectedApartment.IBAN}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>


                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">דיירים</Typography>
                  <Typography variant="body1">
                    {selectedApartment.tenants
                      ? (Array.isArray(selectedApartment.tenants)
                        ? selectedApartment.tenants.map(tenant => tenant.name).join(", ")
                        : JSON.parse(selectedApartment.tenants).map(tenant => tenant.name).join(", "))
                      : 'אין דיירים'}
                  </Typography>
                  <Typography variant="body1">טלפון: {selectedApartment.tenantPhone || 'אין'}</Typography>
                  <Typography variant="body1">מייל: {selectedApartment.tenantEmail || 'אין'}</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">בעל הדירה</Typography>
                  <Typography variant="body1">{selectedApartment.landlordName || 'לא צוין'}</Typography>
                  <Typography variant="body1">טלפון: {selectedApartment.landlordPhone || 'אין'}</Typography>
                  <Typography variant="body1">מייל: {selectedApartment.landlordEmail || 'אין'}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="primary">תאריכים</Typography>
                  <Typography variant="body1">תאריך כניסה: {selectedApartment.moveInDate || 'לא צוין'}</Typography>
                  <Typography variant="body1">סיום חוזה: {selectedApartment.contractEndDate || 'לא צוין'}</Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>הערות</Typography>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, backgroundColor: '#f8f9fa' }}>
                    <Typography variant="body2">
                      {selectedApartment.notes || 'אין הערות'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions>
              <Button onClick={() => onEdit(selectedApartment)} color="primary">
                ערוך
              </Button>
              <Button onClick={() => setDetailsOpen(false)}>
                סגור
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}

export default ApartmentList;
