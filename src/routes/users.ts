import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, requireRole('ADMIN'), wrapAsync(getUsers));
router.post('/', authenticateJWT, requireRole('ADMIN'), wrapAsync(createUser));
router.put('/:id', authenticateJWT, requireRole('ADMIN'), wrapAsync(updateUser));
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), wrapAsync(deleteUser));

export default router;
