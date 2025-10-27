// Configuration file for the payment application
export const config = {
  // Backend API URL - Update this to match your backend server
  API_BASE_URL: 'http://localhost:5000',
  
  // Demo Mode - Set to true for demo without actual Razorpay integration
  DEMO_MODE: true,
  
  // Razorpay Configuration
  RAZORPAY: {
    // Replace with your actual Razorpay Key ID from your dashboard
    KEY_ID: 'rzp_test_demo_key_id', // Demo key - replace with actual key for production
    
    // Theme configuration for Razorpay checkout
    THEME: {
      color: '#667eea'
    },
    
    // Currency
    CURRENCY: 'INR'
  },
  
  // Application settings
  APP: {
    NAME: 'Society Maintenance Payment',
    VERSION: '1.0.0',
    DESCRIPTION: 'Secure payment system for society maintenance charges'
  },
  
  // Pagination settings
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 50
  },
  
  // Validation settings
  VALIDATION: {
    MAX_AMOUNT: 999999,
    MIN_AMOUNT: 1,
    PHONE_REGEX: /^[6-9]\d{9}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    GST_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  }
};

// Environment-specific configurations
export const getConfig = () => {
  const env = import.meta.env.MODE || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...config,
        API_BASE_URL: 'https://your-production-api.com', // Update for production
        RAZORPAY: {
          ...config.RAZORPAY,
          KEY_ID: 'rzp_live_your_live_key_id_here' // Live key for production
        }
      };
    
    case 'staging':
      return {
        ...config,
        API_BASE_URL: 'https://your-staging-api.com' // Update for staging
      };
    
    default: // development
      return config;
  }
};

export default getConfig();