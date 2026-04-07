import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import prisma from './lib/prisma';
import { httpAccessLog } from './lib/http-access-log';
import routes from './routes';
import { errorHandler } from './middleware/error-handler';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string };
    }
  }
}

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
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
