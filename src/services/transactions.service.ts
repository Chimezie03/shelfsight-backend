import prisma from '../lib/prisma';
import type { TransactionType } from '@prisma/client';

interface FetchTransactionsParams {
  type?: TransactionType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

function mapTransactionResponse(tx: any) {
  return {
    id: tx.id,
    type: tx.type,
    loanId: tx.loanId,
    bookTitle: tx.bookTitle,
    memberName: tx.memberName,
    memberNumber: tx.memberNumber,
    timestamp: tx.createdAt.toISOString(),
    processedBy: tx.processedBy,
    details: tx.details,
  };
}

export async function fetchTransactions(params: FetchTransactionsParams) {
  const { type, search, dateFrom, dateTo, page = 1, limit = 20 } = params;
  const whereAnd: any[] = [];

  if (type) {
    whereAnd.push({ type });
  }

  if (search?.trim()) {
    const q = search.trim();
    whereAnd.push({
      OR: [
        { bookTitle: { contains: q, mode: 'insensitive' } },
        { memberName: { contains: q, mode: 'insensitive' } },
        { memberNumber: { contains: q, mode: 'insensitive' } },
        { details: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  if (dateFrom) {
    whereAnd.push({ createdAt: { gte: new Date(dateFrom) } });
  }

  if (dateTo) {
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    whereAnd.push({ createdAt: { lt: end } });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  const total = await prisma.transactionLog.count({ where });
  const transactions = await prisma.transactionLog.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return {
    data: transactions.map(mapTransactionResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createTransaction(data: {
  type: TransactionType;
  loanId?: string;
  bookTitle: string;
  memberName: string;
  memberNumber: string;
  processedBy: string;
  details: string;
}) {
  return prisma.transactionLog.create({ data });
}
