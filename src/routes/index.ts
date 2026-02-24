import { Router } from 'express';
import booksRouter from './books';
import ingestRouter from './ingest';

const router = Router();

router.use('/books', booksRouter);
router.use('/ingest', ingestRouter);

// Stub routes for other endpoints
router.use('/auth', (req, res) => res.status(501).json({ error: 'Not Implemented' }));
router.use('/loans', (req, res) => res.status(501).json({ error: 'Not Implemented' }));
router.use('/map', (req, res) => res.status(501).json({ error: 'Not Implemented' }));

export default router;
