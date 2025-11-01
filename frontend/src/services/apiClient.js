import config from '../config/config.js';

const defaultHeaders = {
  'Content-Type': 'application/json',
};

const toAbsoluteUrl = (maybeRelative) => {
  if (!maybeRelative) {
    return '';
  }
  try {
    return new URL(maybeRelative, config.API_BASE_URL).href;
  } catch (_err) {
    return maybeRelative;
  }
};

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = payload && typeof payload === 'object' && payload.error ? payload.error : response.statusText;
    const err = new Error(error || 'Request failed');
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  if (payload && typeof payload === 'object') {
    if (payload.invoiceUrl) {
      payload.invoiceUrl = toAbsoluteUrl(payload.invoiceUrl);
    }

    if (Array.isArray(payload.payments)) {
      payload.payments = payload.payments.map((payment) => ({
        ...payment,
        invoiceUrl: payment.invoiceUrl ? toAbsoluteUrl(payment.invoiceUrl) : '',
      }));
    }
  }

  return payload;
};

export const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    token,
    body,
    headers = {},
    raw,
  } = options;

  const finalHeaders = new Headers();
  const hasFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (!hasFormData) {
    Object.entries({ ...defaultHeaders, ...headers }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        finalHeaders.set(key, value);
      }
    });
  } else {
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        finalHeaders.set(key, value);
      }
    });
  }

  if (token) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${config.API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? (hasFormData ? body : JSON.stringify(body)) : null,
  });

  if (raw) {
    return response;
  }

  return parseResponse(response);
};

export const buildInvoiceUrl = (invoicePath) => toAbsoluteUrl(invoicePath);
