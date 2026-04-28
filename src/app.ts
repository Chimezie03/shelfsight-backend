import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import prisma from './lib/prisma';
import { httpAccessLog } from './lib/http-access-log';
import routes from './routes';
import { errorHandler } from './middleware/error-handler';

// Request type augmentation lives in src/types/express.d.ts.

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Rate limiting is disabled in development/test to allow load testing.
// It is enforced in production only.
if (process.env.NODE_ENV === 'production') {
  // Global rate limit: 300 requests per 15 minutes per IP
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' },
  });
  app.use(globalLimiter);

  // Strict limit on auth endpoints: 15 requests per 15 minutes per IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, please try again later.' },
  });
  app.use('/auth/login', authLimiter);
}
if (process.env.NODE_ENV === 'production') {
  app.use(httpAccessLog);
} else {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', db: 'error', timestamp: new Date().toISOString() });
  }
});

app.use('/', routes);

app.use(errorHandler);

export default app;
