import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import kycRoutes from './routes/kyc';
import transactionRoutes from './routes/transaction';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';
import { requestMonitor } from './services/monitor.service';

const app = express();



// On a hosting service the app sits behind the host's proxy. TRUST_PROXY=1
// lets the server see each visitor's real address (used by the login limits).
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Which websites may call this server from a browser.
//  - CORS_ORIGINS set (comma-separated, e.g. "https://app.moneywingapp.com"):
//    only those websites.
//  - Not set, while developing: any website (localhost, a phone on the Wi-Fi).
//  - Not set, in production: no websites at all, until it is set.
// The phone app isn't a website, so it is never blocked by this.
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
const production = process.env.NODE_ENV === 'production';
if (production && allowedOrigins.length === 0) {
    console.warn('⚠️  CORS_ORIGINS is not set: browsers on other websites cannot use this server.');
}

// Middleware 
app.use(helmet());
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true); // phone app, curl, same site
            if (allowedOrigins.length > 0) return callback(null, allowedOrigins.includes(origin));
            return callback(null, !production);
        },
    }),
);
// Each request line ends with how long the server took, e.g. "- 230 ms".
app.use(morgan(':remote-addr ":method :url" :status - :response-time ms'));
app.use(requestMonitor); // recent requests, shown in the developer area

// Webhook route with raw body parsing - MUST come BEFORE express.json()
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Regular JSON parsing for most routes
app.use(express.json());

// Health check (used by the app's "Test API Connection" screen)
app.get('/', (_req, res) => {
    res.json({ status: 'ok', service: 'moneywing-api' });
});

// Routes 
app.use('/auth', authRoutes); // Add this line
app.use('/user', userRoutes);
app.use('/kyc', kycRoutes);
app.use('/transaction', transactionRoutes);
app.use('/admin', adminRoutes); // developer area (ADMIN_EMAILS only)

export default app;



