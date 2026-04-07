import app from './app';
import fetch from 'node-fetch';
import { logInfo } from './lib/logger';

(globalThis as any).fetch = fetch;

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  if (process.env.NODE_ENV === 'production') {
    logInfo('server_listen', { port: Number(PORT) });
  } else {
    console.log(`Server running on port ${PORT}`);
  }
});
