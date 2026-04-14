import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  default: {
    transactionLog: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { fetchTransactions, createTransaction } from '../src/services/transactions.service';

const makeTxRow = (overrides: Record<string, any> = {}) => ({
  id: 'tx-1',
  type: 'CHECKOUT',
  loanId: 'loan-1',
  bookTitle: 'Dune',
  memberName: 'Emma Patron',
  memberNumber: 'patron1@shelfsight.com',
  processedBy: 'Maria Staff',
  details: 'Checked out for 14 days, due 2026-04-28',
  createdAt: new Date('2026-04-14T10:00:00.000Z'),
  ...overrides,
});

describe('transactions.service', () => {
  beforeEach(() => {
    vi.mocked(prisma.transactionLog.count).mockReset();
    vi.mocked(prisma.transactionLog.findMany).mockReset();
    vi.mocked(prisma.transactionLog.create).mockReset();
  });

  describe('fetchTransactions', () => {
    it('returns paginated transactions with mapped response', async () => {
      vi.mocked(prisma.transactionLog.count).mockResolvedValue(1);
      vi.mocked(prisma.transactionLog.findMany).mockResolvedValue([makeTxRow()] as any);

      const result = await fetchTransactions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'tx-1',
        type: 'CHECKOUT',
        loanId: 'loan-1',
        bookTitle: 'Dune',
        memberName: 'Emma Patron',
        memberNumber: 'patron1@shelfsight.com',
        processedBy: 'Maria Staff',
        details: expect.stringContaining('Checked out'),
        timestamp: '2026-04-14T10:00:00.000Z',
      });
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('filters by type', async () => {
      vi.mocked(prisma.transactionLog.count).mockResolvedValue(0);
      vi.mocked(prisma.transactionLog.findMany).mockResolvedValue([]);

      await fetchTransactions({ type: 'CHECKIN' });

      expect(prisma.transactionLog.count).toHaveBeenCalledWith({
        where: { AND: [{ type: 'CHECKIN' }] },
      });
    });

    it('filters by search term', async () => {
      vi.mocked(prisma.transactionLog.count).mockResolvedValue(0);
      vi.mocked(prisma.transactionLog.findMany).mockResolvedValue([]);

      await fetchTransactions({ search: 'dune' });

      const call = vi.mocked(prisma.transactionLog.count).mock.calls[0][0] as any;
      const orFilters = call.where.AND[0].OR;
      expect(orFilters).toHaveLength(4);
      expect(orFilters[0]).toEqual({
        bookTitle: { contains: 'dune', mode: 'insensitive' },
      });
    });

    it('filters by date range', async () => {
      vi.mocked(prisma.transactionLog.count).mockResolvedValue(0);
      vi.mocked(prisma.transactionLog.findMany).mockResolvedValue([]);

      await fetchTransactions({ dateFrom: '2026-04-01', dateTo: '2026-04-14' });

      const call = vi.mocked(prisma.transactionLog.count).mock.calls[0][0] as any;
      const andFilters = call.where.AND;
      expect(andFilters).toHaveLength(2);
      expect(andFilters[0].createdAt.gte).toEqual(new Date('2026-04-01'));
    });

    it('paginates correctly', async () => {
      vi.mocked(prisma.transactionLog.count).mockResolvedValue(50);
      vi.mocked(prisma.transactionLog.findMany).mockResolvedValue([]);

      const result = await fetchTransactions({ page: 3, limit: 10 });

      expect(prisma.transactionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.pagination).toEqual({ page: 3, limit: 10, total: 50, totalPages: 5 });
    });
  });

  describe('createTransaction', () => {
    it('creates a transaction log record', async () => {
      vi.mocked(prisma.transactionLog.create).mockResolvedValue(makeTxRow() as any);

      await createTransaction({
        type: 'CHECKOUT',
        loanId: 'loan-1',
        bookTitle: 'Dune',
        memberName: 'Emma Patron',
        memberNumber: 'patron1@shelfsight.com',
        processedBy: 'Maria Staff',
        details: 'Checked out for 14 days',
      });

      expect(prisma.transactionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CHECKOUT',
          loanId: 'loan-1',
          bookTitle: 'Dune',
        }),
      });
    });
  });
});
