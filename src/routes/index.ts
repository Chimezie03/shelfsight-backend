import { Router } from 'express';
import booksRouter from './books';
import ingestRouter from './ingest';
import loansRouter from './loans';
import authRouter from './auth';
import usersRouter from './users';
import mapRouter from './map';

const router = Router();

router.use('/auth', authRouter);
router.use('/books', booksRouter);
router.use('/ingest', ingestRouter);
router.use('/loans', loansRouter);
router.use('/users', usersRouter);
router.use('/map', mapRouter);

export default router;
