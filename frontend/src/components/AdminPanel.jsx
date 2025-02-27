// components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';

function AdminPanel({ showNotification }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  // Local state for role changes
  const [roleUpdates, setRoleUpdates] = useState({});

  // Fetch all users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/adminPanel/users');
      setUsers(response.data);
      // Initialize roleUpdates with the current roles
      const initialRoles = {};
      response.data.forEach((user) => {
        initialRoles[user.id] = user.role;
      });
      setRoleUpdates(initialRoles);
    } catch (error) {
      console.error(error);
      showNotification('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Approve a user (for pending users)
  const handleApprove = async (userId) => {
    setApprovingUserId(userId);
    try {
      await api.put(`/auth/approve_user/${userId}`);
      showNotification('User approved successfully', 'success');
      // Update the local state for the approved user
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, is_approved: true } : user
        )
      );
    } catch (error) {
      console.error(error);
      showNotification('Error approving user', 'error');
    } finally {
      setApprovingUserId(null);
    }
  };

  // Delete a user
  const handleDelete = async (userId) => {
    setDeletingUserId(userId);
    try {
      await api.delete(`/auth/users/${userId}`);
      showNotification('User deleted successfully', 'success');
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (error) {
      console.error(error);
      showNotification('Error deleting user', 'error');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Handle role selection changes locally
  const handleRoleChange = (userId, newRole) => {
    setRoleUpdates((prev) => ({ ...prev, [userId]: newRole }));
  };

  // Update a user's role on the server
  const handleUpdateRole = async (userId) => {
    setUpdatingUserId(userId);
    try {
      const newRole = roleUpdates[userId];
      await api.put(`/auth/users/${userId}`, { role: newRole });
      showNotification('User role updated successfully', 'success');
      // Update the local users state with the new role
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (error) {
      console.error(error);
      showNotification('Error updating user role', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom align="center">
          Admin Panel - User Management
        </Typography>
        {loading ? (
          <CircularProgress />
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User ID</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Current Role</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell>Change Role</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        {user.is_approved ? 'Approved' : 'Pending'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id={`role-select-label-${user.id}`}>
                              Role
                            </InputLabel>
                            <Select
                              labelId={`role-select-label-${user.id}`}
                              id={`role-select-${user.id}`}
                              value={roleUpdates[user.id] || user.role}
                              label="Role"
                              onChange={(e) =>
                                handleRoleChange(user.id, e.target.value)
                              }
                            >
                              <MenuItem value="user">User</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </FormControl>
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={() => handleUpdateRole(user.id)}
                            disabled={updatingUserId === user.id}
                            sx={{ width: '100%' }}
                          >
                            {updatingUserId === user.id ? (
                              <CircularProgress size={20} />
                            ) : (
                              'UPDATE'
                            )}
                          </Button>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconButton
                            color="error"
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingUserId === user.id}
                          >
                            {deletingUserId === user.id ? (
                              <CircularProgress size={20} />
                            ) : (
                              <DeleteIcon />
                            )}
                          </IconButton>

                          {!user.is_approved && (
                            <Button
                              variant="contained"
                              color="primary"
                              disabled={approvingUserId === user.id}
                              onClick={() => handleApprove(user.id)}
                            >
                              {approvingUserId === user.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                'APPROVE'
                              )}
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}

export default AdminPanel;
