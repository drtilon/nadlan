import React, { useState, useEffect, useRef } from 'react';

const CSVPaymentProcessor = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [grokStatus, setGrokStatus] = useState({
    checking: true,
    fullyOperational: false,
    api_working: false
  });
  const [previousUploads, setPreviousUploads] = useState({
    loading: false,
    unassigned: [],
    matched: [],
    summary: {
      unassigned: { count: 0, total_amount: 0 },
      matched: { count: 0, total_amount: 0 },
      assigned: { count: 0, total_amount: 0 },
      rejected: { count: 0, total_amount: 0 }
    }
  });

  // Enhanced assignment dialog state
  const [assignmentDialog, setAssignmentDialog] = useState({
    open: false,
    transaction: null,
    selectedTenant: null,
    selectedApartment: null,
    customAmount: '',
    customDate: '',
    notes: '',
    paymentMethod: 'bank_transfer'
  });

  // Search states
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [tenantSearchResults, setTenantSearchResults] = useState([]);
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState('');
  const [apartmentSearchResults, setApartmentSearchResults] = useState([]);
  const [isSearchingTenants, setIsSearchingTenants] = useState(false);
  const [isSearchingApartments, setIsSearchingApartments] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Create refs
  const fileInputRef = useRef(null);
  const tenantSearchTimeoutRef = useRef(null);
  const apartmentSearchTimeoutRef = useRef(null);

  // Initialize
  useEffect(() => {
    checkGrokStatus();
  }, []);

  useEffect(() => {
    if (currentTab === 1) {
      loadPreviousUploads();
    }
  }, [currentTab]);

  // Search functions
  const searchTenants = async (query) => {
    if (!query || query.length < 2) {
      setTenantSearchResults([]);
      return;
    }

    setIsSearchingTenants(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/tenants/search?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const results = await response.json();
        setTenantSearchResults(results);
      }
    } catch (error) {
      console.error('Error searching tenants:', error);
    } finally {
      setIsSearchingTenants(false);
    }
  };

  const searchApartments = async (query) => {
    if (!query || query.length < 2) {
      setApartmentSearchResults([]);
      return;
    }

    setIsSearchingApartments(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/csv-payments/apartments/search?query=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const results = await response.json();
        setApartmentSearchResults(results);
      }
    } catch (error) {
      console.error('Error searching apartments:', error);
    } finally {
      setIsSearchingApartments(false);
    }
  };

  // Debounced search handlers
  const handleTenantSearch = (query) => {
    setTenantSearchQuery(query);

    if (tenantSearchTimeoutRef.current) {
      clearTimeout(tenantSearchTimeoutRef.current);
    }

    tenantSearchTimeoutRef.current = setTimeout(() => {
      searchTenants(query);
    }, 300);
  };

  const handleApartmentSearch = (query) => {
    setApartmentSearchQuery(query);

    if (apartmentSearchTimeoutRef.current) {
      clearTimeout(apartmentSearchTimeoutRef.current);
    }

    apartmentSearchTimeoutRef.current = setTimeout(() => {
      searchApartments(query);
    }, 300);
  };

  // Existing functions
  const checkGrokStatus = async () => {
    try {
      setGrokStatus(prev => ({ ...prev, checking: true }));
      const token = localStorage.getItem('token');
      const response = await fetch('/api/csv-payments/grok-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.error('Authentication required. Please log in.');
        return;
      }

      const data = await response.json();
      setGrokStatus({
        checking: false,
        fullyOperational: data.fullyOperational || false,
        api_working: data.api_working || false
      });
    } catch (error) {
      console.error('Failed to check Grok status:', error);
      setGrokStatus({
        checking: false,
        fullyOperational: false,
        api_working: false
      });
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      alert('Please select a CSV or TXT file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB.');
      return;
    }

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

      alert(`Successfully processed ${data.transactions?.length || 0} transactions. Auto-matched: ${data.auto_matched || 0}`);

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

  const loadPreviousUploads = async () => {
    setPreviousUploads(prev => ({ ...prev, loading: true }));

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Authentication required');
        setPreviousUploads(prev => ({ ...prev, loading: false }));
        return;
      }

      const response = await fetch('/api/csv-payments/previous-uploads', {
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
        }
      });
    } catch (error) {
      console.error('Failed to load previous uploads:', error);
      setPreviousUploads(prev => ({ ...prev, loading: false }));
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setPage(0);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAutoAssignMatched = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

      const response = await fetch('/api/csv-payments/auto-assign-matched', {
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
        alert(`Successfully assigned ${data.assigned_count} payments.`);
        loadPreviousUploads();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to auto-assign matched payments:', error);
      alert('Failed to auto-assign payments. Please try again.');
    }
  };

  // Enhanced assignment handler
  const handleAssignTransaction = (transaction) => {
    const transactionDate = transaction.date || transaction.payment_date || new Date().toISOString().split('T')[0];

    setAssignmentDialog({
      open: true,
      transaction: transaction,
      selectedTenant: null,
      selectedApartment: null,
      customAmount: transaction.amount?.toString() || '',
      customDate: transactionDate,
      notes: transaction.reference || transaction.description || '',
      paymentMethod: 'bank_transfer'
    });

    // Clear previous search results
    setTenantSearchResults([]);
    setApartmentSearchResults([]);
    setTenantSearchQuery('');
    setApartmentSearchQuery('');
  };

  const handleRejectPreviousPayment = async (payment) => {
    if (!window.confirm('Are you sure you want to reject this payment?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

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
        loadPreviousUploads();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reject payment:', error);
      alert('Failed to reject payment. Please try again.');
    }
  };

  // Enhanced assignment submission
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

      const endpoint = `/api/csv-payments/assign/${transaction.id}`;
      const requestBody = {
        tenant_id: selectedTenant.id,
        apartment_id: selectedApartment.id,
        amount: parseFloat(customAmount),
        payment_date: customDate,
        notes: notes,
        payment_method: paymentMethod
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
          paymentMethod: 'bank_transfer'
        });

        loadPreviousUploads();
      } else {
        alert(`Error: ${data.error || 'Assignment failed'}`);
      }
    } catch (error) {
      console.error('Failed to assign payment:', error);
      alert('Failed to assign payment. Please try again.');
    }
  };

  // Auto-select apartment when tenant is selected
  const handleTenantSelect = (tenant) => {
    setAssignmentDialog(prev => ({
      ...prev,
      selectedTenant: tenant,
      selectedApartment: tenant.current_apartment ? {
        id: tenant.current_apartment.id,
        address: tenant.current_apartment.address
      } : null
    }));

    setTenantSearchQuery(tenant.name);
    setTenantSearchResults([]);

    // If tenant has current apartment, auto-fill apartment search
    if (tenant.current_apartment) {
      setApartmentSearchQuery(tenant.current_apartment.address);
      setApartmentSearchResults([]);
    }
  };

  const handleApartmentSelect = (apt) => {
    setAssignmentDialog(prev => ({
      ...prev,
      selectedApartment: apt
    }));

    setApartmentSearchQuery(apt.address);
    setApartmentSearchResults([]);
  };

  // Calculate displayed items for pagination
  const displayedTransactions = currentTab === 0 ?
    filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) :
    [];

  const displayedPreviousPayments = currentTab === 1 ?
    [...previousUploads.unassigned, ...previousUploads.matched].slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) :
    [];

  const totalItems = currentTab === 0 ? filteredTransactions.length :
    (previousUploads.unassigned.length + previousUploads.matched.length);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#1e293b', fontWeight: '600' }}>Payment Processor</h1>
          <span style={{
            padding: '6px 16px',
            borderRadius: 20,
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: grokStatus.api_working ? '#10b981' : '#f59e0b',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {grokStatus.checking ? 'Checking...' : grokStatus.fullyOperational ? 'AI Ready' : 'AI Issues'}
          </span>
        </div>
        <p style={{ color: '#64748b', margin: 0, fontSize: '1.1rem' }}>
          Upload and process CSV files to identify potential tenant payments automatically.
        </p>
      </div>

      {/* Professional Tabs */}
      <div style={{ backgroundColor: 'white', borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              style={{
                padding: '16px 32px',
                border: 'none',
                background: currentTab === 0 ? '#3b82f6' : 'transparent',
                color: currentTab === 0 ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                borderBottom: currentTab === 0 ? '3px solid #2563eb' : '3px solid transparent'
              }}
              onClick={() => handleTabChange(null, 0)}
            >
              Upload & Process
            </button>
            <button
              style={{
                padding: '16px 32px',
                border: 'none',
                background: currentTab === 1 ? '#3b82f6' : 'transparent',
                color: currentTab === 1 ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                borderBottom: currentTab === 1 ? '3px solid #2563eb' : '3px solid transparent',
                position: 'relative'
              }}
              onClick={() => handleTabChange(null, 1)}
            >
              Pending Assignments
              {(previousUploads.summary.unassigned?.count + previousUploads.summary.matched?.count > 0) && (
                <span style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#dc2626',
                  color: 'white',
                  borderRadius: '50%',
                  minWidth: 20,
                  height: 20,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {Math.min(99, previousUploads.summary.unassigned?.count + previousUploads.summary.matched?.count)}
                </span>
              )}
            </button>
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {/* Upload Tab */}
          {currentTab === 0 && (
            <div>
              {/* Upload Section */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: 12,
                padding: 32,
                marginBottom: 32,
                border: '2px dashed #cbd5e1',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: 24 }}>📁</div>
                <h3 style={{ marginBottom: 12, color: '#1e293b', fontSize: '1.5rem', fontWeight: '600' }}>Upload CSV File</h3>
                <p style={{ color: '#64748b', marginBottom: 24, fontSize: '1.1rem' }}>
                  Bank statement or transaction CSV file (up to 50MB)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  disabled={processing}
                  style={{ display: 'none' }}
                />

                <button
                  onClick={handleUploadClick}
                  disabled={processing}
                  style={{
                    padding: '16px 32px',
                    backgroundColor: processing ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  {processing ? 'Processing...' : 'Choose File'}
                </button>
              </div>

              {/* Results Section */}
              {transactions.length > 0 && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Processed Transactions ({transactions.length})</h3>
                    <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalItems)} of {totalItems}
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Date</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Amount</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Sender</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Reference</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Status</th>
                          <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTransactions.map((transaction) => (
                          <tr key={transaction.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 12 }}>
                              {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: 12, fontWeight: 'bold', color: '#059669' }}>
                              €{parseFloat(transaction.amount).toFixed(2)}
                            </td>
                            <td style={{ padding: 12 }}>{transaction.sender}</td>
                            <td style={{ padding: 12, fontSize: '0.875rem', color: '#64748b' }}>
                              {(transaction.reference || '').substring(0, 50)}
                              {transaction.reference && transaction.reference.length > 50 && '...'}
                            </td>
                            <td style={{ padding: 12 }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: 16,
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: transaction.manually_assigned ? '#d1fae5' : '#fef3c7',
                                color: transaction.manually_assigned ? '#065f46' : '#92400e'
                              }}>
                                {transaction.manually_assigned ? 'Auto-Matched' : 'Needs Review'}
                              </span>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <button
                                onClick={() => handleAssignTransaction(transaction)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                Assign
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Previous Uploads Tab */}
          {currentTab === 1 && (
            <div>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 24,
                marginBottom: 32
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  borderLeft: '4px solid #f59e0b'
                }}>
                  <div style={{ color: '#d97706', fontSize: '1.25rem', fontWeight: '600' }}>Unassigned</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '8px 0', color: '#1e293b' }}>
                    {previousUploads.summary.unassigned?.count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    €{(previousUploads.summary.unassigned?.total_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  borderLeft: '4px solid #10b981'
                }}>
                  <div style={{ color: '#059669', fontSize: '1.25rem', fontWeight: '600' }}>Auto-Matched</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '8px 0', color: '#1e293b' }}>
                    {previousUploads.summary.matched?.count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    €{(previousUploads.summary.matched?.total_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <div style={{ color: '#2563eb', fontSize: '1.25rem', fontWeight: '600' }}>Assigned</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '8px 0', color: '#1e293b' }}>
                    {previousUploads.summary.assigned?.count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    €{(previousUploads.summary.assigned?.total_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  borderLeft: '4px solid #dc2626'
                }}>
                  <div style={{ color: '#dc2626', fontSize: '1.25rem', fontWeight: '600' }}>Rejected</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '8px 0', color: '#1e293b' }}>
                    {previousUploads.summary.rejected?.count || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    €{(previousUploads.summary.rejected?.total_amount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <button
                    onClick={handleAutoAssignMatched}
                    disabled={!previousUploads.summary.matched?.count}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: (!previousUploads.summary.matched?.count) ? '#e5e7eb' : '#10b981',
                      color: (!previousUploads.summary.matched?.count) ? '#9ca3af' : 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: (!previousUploads.summary.matched?.count) ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    Auto-Assign Matched ({previousUploads.summary.matched?.count || 0})
                  </button>
                  <button
                    onClick={loadPreviousUploads}
                    disabled={previousUploads.loading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: 'white',
                      color: '#3b82f6',
                      border: '1px solid #3b82f6',
                      borderRadius: 8,
                      cursor: previousUploads.loading ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {previousUploads.loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Previous Payments Table */}
              {previousUploads.loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 80,
                  backgroundColor: 'white',
                  borderRadius: 12
                }}>
                  <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Loading payments...</div>
                </div>
              ) : totalItems === 0 ? (
                <div style={{
                  padding: 48,
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #0ea5e9',
                  borderRadius: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
                  <h3 style={{ color: '#0c4a6e', marginBottom: 8 }}>No payments to assign</h3>
                  <p style={{ color: '#0369a1' }}>Upload a CSV file to get started with payment processing.</p>
                </div>
              ) : (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  padding: 24,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ marginBottom: 24, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
                    Payments Needing Assignment ({totalItems})
                  </h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Date</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Amount</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Sender</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Reference</th>
                          <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Status</th>
                          <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedPreviousPayments.map((payment) => (
                          <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 12 }}>
                              {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: 12, fontWeight: 'bold', color: '#059669' }}>
                              €{parseFloat(payment.amount).toFixed(2)}
                            </td>
                            <td style={{ padding: 12 }}>{payment.name_from_csv}</td>
                            <td style={{ padding: 12, fontSize: '0.875rem', color: '#64748b' }}>
                              {(payment.description || payment.reference || '').substring(0, 40)}
                              {(payment.description || payment.reference || '').length > 40 && '...'}
                            </td>
                            <td style={{ padding: 12 }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: 16,
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: payment.status === 'matched' ? '#d1fae5' : '#fef3c7',
                                color: payment.status === 'matched' ? '#065f46' : '#92400e'
                              }}>
                                {payment.status === 'matched' ? 'Auto-Matched' : 'Unassigned'}
                              </span>
                            </td>
                            <td style={{ padding: 12, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleAssignTransaction({ ...payment, isPreviousUpload: true })}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '500'
                                  }}
                                  title="Assign Payment"
                                >
                                  Assign
                                </button>
                                <button
                                  onClick={() => handleRejectPreviousPayment(payment)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: '500'
                                  }}
                                  title="Reject Payment"
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Professional Assignment Dialog */}
      {assignmentDialog.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 24
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 900,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
          }}>
            <h2 style={{ marginBottom: 24, color: '#1e293b', fontSize: '1.75rem', fontWeight: '600' }}>
              Assign Payment to Tenant
            </h2>

            {/* Payment Details Card */}
            <div style={{ marginBottom: 32, padding: 24, backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#3b82f6', marginBottom: 16, fontSize: '1.25rem', fontWeight: '600' }}>Payment Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <strong style={{ color: '#475569' }}>Original Sender:</strong><br />
                  <span style={{ color: '#1e293b' }}>{assignmentDialog.transaction?.sender || assignmentDialog.transaction?.name_from_csv}</span>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Original Amount:</strong><br />
                  <span style={{ color: '#059669', fontSize: '1.25rem', fontWeight: 'bold' }}>€{assignmentDialog.transaction?.amount?.toFixed(2)}</span>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Original Date:</strong><br />
                  <span style={{ color: '#1e293b' }}>{assignmentDialog.transaction?.date || assignmentDialog.transaction?.payment_date || 'N/A'}</span>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Reference:</strong><br />
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {(assignmentDialog.transaction?.reference || assignmentDialog.transaction?.description || 'N/A').substring(0, 50)}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Assignment Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              {/* Tenant Search */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Search & Select Tenant *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={tenantSearchQuery}
                    onChange={(e) => handleTenantSearch(e.target.value)}
                    placeholder="Type tenant name to search..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: '1rem',
                      backgroundColor: 'white'
                    }}
                  />

                  {/* Tenant Search Results */}
                  {(tenantSearchResults.length > 0 || isSearchingTenants) && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      maxHeight: 300,
                      overflowY: 'auto',
                      zIndex: 1001
                    }}>
                      {isSearchingTenants ? (
                        <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                          Searching tenants...
                        </div>
                      ) : (
                        tenantSearchResults.map((tenant) => (
                          <div
                            key={tenant.id}
                            onClick={() => handleTenantSelect(tenant)}
                            style={{
                              padding: 12,
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              backgroundColor: assignmentDialog.selectedTenant?.id === tenant.id ? '#eff6ff' : 'white'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = assignmentDialog.selectedTenant?.id === tenant.id ? '#eff6ff' : 'white'}
                          >
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>{tenant.name}</div>
                            {tenant.current_apartment && (
                              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                Current: {tenant.current_apartment.address} (€{tenant.current_apartment.monthly_rent}/month)
                              </div>
                            )}
                            {tenant.email && (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{tenant.email}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Tenant Display */}
                {assignmentDialog.selectedTenant && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: '#eff6ff',
                    borderRadius: 8,
                    border: '1px solid #3b82f6'
                  }}>
                    <div style={{ fontWeight: '500', color: '#1e40af' }}>
                      Selected: {assignmentDialog.selectedTenant.name}
                    </div>
                    {assignmentDialog.selectedTenant.current_apartment && (
                      <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                        Current apartment: {assignmentDialog.selectedTenant.current_apartment.address}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Apartment Search */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Search & Select Apartment *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={apartmentSearchQuery}
                    onChange={(e) => handleApartmentSearch(e.target.value)}
                    placeholder="Type apartment address to search..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      fontSize: '1rem',
                      backgroundColor: 'white'
                    }}
                  />

                  {/* Apartment Search Results */}
                  {(apartmentSearchResults.length > 0 || isSearchingApartments) && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      maxHeight: 300,
                      overflowY: 'auto',
                      zIndex: 1001
                    }}>
                      {isSearchingApartments ? (
                        <div style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>
                          Searching apartments...
                        </div>
                      ) : (
                        apartmentSearchResults.map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => handleApartmentSelect(apt)}
                            style={{
                              padding: 12,
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              backgroundColor: assignmentDialog.selectedApartment?.id === apt.id ? '#eff6ff' : 'white'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = assignmentDialog.selectedApartment?.id === apt.id ? '#eff6ff' : 'white'}
                          >
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>{apt.address}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              €{apt.rent}/month • {apt.rooms} rooms • {apt.status}
                            </div>
                            {apt.current_tenants && apt.current_tenants.length > 0 && (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
                                Current: {apt.current_tenants.map(t => t.name).join(', ')}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Apartment Display */}
                {assignmentDialog.selectedApartment && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: '#eff6ff',
                    borderRadius: 8,
                    border: '1px solid #3b82f6'
                  }}>
                    <div style={{ fontWeight: '500', color: '#1e40af' }}>
                      Selected: {assignmentDialog.selectedApartment.address}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Amount */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={assignmentDialog.customAmount}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, customAmount: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                  placeholder="Enter payment amount"
                />
              </div>

              {/* Custom Date */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={assignmentDialog.customDate}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, customDate: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Payment Method
                </label>
                <select
                  value={assignmentDialog.paymentMethod}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#374151' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={assignmentDialog.notes}
                  onChange={(e) => setAssignmentDialog(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    resize: 'vertical'
                  }}
                  placeholder="Add any additional notes..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAssignmentDialog({
                  open: false,
                  transaction: null,
                  selectedTenant: null,
                  selectedApartment: null,
                  customAmount: '',
                  customDate: '',
                  notes: '',
                  paymentMethod: 'bank_transfer'
                })}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignmentSubmit}
                disabled={!assignmentDialog.selectedTenant || !assignmentDialog.selectedApartment || !assignmentDialog.customAmount || !assignmentDialog.customDate}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (!assignmentDialog.selectedTenant || !assignmentDialog.selectedApartment || !assignmentDialog.customAmount || !assignmentDialog.customDate) ? '#e5e7eb' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: (!assignmentDialog.selectedTenant || !assignmentDialog.selectedApartment || !assignmentDialog.customAmount || !assignmentDialog.customDate) ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
