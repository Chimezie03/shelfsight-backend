import type { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import {
  fetchBooks,
  fetchBookById,
  createBookService,
  bulkCreateBooksService,
  updateBookService,
  deleteBookService,
  deleteAllBooksService,
} from '../services/books.service';
import { AppError } from '../lib/errors';

function requireOrg(req: Request): string {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user.organizationId;
}

export async function getBooks(req: Request, res: Response) {
  const orgId = requireOrg(req);
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
  } = req.query;

  const MAX_LIMIT = 100;
  const parsedPage = Math.max(1, Number(page) || 1);
  const parsedLimit = Math.min(Math.max(1, Number(limit) || 20), MAX_LIMIT);

  const parsedYearMin =
    typeof yearMin === 'string' && yearMin.trim() !== '' ? Number(yearMin) : undefined;
  const parsedYearMax =
    typeof yearMax === 'string' && yearMax.trim() !== '' ? Number(yearMax) : undefined;

  const books = await fetchBooks(orgId, {
    search: typeof search === 'string' ? search : undefined,
    title: typeof title === 'string' ? title : undefined,
    author: typeof author === 'string' ? author : undefined,
    isbn: typeof isbn === 'string' ? isbn : undefined,
    genre: typeof genre === 'string' ? genre : undefined,
    category: typeof category === 'string' ? category : undefined,
    status: typeof status === 'string' ? status : undefined,
    language: typeof language === 'string' ? language : undefined,
    yearMin: Number.isFinite(parsedYearMin) ? parsedYearMin : undefined,
    yearMax: Number.isFinite(parsedYearMax) ? parsedYearMax : undefined,
    sortBy: typeof sortBy === 'string' ? sortBy : undefined,
    sortDir: typeof sortDir === 'string' ? sortDir : undefined,
    page: parsedPage,
    limit: parsedLimit,
  });
  res.json(books);
}

export async function getBook(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const book = await fetchBookById(orgId, req.params.id);
  res.json(book);
}

export async function createBook(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const book = await createBookService(orgId, req.body);
  res.status(201).json(book);
}

export async function bulkUploadFile(req: Request, res: Response) {
  const orgId = requireOrg(req);
  if (!req.file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');
  }

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rawItems = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const items = rawItems.map((row: any) => ({
    ...row,
    title: row.title || row.Title,
    author: row.author || row.Author,
    isbn: row.isbn || row.ISBN || row['ISBN-13'],
    genre: row.genre || row.Genre || row.Category || row.category,
    deweyDecimal: row.deweyDecimal || row.DeweyDecimal || row['Dewey Decimal'],
    language: row.language || row.Language,
    publishYear: row.publishYear || row.PublishYear || row.PublicationYear || row['Publication Year'] || row.publishDate || row.PublishDate || row['Publication Date'],
    pageCount: row.pageCount || row.PageCount || row['Page Count'],
    copies: row.copies || row.Copies || row['Total Copies'] || row['Available Copies'] || 1,
    status: row.status || row.Status,
  }));

  const result = await bulkCreateBooksService(orgId, items);
  res.status(200).json(result);
}

export async function bulkCreateBooks(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const result = await bulkCreateBooksService(orgId, req.body);
  res.status(201).json(result);
}

export async function updateBook(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const book = await updateBookService(orgId, req.params.id, req.body);
  res.json(book);
}

export async function deleteBook(req: Request, res: Response) {
  const orgId = requireOrg(req);
  await deleteBookService(orgId, req.params.id);
  res.status(204).send();
}

export async function deleteAllBooks(req: Request, res: Response) {
  const orgId = requireOrg(req);
  if (req.body?.confirm !== 'DELETE ALL BOOKS') {
    throw new AppError(
      400,
      'CONFIRMATION_REQUIRED',
      'Type "DELETE ALL BOOKS" in the confirm field to proceed',
    );
  }
  const result = await deleteAllBooksService(orgId);
  res.status(200).json(result);
}
