import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  default: {
    loan: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { fetchLoans } from '../src/services/loans.service';

describe('loans.service fetchLoans', () => {
  beforeEach(() => {
    vi.mocked(prisma.loan.count).mockReset();
    vi.mocked(prisma.loan.findMany).mockReset();
  });

  it('builds search filters for title, author, and isbn with active status', async () => {
    vi.mocked(prisma.loan.count).mockResolvedValue(1);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([] as any);

    await fetchLoans({
      userId: 'user-1',
      status: 'active',
      search: '  dune  ',
      page: 2,
      limit: 5,
    });

    expect(prisma.loan.count).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          { userId: 'user-1' },
          { returnedAt: null },
          {
            OR: expect.arrayContaining([
              {
                bookCopy: {
                  book: {
                    title: { contains: 'dune', mode: 'insensitive' },
                  },
                },
              },
              {
                bookCopy: {
                  book: {
                    author: { contains: 'dune', mode: 'insensitive' },
                  },
                },
              },
              {
                bookCopy: {
                  book: {
                    isbn: { contains: 'dune', mode: 'insensitive' },
                  },
                },
              },
            ]),
          },
        ]),
      },
    });
  });

  it('returns aligned loan payload with isbn and compatibility fields', async () => {
    const dueDate = new Date('2026-04-30T00:00:00.000Z');
    const checkedOutAt = new Date('2026-04-01T00:00:00.000Z');

    vi.mocked(prisma.loan.count).mockResolvedValue(1);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([
      {
        id: 'loan-1',
        user: { id: 'user-1', name: 'Paul Atreides', email: 'paul@example.com' },
        bookCopy: {
          id: 'copy-1',
          barcode: 'BC-001',
          book: {
            id: 'book-1',
            title: 'Dune',
            author: 'Frank Herbert',
            isbn: '9780441172719',
          },
        },
        checkedOutAt,
        dueDate,
        returnedAt: null,
        fineAmount: 0,
      },
    ] as any);

    const result = await fetchLoans({ search: '9780441172719' });
    const loan = result.data[0];

    expect(loan.book.isbn).toBe('9780441172719');
    expect(loan.bookCopy.book.isbn).toBe('9780441172719');
    expect(loan.checkoutDate).toEqual(checkedOutAt);
    expect(loan.member.name).toBe('Paul Atreides');
  });
});
