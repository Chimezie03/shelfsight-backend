import type { Request, Response } from 'express';
import {
  checkoutService,
  checkinService,
  fetchLoans,
  getBookCopyLocation,
  shelveBookCopy,
  getBookCopyHistory,
} from '../services/loans.service';
import { AppError } from '../lib/errors';

export async function checkout(req: Request, res: Response) {
  const { bookCopyId, dueDays, userId: targetUserId } = req.body;

  if (!bookCopyId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: bookCopyId', {
      fieldErrors: { bookCopyId: 'Required' },
    });
  }

  const userId =
    targetUserId && (req.user?.role === 'ADMIN' || req.user?.role === 'STAFF')
      ? targetUserId
      : req.user?.userId;

  const loan = await checkoutService(userId!, bookCopyId, dueDays);
  res.status(201).json(loan);
}

export async function checkin(req: Request, res: Response) {
  const { loanId } = req.body;

  if (!loanId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: loanId', {
      fieldErrors: { loanId: 'Required' },
    });
  }

  const loan = await checkinService(loanId);
  res.json(loan);
}

export async function getLoans(req: Request, res: Response) {
  const { userId, status, page = 1, limit = 20 } = req.query;

  const loans = await fetchLoans({
    userId: typeof userId === 'string' ? userId : undefined,
    status: typeof status === 'string' ? (status as 'active' | 'returned' | 'overdue') : undefined,
    page: Number(page),
    limit: Number(limit),
  });

  res.json(loans);
}

export async function getCopyLocation(req: Request, res: Response) {
  const location = await getBookCopyLocation(req.params.copyId);
  res.json(location);
}

export async function shelveCopy(req: Request, res: Response) {
  const { shelfId } = req.body;
  if (!shelfId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: shelfId', {
      fieldErrors: { shelfId: 'Required' },
    });
  }

  const result = await shelveBookCopy(req.params.copyId, shelfId, req.user!.userId);
  res.json(result);
}

export async function getCopyHistory(req: Request, res: Response) {
  const { page = 1, limit = 20 } = req.query;
  const history = await getBookCopyHistory(req.params.copyId, Number(page), Number(limit));
  res.json(history);
}
