import React, { useState } from 'react';
import './DemoRazorpay.css';

const DemoRazorpay = ({ isOpen, orderData, onPaymentSuccess, onPaymentFailure, onClose }) => {
  const [currentStep, setCurrentStep] = useState('details'); // 'details', 'payment', 'processing'
  const [selectedMethod, setSelectedMethod] = useState('upi');

  const handlePayment = () => {
    setCurrentStep('processing');
    
    // Simulate payment processing
    setTimeout(() => {
      // For demo purposes, always succeed
      const response = {
        razorpay_order_id: orderData.id,
        razorpay_payment_id: `pay_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        razorpay_signature: `demo_signature_${orderData.id}_${Date.now()}`
      };
      
      console.log('🎯 Demo payment completed:', response);
      onPaymentSuccess(response);
    }, 3000);
  };

  const formatAmount = (amount) => {
    return (amount / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
  };

  if (!isOpen || !orderData) return null;

  return (
    <div className="demo-razorpay-overlay">
      <div className="demo-razorpay-modal">
        <div className="demo-razorpay-header">
          <div className="demo-razorpay-brand">
            <div className="demo-razorpay-logo">R</div>
            <span>Razorpay</span>
            <span className="demo-badge">DEMO</span>
          </div>
          <button className="demo-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {currentStep === 'details' && (
          <div className="demo-payment-details">
            <div className="demo-merchant-info">
              <h3>{orderData.bill_details?.society_name || 'Society Payment'}</h3>
              <p>{`${orderData.bill_details?.maintenance_type || 'Maintenance'} payment for ${orderData.bill_details?.payment_period || 'current period'}`}</p>
            </div>
            
            <div className="demo-amount-display">
              <span className="demo-amount">{formatAmount(orderData.amount)}</span>
            </div>

            <div className="demo-customer-info">
              <h4>Contact Information</h4>
              <div className="demo-info-item">
                <span>Name:</span>
                <span>{orderData.bill_details?.member_name}</span>
              </div>
              <div className="demo-info-item">
                <span>Flat:</span>
                <span>{orderData.bill_details?.flat_number}</span>
              </div>
              <div className="demo-info-item">
                <span>Society:</span>
                <span>{orderData.bill_details?.society_name}</span>
              </div>
            </div>

            <button 
              className="demo-proceed-btn"
              onClick={() => setCurrentStep('payment')}
            >
              Proceed to Pay
            </button>
          </div>
        )}

        {currentStep === 'payment' && (
          <div className="demo-payment-methods">
            <div className="demo-amount-header">
              <span>Pay {formatAmount(orderData.amount)}</span>
            </div>

            <div className="demo-methods-list">
              <div 
                className={`demo-method ${selectedMethod === 'upi' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('upi')}
              >
                <div className="demo-method-icon">📱</div>
                <span>UPI</span>
                <div className="demo-method-check">✓</div>
              </div>

              <div 
                className={`demo-method ${selectedMethod === 'card' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('card')}
              >
                <div className="demo-method-icon">💳</div>
                <span>Cards</span>
                <div className="demo-method-check">✓</div>
              </div>

              <div 
                className={`demo-method ${selectedMethod === 'netbanking' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('netbanking')}
              >
                <div className="demo-method-icon">🏦</div>
                <span>Net Banking</span>
                <div className="demo-method-check">✓</div>
              </div>

              <div 
                className={`demo-method ${selectedMethod === 'wallet' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('wallet')}
              >
                <div className="demo-method-icon">👛</div>
                <span>Wallets</span>
                <div className="demo-method-check">✓</div>
              </div>
            </div>

            <div className="demo-payment-actions">
              <button 
                className="demo-back-btn"
                onClick={() => setCurrentStep('details')}
              >
                Back
              </button>
              <button 
                className="demo-pay-now-btn"
                onClick={handlePayment}
              >
                Pay Now
              </button>
            </div>
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="demo-processing">
            <div className="demo-processing-animation">
              <div className="demo-spinner"></div>
            </div>
            <h3>Processing Payment</h3>
            <p>Please wait while we process your payment...</p>
            <div className="demo-processing-steps">
              <div className="demo-step completed">
                <span className="demo-step-icon">✓</span>
                <span>Payment initiated</span>
              </div>
              <div className="demo-step completed">
                <span className="demo-step-icon">✓</span>
                <span>Bank authentication</span>
              </div>
              <div className="demo-step active">
                <span className="demo-step-icon">⏳</span>
                <span>Confirming payment</span>
              </div>
            </div>
          </div>
        )}

        <div className="demo-razorpay-footer">
          <div className="demo-security-info">
            <span>🔒 Secured by Razorpay</span>
            <span className="demo-disclaimer">This is a demo payment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoRazorpay;