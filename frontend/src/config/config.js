const resolveEnv = (key, fallback = '') => {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

const createConfig = () => {
  const apiBase = resolveEnv('VITE_API_BASE_URL', 'http://localhost:5000');
  const razorpayKey = resolveEnv('VITE_RAZORPAY_KEY_ID');

  return {
    API_BASE_URL: apiBase.replace(/\/$/, ''),
    RAZORPAY_KEY_ID: razorpayKey,
  };
};

const config = createConfig();

export default config;