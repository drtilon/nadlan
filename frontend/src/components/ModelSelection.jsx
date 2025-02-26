// ModelSelection.js
import React from 'react';
import { Grid, Box, Typography } from '@mui/material';

const ModelSelection = ({ onSelect }) => {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6}>
        <Box
          onClick={() => onSelect('management')}
          sx={{
            p: 3,
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          <Typography variant="h6">Management Model</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Profit calculated as a percentage of income.
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box
          onClick={() => onSelect('rental')}
          sx={{
            p: 3,
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          <Typography variant="h6">Rental Model</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Profit calculated as the difference between income and the rent paid.
          </Typography>
        </Box>
      </Grid>
    </Grid>
  );
};

export default ModelSelection;

