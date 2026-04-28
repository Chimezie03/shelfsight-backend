import { forOrg } from '../lib/prisma';
import { AppError } from '../lib/errors';

interface FetchFinesParams {
  userId?: string;
  status?: 'UNPAID' | 'PAID' | 'WAIVED';
  search?: string;
  page?: number;
  limit?: number;
}

function mapFineResponse(fine: any) {
  return {
    id: fine.id,
    loanId: fine.loanId,
    memberId: fine.loan.user.id,
    memberName: fine.loan.user.name,
    memberNumber: fine.loan.user.email,
    bookTitle: fine.loan.bookCopy.book.title,
    amount: fine.amount,
    status: fine.status,
    reason: fine.reason,
    createdDate: fine.createdAt.toISOString().slice(0, 10),
    paidDate: fine.paidAt ? fine.paidAt.toISOString().slice(0, 10) : null,
    waivedBy: fine.waivedBy,
  };
}

const fineInclude = {
  loan: {
    include: {
      user: { select: { id: true, name: true, email: true } },
      bookCopy: {
        include: {
          book: { select: { id: true, title: true, author: true, isbn: true } },
        },
      },
    },
  },
};

export async function fetchFines(organizationId: string, params: FetchFinesParams) {
  const { userId, status, search, page = 1, limit = 100 } = params;
  const db = forOrg(organizationId);
  const whereAnd: any[] = [];

  if (userId) whereAnd.push({ userId });
  if (status) whereAnd.push({ status });

  if (search?.trim()) {
    const q = search.trim();
    whereAnd.push({
      OR: [
        { loan: { user: { name: { contains: q, mode: 'insensitive' } } } },
        { loan: { user: { email: { contains: q, mode: 'insensitive' } } } },
        { loan: { bookCopy: { book: { title: { contains: q, mode: 'insensitive' } } } } },
      ],
    });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  const total = await db.fine.count({ where });
  const fines = await db.fine.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: fineInclude,
  });

  return {
    data: fines.map(mapFineResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function payFine(organizationId: string, fineId: string) {
  const db = forOrg(organizationId);
  const fine = await db.fine.findFirst({ where: { id: fineId } });
  if (!fine) throw new AppError(404, 'NOT_FOUND', 'Fine not found');
  if (fine.status !== 'UNPAID') {
    throw new AppError(409, 'RESOURCE_UNAVAILABLE', `Fine is already ${fine.status.toLowerCase()}`);
  }

  const updated = await db.fine.update({
    where: { id: fineId },
    data: { status: 'PAID', paidAt: new Date() },
    include: fineInclude,
  });

  return mapFineResponse(updated);
}

export async function waiveFine(organizationId: string, fineId: string, waivedByName: string) {
  const db = forOrg(organizationId);
  const fine = await db.fine.findFirst({ where: { id: fineId } });
  if (!fine) throw new AppError(404, 'NOT_FOUND', 'Fine not found');
  if (fine.status !== 'UNPAID') {
    throw new AppError(409, 'RESOURCE_UNAVAILABLE', `Fine is already ${fine.status.toLowerCase()}`);
  }

  const updated = await db.fine.update({
    where: { id: fineId },
    data: { status: 'WAIVED', waivedBy: waivedByName },
    include: fineInclude,
  });

  return mapFineResponse(updated);
}

export async function createFineForLoan(
  organizationId: string,
  loanId: string,
  userId: string,
  amount: number,
  reason = 'Overdue',
) {
  const db = forOrg(organizationId);
  return db.fine.create({
    data: { loanId, userId, amount, reason } as any,
    include: fineInclude,
  });
}
