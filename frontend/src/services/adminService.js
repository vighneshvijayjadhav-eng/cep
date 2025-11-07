import { apiRequest, buildInvoiceUrl } from './apiClient.js';

export const listMembers = async (token, search = '') => {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await apiRequest(`/admin/members${query}`, { token });
  return data?.members || [];
};

export const createMember = async (token, payload) => {
  return apiRequest('/admin/members', {
    method: 'POST',
    token,
    body: payload,
  });
};

export const updateMember = async (token, id, payload) => {
  return apiRequest(`/admin/members/${id}`, {
    method: 'PUT',
    token,
    body: payload,
  });
};

export const deleteMember = async (token, id) => {
  return apiRequest(`/admin/members/${id}`, {
    method: 'DELETE',
    token,
  });
};

export const importMembers = async (token, file) => {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest('/admin/members/import', {
    method: 'POST',
    token,
    body: formData,
  });
};

export const listPayments = async (token, params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.status) {
    queryParams.set('status', params.status);
  }
  if (params.flatNumber) {
    queryParams.set('flatNumber', params.flatNumber);
  }

  const suffix = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const data = await apiRequest(`/admin/payments${suffix}`, { token });

  if (!data || !Array.isArray(data.payments)) {
    return [];
  }

  return data.payments.map((payment) => ({
    ...payment,
    invoiceUrl: payment.invoiceUrl ? buildInvoiceUrl(payment.invoiceUrl) : '',
  }));
};

export const generatePaymentReport = async (token, payload = {}) => {
  return apiRequest('/admin/payments/report', {
    method: 'POST',
    token,
    body: payload,
  });
};

export const sendPaymentNotification = async (token, orderId, payload = {}) => {
  return apiRequest(`/admin/payments/${orderId}/notify`, {
    method: 'POST',
    token,
    body: payload,
  });
};
