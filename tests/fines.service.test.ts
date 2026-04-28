import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fineMock } = vi.hoisted(() => ({
  fineMock: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  default: { fine: fineMock },
  forOrg: () => ({ fine: fineMock }),
}));

import { fetchFines, payFine, waiveFine, createFineForLoan } from '../src/services/fines.service';

const ORG_ID = 'org-1';

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
    fineMock.count.mockReset();
    fineMock.findMany.mockReset();
    fineMock.findFirst.mockReset();
    fineMock.update.mockReset();
    fineMock.create.mockReset();
  });

  describe('fetchFines', () => {
    it('returns paginated fines with mapped response', async () => {
      fineMock.count.mockResolvedValue(1);
      fineMock.findMany.mockResolvedValue([makeFineRow()] as any);

      const result = await fetchFines(ORG_ID, { page: 1, limit: 10 });

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
      fineMock.count.mockResolvedValue(0);
      fineMock.findMany.mockResolvedValue([]);

      await fetchFines(ORG_ID, { status: 'PAID' });

      expect(fineMock.count).toHaveBeenCalledWith({
        where: { AND: [{ status: 'PAID' }] },
      });
    });

    it('filters by search term across member name, email, and book title', async () => {
      fineMock.count.mockResolvedValue(0);
      fineMock.findMany.mockResolvedValue([]);

      await fetchFines(ORG_ID, { search: 'emma' });

      const call = fineMock.count.mock.calls[0][0] as any;
      const orFilters = call.where.AND[0].OR;
      expect(orFilters).toHaveLength(3);
      expect(orFilters[0]).toEqual({
        loan: { user: { name: { contains: 'emma', mode: 'insensitive' } } },
      });
    });
  });

  describe('payFine', () => {
    it('marks a fine as PAID with paidAt date', async () => {
      fineMock.findFirst.mockResolvedValue({ id: 'fine-1', status: 'UNPAID' } as any);
      fineMock.update.mockResolvedValue(
        makeFineRow({ status: 'PAID', paidAt: new Date('2026-04-14') }) as any,
      );

      const result = await payFine(ORG_ID, 'fine-1');

      expect(result.status).toBe('PAID');
      expect(result.paidDate).toBe('2026-04-14');
      expect(fineMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fine-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('throws 404 if fine not found', async () => {
      fineMock.findFirst.mockResolvedValue(null);

      await expect(payFine(ORG_ID, 'nonexistent')).rejects.toThrow('Fine not found');
    });

    it('throws 409 if fine already paid', async () => {
      fineMock.findFirst.mockResolvedValue({ id: 'fine-1', status: 'PAID' } as any);

      await expect(payFine(ORG_ID, 'fine-1')).rejects.toThrow('already paid');
    });
  });

  describe('waiveFine', () => {
    it('marks a fine as WAIVED with staff name', async () => {
      fineMock.findFirst.mockResolvedValue({ id: 'fine-1', status: 'UNPAID' } as any);
      fineMock.update.mockResolvedValue(
        makeFineRow({ status: 'WAIVED', waivedBy: 'Alice Admin' }) as any,
      );

      const result = await waiveFine(ORG_ID, 'fine-1', 'Alice Admin');

      expect(result.status).toBe('WAIVED');
      expect(result.waivedBy).toBe('Alice Admin');
    });

    it('throws 409 if fine already waived', async () => {
      fineMock.findFirst.mockResolvedValue({ id: 'fine-1', status: 'WAIVED' } as any);

      await expect(waiveFine(ORG_ID, 'fine-1', 'Staff')).rejects.toThrow('already waived');
    });
  });

  describe('createFineForLoan', () => {
    it('creates a fine record', async () => {
      fineMock.create.mockResolvedValue(makeFineRow() as any);

      await createFineForLoan(ORG_ID, 'loan-1', 'user-1', 1.5, 'Overdue');

      expect(fineMock.create).toHaveBeenCalledWith({
        data: { loanId: 'loan-1', userId: 'user-1', amount: 1.5, reason: 'Overdue' },
        include: expect.any(Object),
      });
    });
  });
});
