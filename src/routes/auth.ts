import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', wrapAsync(login));
router.post('/logout', logout);
router.get('/me', requireAuth, wrapAsync(me));

export default router;
