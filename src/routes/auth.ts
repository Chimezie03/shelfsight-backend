import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import {
  login,
  logout,
  me,
  signup,
  acceptInviteController,
  getInvitePreviewController,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', wrapAsync(login));
router.post('/forgot-password', wrapAsync(forgotPassword));
router.post('/reset-password', wrapAsync(resetPassword));
router.post('/logout', logout);
router.get('/me', requireAuth, wrapAsync(me));
router.post('/signup', wrapAsync(signup));
router.post('/accept-invite', wrapAsync(acceptInviteController));
router.get('/invites/:token', wrapAsync(getInvitePreviewController));

export default router;
