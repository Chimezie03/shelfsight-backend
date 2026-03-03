import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import routes from './routes';

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
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/', routes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.name || 'Error', message: err.message || 'Internal Server Error', statusCode: err.statusCode || 500 });
});

export default app;
