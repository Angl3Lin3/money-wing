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



// Middleware 
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
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



