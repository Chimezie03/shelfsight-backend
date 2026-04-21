import { Router, type Request, type Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const router = Router();

router.post('/reset', async (_req: Request, res: Response) => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const { stdout } = await execAsync('npm run db:seed', { cwd: repoRoot, timeout: 60_000 });
  res.json({ success: true, data: { output: stdout.trim().split('\n').slice(-3) } });
});

export default router;
