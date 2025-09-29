import React, { useState, useEffect } from 'react';
import { getPaymentReceipt } from '../services/paymentService';
import './PaymentSuccess.css';

const PaymentSuccess = ({ transactionDetails, onNewPayment, onViewHistory }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transactionDetails?.order_id) {
      fetchReceipt(transactionDetails.order_id);
    }
  }, [transactionDetails]);

  const fetchReceipt = async (orderId) => {
    setLoading(true);
    try {
      const receiptData = await getPaymentReceipt(orderId);
      setReceipt(receiptData);
    } catch (error) {
      console.error('Failed to fetch receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const downloadReceipt = () => {
    const receiptContent = document.querySelector('.receipt-card').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .receipt-card { max-width: 600px; margin: 0 auto; }
            .success-icon { display: none; }
            .action-buttons { display: none; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-card">${receiptContent}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="success-container">
        <div className="loading">Loading receipt...</div>
      </div>
    );
  }

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        
        <h2>Payment Successful!</h2>
        <p className="success-message">
          Your maintenance payment has been processed successfully.
        </p>

        {receipt && (
          <div className="receipt-card">
            <div className="receipt-header">
              <h3>Payment Receipt</h3>
              <p className="receipt-id">Receipt ID: {receipt.receipt_id}</p>
            </div>

            <div className="receipt-section">
              <h4>Society Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Society Name:</span>
                  <span className="value">{receipt.society_details.society_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Flat Number:</span>
                  <span className="value">{receipt.society_details.flat_number}</span>
                </div>
                {receipt.society_details.wing && (
                  <div className="detail-item">
                    <span className="label">Wing:</span>
                    <span className="value">{receipt.society_details.wing}</span>
                  </div>
                )}
                {receipt.society_details.floor && (
                  <div className="detail-item">
                    <span className="label">Floor:</span>
                    <span className="value">{receipt.society_details.floor}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="receipt-section">
              <h4>Member Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Name:</span>
                  <span className="value">{receipt.member_details.name}</span>
                </div>
                {receipt.member_details.phone && (
                  <div className="detail-item">
                    <span className="label">Phone:</span>
                    <span className="value">{receipt.member_details.phone}</span>
                  </div>
                )}
                {receipt.member_details.email && (
                  <div className="detail-item">
                    <span className="label">Email:</span>
                    <span className="value">{receipt.member_details.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="receipt-section">
              <h4>Payment Details</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Maintenance Type:</span>
                  <span className="value">{receipt.payment_details.maintenance_type}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Payment Period:</span>
                  <span className="value">{receipt.payment_details.payment_period}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Status:</span>
                  <span className="value status-paid">{receipt.payment_details.status}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Paid At:</span>
                  <span className="value">
                    {new Date(receipt.payment_details.paid_at).toLocaleString()}
                  </span>
                </div>
                {receipt.payment_details.due_date && (
                  <div className="detail-item">
                    <span className="label">Due Date:</span>
                    <span className="value">
                      {new Date(receipt.payment_details.due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="receipt-section">
              <h4>Bill Summary</h4>
              <div className="bill-summary">
                <div className="bill-item">
                  <span className="bill-label">{receipt.maintenance_bill.description}</span>
                  <span className="bill-amount">₹{receipt.maintenance_bill.maintenance_amount}</span>
                </div>
                <div className="bill-total">
                  <span className="total-label">Total Amount Paid</span>
                  <span className="total-amount">₹{receipt.maintenance_bill.maintenance_amount}</span>
                </div>
              </div>
            </div>

            {receipt.notes && (
              <div className="receipt-section">
                <h4>Notes</h4>
                <p className="notes">{receipt.notes}</p>
              </div>
            )}

            <div className="receipt-footer">
              <p>Transaction ID: {receipt.order_id}</p>
              <p>Payment ID: {receipt.payment_id}</p>
              <p>Generated on: {new Date(receipt.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="action-buttons no-print">
          <button onClick={printReceipt} className="action-btn print-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 6,2 18,2 18,9"/>
              <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Receipt
          </button>
          
          <button onClick={downloadReceipt} className="action-btn download-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
          
          <button onClick={onViewHistory} className="action-btn history-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            View History
          </button>
          
          <button onClick={onNewPayment} className="action-btn new-payment-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            New Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;