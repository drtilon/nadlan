import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  useTheme,
  Paper,
  FormControl,
  FormHelperText,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AlternateEmail as EmailIcon,
  LockOutlined as LockIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import api, { setAuthToken } from '../utils/api';

function LoginPage({ onLogin, showNotification, onSwitchToRegister }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const theme = useTheme();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });

    // Clear error when user types
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!credentials.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!credentials.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', credentials);
      setAuthToken(response.data.access_token);

      let userData = null;
      if (response.data.user) {
        userData = response.data.user;
      } else {
        userData = {
          username: credentials.username,
          role: 'admin'
        };
      }

      localStorage.setItem('userData', JSON.stringify(userData));
      onLogin(userData);
      showNotification('Login successful', 'success');
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message;
      if (message === "Your account is pending admin approval.") {
        showNotification('Your account is pending admin approval.', 'error');
      } else {
        showNotification('Invalid username or password', 'error');
        setErrors({ general: 'Invalid username or password' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#f8f9fa',
      }}
    >
      {/* Left side - Brand/Logo panel */}
      <Box
        sx={{
          flex: { xs: 0, md: '0 0 40%' },
          display: { xs: 'none', md: 'flex' },
          bgcolor: '#2563eb',
          direction: 'ltr',
          color: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '380px',
            p: 4,
          }}
        >
          <Typography
            variant="h2"
            fontWeight="bold"
            sx={{
              mb: 3,
              fontSize: '3rem',
              letterSpacing: '-0.5px',
            }}
          >
            Shefa UG
          </Typography>

          <Typography
            variant="h6"
            sx={{
              mb: 6,
              fontWeight: 400,
              opacity: 0.9,
            }}
          >
            Property Management Made Simple
          </Typography>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography
              variant="body1"
              sx={{ color: 'white', fontWeight: 300 }}
            >
              "Streamline your property management with our intuitive dashboard. Track payments, manage properties, and increase efficiency all in one place."
            </Typography>
          </Paper>
        </Box>

        {/* Simple geometric decorations */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '5%',
            right: '10%',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '15%',
            left: '15%',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            transform: 'rotate(25deg)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '20%',
            left: '25%',
            width: '80px',
            height: '20px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
      </Box>

      {/* Right side - Login form */}
      <Box
        sx={{
          flex: { xs: '1', md: '0 0 60%' },
          display: 'flex',
          direction: 'ltr',
          flexDirection: 'column',
          justifyContent: 'center',
          p: { xs: 3, sm: 6, md: 8 },
          maxWidth: { xs: '100%', md: '800px' },
          margin: '0 auto',
        }}
      >
        <Box sx={{ maxWidth: '450px', mx: 'auto', width: '100%' }}>
          <Typography
            variant="h4"
            fontWeight="600"
            color="#1e293b"
            sx={{ mb: 1 }}
          >
            Welcome back
          </Typography>

          <Typography
            variant="body1"
            color="#64748b"
            sx={{ mb: 4 }}
          >
            Please sign in to your account to continue
          </Typography>

          {errors.general && (
            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: '#fee2e2',
                color: '#b91c1c',
                borderRadius: 1,
                border: '1px solid #fecaca',
              }}
            >
              <Typography variant="body2">{errors.general}</Typography>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl fullWidth error={!!errors.username} sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                fontWeight="500"
                color="#334155"
                sx={{ mb: 1 }}
              >
                Username
              </Typography>

              <TextField
                fullWidth
                name="username"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={handleChange}
                autoFocus
                error={!!errors.username}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color={errors.username ? "error" : "action"} fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#cbd5e1',
                    },
                  }
                }}
                variant="outlined"
              />
              {errors.username && (
                <FormHelperText>{errors.username}</FormHelperText>
              )}
            </FormControl>

            <FormControl fullWidth error={!!errors.password} sx={{ mb: 4 }}>
              <Typography
                variant="body2"
                fontWeight="500"
                color="#334155"
                sx={{ mb: 1 }}
              >
                Password
              </Typography>

              <TextField
                fullWidth
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
                error={!!errors.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color={errors.password ? "error" : "action"} fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#cbd5e1',
                    },
                  }
                }}
                variant="outlined"
              />
              {errors.password && (
                <FormHelperText>{errors.password}</FormHelperText>
              )}
            </FormControl>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1,
                bgcolor: '#2563eb',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#1d4ed8',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <>
                  <LoginIcon sx={{ mr: 1, fontSize: 20 }} />
                  Sign in
                </>
              )}
            </Button>

            <Divider sx={{ my: 4, color: '#94a3b8' }}>
              <Typography variant="body2" sx={{ px: 1, color: '#64748b' }}>
                OR
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              onClick={onSwitchToRegister}
              sx={{
                py: 1.5,
                textTransform: 'none',
                borderRadius: 1,
                fontSize: '0.95rem',
                fontWeight: 500,
                borderColor: '#e2e8f0',
                color: '#334155',
                '&:hover': {
                  borderColor: '#cbd5e1',
                  bgcolor: 'rgba(226, 232, 240, 0.2)',
                }
              }}
            >
              Create an Account
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
}

export default LoginPage;
