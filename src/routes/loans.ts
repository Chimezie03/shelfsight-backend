import { Router } from 'express';
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

router.post('/checkout', checkout);
router.post('/checkin', checkin);
router.get('/', getLoans);

// Book copy tracking
router.get('/copies/:copyId/location', getCopyLocation);
router.get('/copies/:copyId/history', getCopyHistory);
router.post('/copies/:copyId/shelve', shelveCopy);

export default router;
