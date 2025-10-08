import React, { useState, useRef, useEffect } from 'react';

const CSVPaymentProcessor = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  // Previous uploads state
  const [previousUploads, setPreviousUploads] = useState({
    loading: false,
    unassigned: [],
    matched: [],
    summary: {
      unassigned: { count: 0, total_amount: 0 },
      matched: { count: 0, total_amount: 0 },
      assigned: { count: 0, total_amount: 0 },
      rejected: { count: 0, total_amount: 0 }
    },
    pagination: {
      page: 0,
      limit: 50,
      total_items: 0,
      total_pages: 1,
      has_next: false,
      has_prev: false
    },
    uploaders: []
  });

  // Admin filtering state
  const [adminFilter, setAdminFilter] = useState({
    selectedUploader: 'all', // 'all', 'own', or specific user_id
    uploadersList: []
  });

  // Assignment dialog state
  const [assignmentDialog, setAssignmentDialog] = useState({
    open: false,
    transaction: null,
    selectedTenant: null,
    selectedApartment: null,
    customAmount: '',
    customDate: '',
    notes: '',
    paymentMethod: 'bank_transfer',
    tenantSuggestions: [],
    showingSuggestions: false
  });

  // Search states
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState('');
  const [tenantSearchResults, setTenantSearchResults] = useState([]);
  const [apartmentSearchResults, setApartmentSearchResults] = useState([]);

  useEffect(() => {
    loadPreviousUploads();
    loadUploadersList();
  }, []);

  useEffect(() => {
    loadPreviousUploads(0); // Reset to first page when filter changes
  }, [adminFilter.selectedUploader]);

  // Load list of users who have uploaded payments
  const loadUploadersList = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/csv-payments/uploaders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAdminFilter(prev => ({
          ...prev,
          uploadersList: data.uploaders || []
        }));
      }
    } catch (error) {
      console.error('Failed to load uploaders list:', error);
    }
  };

  const loadPreviousUploads = async (pageNum = 0, overrideLimit = null) => {
    try {
      setPreviousUploads(prev => ({ ...prev, loading: true }));

      const token = localStorage.getItem('token');
      if (!token) {
        setPreviousUploads(prev => ({ ...prev, loading: false }));
        return;
      }

      // Build query parameters based on filter
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: (overrideLimit || previousUploads.pagination.limit).toString()
      });

      if (adminFilter.selectedUploader === 'all') {
        params.append('show_all', 'true');
      } else if (adminFilter.selectedUploader !== 'own') {
        params.append('user_id', adminFilter.selectedUploader);
      }

      const response = await fetch(`/api/csv-payments/previous-uploads?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.error('Authentication failed');
        setPreviousUploads(prev => ({ ...prev, loading: false }));
        return;
      }

      const data = await response.json();

      setPreviousUploads({
        loading: false,
        unassigned: data.unassigned || [],
        matched: data.matched || [],
        summary: data.summary || {
          unassigned: { count: 0, total_amount: 0 },
          matched: { count: 0, total_amount: 0 },
          assigned: { count: 0, total_amount: 0 },
          rejected: { count: 0, total_amount: 0 }
        },
        pagination: data.pagination || {
          page: pageNum,
          limit: overrideLimit || 50,
          total_items: 0,
          total_pages: 1,
          has_next: false,
          has_prev: false
        },
        uploaders: data.uploaders || []
      });
    } catch (error) {
      console.error('Failed to load previous uploads:', error);
      setPreviousUploads(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['text/csv', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a CSV or TXT file only.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File too large. Maximum size is 50MB.');
      return;
    }

    await processFile(file);
  };

  const processFile = async (file) => {
    setProcessing(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/csv-payments/process-csv-simple', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.status === 401) {
        alert('Authentication failed. Please log in again.');
        return;
      }

      if (data.error) {
        alert(`Error processing file: ${data.error}`);
        return;
      }

      setTransactions(data.transactions || []);
      setFilteredTransactions(data.transactions || []);

      // Show detailed upload results
      let message = `Successfully processed ${data.total_processed || 0} payments.\n`;
      if (data.auto_assigned > 0) {
        message += `✅ ${data.auto_assigned} payments were automatically assigned.\n`;
      }
      if (data.transactions && data.transactions.length > 0) {
        message += `⚠️ ${data.transactions.length} payments need manual review.`;
      }
      if (data.auto_assigned === data.total_processed) {
        message += `\n🎉 All payments were successfully processed automatically!`;
      }

      alert(message);

      // Refresh previous uploads to show the new data
      loadPreviousUploads();
      loadUploadersList(); // Refresh uploaders list

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload and process the file. Please try again.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    if (processing) return;
    fileInputRef.current?.click();
  };

  // Enhanced assignment dialog with 3 closest tenant suggestions
  const loadTenantSuggestions = async (paymentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/suggest-tenants/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssignmentDialog(prev => ({
          ...prev,
          tenantSuggestions: data.suggestions || [],
          showingSuggestions: true
        }));
      }
    } catch (error) {
      console.error('Failed to load tenant suggestions:', error);
    }
  };

  const handleAssignTransaction = (transaction) => {
    // Fix date handling - check multiple possible date fields
    const transactionDate = transaction.payment_date || transaction.date || new Date().toISOString().split('T')[0];

    setAssignmentDialog({
      open: true,
      transaction: transaction,
      selectedTenant: null,
      selectedApartment: null,
      customAmount: transaction.amount?.toString() || '',
      customDate: transactionDate,
      notes: transaction.reference || transaction.description || '',
      paymentMethod: 'bank_transfer',
      tenantSuggestions: [],
      showingSuggestions: false
    });

    // Clear previous search results
    setTenantSearchResults([]);
    setApartmentSearchResults([]);
    setTenantSearchQuery('');
    setApartmentSearchQuery('');

    // Load tenant suggestions
    loadTenantSuggestions(transaction.id);
  };

  // Enhanced search functionality
  const searchTenants = async (query) => {
    if (!query || query.length < 2) {
      setTenantSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/tenants/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTenantSearchResults(data || []);
      }
    } catch (error) {
      console.error('Failed to search tenants:', error);
    }
  };

  const searchApartments = async (query) => {
    if (!query || query.length < 2) {
      setApartmentSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/apartments/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApartmentSearchResults(data || []);
      }
    } catch (error) {
      console.error('Failed to search apartments:', error);
    }
  };

  const handleTenantSearchChange = (value) => {
    setTenantSearchQuery(value);
    if (value !== assignmentDialog.selectedTenant?.name) {
      setAssignmentDialog(prev => ({ ...prev, selectedTenant: null }));
    }
    searchTenants(value);
  };

  const handleApartmentSearchChange = (value) => {
    setApartmentSearchQuery(value);
    if (value !== assignmentDialog.selectedApartment?.address) {
      setAssignmentDialog(prev => ({ ...prev, selectedApartment: null }));
    }
    searchApartments(value);
  };

  const handleTenantSelect = (tenant) => {
    setAssignmentDialog(prev => ({
      ...prev,
      selectedTenant: tenant,
      selectedApartment: tenant.current_apartment ? {
        id: tenant.current_apartment.id,
        address: tenant.current_apartment.address
      } : null,
      showingSuggestions: false
    }));

    setTenantSearchQuery(tenant.name);
    setTenantSearchResults([]);

    // Auto-fill apartment if tenant has current apartment
    if (tenant.current_apartment) {
      setApartmentSearchQuery(tenant.current_apartment.address);
      setApartmentSearchResults([]);
    }
  };

  const handleApartmentSelect = (apartment) => {
    setAssignmentDialog(prev => ({
      ...prev,
      selectedApartment: apartment
    }));

    setApartmentSearchQuery(apartment.address);
    setApartmentSearchResults([]);
  };

  const handleAssignmentSubmit = async () => {
    const { transaction, selectedTenant, selectedApartment, customAmount, customDate, notes, paymentMethod } = assignmentDialog;

    if (!selectedTenant || !selectedApartment) {
      alert('Please select both tenant and apartment');
      return;
    }

    if (!customAmount || parseFloat(customAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!customDate) {
      alert('Please select a payment date');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

      const response = await fetch(`/api/csv-payments/assign/${transaction.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: selectedTenant.id,
          apartment_id: selectedApartment.id,
          amount: parseFloat(customAmount),
          payment_date: customDate,
          notes: notes,
          payment_method: paymentMethod
        })
      });

      if (response.status === 401) {
        alert('Authentication failed. Please log in again.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        alert(`Payment assigned successfully to ${selectedTenant.name}!`);
        setAssignmentDialog({
          open: false,
          transaction: null,
          selectedTenant: null,
          selectedApartment: null,
          customAmount: '',
          customDate: '',
          notes: '',
          paymentMethod: 'bank_transfer',
          tenantSuggestions: [],
          showingSuggestions: false
        });

        loadPreviousUploads(previousUploads.pagination.page);
      } else {
        alert(`Error: ${data.error || 'Assignment failed'}`);
      }
    } catch (error) {
      console.error('Failed to assign payment:', error);
      alert('Failed to assign payment. Please try again.');
    }
  };

  const handleRejectPreviousPayment = async (payment) => {
    if (!window.confirm('Are you sure you want to reject this payment?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/reject/${payment.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        alert('Authentication failed. Please log in again.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        loadPreviousUploads(previousUploads.pagination.page);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reject payment:', error);
      alert('Failed to reject payment. Please try again.');
    }
  };

  const handleRejectAll = async () => {
    if (!window.confirm('Are you sure you want to reject all previous payments?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

      // Build query parameters to match current filter
      const params = new URLSearchParams();
      if (adminFilter.selectedUploader === 'all') {
        params.append('show_all', 'true');
      } else if (adminFilter.selectedUploader !== 'own') {
        params.append('user_id', adminFilter.selectedUploader);
      }

      const response = await fetch(`/api/csv-payments/reject-all?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        alert('Authentication failed. Please log in again.');
        return;
      }

      const data = await response.json();

      if (data.success) {
        alert(`Successfully rejected ${data.rejected_count} payments`);
        loadPreviousUploads(0); // Refresh with default pagination
      } else {
        alert(`Error: ${data.error || 'Failed to reject all payments'}`);
      }
    } catch (error) {
      console.error('Failed to reject all payments:', error);
      alert('Failed to reject all payments. Please try again.');
    }
  };

  const displayedPreviousPayments = [...previousUploads.unassigned, ...previousUploads.matched];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '32px' }}>
          CSV Payment Processor
        </h1>

        {/* Upload Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: '32px',
          marginBottom: '32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
            Upload New CSV File
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <button
            onClick={handleUploadClick}
            disabled={processing}
            style={{
              padding: '16px 32px',
              backgroundColor: processing ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: processing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {processing ? 'Processing...' : 'Choose CSV File'}
          </button>

          <p style={{ marginTop: '12px', color: '#64748b', fontSize: '0.9rem' }}>
            Supported formats: CSV, TXT (Max 50MB)
          </p>
        </div>

        {/* Admin Filter Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: '24px',
          marginBottom: '32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
            Filter by Uploader
          </h3>

          <select
            value={adminFilter.selectedUploader}
            onChange={(e) => setAdminFilter(prev => ({ ...prev, selectedUploader: e.target.value }))}
            style={{
              padding: '12px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: 8,
              fontSize: '1rem',
              backgroundColor: 'white',
              minWidth: '300px'
            }}
          >
            <option value="own">My Uploads Only</option>
            <option value="all">All Uploads (All Users)</option>
            {adminFilter.uploadersList.map(uploader => (
              <option key={uploader.user_id || 'legacy'} value={uploader.user_id || 'legacy'}>
                {uploader.username} ({uploader.total_uploads} uploads)
              </option>
            ))}
          </select>
        </div>

        {/* Summary Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {Object.entries(previousUploads.summary).map(([status, data]) => (
            <div key={status} style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                {status.replace('_', ' ')}
              </h3>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                {data.count}
              </div>
              <div style={{ fontSize: '1rem', color: '#059669', fontWeight: '600' }}>
                €{Number(data.total_amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Previous Uploads Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              Previous Uploads
            </h2>
            {!previousUploads.loading && displayedPreviousPayments.length > 0 && (
              <button
                onClick={handleRejectAll}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Reject All
              </button>
            )}
          </div>

          {previousUploads.loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              Loading payments...
            </div>
          ) : displayedPreviousPayments.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              No payments found for the selected filter.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date</th>
                    <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name from CSV</th>
                    <th style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Amount</th>
                    <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
                    <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Uploader</th>
                    <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPreviousPayments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '16px 12px', fontSize: '0.9rem' }}>
                        {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '500' }}>
                        {payment.name_from_csv}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                        €{Number(payment.amount).toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 12px', fontSize: '0.9rem', color: '#64748b' }}>
                        {payment.description || '-'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 12,
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          backgroundColor: payment.status === 'matched' ? '#dbeafe' : '#fef3c7',
                          color: payment.status === 'matched' ? '#1e40af' : '#92400e'
                        }}>
                          {payment.status === 'matched' ? 'Auto-matched' : 'Unassigned'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', fontSize: '0.8rem', color: '#64748b' }}>
                        {payment.uploaded_by_username || 'Unknown'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleAssignTransaction(payment)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => handleRejectPreviousPayment(payment)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {previousUploads.pagination.total_pages > 1 && (
            <div style={{
              padding: '20px 32px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Page {previousUploads.pagination.page + 1} of {previousUploads.pagination.total_pages}
                ({previousUploads.pagination.total_items} total items)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => loadPreviousUploads(previousUploads.pagination.page - 1)}
                  disabled={!previousUploads.pagination.has_prev}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: previousUploads.pagination.has_prev ? '#3b82f6' : '#e2e8f0',
                    color: previousUploads.pagination.has_prev ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: 6,
                    cursor: previousUploads.pagination.has_prev ? 'pointer' : 'not-allowed'
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => loadPreviousUploads(previousUploads.pagination.page + 1)}
                  disabled={!previousUploads.pagination.has_next}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: previousUploads.pagination.has_next ? '#3b82f6' : '#e2e8f0',
                    color: previousUploads.pagination.has_next ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: 6,
                    cursor: previousUploads.pagination.has_next ? 'pointer' : 'not-allowed'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Assignment Dialog */}
      {assignmentDialog.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: '32px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '24px' }}>
              Assign Payment
            </h3>

            {/* Transaction Info */}
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '16px',
              borderRadius: 8,
              marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>Transaction Details:</h4>
              <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                <div><strong>Name:</strong> {assignmentDialog.transaction?.name_from_csv || assignmentDialog.transaction?.sender}</div>
                <div><strong>Amount:</strong> €{Number(assignmentDialog.transaction?.amount || 0).toFixed(2)}</div>
                <div>
                  <strong>Date:</strong> {assignmentDialog.transaction?.payment_date
                    ? new Date(assignmentDialog.transaction.payment_date).toLocaleDateString()
                    : assignmentDialog.transaction?.date
                    ? new Date(assignmentDialog.transaction.date).toLocaleDateString()
                    : 'N/A'}
                </div>
                <div><strong>Reference:</strong> {assignmentDialog.transaction?.description || assignmentDialog.transaction?.reference || '-'}</div>
              </div>
            </div>

            {/* 3 Closest Tenant Suggestions */}
            {assignmentDialog.showingSuggestions && assignmentDialog.tenantSuggestions.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>3 Closest Tenant Matches:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {assignmentDialog.tenantSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleTenantSelect(suggestion)}
                      style={{
                        padding: '12px 16px',
                        border: '2px solid #e2e8f0',
                        borderRadius: 8,
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.target.style.borderColor = '#3b82f6'}
                      onMouseOut={(e) => e.target.style.borderColor = '#e2e8f0'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>{suggestion.name}</div>
                          {suggestion.current_apartment && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              Current: {suggestion.current_apartment.address}
                            </div>
                          )}
                        </div>
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: 12,
                          fontSize: '0.7rem',
                          fontWeight: '500',
                          backgroundColor: suggestion.score > 0.8 ? '#dcfce7' : suggestion.score > 0.6 ? '#fef3c7' : '#fee2e2',
                          color: suggestion.score > 0.8 ? '#166534' : suggestion.score > 0.6 ? '#92400e' : '#dc2626'
                        }}>
                          {Math.round(suggestion.score * 100)}% match
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced Tenant Search */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Search and Select Tenant *
              </label>
              <input
                type="text"
                value={tenantSearchQuery}
                onChange={(e) => handleTenantSearchChange(e.target.value)}
                placeholder="Type tenant name to search..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              {tenantSearchResults.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor: 'white',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {tenantSearchResults.map(tenant => (
                    <div
                      key={tenant.id}
                      onClick={() => handleTenantSelect(tenant)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500' }}>{tenant.name}</div>
                      {tenant.current_apartment && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Current: {tenant.current_apartment.address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {assignmentDialog.selectedTenant && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#dbeafe',
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  color: '#1e40af'
                }}>
                  Selected: {assignmentDialog.selectedTenant.name}
                </div>
              )}
            </div>

            {/* Enhanced Apartment Search */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Search and Select Apartment *
              </label>
              <input
                type="text"
                value={apartmentSearchQuery}
                onChange={(e) => handleApartmentSearchChange(e.target.value)}
                placeholder="Type apartment address to search..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              {apartmentSearchResults.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor: 'white',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {apartmentSearchResults.map(apartment => (
                    <div
                      key={apartment.id}
                      onClick={() => handleApartmentSelect(apartment)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500' }}>{apartment.address}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        €{apartment.rent}/month • {apartment.rooms} rooms
                        {apartment.current_tenants && apartment.current_tenants.length > 0 && (
                          <span> • Current: {apartment.current_tenants.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {assignmentDialog.selectedApartment && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#dbeafe',
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  color: '#1e40af'
                }}>
                  Selected: {assignmentDialog.selectedApartment.address}
                </div>
              )}
            </div>

            {/* Amount and Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                  Amount (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={assignmentDialog.customAmount}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, customAmount: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={assignmentDialog.customDate}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, customDate: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Payment Method
              </label>
              <select
                value={assignmentDialog.paymentMethod}
                onChange={(e) => setAssignmentDialog(prev => ({ ...prev, paymentMethod: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '1rem',
                  outline: 'none',
                  backgroundColor: 'white'
                }}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Notes
              </label>
              <textarea
                value={assignmentDialog.notes}
                onChange={(e) => setAssignmentDialog(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '1rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Dialog Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAssignmentDialog({ ...assignmentDialog, open: false })}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e2e8f0',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignmentSubmit}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Assign Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVPaymentProcessor;
