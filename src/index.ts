import app from './app';
import fetch from 'node-fetch';
(globalThis as any).fetch = fetch;

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
