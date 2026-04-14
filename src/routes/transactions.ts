import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT } from '../middleware/auth.middleware';
import { getTransactions } from '../controllers/transactions.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', wrapAsync(getTransactions));

export default router;
