import { apiRequest, buildInvoiceUrl } from './apiClient.js';

export const fetchMemberProfile = async (token) => {
  const data = await apiRequest('/member/profile', { token });
  return data?.member ? data.member : null;
};

export const updateMemberProfile = async (token, payload) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  const response = await apiRequest('/member/profile', {
    method: 'PUT',
    token,
    body: formData,
  });

  return response?.member ? response.member : null;
};

export const fetchMemberPayments = async (token) => {
  const data = await apiRequest('/member/payments', { token });
  if (!data || !Array.isArray(data.payments)) {
    return [];
  }

  return data.payments.map((payment) => ({
    ...payment,
    invoiceUrl: payment.invoiceUrl ? buildInvoiceUrl(payment.invoiceUrl) : '',
  }));
};
