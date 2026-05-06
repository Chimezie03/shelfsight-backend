import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  createInviteHandler,
  listInvitesHandler,
  revokeInviteHandler,
} from '../controllers/invites.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.post('/:id/invites', wrapAsync(createInviteHandler));
router.get('/:id/invites', wrapAsync(listInvitesHandler));
router.delete('/:id/invites/:inviteId', wrapAsync(revokeInviteHandler));

export default router;
