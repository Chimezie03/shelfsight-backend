import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  checkout,
  checkin,
  getLoans,
  getCopyLocation,
  shelveCopy,
  getCopyHistory,
} from '../controllers/loans.controller';

const router = Router();

router.use(authenticateJWT);

// Staff/Admin-only write operations
router.post('/checkout', requireRole('ADMIN', 'STAFF'), wrapAsync(checkout));
router.post('/checkin', requireRole('ADMIN', 'STAFF'), wrapAsync(checkin));

// All authenticated users may list loans (controller enforces patron scope)
router.get('/', wrapAsync(getLoans));

router.get('/copies/:copyId/location', wrapAsync(getCopyLocation));
router.get('/copies/:copyId/history', wrapAsync(getCopyHistory));
router.post('/copies/:copyId/shelve', requireRole('ADMIN', 'STAFF'), wrapAsync(shelveCopy));

export default router;
