import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';
import { createTransaction } from './transactions.service';

const DEFAULT_LOAN_DAYS = 14;
const FINE_PER_DAY = 0.25;
const MAX_FINE_PER_ITEM = 25.0;

interface FetchLoansParams {
  userId?: string;
  status?: 'active' | 'returned' | 'overdue';
  search?: string;
  page?: number;
  limit?: number;
}

function mapLoanResponse(loan: any) {
  const mappedBook = {
    id: loan.bookCopy.book.id,
    title: loan.bookCopy.book.title,
    author: loan.bookCopy.book.author,
    isbn: loan.bookCopy.book.isbn,
  };

  return {
    id: loan.id,
    user: loan.user,
    member: loan.user,
    book: mappedBook,
    bookCopy: {
      id: loan.bookCopy.id,
      barcode: loan.bookCopy.barcode,
      book: mappedBook,
    },
    checkedOutAt: loan.checkedOutAt,
    checkoutDate: loan.checkedOutAt,
    dueDate: loan.dueDate,
    returnedAt: loan.returnedAt,
    returnDate: loan.returnedAt,
    fineAmount: loan.fineAmount,
    isOverdue: !loan.returnedAt && loan.dueDate < new Date(),
  };
}

export async function checkoutService(userId: string, bookCopyId: string, dueDays?: number) {
  const copy = await prisma.bookCopy.findUnique({ where: { id: bookCopyId } });
  if (!copy) throw new AppError(404, 'NOT_FOUND', 'Book copy not found');
  if (copy.status !== 'AVAILABLE') {
    throw new AppError(409, 'RESOURCE_UNAVAILABLE', 'Book copy is not available for checkout');
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (dueDays ?? DEFAULT_LOAN_DAYS));

  const [loan] = await prisma.$transaction([
    prisma.loan.create({
      data: { userId, bookCopyId, dueDate },
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookCopy: {
          include: {
            book: { select: { id: true, title: true, author: true, isbn: true } },
          },
        },
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

  await createTransaction({
    type: 'CHECKOUT',
    loanId: loan.id,
    bookTitle: loan.bookCopy.book.title,
    memberName: loan.user.name,
    memberNumber: loan.user.email,
    processedBy: 'Staff',
    details: `Checked out for ${dueDays ?? DEFAULT_LOAN_DAYS} days, due ${dueDate.toISOString().slice(0, 10)}`,
  });

  return mapLoanResponse(loan);
}

export async function checkinService(loanId: string) {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  if (loan.returnedAt) throw new AppError(409, 'ALREADY_RETURNED', 'Loan already returned');

  const now = new Date();
  let fineAmount = 0;
  if (now > loan.dueDate) {
    const overdueDays = Math.ceil((now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
    fineAmount = Math.min(
      parseFloat((overdueDays * FINE_PER_DAY).toFixed(2)),
      MAX_FINE_PER_ITEM,
    );
  }

  const txOps: any[] = [
    prisma.loan.update({
      where: { id: loanId },
      data: { returnedAt: now, fineAmount },
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookCopy: {
          include: {
            book: { select: { id: true, title: true, author: true, isbn: true } },
          },
        },
      },
    }),
    prisma.bookCopy.update({
      where: { id: loan.bookCopyId },
      data: { status: 'AVAILABLE' },
    }),
    prisma.bookCopyEvent.create({
      data: { bookCopyId: loan.bookCopyId, type: 'RETURNED', userId: loan.userId, loanId },
    }),
  ];

  // Create a Fine record if overdue
  if (fineAmount > 0) {
    txOps.push(
      prisma.fine.create({
        data: {
          loanId,
          userId: loan.userId,
          amount: fineAmount,
          reason: 'Overdue',
        },
      }),
    );
  }

  const results = await prisma.$transaction(txOps);
  const updated = results[0];

  // Create transaction log entry for check-in
  const overdueDays = fineAmount > 0
    ? Math.ceil((now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  await createTransaction({
    type: 'CHECKIN',
    loanId,
    bookTitle: updated.bookCopy.book.title,
    memberName: updated.user.name,
    memberNumber: updated.user.email,
    processedBy: 'Staff',
    details: fineAmount > 0
      ? `Returned ${overdueDays} days late, fine of $${fineAmount.toFixed(2)} applied`
      : 'Returned on time, no fines',
  });

  return mapLoanResponse(updated);
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
  if (!copy) throw new AppError(404, 'NOT_FOUND', 'Book copy not found');
  if (copy.status === 'CHECKED_OUT') {
    throw new AppError(409, 'RESOURCE_UNAVAILABLE', 'Cannot shelve a checked-out copy');
  }

  const shelf = await prisma.shelfSection.findUnique({ where: { id: shelfId } });
  if (!shelf) throw new AppError(404, 'NOT_FOUND', 'Shelf section not found');

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
  if (!copy) throw new AppError(404, 'NOT_FOUND', 'Book copy not found');

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
  const { userId, status, search, page = 1, limit = 20 } = params;
  const whereAnd: any[] = [];

  if (userId) {
    whereAnd.push({ userId });
  }

  if (status === 'active') {
    whereAnd.push({ returnedAt: null });
  } else if (status === 'returned') {
    whereAnd.push({ returnedAt: { not: null } });
  } else if (status === 'overdue') {
    whereAnd.push({ returnedAt: null });
    whereAnd.push({ dueDate: { lt: new Date() } });
  }

  const normalizedSearch = search?.trim();
  if (normalizedSearch) {
    whereAnd.push({
      OR: [
        { user: { name: { contains: normalizedSearch, mode: 'insensitive' } } },
        { user: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
        { bookCopy: { barcode: { contains: normalizedSearch, mode: 'insensitive' } } },
        { bookCopy: { book: { title: { contains: normalizedSearch, mode: 'insensitive' } } } },
        { bookCopy: { book: { author: { contains: normalizedSearch, mode: 'insensitive' } } } },
        { bookCopy: { book: { isbn: { contains: normalizedSearch, mode: 'insensitive' } } } },
      ],
    });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  const total = await prisma.loan.count({ where });
  const loans = await prisma.loan.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { checkedOutAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      bookCopy: {
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
        },
      },
    },
  });

  return {
    data: loans.map(mapLoanResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
