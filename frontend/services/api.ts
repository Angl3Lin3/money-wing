import axios from 'axios';
import { API_BASE_URL } from '../app/constants/config';
import { getToken } from './auth-storage';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    // Attach the saved login token so the server knows who we are.
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  signup: async (email: string, password: string) => {
    const response = await api.post('/auth/signup', { email, password });
    return response.data;
  },

  resendOTP: async (email: string) => {
    const response = await api.post('/auth/resend-otp', { email });
    return response.data;
  },

  verifyOTP: async (email: string, otpCode: string) => {
    const response = await api.post('/auth/verify-otp', { email, otpCode });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
};

// User API calls
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/user/me');
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.put('/user/profile', data);
    return response.data;
  },
};

// KYC API calls
export const kycAPI = {
  submitKYC: async (data: any) => {
    const response = await api.post('/kyc/submit', data);
    return response.data;
  },

  getKYCStatus: async () => {
    const response = await api.get('/kyc/status');
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    throw new Error('API is not accessible');
  }
};

export default api;

// Turns an API/network error into a message worth showing the user.
export const getErrorMessage = (error: any, fallback = 'Something went wrong'): string => {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.code === 'ECONNABORTED' || error?.message === 'Network Error') {
    return `Can't reach the server at ${API_BASE_URL}. Is the backend running?`;
  }
  return fallback;
};

// Recipients (people in Uganda the user sends money to)
export type Network = 'MTN' | 'Airtel';

export interface Recipient {
  id: string;
  name: string;
  phoneNumber: string;
  network: Network;
  createdAt?: string;
}

export const recipientAPI = {
  list: async (): Promise<Recipient[]> => {
    const response = await api.get('/transaction/recipients');
    return response.data.recipients;
  },

  add: async (name: string, phoneNumber: string, network: Network): Promise<Recipient> => {
    const response = await api.post('/transaction/recipients', { name, phoneNumber, network });
    return response.data.recipient;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/transaction/recipients/${id}`);
  },
};

// Quotes: how much the recipient gets for a CAD amount
export interface Quote {
  cadAmount: number;
  fee: number;
  exchangeRate: number;
  ugxAmount: number;
  expiresIn: number;
}

export const quoteAPI = {
  get: async (cadAmount: string): Promise<Quote> => {
    const response = await api.get('/transaction/quote', { params: { cadAmount } });
    return response.data;
  },
};

// Transfers
export type TransactionStatus =
  | 'DRAFT'
  | 'PAYMENT_PENDING'
  | 'FUNDED'
  | 'PAYOUT_PENDING'
  | 'COMPLETED'
  | 'PAYOUT_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export interface Transaction {
  id: string;
  cadAmount: number;
  fee: number;
  exchangeRate: number;
  ugxAmount: number;
  status: TransactionStatus;
  recipient: { name: string; phoneNumber: string; network: Network };
  createdAt: string;
  updatedAt?: string;
}

export const transactionAPI = {
  // `expected` = the amounts the user saw; the server refuses (409) if they changed.
  create: async (
    recipientId: string,
    quote: Quote
  ): Promise<Transaction> => {
    const response = await api.post('/transaction', {
      recipientId,
      cadAmount: quote.cadAmount.toFixed(2),
      expectedUgxAmount: quote.ugxAmount,
      expectedFee: quote.fee,
    });
    return response.data.transaction;
  },

  // Newest first. Pass the oldest loaded date as `before` to get the next page.
  list: async (before?: string): Promise<{ transactions: Transaction[]; hasMore: boolean }> => {
    const response = await api.get('/transaction', { params: { limit: 20, ...(before && { before }) } });
    return response.data;
  },

  get: async (id: string): Promise<Transaction> => {
    const response = await api.get(`/transaction/${id}`);
    return response.data.transaction;
  },
};
