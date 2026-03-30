import type { Book, BookCopy } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';

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
});

/** Matches list-item shape expected by frontend `BackendBook` / catalog transforms. */
export function mapBookWithCopies(book: Book & { copies: BookCopy[] }) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    deweyDecimal: book.deweyDecimal,
    coverImageUrl: book.coverImageUrl,
    publishYear: book.publishYear,
    availableCopies: book.copies.filter((c) => c.status === 'AVAILABLE').length,
    totalCopies: book.copies.length,
    availableCopyIds: book.copies.filter((c) => c.status === 'AVAILABLE').map((c) => c.id),
    createdAt: book.createdAt,
  };
}

export async function createBookService(data: any) {
  if (!data.title || !data.author || !data.isbn) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields: title, author, isbn', {
      fieldErrors: {
        ...(data.title ? {} : { title: 'Required' }),
        ...(data.author ? {} : { author: 'Required' }),
        ...(data.isbn ? {} : { isbn: 'Required' }),
      },
    });
  }
  const existing = await prisma.book.findUnique({ where: { isbn: data.isbn } });
  if (existing) {
    return await prisma.book.update({
      where: { id: existing.id },
      data: bookPayload(data),
    });
  }
  return await prisma.book.create({
    data: bookPayload(data),
  });
}

export async function updateBookService(id: string, data: any) {
  return await prisma.book.update({
    where: { id },
    data: {
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      genre: data.genre,
      deweyDecimal: data.deweyDecimal,
      coverImageUrl: data.coverImageUrl,
      publishYear: data.publishYear ?? data.publishDate ?? undefined,
    },
  });
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
      copies: true,
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
    include: { copies: true },
  });
  if (!book) {
    throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');
  }
  return mapBookWithCopies(book);
}
