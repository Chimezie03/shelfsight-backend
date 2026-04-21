import type { Request, Response } from 'express';
import {
  fetchBooks,
  fetchBookById,
  createBookService,
  bulkCreateBooksService,
  updateBookService,
  deleteBookService,
} from '../services/books.service';

export async function getBooks(req: Request, res: Response) {
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

  const books = await fetchBooks({
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
  const book = await fetchBookById(req.params.id);
  res.json(book);
}

import * as xlsx from 'xlsx';

export async function createBook(req: Request, res: Response) {
  const book = await createBookService(req.body);
  res.status(201).json(book);
}

import { AppError } from '../lib/errors';

export async function bulkUploadFile(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');
  }
  
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const items = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  // Basic validation that it possesses keys that look like book
  const result = await bulkCreateBooksService(items);
  res.status(200).json(result);
}

export async function bulkCreateBooks(req: Request, res: Response) {
  const result = await bulkCreateBooksService(req.body);
  res.status(201).json(result);
}

export async function updateBook(req: Request, res: Response) {
  const book = await updateBookService(req.params.id, req.body);
  res.json(book);
}

export async function deleteBook(req: Request, res: Response) {
  await deleteBookService(req.params.id);
  res.status(204).send();
}
