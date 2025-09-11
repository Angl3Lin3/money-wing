import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import kycRoutes from './routes/kyc';
import transactionRoutes from './routes/transaction';
import webhookRoutes from './routes/webhooks';
// import adminRoutes from './routes/admin';
// Load environment variables 
dotenv.config();

const app = express();



// Middleware 
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Webhook route with raw body parsing - MUST come BEFORE express.json()
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Regular JSON parsing for most routes
app.use(express.json());

// Routes 
app.use('/auth', authRoutes); // Add this line
app.use('/user', userRoutes);
app.use('/kyc', kycRoutes);
app.use('/transaction', transactionRoutes);
// app.use('/admin', adminRoutes);

export default app;



