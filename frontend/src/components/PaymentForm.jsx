import React, { useState } from 'react';
import { createMaintenanceOrder, verifyPayment } from '../services/paymentService';
import config from '../config/config';
import './PaymentForm.css';

const PaymentForm = ({ onPaymentSuccess }) => {
  const [formData, setFormData] = useState({
    amount: '',
    society_name: '',
    flat_number: '',
    wing: '',
    floor: '',
    member_name: '',
    member_phone: '',
    member_email: '',
    maintenance_type: 'monthly',
    payment_period: '',
    due_date: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    if (!formData.society_name.trim()) {
      newErrors.society_name = 'Society name is required';
    }
    if (!formData.flat_number.trim()) {
      newErrors.flat_number = 'Flat number is required';
    }
    if (!formData.member_name.trim()) {
      newErrors.member_name = 'Member name is required';
    }
    if (!formData.payment_period.trim()) {
      newErrors.payment_period = 'Payment period is required';
    }
    if (formData.member_phone && !/^[6-9]\d{9}$/.test(formData.member_phone)) {
      newErrors.member_phone = 'Please enter a valid 10-digit mobile number';
    }
    if (formData.member_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.member_email)) {
      newErrors.member_email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async (orderData) => {
    return new Promise((resolve, reject) => {
      const options = {
        key: config.RAZORPAY.KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.bill_details.society_name,
        description: `${orderData.bill_details.maintenance_type} maintenance for ${orderData.bill_details.payment_period}`,
        order_id: orderData.id,
        
        prefill: {
          name: orderData.bill_details.member_name,
          contact: formData.member_phone,
          email: formData.member_email
        },
        
        theme: config.RAZORPAY.THEME,
        
        handler: function(response) {
          resolve(response);
        },
        
        modal: {
          ondismiss: function() {
            reject(new Error('Payment cancelled by user'));
          }
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // Step 1: Create maintenance order
      const orderData = await createMaintenanceOrder({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      // Step 2: Open Razorpay checkout
      const paymentResponse = await handlePayment(orderData);
      
      // Step 3: Verify payment
      const verificationResult = await verifyPayment({
        order_id: paymentResponse.razorpay_order_id,
        payment_id: paymentResponse.razorpay_payment_id,
        signature: paymentResponse.razorpay_signature
      });
      
      if (verificationResult.verified) {
        onPaymentSuccess({
          ...verificationResult.transaction_details,
          order_id: paymentResponse.razorpay_order_id
        });
      } else {
        throw new Error('Payment verification failed');
      }
      
    } catch (error) {
      console.error('Payment failed:', error);
      alert(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form-container">
      <div className="payment-form-card">
        <h2>Society Maintenance Payment</h2>
        
        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Maintenance Amount (₹) *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="Enter amount"
                min="1"
                required
              />
              {errors.amount && <span className="error">{errors.amount}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="maintenance_type">Maintenance Type</label>
              <select
                id="maintenance_type"
                name="maintenance_type"
                value={formData.maintenance_type}
                onChange={handleInputChange}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="society_name">Society Name *</label>
              <input
                type="text"
                id="society_name"
                name="society_name"
                value={formData.society_name}
                onChange={handleInputChange}
                placeholder="Enter society name"
                required
              />
              {errors.society_name && <span className="error">{errors.society_name}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="payment_period">Payment Period *</label>
              <input
                type="text"
                id="payment_period"
                name="payment_period"
                value={formData.payment_period}
                onChange={handleInputChange}
                placeholder="e.g., January 2025"
                required
              />
              {errors.payment_period && <span className="error">{errors.payment_period}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="flat_number">Flat Number *</label>
              <input
                type="text"
                id="flat_number"
                name="flat_number"
                value={formData.flat_number}
                onChange={handleInputChange}
                placeholder="e.g., A-101"
                required
              />
              {errors.flat_number && <span className="error">{errors.flat_number}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="wing">Wing/Block</label>
              <input
                type="text"
                id="wing"
                name="wing"
                value={formData.wing}
                onChange={handleInputChange}
                placeholder="e.g., A"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="floor">Floor</label>
              <input
                type="text"
                id="floor"
                name="floor"
                value={formData.floor}
                onChange={handleInputChange}
                placeholder="e.g., 1"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="due_date">Due Date</label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="member_name">Member Name *</label>
              <input
                type="text"
                id="member_name"
                name="member_name"
                value={formData.member_name}
                onChange={handleInputChange}
                placeholder="Enter member name"
                required
              />
              {errors.member_name && <span className="error">{errors.member_name}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="member_phone">Phone Number</label>
              <input
                type="tel"
                id="member_phone"
                name="member_phone"
                value={formData.member_phone}
                onChange={handleInputChange}
                placeholder="10-digit mobile number"
              />
              {errors.member_phone && <span className="error">{errors.member_phone}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="member_email">Email Address</label>
            <input
              type="email"
              id="member_email"
              name="member_email"
              value={formData.member_email}
              onChange={handleInputChange}
              placeholder="Enter email address"
            />
            {errors.member_email && <span className="error">{errors.member_email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Additional Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Any additional notes"
              rows="3"
            />
          </div>

          <button 
            type="submit" 
            className="pay-button"
            disabled={loading}
          >
            {loading ? 'Processing...' : `Pay ₹${formData.amount || '0'}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;