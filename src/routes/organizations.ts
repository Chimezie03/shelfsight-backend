import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  getOrgHandler,
  renameOrgHandler,
  deleteOrgHandler,
} from '../controllers/organizations.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/:id', wrapAsync(getOrgHandler));
router.patch('/:id', requireRole('ADMIN'), wrapAsync(renameOrgHandler));
router.delete('/:id', requireRole('ADMIN'), wrapAsync(deleteOrgHandler));

export default router;
