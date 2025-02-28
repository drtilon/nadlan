import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
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
  PersonAdd as RegisterIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import api from '../utils/api';

function RegisterPage({ showNotification, onSwitchToLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/register', { username: formData.username, password: formData.password });
      showNotification('Registration successful! Waiting for admin approval', 'success');
      onSwitchToLogin(); // Redirect to login after success
    } catch (error) {
      console.error(error);
      showNotification('Username is taken or registration error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
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
            Nadlan
          </Typography>
        </Box>

        <CardContent sx={{ padding: 4 }}>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            color="text.primary"
            fontWeight="medium"
            sx={{ mb: 2 }}
          >
            Create Your Account
          </Typography>
          <Typography
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Register to start managing your properties
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
              value={formData.username}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
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
              autoComplete="new-password"
              value={formData.password}
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

            <TextField
              variant="outlined"
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              autoComplete="new-password"
              value={formData.confirmPassword}
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
                      onClick={handleToggleConfirmPasswordVisibility}
                      edge="end"
                      size="large"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              error={formData.password !== formData.confirmPassword && formData.confirmPassword !== ''}
              helperText={
                formData.password !== formData.confirmPassword && formData.confirmPassword !== ''
                  ? 'Passwords do not match'
                  : ''
              }
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              sx={{
                mt: 3,
                mb: 2,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              disabled={isLoading}
              startIcon={isLoading ? null : <RegisterIcon />}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
            </Button>

            <Divider sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              color="secondary"
              sx={{
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                bgcolor: alpha('#f3f4f6', 0.5),
                '&:hover': {
                  bgcolor: alpha('#f3f4f6', 0.8),
                }
              }}
              onClick={onSwitchToLogin}
              startIcon={<ArrowBackIcon />}
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

export default RegisterPage;
