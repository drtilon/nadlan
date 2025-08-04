// src/components/common/Pagination.jsx
import React from 'react';
import { Box, Pagination as MuiPagination, Typography, Select, MenuItem, FormControl } from '@mui/material';

const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100]
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePageChange = (event, value) => {
    onPageChange(value);
  };

  const handleItemsPerPageChange = (event) => {
    onItemsPerPageChange(event.target.value);
    // Reset to first page when changing items per page
    onPageChange(1);
  };

  // Calculate the range of items being displayed
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      mt: 2,
      mb: 2,
      gap: 2
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {startItem} to {endItem} of {totalItems} entries
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Rows per page:
          </Typography>
          <FormControl size="small">
            <Select
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              variant="outlined"
              size="small"
              sx={{ minWidth: 80 }}
            >
              {itemsPerPageOptions.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {totalPages > 1 && (
        <MuiPagination
          count={totalPages}
          page={currentPage}
          onChange={handlePageChange}
          color="primary"
          size="medium"
          showFirstButton
          showLastButton
        />
      )}
    </Box>
  );
};

export default Pagination;
