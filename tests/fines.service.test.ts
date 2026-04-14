import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  default: {
    fine: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { fetchFines, payFine, waiveFine, createFineForLoan } from '../src/services/fines.service';

const makeFineRow = (overrides: Record<string, any> = {}) => ({
  id: 'fine-1',
  loanId: 'loan-1',
  userId: 'user-1',
  amount: 1.5,
  status: 'UNPAID',
  reason: 'Overdue',
  paidAt: null,
  waivedBy: null,
  createdAt: new Date('2026-04-10T00:00:00.000Z'),
  loan: {
    user: { id: 'user-1', name: 'Emma Patron', email: 'patron1@shelfsight.com' },
    bookCopy: {
      book: { id: 'book-1', title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719' },
    },
  },
  ...overrides,
});

describe('fines.service', () => {
  beforeEach(() => {
    vi.mocked(prisma.fine.count).mockReset();
    vi.mocked(prisma.fine.findMany).mockReset();
    vi.mocked(prisma.fine.findUnique).mockReset();
    vi.mocked(prisma.fine.update).mockReset();
    vi.mocked(prisma.fine.create).mockReset();
  });

  describe('fetchFines', () => {
    it('returns paginated fines with mapped response', async () => {
      vi.mocked(prisma.fine.count).mockResolvedValue(1);
      vi.mocked(prisma.fine.findMany).mockResolvedValue([makeFineRow()] as any);

      const result = await fetchFines({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'fine-1',
        loanId: 'loan-1',
        memberId: 'user-1',
        memberName: 'Emma Patron',
        memberNumber: 'patron1@shelfsight.com',
        bookTitle: 'Dune',
        amount: 1.5,
        status: 'UNPAID',
        reason: 'Overdue',
        createdDate: '2026-04-10',
        paidDate: null,
        waivedBy: null,
      });
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('filters by status', async () => {
      vi.mocked(prisma.fine.count).mockResolvedValue(0);
      vi.mocked(prisma.fine.findMany).mockResolvedValue([]);

      await fetchFines({ status: 'PAID' });

      expect(prisma.fine.count).toHaveBeenCalledWith({
        where: { AND: [{ status: 'PAID' }] },
      });
    });

    it('filters by search term across member name, email, and book title', async () => {
      vi.mocked(prisma.fine.count).mockResolvedValue(0);
      vi.mocked(prisma.fine.findMany).mockResolvedValue([]);

      await fetchFines({ search: 'emma' });

      const call = vi.mocked(prisma.fine.count).mock.calls[0][0] as any;
      const orFilters = call.where.AND[0].OR;
      expect(orFilters).toHaveLength(3);
      expect(orFilters[0]).toEqual({
        loan: { user: { name: { contains: 'emma', mode: 'insensitive' } } },
      });
    });
  });

  describe('payFine', () => {
    it('marks a fine as PAID with paidAt date', async () => {
      vi.mocked(prisma.fine.findUnique).mockResolvedValue({ id: 'fine-1', status: 'UNPAID' } as any);
      vi.mocked(prisma.fine.update).mockResolvedValue(
        makeFineRow({ status: 'PAID', paidAt: new Date('2026-04-14') }) as any,
      );

      const result = await payFine('fine-1');

      expect(result.status).toBe('PAID');
      expect(result.paidDate).toBe('2026-04-14');
      expect(prisma.fine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fine-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('throws 404 if fine not found', async () => {
      vi.mocked(prisma.fine.findUnique).mockResolvedValue(null);

      await expect(payFine('nonexistent')).rejects.toThrow('Fine not found');
    });

    it('throws 409 if fine already paid', async () => {
      vi.mocked(prisma.fine.findUnique).mockResolvedValue({ id: 'fine-1', status: 'PAID' } as any);

      await expect(payFine('fine-1')).rejects.toThrow('already paid');
    });
  });

  describe('waiveFine', () => {
    it('marks a fine as WAIVED with staff name', async () => {
      vi.mocked(prisma.fine.findUnique).mockResolvedValue({ id: 'fine-1', status: 'UNPAID' } as any);
      vi.mocked(prisma.fine.update).mockResolvedValue(
        makeFineRow({ status: 'WAIVED', waivedBy: 'Alice Admin' }) as any,
      );

      const result = await waiveFine('fine-1', 'Alice Admin');

      expect(result.status).toBe('WAIVED');
      expect(result.waivedBy).toBe('Alice Admin');
    });

    it('throws 409 if fine already waived', async () => {
      vi.mocked(prisma.fine.findUnique).mockResolvedValue({ id: 'fine-1', status: 'WAIVED' } as any);

      await expect(waiveFine('fine-1', 'Staff')).rejects.toThrow('already waived');
    });
  });

  describe('createFineForLoan', () => {
    it('creates a fine record', async () => {
      vi.mocked(prisma.fine.create).mockResolvedValue(makeFineRow() as any);

      const result = await createFineForLoan('loan-1', 'user-1', 1.5, 'Overdue');

      expect(prisma.fine.create).toHaveBeenCalledWith({
        data: { loanId: 'loan-1', userId: 'user-1', amount: 1.5, reason: 'Overdue' },
        include: expect.any(Object),
      });
    });
  });
});
