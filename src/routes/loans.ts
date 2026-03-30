import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT } from '../middleware/auth.middleware';
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

router.post('/checkout', wrapAsync(checkout));
router.post('/checkin', wrapAsync(checkin));
router.get('/', wrapAsync(getLoans));

router.get('/copies/:copyId/location', wrapAsync(getCopyLocation));
router.get('/copies/:copyId/history', wrapAsync(getCopyHistory));
router.post('/copies/:copyId/shelve', wrapAsync(shelveCopy));

export default router;
