import React, { useState } from 'react';
import { Container, Paper, Typography, TextField, Button, CircularProgress } from '@mui/material';
import api from '../utils/api';

function LoginPage({ onLogin, showNotification, onSwitchToRegister }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', credentials);
      localStorage.setItem('token', response.data.access_token);
      onLogin();
      showNotification('Successful login', 'success');
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message;
      if (message === "Your account is pending admin approval.") {
        showNotification('Your account is pending admin approval.', 'error');
      } else {
        showNotification('Username or Password incorrect', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          Nadlan Management App
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
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
            label="Password"
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
            {isLoading ? <CircularProgress size={24} /> : 'Sign in'}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            sx={{ mt: 1 }}
            onClick={onSwitchToRegister}
          >
            Register
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default LoginPage;
