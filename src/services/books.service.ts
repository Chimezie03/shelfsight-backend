import type { Book, BookCopy, ShelfSection } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';

type CopyWithShelf = BookCopy & { shelf: ShelfSection | null };

interface FetchBooksParams {
  title?: string;
  author?: string;
  isbn?: string;
  genre?: string;
  page?: number;
  limit?: number;
}
const bookPayload = (data: any) => ({
  title: data.title,
  author: data.author,
  isbn: data.isbn,
  genre: data.genre,
  deweyDecimal: data.deweyDecimal,
  coverImageUrl: data.coverImageUrl,
  publishYear: data.publishYear ?? data.publishDate ?? undefined,
  pageCount: data.pageCount != null ? (parseInt(data.pageCount) || null) : undefined,
});

/** Matches list-item shape expected by frontend `BackendBook` / catalog transforms. */
export function mapBookWithCopies(book: Book & { copies: CopyWithShelf[] }) {
  // Find the first copy that has a shelf assigned to derive location
  const shelfCopy = book.copies.find((c) => c.shelf);
  const shelf = shelfCopy?.shelf ?? null;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    deweyDecimal: book.deweyDecimal,
    coverImageUrl: book.coverImageUrl,
    publishYear: book.publishYear,
    pageCount: book.pageCount ?? null,
    availableCopies: book.copies.filter((c) => c.status === 'AVAILABLE').length,
    totalCopies: book.copies.length,
    availableCopyIds: book.copies.filter((c) => c.status === 'AVAILABLE').map((c) => c.id),
    createdAt: book.createdAt,
    shelfId: shelf?.id ?? null,
    shelfLabel: shelf?.label ?? null,
  };
}

/** Map frontend copy status strings to DB CopyStatus enum values. */
function mapCopyStatus(status: string | undefined): 'AVAILABLE' | 'PROCESSING' {
  if (status === 'maintenance') return 'PROCESSING';
  return 'AVAILABLE';
}

/** Validate a raw ISBN string (10 or 13 digits, hyphens stripped). */
function validateIsbn(isbn: string): string | null {
  const clean = String(isbn).replace(/-/g, '');
  if (!/^\d{10}$/.test(clean) && !/^\d{13}$/.test(clean)) {
    return 'Must be 10 or 13 numeric digits (hyphens allowed)';
  }
  return null;
}

export async function createBookService(data: any) {
  const fieldErrors: Record<string, string> = {};
  if (!data.title) fieldErrors.title = 'Required';
  if (!data.author) fieldErrors.author = 'Required';
  if (!data.isbn) {
    fieldErrors.isbn = 'Required';
  } else {
    const isbnErr = validateIsbn(data.isbn);
    if (isbnErr) fieldErrors.isbn = isbnErr;
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  const existing = await prisma.book.findUnique({ where: { isbn: data.isbn } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_ENTRY', 'A book with this ISBN already exists in the catalog', {
      fieldErrors: { isbn: 'This ISBN is already in the catalog' },
    });
  }

  const copiesCount = Math.max(0, parseInt(data.copies) || 0);
  const copyStatus = mapCopyStatus(data.status);
  const cleanIsbn = String(data.isbn).replace(/-/g, '');

  const book = await prisma.book.create({
    data: {
      ...bookPayload(data),
      copies: copiesCount > 0
        ? {
            create: Array.from({ length: copiesCount }, (_, i) => ({
              barcode: `${cleanIsbn}-${i + 1}`,
              status: copyStatus,
            })),
          }
        : undefined,
    },
    include: { copies: { include: { shelf: true } } },
  });

  return mapBookWithCopies(book);
}

export async function updateBookService(id: string, data: any) {
  if (data.isbn) {
    const isbnErr = validateIsbn(data.isbn);
    if (isbnErr) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { isbn: isbnErr },
      });
    }
  }

  const book = await prisma.$transaction(async (tx) => {
    const updated = await tx.book.update({
      where: { id },
      data: bookPayload(data),
      include: { copies: { include: { shelf: true } } },
    });

    // Handle copies count change if provided
    if (data.copies != null) {
      const desiredCount = Math.max(0, parseInt(data.copies) || 0);
      const currentCopies = updated.copies;
      const currentCount = currentCopies.length;

      if (desiredCount > currentCount) {
        // Add new copies
        const toAdd = desiredCount - currentCount;
        const cleanIsbn = String(updated.isbn).replace(/-/g, '');
        const ts = Date.now();
        await tx.bookCopy.createMany({
          data: Array.from({ length: toAdd }, (_, i) => ({
            bookId: id,
            barcode: `${cleanIsbn}-${ts}-${i + 1}`,
            status: 'AVAILABLE' as const,
          })),
        });
      } else if (desiredCount < currentCount) {
        // Remove excess copies — prefer AVAILABLE ones, never remove CHECKED_OUT
        const available = currentCopies.filter((c) => c.status === 'AVAILABLE');
        const toRemove = currentCount - desiredCount;
        const removable = available.slice(0, toRemove);
        if (removable.length > 0) {
          await tx.bookCopy.deleteMany({
            where: { id: { in: removable.map((c) => c.id) } },
          });
        }
      }
    }

    return tx.book.findUniqueOrThrow({
      where: { id },
      include: { copies: { include: { shelf: true } } },
    });
  });

  return mapBookWithCopies(book);
}

export async function deleteBookService(id: string) {
  return await prisma.book.delete({
    where: { id },
  });
}

export async function fetchBooks(params: FetchBooksParams) {
  const { title, author, isbn, genre, page = 1, limit = 20 } = params;
  const where: any = {};
  if (title) where.title = { contains: title, mode: 'insensitive' };
  if (author) where.author = { contains: author, mode: 'insensitive' };
  if (isbn) where.isbn = { contains: isbn, mode: 'insensitive' };
  if (genre) where.genre = { contains: genre, mode: 'insensitive' };

  const total = await prisma.book.count({ where });
  const books = await prisma.book.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      copies: { include: { shelf: true } },
    },
  });

  return {
    data: books.map(mapBookWithCopies),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function fetchBookById(id: string) {
  const book = await prisma.book.findUnique({
    where: { id },
    include: { copies: { include: { shelf: true } } },
  });
  if (!book) {
    throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');
  }
  return mapBookWithCopies(book);
}
