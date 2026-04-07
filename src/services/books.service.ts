import type { Book, BookCopy, Prisma, ShelfSection } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';

type CopyWithShelf = BookCopy & { shelf: ShelfSection | null };

type CatalogStatus = 'available' | 'checked-out' | 'maintenance';
type CatalogSortField =
  | 'title'
  | 'author'
  | 'dewey'
  | 'publishYear'
  | 'dateAdded'
  | 'status';

type SortDirection = 'asc' | 'desc';

interface FetchBooksParams {
  search?: string;
  title?: string;
  author?: string;
  isbn?: string;
  genre?: string;
  category?: string;
  status?: string;
  language?: string;
  yearMin?: number;
  yearMax?: number;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

const CATEGORY_RANGES: Record<string, readonly [number, number]> = {
  'Computer Science, Information & General Works': [0, 99],
  'Philosophy & Psychology': [100, 199],
  Religion: [200, 299],
  'Social Sciences': [300, 399],
  Language: [400, 499],
  Science: [500, 599],
  Technology: [600, 699],
  'Arts & Recreation': [700, 799],
  Literature: [800, 899],
  'History & Geography': [900, 999],
};

const bookPayload = (data: any) => ({
  title: data.title,
  author: data.author,
  isbn: data.isbn,
  genre: data.genre,
  deweyDecimal: data.deweyDecimal,
  language: data.language ?? undefined,
  coverImageUrl: data.coverImageUrl,
  publishYear: data.publishYear ?? data.publishDate ?? undefined,
  pageCount: data.pageCount != null ? (parseInt(data.pageCount) || null) : undefined,
});

/** Matches list-item shape expected by frontend `BackendBook` / catalog transforms. */
export function mapBookWithCopies(book: Book & { copies: CopyWithShelf[] }) {
  // Find the first copy that has a shelf assigned to derive location
  const shelfCopy = book.copies.find((c) => c.shelf);
  const shelf = shelfCopy?.shelf ?? null;

  const availableCopies = book.copies.filter((c) => c.status === 'AVAILABLE').length;
  const processingCopies = book.copies.filter((c) => c.status === 'PROCESSING').length;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    genre: book.genre,
    deweyDecimal: book.deweyDecimal,
    language: book.language,
    coverImageUrl: book.coverImageUrl,
    publishYear: book.publishYear,
    availableCopies,
    processingCopies,
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

function parseDeweyBucket(deweyDecimal: string | null): number | null {
  if (!deweyDecimal) {
    return null;
  }
  const match = String(deweyDecimal).match(/\d{1,3}/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractPublishYear(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const match = String(value).match(/\d{4}/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toCatalogStatus(book: {
  availableCopies: number;
  processingCopies: number;
  totalCopies: number;
}): CatalogStatus {
  if (book.availableCopies > 0) {
    return 'available';
  }
  if (book.processingCopies > 0) {
    return 'maintenance';
  }
  if (book.totalCopies > 0) {
    return 'checked-out';
  }
  return 'available';
}

function normalizeStatus(status?: string): CatalogStatus | null {
  if (status === 'available' || status === 'checked-out' || status === 'maintenance') {
    return status;
  }
  return null;
}

function normalizeSortField(sortBy?: string): CatalogSortField | null {
  if (
    sortBy === 'title' ||
    sortBy === 'author' ||
    sortBy === 'dewey' ||
    sortBy === 'publishYear' ||
    sortBy === 'dateAdded' ||
    sortBy === 'status'
  ) {
    return sortBy;
  }
  return null;
}

function normalizeSortDirection(sortDir?: string): SortDirection {
  return sortDir === 'desc' ? 'desc' : 'asc';
}

function compareValues(a: number | string, b: number | string, direction: SortDirection): number {
  const factor = direction === 'desc' ? -1 : 1;

  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return 0;
    return a > b ? factor : -factor;
  }

  const result = String(a).localeCompare(String(b), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  return result * factor;
}

function matchesCategoryFilter(book: { deweyDecimal: string | null; genre: string | null }, category?: string): boolean {
  if (!category || category === 'all') {
    return true;
  }

  const deweyRange = CATEGORY_RANGES[category];
  if (deweyRange) {
    const deweyBucket = parseDeweyBucket(book.deweyDecimal);
    if (deweyBucket === null) {
      return false;
    }
    return deweyBucket >= deweyRange[0] && deweyBucket <= deweyRange[1];
  }

  // Fallback if category strings ever diverge from Dewey labels.
  return (book.genre ?? '').toLowerCase().includes(category.toLowerCase());
}

function matchesYearFilter(publishYear: string | null, yearMin?: number, yearMax?: number): boolean {
  const normalizedMin = Number.isFinite(yearMin) ? Number(yearMin) : null;
  const normalizedMax = Number.isFinite(yearMax) ? Number(yearMax) : null;

  if (normalizedMin === null && normalizedMax === null) {
    return true;
  }

  const year = extractPublishYear(publishYear);
  if (year === null) {
    return false;
  }

  if (normalizedMin !== null && year < normalizedMin) {
    return false;
  }
  if (normalizedMax !== null && year > normalizedMax) {
    return false;
  }
  return true;
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
      copies:
        copiesCount > 0
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

    // If a shelfId was provided, assign all AVAILABLE copies to that shelf
    if (data.shelfId) {
      await tx.bookCopy.updateMany({
        where: { bookId: id, status: 'AVAILABLE' },
        data: { shelfId: data.shelfId },
      });
    }

    return tx.book.findUniqueOrThrow({
      where: { id },
      include: { copies: { include: { shelf: true } } },
    });
  });

  return mapBookWithCopies(book);
}

export async function deleteBookService(id: string) {
  return await prisma.$transaction(async (tx) => {
    // Fetch all copy IDs for this book
    const copies = await tx.bookCopy.findMany({
      where: { bookId: id },
      select: { id: true },
    });
    const copyIds = copies.map((c) => c.id);

    // Delete dependents of each copy first
    if (copyIds.length > 0) {
      await tx.bookCopyEvent.deleteMany({ where: { bookCopyId: { in: copyIds } } });
      await tx.loan.deleteMany({ where: { bookCopyId: { in: copyIds } } });
      await tx.bookCopy.deleteMany({ where: { bookId: id } });
    }

    return tx.book.delete({ where: { id } });
  });
}

export async function fetchBooks(params: FetchBooksParams) {
  const {
    search,
    title,
    author,
    isbn,
    genre,
    category,
    status,
    language,
    yearMin,
    yearMax,
    sortBy,
    sortDir,
    page = 1,
    limit = 20,
  } = params;

  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;

  const whereClauses: Prisma.BookWhereInput[] = [];

  if (title) {
    whereClauses.push({ title: { contains: title, mode: 'insensitive' } });
  }
  if (author) {
    whereClauses.push({ author: { contains: author, mode: 'insensitive' } });
  }
  if (isbn) {
    whereClauses.push({ isbn: { contains: isbn, mode: 'insensitive' } });
  }
  if (genre) {
    whereClauses.push({ genre: { contains: genre, mode: 'insensitive' } });
  }
  if (language && language !== 'all') {
    whereClauses.push({ language: { equals: language, mode: 'insensitive' } });
  }

  const normalizedSearch = search?.trim();
  if (normalizedSearch) {
    whereClauses.push({
      OR: [
        { title: { contains: normalizedSearch, mode: 'insensitive' } },
        { author: { contains: normalizedSearch, mode: 'insensitive' } },
        { isbn: { contains: normalizedSearch, mode: 'insensitive' } },
        { deweyDecimal: { contains: normalizedSearch, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.BookWhereInput = whereClauses.length > 0 ? { AND: whereClauses } : {};

  const books = await prisma.book.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      copies: { include: { shelf: true } },
    },
  });

  let filtered = books.map(mapBookWithCopies);

  if (category && category !== 'all') {
    filtered = filtered.filter((book) => matchesCategoryFilter(book, category));
  }

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    filtered = filtered.filter((book) => toCatalogStatus(book) === normalizedStatus);
  }

  if (Number.isFinite(yearMin) || Number.isFinite(yearMax)) {
    filtered = filtered.filter((book) => matchesYearFilter(book.publishYear, yearMin, yearMax));
  }

  const normalizedSortField = normalizeSortField(sortBy);
  if (normalizedSortField) {
    const direction = normalizeSortDirection(sortDir);

    filtered = [...filtered].sort((a, b) => {
      if (normalizedSortField === 'title') {
        return compareValues(a.title, b.title, direction);
      }
      if (normalizedSortField === 'author') {
        return compareValues(a.author, b.author, direction);
      }
      if (normalizedSortField === 'dewey') {
        const aDewey = parseDeweyBucket(a.deweyDecimal) ?? Number.NEGATIVE_INFINITY;
        const bDewey = parseDeweyBucket(b.deweyDecimal) ?? Number.NEGATIVE_INFINITY;
        return compareValues(aDewey, bDewey, direction);
      }
      if (normalizedSortField === 'publishYear') {
        const aYear = extractPublishYear(a.publishYear) ?? Number.NEGATIVE_INFINITY;
        const bYear = extractPublishYear(b.publishYear) ?? Number.NEGATIVE_INFINITY;
        return compareValues(aYear, bYear, direction);
      }
      if (normalizedSortField === 'status') {
        const rank: Record<CatalogStatus, number> = {
          available: 0,
          'checked-out': 1,
          maintenance: 2,
        };
        return compareValues(rank[toCatalogStatus(a)], rank[toCatalogStatus(b)], direction);
      }

      // dateAdded maps to createdAt
      return compareValues(a.createdAt.getTime(), b.createdAt.getTime(), direction);
    });
  }

  const total = filtered.length;
  const start = (safePage - 1) * safeLimit;
  const paginated = filtered.slice(start, start + safeLimit);

  return {
    data: paginated,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
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
