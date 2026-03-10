import { Router } from 'express';
import { getBooks, createBook, updateBook, deleteBook } from '../controllers/books.controller';

const router = Router();


router.post('/', createBook);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);
router.get('/', getBooks);

export default router;
