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

function requireOrg(req: Request): string {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user.organizationId;
}

export async function checkout(req: Request, res: Response) {
  const orgId = requireOrg(req);
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

  const loan = await checkoutService(orgId, userId!, bookCopyId, dueDays);
  res.status(201).json(loan);
}

export async function checkin(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { loanId } = req.body;

  if (!loanId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: loanId', {
      fieldErrors: { loanId: 'Required' },
    });
  }

  const loan = await checkinService(orgId, loanId);
  res.json(loan);
}

const VALID_LOAN_STATUSES = new Set(['active', 'returned', 'overdue']);

export async function getLoans(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { userId, status, search, page = 1, limit = 20 } = req.query;

  const MAX_LIMIT = 100;
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 20), MAX_LIMIT);

  const rawStatus = typeof status === 'string' ? status : undefined;
  const safeStatus =
    rawStatus && VALID_LOAN_STATUSES.has(rawStatus)
      ? (rawStatus as 'active' | 'returned' | 'overdue')
      : undefined;

  // PATRONs may only view their own loans — ignore any userId query param they supply.
  const isPrivileged = req.user?.role === 'ADMIN' || req.user?.role === 'STAFF';
  const effectiveUserId = isPrivileged
    ? (typeof userId === 'string' ? userId : undefined)
    : req.user!.userId;

  const loans = await fetchLoans(orgId, {
    userId: effectiveUserId,
    status: safeStatus,
    search: typeof search === 'string' ? search : undefined,
    page: parsedPage,
    limit: parsedLimit,
  });

  res.json(loans);
}

export async function getCopyLocation(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const location = await getBookCopyLocation(orgId, req.params.copyId);
  res.json(location);
}

export async function shelveCopy(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { shelfId } = req.body;
  if (!shelfId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required field: shelfId', {
      fieldErrors: { shelfId: 'Required' },
    });
  }

  const result = await shelveBookCopy(orgId, req.params.copyId, shelfId, req.user!.userId);
  res.json(result);
}

export async function getCopyHistory(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { page = 1, limit = 20 } = req.query;
  const history = await getBookCopyHistory(orgId, req.params.copyId, Number(page), Number(limit));
  res.json(history);
}
