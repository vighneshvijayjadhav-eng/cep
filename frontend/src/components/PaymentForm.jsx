import React, { useState, useEffect } from 'react';
import { createMaintenanceOrder, verifyPayment } from '../services/paymentService';
import { createMaintenanceOrderDemo, verifyPaymentDemo, sendReceiptEmailDemo } from '../services/demoService';
import { getAllFlats, getAllSocieties, getFlatsBySociety } from '../services/flatService';
import DemoRazorpay from './DemoRazorpay';
import config from '../config/config';
import './PaymentForm.css';

const PaymentForm = ({ onPaymentSuccess }) => {
  const [societies, setSocieties] = useState([]);
  const [availableFlats, setAvailableFlats] = useState([]);
  const [selectedFlat, setSelectedFlat] = useState(null);
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
  const [showDemoPayment, setShowDemoPayment] = useState(false);
  const [demoOrderData, setDemoOrderData] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Load societies on component mount
    const allSocieties = getAllSocieties();
    setSocieties(allSocieties);
  }, []);

  const handleSocietyChange = (e) => {
    const society = e.target.value;
    setFormData(prev => ({
      ...prev,
      society_name: society,
      flat_number: '',
      member_name: '',
      member_email: '',
      member_phone: '',
      wing: '',
      floor: '',
      amount: ''
    }));
    setSelectedFlat(null);
    
    if (society) {
      const flats = getFlatsBySociety(society);
      setAvailableFlats(flats);
    } else {
      setAvailableFlats([]);
    }
  };

  const handleFlatSelection = (e) => {
    const flatNumber = e.target.value;
    const flat = availableFlats.find(f => f.flat_number === flatNumber);
    
    if (flat) {
      setSelectedFlat(flat);
      setFormData(prev => ({
        ...prev,
        flat_number: flat.flat_number,
        member_name: flat.member_name,
        member_email: flat.member_email,
        member_phone: flat.member_phone,
        wing: flat.wing || '',
        floor: flat.floor || '',
        amount: flat.maintenance_amount || '',
        maintenance_type: flat.maintenance_type || 'monthly'
      }));
    } else {
      setSelectedFlat(null);
      setFormData(prev => ({
        ...prev,
        flat_number: flatNumber
      }));
    }
  };

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
    if (config.DEMO_MODE) {
      // Show demo payment modal
      setDemoOrderData(orderData);
      setShowDemoPayment(true);
      return new Promise((resolve, reject) => {
        // This will be resolved by the demo payment component
        window.demoPaymentResolve = resolve;
        window.demoPaymentReject = reject;
      });
    } else {
      // Real Razorpay payment
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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    console.log('🔄 Starting payment process...');
    
    try {
      // Step 1: Create maintenance order
      console.log('📝 Creating maintenance order...');
      let orderData;
      if (config.DEMO_MODE) {
        orderData = await createMaintenanceOrderDemo({
          ...formData,
          amount: parseFloat(formData.amount)
        });
      } else {
        orderData = await createMaintenanceOrder({
          ...formData,
          amount: parseFloat(formData.amount)
        });
      }
      console.log('✅ Order created:', orderData);
      
      // Step 2: Open payment checkout (Razorpay or Demo)
      console.log('💳 Opening payment modal...');
      const paymentResponse = await handlePayment(orderData);
      console.log('✅ Payment response:', paymentResponse);
      
      // Step 3: Verify payment
      console.log('🔍 Verifying payment...');
      let verificationResult;
      if (config.DEMO_MODE) {
        verificationResult = await verifyPaymentDemo({
          order_id: paymentResponse.razorpay_order_id,
          payment_id: paymentResponse.razorpay_payment_id,
          signature: paymentResponse.razorpay_signature
        });
        
        // Send demo receipt email
        console.log('📧 Sending receipt email...');
        await sendReceiptEmailDemo({
          payment_id: paymentResponse.razorpay_payment_id,
          email: formData.member_email,
          amount: orderData.amount,
          member_name: formData.member_name,
          society_name: formData.society_name,
          payment_period: formData.payment_period
        });
      } else {
        verificationResult = await verifyPayment({
          order_id: paymentResponse.razorpay_order_id,
          payment_id: paymentResponse.razorpay_payment_id,
          signature: paymentResponse.razorpay_signature
        });
      }
      console.log('✅ Verification result:', verificationResult);
      
      if (verificationResult.verified) {
        console.log('🎉 Payment successful, redirecting...');
        onPaymentSuccess({
          ...verificationResult.transaction_details,
          order_id: paymentResponse.razorpay_order_id,
          isDemo: config.DEMO_MODE,
          emailSent: config.DEMO_MODE
        });
      } else {
        throw new Error('Payment verification failed');
      }
      
    } catch (error) {
      console.error('❌ Payment failed:', error);
      alert(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
      console.log('🏁 Payment process completed');
    }
  };

  return (
    <div className="payment-form-container">
      <div className="payment-form-card">
        <h2>Society Maintenance Payment</h2>
        
        {selectedFlat && (
          <div className="auto-fill-notice">
            <span className="notice-icon">✅</span>
            <span>Information auto-filled for {selectedFlat.flat_number}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="payment-form">
          {/* Society and Flat Selection */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="society_name">Society Name *</label>
              <select
                id="society_name"
                name="society_name"
                value={formData.society_name}
                onChange={handleSocietyChange}
                required
              >
                <option value="">Select Society</option>
                {societies.map((society, index) => (
                  <option key={index} value={society}>{society}</option>
                ))}
                <option value="__other__">➕ Enter Manually</option>
              </select>
              {errors.society_name && <span className="error">{errors.society_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="flat_number">Flat Number *</label>
              {formData.society_name && formData.society_name !== '__other__' && availableFlats.length > 0 ? (
                <select
                  id="flat_number"
                  name="flat_number"
                  value={formData.flat_number}
                  onChange={handleFlatSelection}
                  required
                >
                  <option value="">Select Flat</option>
                  {availableFlats.map((flat) => (
                    <option key={flat.id} value={flat.flat_number}>
                      {flat.flat_number} - {flat.member_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="flat_number"
                  name="flat_number"
                  value={formData.flat_number}
                  onChange={handleInputChange}
                  placeholder="e.g., A-101"
                  required
                />
              )}
              {errors.flat_number && <span className="error">{errors.flat_number}</span>}
            </div>
          </div>
          
          {formData.society_name === '__other__' && (
            <div className="form-group">
              <label htmlFor="society_name_manual">Enter Society Name *</label>
              <input
                type="text"
                id="society_name_manual"
                name="society_name"
                value={formData.society_name === '__other__' ? '' : formData.society_name}
                onChange={handleInputChange}
                placeholder="Enter society name"
                required
              />
            </div>
          )}

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
          
          {config.DEMO_MODE && (
            <div className="demo-notice">
              <p>🎯 Demo Mode: Payment simulation for client presentation</p>
              <p>📧 Receipt will be sent via email after payment</p>
            </div>
          )}
        </form>
      </div>
      
      {/* Demo Payment Modal */}
      {showDemoPayment && demoOrderData && (
        <DemoRazorpay
          isOpen={showDemoPayment}
          orderData={demoOrderData}
          onPaymentSuccess={(response) => {
            console.log('✅ Demo payment success:', response);
            setShowDemoPayment(false);
            if (window.demoPaymentResolve) {
              window.demoPaymentResolve(response);
              window.demoPaymentResolve = null;
              window.demoPaymentReject = null;
            }
          }}
          onPaymentFailure={(error) => {
            console.log('❌ Demo payment failure:', error);
            setShowDemoPayment(false);
            if (window.demoPaymentReject) {
              window.demoPaymentReject(error);
              window.demoPaymentResolve = null;
              window.demoPaymentReject = null;
            }
          }}
          onClose={() => {
            console.log('🚪 Demo payment closed');
            setShowDemoPayment(false);
            if (window.demoPaymentReject) {
              window.demoPaymentReject(new Error('Payment cancelled by user'));
              window.demoPaymentResolve = null;
              window.demoPaymentReject = null;
            }
          }}
        />
      )}
    </div>
  );
};

export default PaymentForm;