import React, { useState, useEffect } from 'react';
import { getPaymentHistory, getPaymentReceipt } from '../services/paymentService';
import { getPaymentHistoryDemo, getPaymentReceiptDemo } from '../services/demoService';
import config from '../config/config';
import './PaymentHistory.css';

const PaymentHistory = ({ onBackToForm }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [filters, setFilters] = useState({
    society_name: '',
    flat_number: '',
    status: '',
    maintenance_type: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0
  });

  useEffect(() => {
    fetchPayments();
  }, [filters, pagination.page]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      if (config.DEMO_MODE) {
        // Use demo data
        const response = await getPaymentHistoryDemo();
        setPayments(response.transactions);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          total_pages: response.pagination.total_pages
        }));
      } else {
        // Use real API
        const params = new URLSearchParams({
          page: pagination.page,
          limit: pagination.limit,
          ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
        });

        const response = await getPaymentHistory(params.toString());
        setPayments(response.transactions);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          total_pages: response.pagination.total_pages
        }));
      }
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const viewReceipt = async (orderId) => {
    try {
      let receipt;
      if (config.DEMO_MODE) {
        receipt = await getPaymentReceiptDemo(orderId);
      } else {
        receipt = await getPaymentReceipt(orderId);
      }
      setSelectedReceipt(receipt);
    } catch (error) {
      console.error('Failed to fetch receipt:', error);
      alert('Failed to load receipt');
    }
  };

  const closeReceipt = () => {
    setSelectedReceipt(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#27ae60';
      case 'created': return '#f39c12';
      case 'failed': return '#e74c3c';
      default: return '#666';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  return (
    <div className="history-container">
      <div className="history-card">
        {/* Demo Mode Banner */}
        {config.DEMO_MODE && (
          <div className="demo-banner">
            <div className="demo-content">
              <span className="demo-icon">🎯</span>
              <div className="demo-text">
                <strong>Demo Mode</strong>
                <p>Showing sample payment history for demonstration</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="history-header">
          <h2>Payment History</h2>
          <button onClick={onBackToForm} className="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5"/>
              <path d="M12 19l-7-7 7-7"/>
            </svg>
            New Payment
          </button>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label htmlFor="society_name">Society Name</label>
              <input
                type="text"
                id="society_name"
                name="society_name"
                value={filters.society_name}
                onChange={handleFilterChange}
                placeholder="Enter society name"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="flat_number">Flat Number</label>
              <input
                type="text"
                id="flat_number"
                name="flat_number"
                value={filters.flat_number}
                onChange={handleFilterChange}
                placeholder="Enter flat number"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="created">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="maintenance_type">Maintenance Type</label>
              <select
                id="maintenance_type"
                name="maintenance_type"
                value={filters.maintenance_type}
                onChange={handleFilterChange}
              >
                <option value="">All Types</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payment List */}
        <div className="payments-section">
          {loading ? (
            <div className="loading">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="no-payments">
              <p>No payments found matching your criteria.</p>
            </div>
          ) : (
            <>
              <div className="payments-list">
                {payments.map((payment) => (
                  <div key={payment.order_id} className="payment-item">
                    <div className="payment-info">
                      <div className="payment-header">
                        <h4>{payment.society_name} - {payment.flat_number}</h4>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(payment.status) }}
                        >
                          {payment.status}
                        </span>
                      </div>
                      
                      <div className="payment-details">
                        <div className="detail-row">
                          <span className="label">Member:</span>
                          <span className="value">{payment.member_name}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Period:</span>
                          <span className="value">{payment.payment_period}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Type:</span>
                          <span className="value">{payment.maintenance_type}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Date:</span>
                          <span className="value">
                            {payment.paidAt ? formatDateTime(payment.paidAt) : formatDate(payment.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="payment-actions">
                      <div className="amount">₹{payment.amount}</div>
                      {payment.status === 'paid' && (
                        <button 
                          onClick={() => viewReceipt(payment.order_id)}
                          className="view-receipt-btn"
                        >
                          View Receipt
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.total_pages > 1 && (
                <div className="pagination">
                  <button 
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="page-btn"
                  >
                    Previous
                  </button>
                  
                  <span className="page-info">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  
                  <button 
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.total_pages}
                    className="page-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="receipt-modal">
          <div className="receipt-modal-content">
            <div className="receipt-modal-header">
              <h3>Payment Receipt</h3>
              <button onClick={closeReceipt} className="close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="receipt-content">
              <div className="receipt-details">
                <p><strong>Receipt ID:</strong> {selectedReceipt.receipt_id}</p>
                <p><strong>Society:</strong> {selectedReceipt.society_details.society_name}</p>
                <p><strong>Flat:</strong> {selectedReceipt.society_details.flat_number}</p>
                <p><strong>Member:</strong> {selectedReceipt.member_details.name}</p>
                <p><strong>Period:</strong> {selectedReceipt.payment_details.payment_period}</p>
                <p><strong>Amount:</strong> ₹{selectedReceipt.maintenance_bill.maintenance_amount}</p>
                <p><strong>Paid At:</strong> {formatDateTime(selectedReceipt.payment_details.paid_at)}</p>
              </div>
            </div>

            <div className="receipt-modal-actions">
              <button onClick={() => window.print()} className="print-btn">
                Print Receipt
              </button>
              <button onClick={closeReceipt} className="close-modal-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;