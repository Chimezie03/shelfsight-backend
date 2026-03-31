import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import {
  createSection,
  deleteSection,
  getSection,
  listSections,
  updateSection,
  listShelfBooks,
  saveLayout,
} from '../controllers/map.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// ARCH DECISION: Any authenticated role (including PATRON) may read map data for future UI parity.
router.get('/', requireAuth, wrapAsync(listSections));

// Bulk layout save — must come before /:id routes
router.put('/layout', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(saveLayout));

router.get('/:id', requireAuth, wrapAsync(getSection));
router.get('/:id/books', requireAuth, wrapAsync(listShelfBooks));

router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(createSection));
router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(updateSection));
router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(deleteSection));

export default router;
