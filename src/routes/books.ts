import { Router } from 'express';
import multer from 'multer';
import { wrapAsync } from '../lib/async-handler';
import {
  getBooks,
  getBook,
  createBook,
  bulkCreateBooks,
  bulkUploadFile,
  updateBook,
  deleteBook,
} from '../controllers/books.controller';

import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAuth, wrapAsync(getBooks));
router.get('/:id', requireAuth, wrapAsync(getBook));
router.post('/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(bulkCreateBooks));
router.post('/bulk-file', requireAuth, requireRole('ADMIN', 'STAFF'), upload.single('file'), wrapAsync(bulkUploadFile));
router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(createBook));
router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(updateBook));
router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), wrapAsync(deleteBook));

export default router;
