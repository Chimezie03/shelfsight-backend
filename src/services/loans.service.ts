import prisma from '../lib/prisma';

const DEFAULT_LOAN_DAYS = 14;
const FINE_PER_DAY = 0.25;

interface FetchLoansParams {
  userId?: string;
  status?: 'active' | 'returned' | 'overdue';
  page?: number;
  limit?: number;
}

export async function checkoutService(userId: string, bookCopyId: string, dueDays?: number) {
  const copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { code: 'NOT_FOUND' });
  if (copy.status !== 'AVAILABLE') {
    throw Object.assign(new Error('Book copy is not available for checkout'), { code: 'UNAVAILABLE' });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (dueDays ?? DEFAULT_LOAN_DAYS));

  const [loan] = await prisma.$transaction([
    prisma.loan.create({
      data: { userId, bookCopyId, dueDate },
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookCopy: { include: { book: { select: { id: true, title: true, author: true } } } },
      },
    }),
    prisma.bookCopy.update({
      where: { id: bookCopyId },
      data: { status: 'CHECKED_OUT', shelfId: null },
    }),
    prisma.bookCopyEvent.create({
      data: { bookCopyId, type: 'CHECKED_OUT', userId },
    }),
  ]);

  return loan;
}

export async function checkinService(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw Object.assign(new Error('Loan not found'), { code: 'NOT_FOUND' });
  if (loan.returnedAt) throw Object.assign(new Error('Loan already returned'), { code: 'ALREADY_RETURNED' });

  const now = new Date();
  let fineAmount = 0;
  if (now > loan.dueDate) {
    const overdueDays = Math.ceil((now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    fineAmount = parseFloat((overdueDays * FINE_PER_DAY).toFixed(2));
  }

  const [updated] = await prisma.$transaction([
    prisma.loan.update({
      where: { id: loanId },
      data: { returnedAt: now, fineAmount },
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookCopy: { include: { book: { select: { id: true, title: true, author: true } } } },
      },
    }),
    prisma.bookCopy.update({
      where: { id: loan.bookCopyId },
      data: { status: 'AVAILABLE' },
    }),
    prisma.bookCopyEvent.create({
      data: { bookCopyId: loan.bookCopyId, type: 'RETURNED', userId: loan.userId, loanId },
    }),
  ]);

  return updated;
}

export async function getBookCopyLocation(bookCopyId: string) {
  const copy = await prisma.bookCopy.findUnique({
    where: { id: bookCopyId },
    include: {
      book: { select: { id: true, title: true, author: true } },
      shelf: true,
      loans: {
        where: { returnedAt: null },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
    },
  });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { code: 'NOT_FOUND' });

  return {
    id: copy.id,
    barcode: copy.barcode,
    status: copy.status,
    book: copy.book,
    shelf: copy.shelf,
    activeLoan: copy.loans[0] ?? null,
  };
}

export async function shelveBookCopy(bookCopyId: string, shelfId: string, userId: string) {
  const copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { code: 'NOT_FOUND' });
  if (copy.status === 'CHECKED_OUT') {
    throw Object.assign(new Error('Cannot shelve a checked-out copy'), { code: 'UNAVAILABLE' });
  }

  const shelf = await prisma.shelfSection.findUnique({ where: { id: shelfId } });
  if (!shelf) throw Object.assign(new Error('Shelf section not found'), { code: 'NOT_FOUND' });

  const eventType = copy.shelfId ? 'MOVED' : 'SHELVED';

  const [updated] = await prisma.$transaction([
    prisma.bookCopy.update({
      where: { id: bookCopyId },
      data: { shelfId, status: 'AVAILABLE' },
      include: {
        book: { select: { id: true, title: true, author: true } },
        shelf: true,
      },
    }),
    prisma.bookCopyEvent.create({
      data: { bookCopyId, type: eventType, shelfId, userId },
    }),
  ]);

  return updated;
}

export async function getBookCopyHistory(bookCopyId: string, page = 1, limit = 20) {
  const copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { code: 'NOT_FOUND' });

  const total = await prisma.bookCopyEvent.count({ where: { bookCopyId } });
  const events = await prisma.bookCopyEvent.findMany({
    where: { bookCopyId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: events,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function fetchLoans(params: FetchLoansParams) {
  const { userId, status, page = 1, limit = 20 } = params;
  const where: any = {};

  if (userId) where.userId = userId;

  if (status === 'active') {
    where.returnedAt = null;
  } else if (status === 'returned') {
    where.returnedAt = { not: null };
  } else if (status === 'overdue') {
    where.returnedAt = null;
    where.dueDate = { lt: new Date() };
  }

  const total = await prisma.loan.count({ where });
  const loans = await prisma.loan.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { checkedOutAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      bookCopy: { include: { book: { select: { id: true, title: true, author: true } } } },
    },
  });

  return {
    data: loans.map((loan) => ({
      id: loan.id,
      user: loan.user,
      bookCopy: {
        id: loan.bookCopy.id,
        barcode: loan.bookCopy.barcode,
        book: loan.bookCopy.book,
      },
      checkedOutAt: loan.checkedOutAt,
      dueDate: loan.dueDate,
      returnedAt: loan.returnedAt,
      fineAmount: loan.fineAmount,
      isOverdue: !loan.returnedAt && loan.dueDate < new Date(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
