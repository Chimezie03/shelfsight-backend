import { Router } from 'express';
import booksRouter from './books';
import ingestRouter from './ingest';
import loansRouter from './loans';
import authRouter from './auth';
import usersRouter from './users';

const router = Router();

router.use('/auth', authRouter);
router.use('/books', booksRouter);
router.use('/ingest', ingestRouter);
router.use('/loans', loansRouter);
router.use('/users', usersRouter);

// Stub routes for other endpoints
router.use('/map', (req, res) => res.status(501).json({ error: 'Not Implemented' }));

export default router;
