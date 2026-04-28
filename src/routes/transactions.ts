import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { getTransactions } from '../controllers/transactions.controller';

const router = Router();

router.use(authenticateJWT);

// Transaction audit log is staff/admin-only
router.get('/', requireRole('ADMIN', 'STAFF'), wrapAsync(getTransactions));

export default router;
