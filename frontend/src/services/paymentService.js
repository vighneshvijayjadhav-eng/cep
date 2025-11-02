import config from '../config/config.js';
import { apiRequest, buildInvoiceUrl } from './apiClient.js';

export const createMemberOrder = async (token, payload) => {
  const data = await apiRequest('/member/payments/create-order', {
    method: 'POST',
    token,
    body: payload,
  });

  if (data?.transaction?.invoiceUrl) {
    data.transaction.invoiceUrl = buildInvoiceUrl(data.transaction.invoiceUrl);
  }

  return data;
};

export const verifyMemberPayment = async ({ orderId, paymentId, signature }) => {
  return apiRequest('/member/payments/verify', {
    method: 'POST',
    body: { orderId, paymentId, signature },
  });
};

export const fetchMemberPayments = async (token) => {
  return apiRequest('/member/payments', {
    token,
  });
};

export const formatCurrency = (amount) => {
  if (Number.isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount));
};

export const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (_err) {
    return value;
  }
};

export const ensureRazorpay = () => {
  if (!config.RAZORPAY_KEY_ID) {
    return Promise.reject(new Error('Razorpay key is not configured'));
  }

  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
};