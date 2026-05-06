import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { fetchFines, payFine, waiveFine } from '../services/fines.service';
import { createTransaction } from '../services/transactions.service';
import { AppError } from '../lib/errors';

const VALID_FINE_STATUSES = new Set(['UNPAID', 'PAID', 'WAIVED']);

function requireOrg(req: Request): string {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user.organizationId;
}

export async function getFines(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { userId, status, search, page = 1, limit = 50 } = req.query;

  const MAX_LIMIT = 100;
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 50), MAX_LIMIT);

  const rawStatus = typeof status === 'string' ? status : undefined;
  const safeStatus =
    rawStatus && VALID_FINE_STATUSES.has(rawStatus)
      ? (rawStatus as 'UNPAID' | 'PAID' | 'WAIVED')
      : undefined;

  // PATRONs may only view their own fines — ignore any userId query param they supply.
  const isPrivileged = req.user?.role === 'ADMIN' || req.user?.role === 'STAFF';
  const effectiveUserId = isPrivileged
    ? (typeof userId === 'string' ? userId : undefined)
    : req.user!.userId;

  const result = await fetchFines(orgId, {
    userId: effectiveUserId,
    status: safeStatus,
    search: typeof search === 'string' ? search : undefined,
    page: parsedPage,
    limit: parsedLimit,
  });

  res.json(result);
}

export async function markFinePaid(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { fineId } = req.params;
  if (!fineId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required param: fineId', {
      fieldErrors: { fineId: 'Required' },
    });
  }

  // PATRONs may only pay their own fines
  const isPrivileged = req.user?.role === 'ADMIN' || req.user?.role === 'STAFF';
  if (!isPrivileged) {
    const existing = await prisma.fine.findFirst({
      where: { id: fineId, organizationId: orgId },
      select: { userId: true },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Fine not found');
    if (existing.userId !== req.user!.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
  }

  const fine = await payFine(orgId, fineId);

  await createTransaction(orgId, {
    type: 'FINE_PAID',
    loanId: fine.loanId,
    bookTitle: fine.bookTitle,
    memberName: fine.memberName,
    memberNumber: fine.memberNumber,
    processedBy: req.user?.name ?? 'Staff',
    details: `Fine of $${fine.amount.toFixed(2)} paid`,
  });

  res.json(fine);
}

export async function markFineWaived(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { fineId } = req.params;
  if (!fineId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required param: fineId', {
      fieldErrors: { fineId: 'Required' },
    });
  }

  const staffName = req.user?.name ?? 'Staff';
  const fine = await waiveFine(orgId, fineId, staffName);

  await createTransaction(orgId, {
    type: 'FINE_WAIVED',
    loanId: fine.loanId,
    bookTitle: fine.bookTitle,
    memberName: fine.memberName,
    memberNumber: fine.memberNumber,
    processedBy: staffName,
    details: `Fine of $${fine.amount.toFixed(2)} waived`,
  });

  res.json(fine);
}
