import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { getFines, markFinePaid, markFineWaived } from '../controllers/fines.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', wrapAsync(getFines));
router.post('/:fineId/pay', wrapAsync(markFinePaid));
// Waiving a fine is a privileged staff action — patrons cannot waive
router.post('/:fineId/waive', requireRole('ADMIN', 'STAFF'), wrapAsync(markFineWaived));

export default router;
