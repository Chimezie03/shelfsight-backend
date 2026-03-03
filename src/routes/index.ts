import { Router } from 'express';
import booksRouter from './books';
import ingestRouter from './ingest';
import authRouter from './auth';

const router = Router();

router.use('/auth', authRouter);
router.use('/books', booksRouter);
router.use('/ingest', ingestRouter);

// Stub routes for other endpoints
router.use('/loans', (req, res) => res.status(501).json({ error: 'Not Implemented' }));
router.use('/map', (req, res) => res.status(501).json({ error: 'Not Implemented' }));

export default router;
