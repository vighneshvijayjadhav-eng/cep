// Payment Service - API calls for Razorpay integration
import config from '../config/config';

const API_BASE_URL = config.API_BASE_URL;

// Create maintenance payment order
export const createMaintenanceOrder = async (paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/create-maintenance-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating maintenance order:', error);
    throw error;
  }
};

// Verify payment after Razorpay success
export const verifyPayment = async (verificationData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verificationData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

// Get payment history
export const getPaymentHistory = async (queryParams = '') => {
  try {
    const url = `${API_BASE_URL}/payment-history${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching payment history:', error);
    throw error;
  }
};

// Get payment receipt details
export const getPaymentReceipt = async (orderId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/payment-receipt/${orderId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching payment receipt:', error);
    throw error;
  }
};

// Get pending payments
export const getPendingPayments = async (queryParams = '') => {
  try {
    const url = `${API_BASE_URL}/pending-payments${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    throw error;
  }
};

// Get society summary
export const getSocietySummary = async (societyName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/society-summary/${encodeURIComponent(societyName)}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching society summary:', error);
    throw error;
  }
};

// Utility function to format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Utility function to format date
export const formatDate = (dateString) => {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString));
};

// Utility function to format date and time
export const formatDateTime = (dateString) => {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
};

// Validate form data before sending to API
export const validatePaymentData = (data) => {
  const errors = {};

  if (!data.amount || data.amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  if (!data.society_name?.trim()) {
    errors.society_name = 'Society name is required';
  }

  if (!data.flat_number?.trim()) {
    errors.flat_number = 'Flat number is required';
  }

  if (!data.member_name?.trim()) {
    errors.member_name = 'Member name is required';
  }

  if (!data.payment_period?.trim()) {
    errors.payment_period = 'Payment period is required';
  }

  if (data.member_phone && !/^[6-9]\d{9}$/.test(data.member_phone)) {
    errors.member_phone = 'Invalid phone number format';
  }

  if (data.member_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.member_email)) {
    errors.member_email = 'Invalid email format';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Generate payment period suggestions based on maintenance type
export const generatePaymentPeriodSuggestions = (maintenanceType) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  switch (maintenanceType) {
    case 'monthly':
      return [
        `${months[currentMonth]} ${currentYear}`,
        `${months[(currentMonth + 1) % 12]} ${currentMonth === 11 ? currentYear + 1 : currentYear}`,
        `${months[(currentMonth + 2) % 12]} ${currentMonth >= 10 ? currentYear + 1 : currentYear}`,
      ];
    
    case 'quarterly':
      const currentQuarter = Math.floor(currentMonth / 3) + 1;
      return [
        `Q${currentQuarter} ${currentYear}`,
        `Q${currentQuarter === 4 ? 1 : currentQuarter + 1} ${currentQuarter === 4 ? currentYear + 1 : currentYear}`,
        `Q${currentQuarter <= 2 ? currentQuarter + 2 : currentQuarter - 2} ${currentQuarter <= 2 ? currentYear : currentYear + 1}`,
      ];
    
    case 'annual':
      return [
        `${currentYear}`,
        `${currentYear + 1}`,
        `${currentYear + 2}`,
      ];
    
    default:
      return [];
  }
};

// Check if Razorpay is loaded
export const isRazorpayLoaded = () => {
  return typeof window !== 'undefined' && window.Razorpay;
};

// Load Razorpay script dynamically if not loaded
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (isRazorpayLoaded()) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.head.appendChild(script);
  });
};