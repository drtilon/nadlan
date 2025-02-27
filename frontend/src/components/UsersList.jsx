// components/UsersList.jsx
import React, { useEffect, useState } from 'react';
import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../utils/api';

function UsersList({ showNotification }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  // Store role changes locally before sending update
  const [roleUpdates, setRoleUpdates] = useState({});

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/adminPanel/users');
      setUsers(response.data);
      // Initialize roleUpdates with current roles
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

  // Handle deletion of a user
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

  // Handle local role change
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

  if (loading) {
    return (
      <Container sx={{ textAlign: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      <TableContainer component={Paper}>
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
                  <TableCell>{user.is_approved ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
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
                        {/* Add additional roles as needed */}
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleUpdateRole(user.id)}
                      disabled={updatingUserId === user.id}
                      sx={{ mt: 1 }}
                    >
                      {updatingUserId === user.id ? (
                        <CircularProgress size={20} />
                      ) : (
                        'Update'
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(user.id)}
                      disabled={deletingUserId === user.id}
                    >
                      {deletingUserId === user.id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <DeleteIcon />
                      )}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default UsersList;

