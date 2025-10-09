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
    selectedUploader: 'all',
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
    paymentMethod: 'bank_transfer'
  });

  // Tenants and Apartments lists
  const [tenants, setTenants] = useState([]);
  const [apartments, setApartments] = useState([]);

  // Search queries
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [apartmentSearchQuery, setApartmentSearchQuery] = useState('');

  useEffect(() => {
    loadPreviousUploads();
    loadUploadersList();
  }, []);

  useEffect(() => {
    loadPreviousUploads(0);
  }, [adminFilter.selectedUploader]);

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

  const loadPreviousUploads = async (pageNum = 0) => {
    try {
      setPreviousUploads(prev => ({ ...prev, loading: true }));

      const token = localStorage.getItem('token');
      if (!token) {
        setPreviousUploads(prev => ({ ...prev, loading: false }));
        return;
      }

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: previousUploads.pagination.limit.toString()
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
          limit: 50,
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

      loadPreviousUploads();
      loadUploadersList();

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

  const filteredTenants = tenants.filter(tenant => {
    if (!tenantSearchQuery) return false;
    const query = tenantSearchQuery.toLowerCase();
    return (
      tenant.name?.toLowerCase().includes(query) ||
      tenant.email?.toLowerCase().includes(query) ||
      tenant.phone?.toLowerCase().includes(query)
    );
  });

  const filteredApartments = apartments.filter(apartment => {
    if (!apartmentSearchQuery) return false;
    const query = apartmentSearchQuery.toLowerCase();

    const addressMatch = (
      apartment.address?.toLowerCase().includes(query) ||
      apartment.street_name?.toLowerCase().includes(query) ||
      apartment.city?.toLowerCase().includes(query) ||
      apartment.full_address?.toLowerCase().includes(query)
    );

    const contractMatch = apartment.contract_periods?.some(contract =>
      contract.contract_number?.toLowerCase().includes(query)
    ) || false;

    return addressMatch || contractMatch;
  });

  const loadTenants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tenants/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || data || []);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const loadApartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/apartments/list-with-contracts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setApartments(data.apartments || data || []);
      }
    } catch (error) {
      console.error('Failed to load apartments:', error);
    }
  };

  const handleAssignTransaction = async (payment) => {
    await loadTenants();
    await loadApartments();

    const transactionDate = payment.payment_date || payment.date || new Date().toISOString().split('T')[0];

    setAssignmentDialog({
      open: true,
      transaction: payment,
      selectedTenant: null,
      selectedApartment: null,
      customAmount: payment.amount?.toString() || '',
      customDate: transactionDate,
      notes: payment.reference || payment.description || '',
      paymentMethod: 'bank_transfer'
    });

    setTenantSearchQuery('');
    setApartmentSearchQuery('');
  };

  const handleTenantSelect = (tenant) => {
    setAssignmentDialog(prev => ({
      ...prev,
      selectedTenant: tenant,
      selectedApartment: tenant?.current_contracts?.[0]?.apartment_id
        ? apartments.find(a => a.id === tenant.current_contracts[0].apartment_id)
        : prev.selectedApartment
    }));
    setTenantSearchQuery(tenant.name);

    if (tenant?.current_contracts?.[0]?.apartment_address) {
      setApartmentSearchQuery(tenant.current_contracts[0].apartment_address);
    }
  };

  const handleApartmentSelect = (apartment) => {
    setAssignmentDialog(prev => ({ ...prev, selectedApartment: apartment }));
    setApartmentSearchQuery(apartment.address);
  };

  // FIXED: handleAssignmentSubmit to support Unknown Tenant
  const handleAssignmentSubmit = async () => {
    const { transaction, selectedTenant, selectedApartment, customAmount, customDate, notes, paymentMethod } = assignmentDialog;

    // Only apartment is required - tenant can be null for "Unknown"
    if (!selectedApartment) {
      alert('Please select an apartment');
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
          tenant_id: selectedTenant ? selectedTenant.id : null,  // Can be null for unknown tenant
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
        const tenantName = selectedTenant ? selectedTenant.name : 'Unknown Tenant';
        alert(`Payment assigned successfully to ${tenantName}!`);

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
    const totalCount = previousUploads.pagination.total_items;

    if (!window.confirm(`Are you sure you want to reject ALL ${totalCount} payments?\n\nThis will permanently delete payments across all pages and cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');

      let allPaymentIds = [];
      const totalPages = previousUploads.pagination.total_pages;

      for (let page = 0; page < totalPages; page++) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '50'
        });

        if (adminFilter.selectedUploader === 'all') {
          params.append('show_all', 'true');
        } else if (adminFilter.selectedUploader !== 'own') {
          params.append('user_id', adminFilter.selectedUploader);
        }

        const response = await fetch(`/api/csv-payments/previous-uploads?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        const pageIds = [...(data.unassigned || []), ...(data.matched || [])].map(p => p.id);
        allPaymentIds = [...allPaymentIds, ...pageIds];
      }

      const deleteResponse = await fetch('/api/csv-payments/reject-multiple', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_ids: allPaymentIds })
      });

      const result = await deleteResponse.json();

      if (result.success) {
        alert(`Successfully rejected ${result.rejected_count} payment(s).`);
        loadPreviousUploads(0);
      } else {
        alert(`Error: ${result.error || 'Failed to reject payments'}`);
      }
    } catch (error) {
      console.error('Failed to reject all payments:', error);
      alert('Failed to reject all payments. Please try again.');
    }
  };

  const displayedPreviousPayments = [...previousUploads.unassigned, ...previousUploads.matched];

  return (
    <div style={{ padding: '32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
          CSV Payment Processor
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
          Upload and process bank statements automatically
        </p>
      </div>

      {/* File Upload Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: '40px',
        marginBottom: '32px',
        border: '2px dashed #cbd5e1',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          style={{
            padding: '14px 32px',
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
              {uploader.username} ({uploader.upload_count} uploads)
            </option>
          ))}
        </select>
      </div>

      {/* Summary Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
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
            ✅ Auto-Assigned
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
            {previousUploads.summary.assigned.count + previousUploads.summary.matched.count}
          </div>
          <div style={{ fontSize: '1rem', color: '#059669', fontWeight: '600' }}>
            €{(Number(previousUploads.summary.assigned.total_amount) + Number(previousUploads.summary.matched.total_amount)).toFixed(2)}
          </div>
        </div>

        <div style={{
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
            ⚠️ Needs Manual Review
          </h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
            {previousUploads.summary.unassigned.count}
          </div>
          <div style={{ fontSize: '1rem', color: '#f59e0b', fontWeight: '600' }}>
            €{Number(previousUploads.summary.unassigned.total_amount).toFixed(2)}
          </div>
        </div>
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
          <button
            onClick={handleRejectAll}
            disabled={displayedPreviousPayments.length === 0}
            style={{
              padding: '10px 20px',
              backgroundColor: displayedPreviousPayments.length === 0 ? '#e2e8f0' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: displayedPreviousPayments.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🗑️ Reject All
          </button>
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

      {/* Assignment Dialog - FIXED WITH UNKNOWN TENANT SUPPORT */}
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: '40px',
            width: '95%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
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

            {/* FIXED: Tenant Search with Unknown Option */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#374151'
              }}>
                Search and Select Tenant (Optional - leave blank for Unknown)
              </label>

              {/* Clear/Unknown Button */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  onClick={() => {
                    setAssignmentDialog(prev => ({ ...prev, selectedTenant: null }));
                    setTenantSearchQuery('');
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: assignmentDialog.selectedTenant ? '#f3f4f6' : '#3b82f6',
                    color: assignmentDialog.selectedTenant ? '#374151' : 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {assignmentDialog.selectedTenant ? 'Clear Selection' : 'Unknown Tenant'}
                </button>

                {!assignmentDialog.selectedTenant && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#fef3c7',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ℹ️ Payment will be assigned to apartment with unknown tenant
                  </div>
                )}
              </div>

              {/* Only show search if no tenant selected */}
              {!assignmentDialog.selectedTenant && (
                <input
                  type="text"
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  placeholder="Type to search by name, email, or phone..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: '1rem',
                    outline: 'none'
                  }}
                />
              )}

              {/* Show selected tenant */}
              {assignmentDialog.selectedTenant && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#dbeafe',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1e40af' }}>
                      {assignmentDialog.selectedTenant.name}
                    </div>
                    {assignmentDialog.selectedTenant.email && (
                      <div style={{ fontSize: '0.85rem', color: '#1e40af', marginTop: '4px' }}>
                        {assignmentDialog.selectedTenant.email}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setAssignmentDialog(prev => ({ ...prev, selectedTenant: null }));
                      setTenantSearchQuery('');
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Tenant search results */}
              {!assignmentDialog.selectedTenant && tenantSearchQuery && filteredTenants.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor: 'white',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  {filteredTenants.slice(0, 10).map(tenant => (
                    <div
                      key={tenant.id}
                      onClick={() => handleTenantSelect(tenant)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{tenant.name}</div>
                      {tenant.email && (
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                          {tenant.email}
                          {tenant.phone && ` • ${tenant.phone}`}
                        </div>
                      )}
                      {tenant.current_contracts && tenant.current_contracts.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '4px' }}>
                          Current: {tenant.current_contracts[0].apartment_address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!assignmentDialog.selectedTenant && tenantSearchQuery && filteredTenants.length === 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: 8,
                  color: '#92400e',
                  fontSize: '0.9rem'
                }}>
                  No tenants found matching "{tenantSearchQuery}"
                </div>
              )}
            </div>

            {/* Apartment Search */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Search and Select Apartment *
              </label>
              <input
                type="text"
                value={apartmentSearchQuery}
                onChange={(e) => setApartmentSearchQuery(e.target.value)}
                placeholder="Type to search by address, street, city, or contract name..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />

              {/* Selected Apartment Display */}
              {assignmentDialog.selectedApartment && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  backgroundColor: '#dbeafe',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#1e40af' }}>
                      {assignmentDialog.selectedApartment.address}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e40af', marginTop: '4px' }}>
                      €{assignmentDialog.selectedApartment.rent}/month • {assignmentDialog.selectedApartment.rooms} rooms
                    </div>
                    {assignmentDialog.selectedApartment.contract_periods && assignmentDialog.selectedApartment.contract_periods.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#1e40af', marginTop: '4px' }}>
                        Contract: {assignmentDialog.selectedApartment.contract_periods[0].contract_number}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setAssignmentDialog(prev => ({ ...prev, selectedApartment: null }));
                      setApartmentSearchQuery('');
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Apartment Search Results */}
              {!assignmentDialog.selectedApartment && apartmentSearchQuery && filteredApartments.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  backgroundColor: 'white',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  {filteredApartments.slice(0, 10).map(apartment => (
                    <div
                      key={apartment.id}
                      onClick={() => handleApartmentSelect(apartment)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{apartment.address}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                        €{apartment.rent}/month • {apartment.rooms} rooms
                      </div>
                      {apartment.contract_periods && apartment.contract_periods.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '4px' }}>
                          Contract: {apartment.contract_periods[0].contract_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!assignmentDialog.selectedApartment && apartmentSearchQuery && filteredApartments.length === 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '12px 16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: 8,
                  color: '#92400e',
                  fontSize: '0.9rem'
                }}>
                  No apartments found matching "{apartmentSearchQuery}"
                </div>
              )}
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                value={assignmentDialog.customAmount}
                onChange={(e) => setAssignmentDialog(prev => ({ ...prev, customAmount: e.target.value }))}
                placeholder="Enter amount"
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

            {/* Payment Date */}
            <div style={{ marginBottom: '24px' }}>
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
                  outline: 'none'
                }}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                Notes
              </label>
              <textarea
                value={assignmentDialog.notes}
                onChange={(e) => setAssignmentDialog(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional notes..."
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

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
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
                  setTenantSearchQuery('');
                  setApartmentSearchQuery('');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignmentSubmit}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
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
