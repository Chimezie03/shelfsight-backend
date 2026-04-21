import type { Request, Response } from 'express';
import { fetchTransactions } from '../services/transactions.service';
import type { TransactionType } from '@prisma/client';

const VALID_TYPES = new Set(['CHECKOUT', 'CHECKIN', 'RENEWAL', 'FINE_PAID', 'FINE_WAIVED']);

export async function getTransactions(req: Request, res: Response) {
  const { type, search, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const MAX_LIMIT = 100;
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 20), MAX_LIMIT);

  const parsedType =
    typeof type === 'string' && VALID_TYPES.has(type) ? (type as TransactionType) : undefined;

  const result = await fetchTransactions({
    type: parsedType,
    search: typeof search === 'string' ? search : undefined,
    dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
    dateTo: typeof dateTo === 'string' ? dateTo : undefined,
    page: parsedPage,
    limit: parsedLimit,
  });

  res.json(result);
}
