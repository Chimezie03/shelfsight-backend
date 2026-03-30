import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import {
  createSection,
  deleteSection,
  getSection,
  listSections,
  updateSection,
} from '../controllers/map.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ARCH DECISION: Any authenticated role (including PATRON) may read map data for future UI parity.
router.get('/', requireAuth, wrapAsync(listSections));
router.get('/:id', requireAuth, wrapAsync(getSection));

router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(createSection));
router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(updateSection));
router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(deleteSection));

export default router;
