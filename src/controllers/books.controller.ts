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

import ExcelJS from 'exceljs';

export async function createBook(req: Request, res: Response) {
  const book = await createBookService(req.body);
  res.status(201).json(book);
}

import { AppError } from '../lib/errors';

export async function bulkUploadFile(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');
  }

  const workbook = new ExcelJS.Workbook();
  // exceljs types lag behind Node.js Buffer generics; cast is safe at runtime
  await workbook.xlsx.load(req.file.buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Spreadsheet has no sheets');
  }

  // Extract header row then map each data row to an object
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(String(cell.value ?? ''));
  });

  const rawItems: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return; // skip header
    const obj: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colIndex) => {
      obj[headers[colIndex - 1]] = cell.value;
    });
    rawItems.push(obj);
  });

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
