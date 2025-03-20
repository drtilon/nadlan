// Updated components/AdminPanel.jsx with password change functionality
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
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
  Tooltip,
  TextField,
  InputAdornment,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Tabs,
  Tab,
  Grid,
  Stack
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as ApproveIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
  PersonAdd as PendingIcon,
  FilterList as FilterIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import api from '../utils/api';
import PasswordChangeDialog from './PasswordChangeDialog';

function AdminPanel({ showNotification }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [roleUpdates, setRoleUpdates] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    pendingApproval: 0,
  });

  // Password change state
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Fetch all users from the backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/adminPanel/users');
      setUsers(response.data);

      // Calculate statistics
      const totalUsers = response.data.length;
      const adminCount = response.data.filter(user => user.role === 'admin').length;
      const pendingCount = response.data.filter(user => !user.is_approved).length;

      setStats({
        total: totalUsers,
        admins: adminCount,
        pendingApproval: pendingCount
      });

      // Initialize roleUpdates with the current roles
      const initialRoles = {};
      response.data.forEach((user) => {
        initialRoles[user.id] = user.role;
      });
      setRoleUpdates(initialRoles);

      setFilteredUsers(response.data);
    } catch (error) {
      console.error('Fetch users error:', error);
      showNotification('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search query and current tab
  useEffect(() => {
    let result = [...users];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        user => user.username.toLowerCase().includes(query) ||
          user.id.toString().includes(query)
      );
    }

    if (currentTab === 1) {
      result = result.filter(user => !user.is_approved);
    } else if (currentTab === 2) {
      result = result.filter(user => user.role === 'admin');
    } else if (currentTab === 3) {
      result = result.filter(user => user.role === 'user');
    }

    setFilteredUsers(result);
  }, [users, searchQuery, currentTab]);

  // Approve a user
  const handleApprove = async (userId) => {
    setApprovingUserId(userId);
    try {
      await api.put(`/adminPanel/approve_user/${userId}`);
      showNotification('User approved successfully', 'success');
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, is_approved: true } : user
        )
      );
      setStats(prev => ({
        ...prev,
        pendingApproval: prev.pendingApproval - 1
      }));
    } catch (error) {
      console.error('Approve error:', error);
      showNotification('Error approving user', 'error');
    } finally {
      setApprovingUserId(null);
    }
  };

  // Open delete confirmation dialog
  const confirmDeleteUser = (userId) => {
    setConfirmDelete(userId);
  };

  // Delete a user after confirmation
  const handleDelete = async () => {
    const userId = confirmDelete;
    if (!userId) {
      showNotification('No user selected for deletion', 'error');
      setConfirmDelete(null);
      return;
    }

    setDeletingUserId(userId);

    try {
      await api.delete(`/adminPanel/users/${userId}`);
      showNotification('User deleted successfully', 'success');

      const deletedUser = users.find(user => user.id === userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));

      setStats(prev => ({
        total: prev.total - 1,
        admins: deletedUser?.role === 'admin' ? prev.admins - 1 : prev.admins,
        pendingApproval: !deletedUser?.is_approved ? prev.pendingApproval - 1 : prev.pendingApproval
      }));
    } catch (error) {
      console.error('Delete error:', error);
      showNotification(`Error deleting user: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setDeletingUserId(null);
      setConfirmDelete(null);
    }
  };

  // Cancel delete operation
  const handleCancelDelete = () => {
    setConfirmDelete(null);
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
      const oldRole = users.find(user => user.id === userId)?.role;
      await api.put(`/adminPanel/users/${userId}`, { role: newRole });
      showNotification('User role updated successfully', 'success');
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
      if (oldRole !== newRole) {
        if (newRole === 'admin') {
          setStats(prev => ({ ...prev, admins: prev.admins + 1 }));
        } else if (oldRole === 'admin') {
          setStats(prev => ({ ...prev, admins: prev.admins - 1 }));
        }
      }
    } catch (error) {
      console.error('Update role error:', error);
      showNotification('Error updating user role', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Open password change dialog
  const handleOpenPasswordChange = (user) => {
    setSelectedUser(user);
    setPasswordChangeOpen(true);
  };

  // Close password change dialog
  const handleClosePasswordChange = () => {
    setPasswordChangeOpen(false);
    setSelectedUser(null);
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Get avatar based on user role and approval status
  const getUserAvatar = (user) => {
    if (!user.is_approved) {
      return <Avatar sx={{ bgcolor: 'warning.light' }}><PendingIcon /></Avatar>;
    }
    return user.role === 'admin'
      ? <Avatar sx={{ bgcolor: 'primary.main' }}><AdminIcon /></Avatar>
      : <Avatar sx={{ bgcolor: 'success.light' }}><UserIcon /></Avatar>;
  };

  // Get status chip for user
  const getUserStatusChip = (user) => {
    if (!user.is_approved) {
      return <Chip label="Pending Approval" color="warning" size="small" variant="outlined" />;
    }
    return user.role === 'admin'
      ? <Chip label="Admin" color="primary" size="small" />
      : <Chip label="User" color="success" size="small" />;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Card sx={{ mb: 4, overflow: 'visible' }}>
        <CardContent>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AdminIcon sx={{ mr: 1 }} /> Admin Panel
          </Typography>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" component="div">Total Users</Typography>
                  <Typography variant="h3" component="div">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" component="div">Administrators</Typography>
                  <Typography variant="h3" component="div">{stats.admins}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" component="div">Pending Approval</Typography>
                  <Typography variant="h3" component="div">{stats.pendingApproval}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Search and Filter */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <TextField
              placeholder="Search by username or ID"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: '350px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchUsers}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {/* Tabs for filtering */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs
              value={currentTab}
              onChange={handleTabChange}
              aria-label="user filter tabs"
              sx={{ '& .MuiTab-root': { minWidth: '120px' } }}
            >
              <Tab label="All Users" />
              <Tab label={`Pending (${stats.pendingApproval})`} />
              <Tab label={`Admins (${stats.admins})`} />
              <Tab label={`Users (${stats.total - stats.admins})`} />
            </Tabs>
          </Box>

          {loading ? (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress />
            </Box>
          ) : (
            <>
              {filteredUsers.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary">
                    No users found matching your criteria
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid rgba(0,0,0,0.1)' }}>
                  <Table>
                    <TableHead sx={{ bgcolor: 'background.default' }}>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Change Role</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              {getUserAvatar(user)}
                              <Box>
                                <Typography variant="subtitle1">{user.username}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {user.id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {getUserStatusChip(user)}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FormControl sx={{ minWidth: 120 }} size="small">
                                <InputLabel id={`role-select-label-${user.id}`}>Role</InputLabel>
                                <Select
                                  labelId={`role-select-label-${user.id}`}
                                  id={`role-select-${user.id}`}
                                  value={roleUpdates[user.id] || user.role}
                                  label="Role"
                                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                >
                                  <MenuItem value="user">User</MenuItem>
                                  <MenuItem value="admin">Admin</MenuItem>
                                </Select>
                              </FormControl>
                              <Tooltip title="Update role" arrow>
                                <span>
                                  <IconButton
                                    color="primary"
                                    onClick={() => handleUpdateRole(user.id)}
                                    disabled={updatingUserId === user.id || roleUpdates[user.id] === user.role}
                                    size="small"
                                  >
                                    {updatingUserId === user.id ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <EditIcon />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              {!user.is_approved && (
                                <Tooltip title="Approve user" arrow>
                                  <span>
                                    <IconButton
                                      color="success"
                                      onClick={() => handleApprove(user.id)}
                                      disabled={approvingUserId === user.id}
                                      size="small"
                                    >
                                      {approvingUserId === user.id ? (
                                        <CircularProgress size={20} />
                                      ) : (
                                        <ApproveIcon />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}

                              <Tooltip title="Change password" arrow>
                                <span>
                                  <IconButton
                                    color="primary"
                                    onClick={() => handleOpenPasswordChange(user)}
                                    size="small"
                                  >
                                    <LockIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title="Delete user" arrow>
                                <span>
                                  <IconButton
                                    color="error"
                                    onClick={() => confirmDeleteUser(user.id)}
                                    disabled={deletingUserId === user.id}
                                    size="small"
                                  >
                                    {deletingUserId === user.id ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <DeleteIcon />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDelete !== null}
        onClose={handleCancelDelete}
      >
        <DialogTitle>Confirm User Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this user? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deletingUserId !== null}
            startIcon={deletingUserId !== null ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Change Dialog */}
      {selectedUser && (
        <PasswordChangeDialog
          open={passwordChangeOpen}
          onClose={handleClosePasswordChange}
          userId={selectedUser.id}
          username={selectedUser.username}
          showNotification={showNotification}
        />
      )}
    </Container>
  );
}

export default AdminPanel;
