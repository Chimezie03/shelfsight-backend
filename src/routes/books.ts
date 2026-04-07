import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/books.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, wrapAsync(getBooks));
router.get('/:id', requireAuth, wrapAsync(getBook));
router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(createBook));
router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(updateBook));
router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(deleteBook));

export default router;
