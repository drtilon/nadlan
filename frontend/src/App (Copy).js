import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

// Create RTL theme with blue primary color
const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Rubik, Arial, sans-serif',
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& label': {
            right: 14,
            transformOrigin: 'right',
          },
          '& legend': {
            textAlign: 'right',
          },
        },
      },
    },
  },
});

// API service
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Set auth token for API requests
const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

// Main App Component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('list'); // 'list', 'add', 'edit'
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [editingApartment, setEditingApartment] = useState(null);

  // Check for existing token on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box dir="rtl" sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {isAuthenticated ? (
          <AuthenticatedApp 
            onLogout={handleLogout} 
            activeView={activeView}
            setActiveView={setActiveView}
            showNotification={showNotification}
            editingApartment={editingApartment}
            setEditingApartment={setEditingApartment}
          />
        ) : (
          <LoginPage onLogin={() => setIsAuthenticated(true)} showNotification={showNotification} />
        )}
        
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={() => setNotification({...notification, open: false})}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={notification.severity} variant="filled">
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

// Login Page Component
function LoginPage({ onLogin, showNotification }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await api.post('/login', credentials);
      setAuthToken(response.data.token);
      onLogin();
      showNotification('התחברת בהצלחה');
    } catch (error) {
      console.error(error);
      showNotification('שם משתמש או סיסמה שגויים', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
          ניהול דירות להשכרה
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label="שם משתמש"
            name="username"
            autoComplete="username"
            autoFocus
            value={credentials.username}
            onChange={handleChange}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="סיסמה"
            type="password"
            id="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={handleChange}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'התחבר'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

// Main Authenticated App
function AuthenticatedApp({ onLogout, activeView, setActiveView, showNotification, editingApartment, setEditingApartment }) {
  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            ניהול דירות להשכרה
          </Typography>
          <IconButton color="inherit" onClick={() => setActiveView('list')}>
            <HomeIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => {
            setEditingApartment(null);
            setActiveView('add');
          }}>
            <AddCircleIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {activeView === 'list' && (
          <ApartmentList 
            onEdit={(apartment) => {
              setEditingApartment(apartment);
              setActiveView('edit');
            }}
            showNotification={showNotification}
          />
        )}
        
        {activeView === 'add' && (
          <ApartmentForm 
            onSuccess={() => {
              setActiveView('list');
              showNotification('דירה נוספה בהצלחה');
            }}
            showNotification={showNotification}
          />
        )}
        
        {activeView === 'edit' && editingApartment && (
          <ApartmentForm 
            isEdit={true}
            initialData={editingApartment}
            onSuccess={() => {
              setActiveView('list');
              showNotification('דירה עודכנה בהצלחה');
            }}
            showNotification={showNotification}
          />
        )}
      </Container>
    </>
  );
}

// Apartment Form Component (for both Add and Edit)
function ApartmentForm({ isEdit = false, initialData = {}, onSuccess, showNotification }) {
  const emptyForm = {
    address: '',
    rooms: '',
    size: '',
    tenants: '',
    tenantEmail: '',
    tenantPhone: '',
    landlordName: '',
    landlordEmail: '',
    landlordPhone: '',
    moveInDate: '',
    contractEndDate: '',
    rent: '',
    deposit: '',
    notes: '',
    IBAN: '',
    status: ''
  };

  const [formData, setFormData] = useState(isEdit ? initialData : emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/edit/${initialData.id}`, formData);
      } else {
        await api.post('/add', formData);
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      showNotification(`שגיאה: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 4, mb: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>
        {isEdit ? 'עריכת פרטי דירה' : 'הוספת דירה חדשה'}
      </Typography>
      
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              פרטי הנכס
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="כתובת דירה"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="מספר חדרים"
              name="rooms"
              value={formData.rooms}
              onChange={handleChange}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="גודל במ״ר"
              name="size"
              value={formData.size}
              onChange={handleChange}
              required
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
              פרטי דיירים
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="שמות דיירים"
              name="tenants"
              value={formData.tenants}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="email"
              label="מייל דייר"
              name="tenantEmail"
              value={formData.tenantEmail}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="טלפון דייר"
              name="tenantPhone"
              value={formData.tenantPhone}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
              פרטי בעל הדירה
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="שם בעל דירה"
              name="landlordName"
              value={formData.landlordName}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="email"
              label="מייל בעל דירה"
              name="landlordEmail"
              value={formData.landlordEmail}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="טלפון בעל דירה"
              name="landlordPhone"
              value={formData.landlordPhone}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom color="primary" sx={{ mt: 2 }}>
              פרטי חוזה
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="תאריך כניסה"
              name="moveInDate"
              InputLabelProps={{ shrink: true }}
              value={formData.moveInDate || ''}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="תאריך סיום חוזה"
              name="contractEndDate"
              InputLabelProps={{ shrink: true }}
              value={formData.contractEndDate || ''}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="שכירות חודשית (₪)"
              name="rent"
              value={formData.rent}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="פיקדון (₪)"
              name="deposit"
              value={formData.deposit}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="IBAN לשכירות"
              name="IBAN"
              value={formData.IBAN}
              onChange={handleChange}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="status-label">סטטוס</InputLabel>
              <Select
                labelId="status-label"
                label="סטטוס"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <MenuItem value="מושכר">מושכר</MenuItem>
                <MenuItem value="פנוי">פנוי</MenuItem>
                <MenuItem value="חוזה נשלח">חוזה נשלח</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="הערות"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              multiline
              rows={3}
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sx={{ textAlign: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              type="submit"
              size="large"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
              sx={{ minWidth: 150 }}
            >
              {isEdit ? 'עדכון דירה' : 'הוספת דירה'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}

// Apartment List Component
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
                  <Typography variant="body1">{selectedApartment.tenants || 'אין דיירים'}</Typography>
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

export default App;
