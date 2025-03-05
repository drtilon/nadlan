import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  InputAdornment,
  IconButton,
  Divider,
  Card,
  CardContent,
  alpha
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Lock as LockIcon,
  Login as LoginIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import api, { setAuthToken } from '../utils/api';

function LoginPage({ onLogin, showNotification, onSwitchToRegister }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', credentials);

      // Store token
      setAuthToken(response.data.access_token);

      // Extract user data from response
      let userData = null;

      // Check various possible locations of user data in the response
      if (response.data.user) {
        userData = response.data.user;
      } else {
        // Create a default user object
        userData = {
          username: credentials.username,
          // For testing/development - set all users as admin
          // In production, this should come from the backend
          role: 'admin'
        };
      }

      // For debugging - log the response and extracted user data
      console.log('Login response:', response.data);
      console.log('Extracted user data:', userData);

      // Store user data
      localStorage.setItem('userData', JSON.stringify(userData));

      // Notify parent component
      onLogin(userData);
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

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 3
      }}
    >
      <Card
        elevation={8}
        sx={{
          maxWidth: 450,
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}
      >
        <Box
          sx={{
            padding: 3,
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          <HomeIcon fontSize="large" />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Shefa UG
          </Typography>
        </Box>

        <CardContent sx={{ padding: 4 }}>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            color="text.primary"
            fontWeight="medium"
            sx={{ mb: 3 }}
          >
            Welcome Back
          </Typography>
          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Sign in to your account to continue
          </Typography>

          <form onSubmit={handleSubmit}>
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                      size="large"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              sx={{
                mt: 3,
                mb: 3,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              disabled={isLoading}
              startIcon={isLoading ? null : <LoginIcon />}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>

            <Divider sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                New User?
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              sx={{
                mt: 1,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                bgcolor: alpha('#f3f4f6', 0.5),
                '&:hover': {
                  bgcolor: alpha('#f3f4f6', 0.8),
                }
              }}
              onClick={onSwitchToRegister}
            >
              Create New Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;
