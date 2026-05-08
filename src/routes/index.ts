import { Router } from 'express';
import booksRouter from './books';
import ingestRouter from './ingest';
import loansRouter from './loans';
import authRouter from './auth';
import usersRouter from './users';
import mapRouter from './map';
import finesRouter from './fines';
import transactionsRouter from './transactions';
import invitesRouter from './invites';
import organizationsRouter from './organizations';
import testRouter from './test.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/books', booksRouter);
router.use('/ingest', ingestRouter);
router.use('/loans', loansRouter);
router.use('/users', usersRouter);
router.use('/map', mapRouter);
router.use('/fines', finesRouter);
router.use('/transactions', transactionsRouter);
// organizationsRouter must mount before invitesRouter — invitesRouter applies
// requireRole('ADMIN') at the router level, so a non-admin GET /orgs/:id would
// be blocked there before falling through to organizationsRouter.
router.use('/orgs', organizationsRouter);
router.use('/orgs', invitesRouter);

// Test helpers — only mounted outside production so E2E runs get a
// deterministic database state. Guarded so this surface never exists in prod.
if (process.env.NODE_ENV !== 'production') {
  router.use('/__test__', testRouter);
}

export default router;
