// Calls for the developer area. Uses the developer login, not the customer one.
import axios from 'axios';
import { API_BASE_URL } from '../app/constants/config';
import { getDevToken } from './auth-storage';
import type { Network, TransactionStatus } from './api';

const adminApi = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

adminApi.interceptors.request.use(async (config) => {
  const token = await getDevToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Overview {
  server: { status: string; startedAt: string; uptimeSeconds: number; nodeVersion: string; environment: string };
  database: { ok: boolean; latencyMs?: number; error?: string };
  config: {
    jwtSecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    payoutProvider: string;
    emailProvider: string;
    adminCount: number;
    pricing: { exchangeRate: number; feePercent: number; minCad: number; maxCad: number };
  };
  totals: {
    users: { total: number; verified: number; pending: number; newLast24h: number };
    recipients: number;
    transfers: {
      total: number;
      newLast24h: number;
      byStatus: Partial<Record<TransactionStatus, { count: number; cadAmount: number }>>;
      paidVolumeCad: number;
    };
  };
}

export interface AdminUser {
  id: string;
  email: string;
  status: string;
  kycStatus: string | null;
  createdAt: string;
  _count: { recipients: number; transactions: number };
}

export interface AdminTransaction {
  id: string;
  cadAmount: number;
  fee: number;
  exchangeRate: number;
  ugxAmount: number;
  status: TransactionStatus;
  provider: string | null;
  stripePaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string };
  recipient: { name: string; phoneNumber: string; network: Network };
}

export interface Activity {
  startedAt: string;
  requests: { time: string; method: string; path: string; status: number; durationMs: number }[];
  errors: { time: string; message: string }[];
  summary: { requestsLastHour: number; serverErrorsLastHour: number; averageMsLastHour: number };
}

export const adminAPI = {
  overview: async (): Promise<Overview> => (await adminApi.get('/admin/overview')).data,
  users: async (): Promise<AdminUser[]> => (await adminApi.get('/admin/users')).data.users,
  transactions: async (status?: TransactionStatus): Promise<AdminTransaction[]> =>
    (await adminApi.get('/admin/transactions', { params: status ? { status } : {} })).data.transactions,
  activity: async (): Promise<Activity> => (await adminApi.get('/admin/activity')).data,

  // Quick checks that the main parts of the API answer. Each returns how long it took.
  checks: [
    { name: 'Server is reachable', run: () => adminApi.get('/') },
    { name: 'Login service answers', run: () => adminApi.post('/auth/login', {}).catch((e) => {
        // An empty login *should* be rejected with 400: that means the route works.
        if (e?.response?.status === 400) return e.response;
        throw e;
      }) },
    { name: 'Quotes work (rate & fee)', run: () => adminApi.get('/transaction/quote', { params: { cadAmount: '100' } }) },
    { name: 'Recipients service answers', run: () => adminApi.get('/transaction/recipients') },
    { name: 'Database answers', run: async () => {
        const r = await adminApi.get('/admin/overview');
        if (!r.data.database.ok) throw new Error(r.data.database.error ?? 'Database unreachable');
        return r;
      } },
  ],
};
