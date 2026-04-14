import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { authenticateJWT } from '../middleware/auth.middleware';
import { getFines, markFinePaid, markFineWaived } from '../controllers/fines.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/', wrapAsync(getFines));
router.post('/:fineId/pay', wrapAsync(markFinePaid));
router.post('/:fineId/waive', wrapAsync(markFineWaived));

export default router;
