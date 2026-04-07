import type { Request, Response } from 'express';
import {
  fetchBooks,
  fetchBookById,
  createBookService,
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
    page: Number(page),
    limit: Number(limit),
  });
  res.json(books);
}

export async function getBook(req: Request, res: Response) {
  const book = await fetchBookById(req.params.id);
  res.json(book);
}

export async function createBook(req: Request, res: Response) {
  const book = await createBookService(req.body);
  res.status(201).json(book);
}

export async function updateBook(req: Request, res: Response) {
  const book = await updateBookService(req.params.id, req.body);
  res.json(book);
}

export async function deleteBook(req: Request, res: Response) {
  await deleteBookService(req.params.id);
  res.status(204).send();
}
