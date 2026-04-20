import React from 'react';
import PropTypes from 'prop-types';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { useQuery } from 'react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const mockChartData = [
  { month: 'Jan', batches: 45 }, { month: 'Feb', batches: 52 }, { month: 'Mar', batches: 49 },
  { month: 'Apr', batches: 63 }, { month: 'May', batches: 58 }, { month: 'Jun', batches: 71 },
];

function StatCard({ title, value, color, subtitle }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
        <Typography variant="h4" color={color || 'primary'} fontWeight={700}>{value}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </CardContent>
    </Card>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
  subtitle: PropTypes.string,
};

export default function Dashboard() {
  const { data: drugs, isLoading: drugsLoading } = useQuery('drugs', () => api.get('/drugs').then(r => r.data), { retry: false });
  const { data: inventory } = useQuery('inventory', () => api.get('/inventory').then(r => r.data), { retry: false });
  const { data: batches } = useQuery('batches', () => api.get('/manufacturing').then(r => r.data), { retry: false });
  const { data: suppliers } = useQuery('suppliers', () => api.get('/suppliers').then(r => r.data), { retry: false });

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={3}>Dashboard</Typography>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Drugs" value={drugsLoading ? '...' : (drugs?.length || 0)} subtitle="In catalog" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Inventory Items" value={inventory?.length || 0} color="success.main" subtitle="Active items" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Batches" value={batches?.length || 0} color="warning.main" subtitle="In production" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Suppliers" value={suppliers?.length || 0} color="info.main" subtitle="Registered" />
        </Grid>
      </Grid>
      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>Monthly Production Batches</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="batches" stroke="#1B447A" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
