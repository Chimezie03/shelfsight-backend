import { Router } from 'express';
import multer from 'multer';
import { wrapAsync } from '../lib/async-handler';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  analyzeBookImage,
  lookupBookByIsbn,
  listJobs,
  getJob,
  approveJob,
  rejectJob,
} from '../controllers/ingest.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/lookup', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(lookupBookByIsbn));

router.post('/analyze', requireAuth, requireRole('ADMIN', 'STAFF'), upload.single('image'), wrapAsync(analyzeBookImage));

// Job management
router.get('/jobs', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(listJobs));
router.get('/jobs/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(getJob));
router.post('/jobs/:id/approve', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(approveJob));
router.post('/jobs/:id/reject', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(rejectJob));

export default router;
