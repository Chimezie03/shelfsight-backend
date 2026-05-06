import { beforeEach, describe, expect, it, vi } from 'vitest';

const { txMock } = vi.hoisted(() => ({
  txMock: {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  default: { transactionLog: txMock },
  forOrg: () => ({ transactionLog: txMock }),
}));

import { fetchTransactions, createTransaction } from '../src/services/transactions.service';

const ORG_ID = 'org-1';

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
    txMock.count.mockReset();
    txMock.findMany.mockReset();
    txMock.create.mockReset();
  });

  describe('fetchTransactions', () => {
    it('returns paginated transactions with mapped response', async () => {
      txMock.count.mockResolvedValue(1);
      txMock.findMany.mockResolvedValue([makeTxRow()] as any);

      const result = await fetchTransactions(ORG_ID, { page: 1, limit: 10 });

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
      txMock.count.mockResolvedValue(0);
      txMock.findMany.mockResolvedValue([]);

      await fetchTransactions(ORG_ID, { type: 'CHECKIN' });

      expect(txMock.count).toHaveBeenCalledWith({
        where: { AND: [{ type: 'CHECKIN' }] },
      });
    });

    it('filters by search term', async () => {
      txMock.count.mockResolvedValue(0);
      txMock.findMany.mockResolvedValue([]);

      await fetchTransactions(ORG_ID, { search: 'dune' });

      const call = txMock.count.mock.calls[0][0] as any;
      const orFilters = call.where.AND[0].OR;
      expect(orFilters).toHaveLength(4);
      expect(orFilters[0]).toEqual({
        bookTitle: { contains: 'dune', mode: 'insensitive' },
      });
    });

    it('filters by date range', async () => {
      txMock.count.mockResolvedValue(0);
      txMock.findMany.mockResolvedValue([]);

      await fetchTransactions(ORG_ID, { dateFrom: '2026-04-01', dateTo: '2026-04-14' });

      const call = txMock.count.mock.calls[0][0] as any;
      const andFilters = call.where.AND;
      expect(andFilters).toHaveLength(2);
      expect(andFilters[0].createdAt.gte).toEqual(new Date('2026-04-01'));
    });

    it('paginates correctly', async () => {
      txMock.count.mockResolvedValue(50);
      txMock.findMany.mockResolvedValue([]);

      const result = await fetchTransactions(ORG_ID, { page: 3, limit: 10 });

      expect(txMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.pagination).toEqual({ page: 3, limit: 10, total: 50, totalPages: 5 });
    });
  });

  describe('createTransaction', () => {
    it('creates a transaction log record', async () => {
      txMock.create.mockResolvedValue(makeTxRow() as any);

      await createTransaction(ORG_ID, {
        type: 'CHECKOUT',
        loanId: 'loan-1',
        bookTitle: 'Dune',
        memberName: 'Emma Patron',
        memberNumber: 'patron1@shelfsight.com',
        processedBy: 'Maria Staff',
        details: 'Checked out for 14 days',
      });

      expect(txMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CHECKOUT',
          loanId: 'loan-1',
          bookTitle: 'Dune',
        }),
      });
    });
  });
});
