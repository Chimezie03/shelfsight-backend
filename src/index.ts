import app from './app';
import fetch from 'node-fetch';
import { logInfo } from './lib/logger';

(globalThis as any).fetch = fetch;

// Fail fast on missing required environment variables before starting the server.
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnv.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values.',
  );
}
if (!process.env.CORS_ORIGIN) {
  console.warn('[env] CORS_ORIGIN not set; defaulting to http://localhost:3000. Set it in production.');
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  if (process.env.NODE_ENV === 'production') {
    logInfo('server_listen', { port: Number(PORT) });
  } else {
    console.log(`Server running on port ${PORT}`);
  }
});
