import { Request, Response } from 'express';
import {
  checkoutService,
  checkinService,
  fetchLoans,
  getBookCopyLocation,
  shelveBookCopy,
  getBookCopyHistory,
} from '../services/loans.service';

export async function checkout(req: Request, res: Response) {
  try {
    const { bookCopyId, dueDays, userId: targetUserId } = req.body;

    if (!bookCopyId) {
      return res.status(400).json({ error: 'Missing required field: bookCopyId' });
    }

    // Allow admin/staff to checkout on behalf of another user
    const userId = (targetUserId && (req.user?.role === 'ADMIN' || req.user?.role === 'STAFF'))
      ? targetUserId
      : req.user?.userId;

    const loan = await checkoutService(userId!, bookCopyId, dueDays);
    res.status(201).json(loan);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'UNAVAILABLE') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to checkout', message: err.message });
  }
}

export async function checkin(req: Request, res: Response) {
  try {
    const { loanId } = req.body;

    if (!loanId) {
      return res.status(400).json({ error: 'Missing required field: loanId' });
    }

    const loan = await checkinService(loanId);
    res.json(loan);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'ALREADY_RETURNED') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to checkin', message: err.message });
  }
}

export async function getLoans(req: Request, res: Response) {
  try {
    const { userId, status, page = 1, limit = 20 } = req.query;

    const loans = await fetchLoans({
      userId: typeof userId === 'string' ? userId : undefined,
      status: typeof status === 'string' ? (status as 'active' | 'returned' | 'overdue') : undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json(loans);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

export async function getCopyLocation(req: Request, res: Response) {
  try {
    const location = await getBookCopyLocation(req.params.copyId);
    res.json(location);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to get location', message: err.message });
  }
}

export async function shelveCopy(req: Request, res: Response) {
  try {
    const { shelfId } = req.body;
    if (!shelfId) {
      return res.status(400).json({ error: 'Missing required field: shelfId' });
    }

    const result = await shelveBookCopy(req.params.copyId, shelfId, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'UNAVAILABLE') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to shelve copy', message: err.message });
  }
}

export async function getCopyHistory(req: Request, res: Response) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const history = await getBookCopyHistory(req.params.copyId, Number(page), Number(limit));
    res.json(history);
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Failed to get history', message: err.message });
  }
}
