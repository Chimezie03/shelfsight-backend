import { Router } from 'express';
<<<<<<< HEAD
import { login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
=======
import { login, getMe } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
>>>>>>> 4fe7ecfe5c39cb943344d7210a4286f1f9f91e66

const router = Router();

router.post('/login', login);
<<<<<<< HEAD
router.post('/logout', logout);
router.get('/me', requireAuth, me);
=======
router.get('/me', authenticateJWT, getMe);
>>>>>>> 4fe7ecfe5c39cb943344d7210a4286f1f9f91e66

export default router;
