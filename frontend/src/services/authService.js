import { apiRequest } from './apiClient.js';

export const memberLogin = async ({ flatNumber, password }) => {
  return apiRequest('/auth/member/login', {
    method: 'POST',
    body: { flatNumber, password },
  });
};

export const adminLogin = async ({ email, password }) => {
  return apiRequest('/auth/admin/login', {
    method: 'POST',
    body: { email, password },
  });
};

export const adminRegister = async (token, payload) => {
  return apiRequest('/auth/admin/register', {
    method: 'POST',
    token,
    body: payload,
  });
};
