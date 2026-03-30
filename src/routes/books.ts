import { Router } from 'express';
import { wrapAsync } from '../lib/async-handler';
import {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/books.controller';

const router = Router();

router.get('/', wrapAsync(getBooks));
router.get('/:id', wrapAsync(getBook));
router.post('/', wrapAsync(createBook));
router.put('/:id', wrapAsync(updateBook));
router.delete('/:id', wrapAsync(deleteBook));

export default router;
