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
  useMediaQuery,
  Paper,
  FormControl,
  FormHelperText,
  Link
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AlternateEmail as EmailIcon,
  LockOutlined as LockIcon,
  ArrowBack as ArrowBackIcon,
  PersonAddAlt as PersonAddIcon
} from '@mui/icons-material';
import api from '../utils/api';

function RegisterPage({ showNotification, onSwitchToLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    // Clear error when user types
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        username: formData.username,
        password: formData.password
      });
      showNotification('Registration successful! Waiting for admin approval', 'success');
      onSwitchToLogin();
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message;
      if (message && message.includes('taken')) {
        setErrors({ username: 'This username is already taken' });
      } else {
        setErrors({ general: 'Registration failed. Please try again.' });
      }
      showNotification('Registration failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        overflow: 'hidden'
      }}
    >
      {/* Left side - Brand/Logo panel */}
      <Box
        sx={{
          flex: { xs: '1', md: '0 0 45%' },
          bgcolor: 'primary.main',
          backgroundImage: 'linear-gradient(135deg, #1A237E 0%, #3F51B5 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          px: 3,
          py: { xs: 5, md: 0 }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            maxWidth: '500px',
            position: 'relative',
            zIndex: 2
          }}
        >
          <Typography
            variant="h2"
            fontWeight="bold"
            sx={{
              mb: 2,
              fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              letterSpacing: '-0.5px'
            }}
          >
            Shefa UG
          </Typography>

          <Typography
            variant="h5"
            sx={{
              mb: 4,
              opacity: 0.9,
              fontWeight: 300,
              maxWidth: '400px',
              fontSize: { xs: '1.2rem', sm: '1.5rem' }
            }}
          >
            Join Our Property Management Platform
          </Typography>

          {!isMobile && (
            <Box sx={{ mt: 4 }}>
              <Paper
                elevation={6}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  maxWidth: '400px'
                }}
              >
                <Typography
                  variant="body1"
                  sx={{ color: 'white', fontStyle: 'italic', opacity: 0.9 }}
                >
                  "Create your account today to start tracking your properties, managing leases, and streamlining your workflow with our comprehensive management tools."
                </Typography>
              </Paper>
            </Box>
          )}
        </Box>

        {/* Background overlay patterns */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.1)',
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(41, 53, 86, 0.8) 0%, transparent 100%)`,
            zIndex: 1
          }}
        />
      </Box>

      {/* Right side - Register form */}
      <Box
        sx={{
          flex: { xs: '1', md: '0 0 55%' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: { xs: 3, sm: 6, md: 8 },
          maxWidth: { xs: '100%', md: '800px' },
          margin: '0 auto'
        }}
      >
        <Box sx={{ maxWidth: '450px', mx: 'auto', width: '100%' }}>
          <Typography
            variant="h4"
            fontWeight="bold"
            color="text.primary"
            sx={{ mb: 1 }}
          >
            Create Your Account
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Fill in the information below to register
          </Typography>

          {errors.general && (
            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'error.light',
                color: 'error.dark',
                borderRadius: 1,
                borderLeft: '4px solid',
                borderColor: 'error.main'
              }}
            >
              <Typography variant="body2">{errors.general}</Typography>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl fullWidth error={!!errors.username} sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                fontWeight="medium"
                color="text.primary"
                sx={{ mb: 1 }}
              >
                Username
              </Typography>

              <TextField
                fullWidth
                name="username"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
                autoFocus
                error={!!errors.username}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color={errors.username ? "error" : "action"} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                    }
                  }
                }}
                variant="outlined"
              />
              {errors.username && (
                <FormHelperText>{errors.username}</FormHelperText>
              )}
            </FormControl>

            <FormControl fullWidth error={!!errors.password} sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                fontWeight="medium"
                color="text.primary"
                sx={{ mb: 1 }}
              >
                Password
              </Typography>

              <TextField
                fullWidth
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color={errors.password ? "error" : "action"} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                    }
                  }
                }}
                variant="outlined"
              />
              {errors.password && (
                <FormHelperText>{errors.password}</FormHelperText>
              )}
            </FormControl>

            <FormControl fullWidth error={!!errors.confirmPassword} sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                fontWeight="medium"
                color="text.primary"
                sx={{ mb: 1 }}
              >
                Confirm Password
              </Typography>

              <TextField
                fullWidth
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!errors.confirmPassword}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color={errors.confirmPassword ? "error" : "action"} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                    }
                  }
                }}
                variant="outlined"
              />
              {errors.confirmPassword && (
                <FormHelperText>{errors.confirmPassword}</FormHelperText>
              )}
            </FormControl>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={isLoading}
              sx={{
                mt: 2,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 'medium',
                textTransform: 'none',
                borderRadius: 1.5,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                position: 'relative',
                overflow: 'hidden',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  transform: 'translateX(-100%)',
                  transition: 'transform 0.5s ease-in-out'
                },
                '&:hover::after': {
                  transform: 'translateX(100%)'
                }
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <>
                  <PersonAddIcon sx={{ mr: 1 }} />
                  Create Account
                </>
              )}
            </Button>

            <Divider sx={{ my: 4, opacity: 0.7 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              color="primary"
              onClick={onSwitchToLogin}
              startIcon={<ArrowBackIcon />}
              sx={{
                py: 1.5,
                textTransform: 'none',
                borderRadius: 1.5,
                fontSize: '1rem',
                borderWidth: 1.5,
                '&:hover': {
                  borderWidth: 1.5,
                  bgcolor: 'rgba(63, 81, 181, 0.04)'
                }
              }}
            >
              Back to Login
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
}

export default RegisterPage;
