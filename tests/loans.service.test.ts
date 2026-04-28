import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loanMock } = vi.hoisted(() => ({
  loanMock: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  default: { loan: loanMock },
  forOrg: () => ({ loan: loanMock }),
}));

import { fetchLoans } from '../src/services/loans.service';

const ORG_ID = 'org-1';

describe('loans.service fetchLoans', () => {
  beforeEach(() => {
    loanMock.count.mockReset();
    loanMock.findMany.mockReset();
  });

  it('builds search filters for title, author, and isbn with active status', async () => {
    loanMock.count.mockResolvedValue(1);
    loanMock.findMany.mockResolvedValue([] as any);

    await fetchLoans(ORG_ID, {
      userId: 'user-1',
      status: 'active',
      search: '  dune  ',
      page: 2,
      limit: 5,
    });

    expect(loanMock.count).toHaveBeenCalledWith({
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

    loanMock.count.mockResolvedValue(1);
    loanMock.findMany.mockResolvedValue([
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

    const result = await fetchLoans(ORG_ID, { search: '9780441172719' });
    const loan = result.data[0];

    expect(loan.book.isbn).toBe('9780441172719');
    expect(loan.bookCopy.book.isbn).toBe('9780441172719');
    expect(loan.checkoutDate).toEqual(checkedOutAt);
    expect(loan.member.name).toBe('Paul Atreides');
  });
});
