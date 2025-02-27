import React, { useState } from 'react';
import { Container, Paper, Typography, TextField, Button, CircularProgress } from '@mui/material';
import api from '../utils/api';

function RegisterPage({ showNotification, onSwitchToLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      showNotification('הסיסמאות אינן תואמות', 'error');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/register', { username: formData.username, password: formData.password });
      showNotification('נרשמת בהצלחה! ההרשמה ממתינה לאישור מנהל', 'success');
      onSwitchToLogin(); // Redirect to login after success
    } catch (error) {
      console.error(error);
      showNotification('שם משתמש תפוס או שגיאה בהרשמה', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
          הרשמה למערכת
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            fullWidth
            label="שם משתמש"
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="סיסמה"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="אימות סיסמה"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            margin="normal"
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'הרשמה'}
          </Button>
        </form>
        <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={onSwitchToLogin}>
          כבר יש לך חשבון? התחבר כאן
        </Button>
      </Paper>
    </Container>
  );
}

export default RegisterPage;

