import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowBack as ArrowBackIcon,
  PersonAddAlt as PersonAddIcon
} from '@mui/icons-material';
import api from '../../utils/api';

function RegisterPage({ showNotification }) {
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const theme = useTheme();
  const navigate = useNavigate();

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
      navigate('/login');
      
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

  const handleSwitchToLogin = () => {
    navigate('/login');
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
            Join Our Property Management Platform
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
              "Create your account today to start tracking your properties, managing leases, and streamlining your workflow with our comprehensive management tools."
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

      {/* Right side - Register form */}
      <Box
        sx={{
          flex: { xs: '1', md: '0 0 60%' },
          display: 'flex',
          flexDirection: 'column',
          direction: 'ltr',
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
            Create Your Account
          </Typography>

          <Typography
            variant="body1"
            color="#64748b"
            sx={{ mb: 4 }}
          >
            Fill in the information below to register
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
                placeholder="Choose a username"
                value={formData.username}
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

            <FormControl fullWidth error={!!errors.password} sx={{ mb: 3 }}>
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
                placeholder="Create a password"
                value={formData.password}
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

            <FormControl fullWidth error={!!errors.confirmPassword} sx={{ mb: 4 }}>
              <Typography
                variant="body2"
                fontWeight="500"
                color="#334155"
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
                      <LockIcon color={errors.confirmPassword ? "error" : "action"} fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
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
              {errors.confirmPassword && (
                <FormHelperText>{errors.confirmPassword}</FormHelperText>
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
                  <PersonAddIcon sx={{ mr: 1, fontSize: 20 }} />
                  Create Account
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
              onClick={handleSwitchToLogin}
              startIcon={<ArrowBackIcon fontSize="small" />}
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
              Back to Login
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
}

export default RegisterPage;
