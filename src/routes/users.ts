import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT, getUsers);
router.post('/', authenticateJWT, createUser);
router.put('/:id', authenticateJWT, updateUser);
router.delete('/:id', authenticateJWT, deleteUser);

export default router;
