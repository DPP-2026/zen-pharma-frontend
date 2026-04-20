import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, TextField, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, Divider,
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 40%, #01579b 100%)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          overflow: 'visible',
        }}
      >
        {/* Branded header strip */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1565c0, #0288d1)',
            borderRadius: '12px 12px 0 0',
            py: 3,
            px: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              backdropFilter: 'blur(4px)',
            }}
          >
            <MedicationIcon sx={{ fontSize: 36, color: '#fff' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="#fff" letterSpacing={0.5}>
            PharmaDev Portal
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
            Medicine Manufacturing Management System
          </Typography>
        </Box>

        <CardContent sx={{ p: 4, pt: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} color="text.primary" mb={0.5}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Sign in to continue to your dashboard
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              margin="normal"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(v => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 3,
                py: 1.4,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #1565c0, #0288d1)',
                boxShadow: '0 4px 16px rgba(2,136,209,0.4)',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(135deg, #0d47a1, #0277bd)',
                  boxShadow: '0 6px 20px rgba(2,136,209,0.5)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }} />

          <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Default credentials:&nbsp;
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>admin</Box>
              &nbsp;/&nbsp;
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>changeme</Box>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
