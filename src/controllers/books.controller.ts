import type { Request, Response } from 'express';
import {
  fetchBooks,
  fetchBookById,
  createBookService,
  updateBookService,
  deleteBookService,
} from '../services/books.service';

export async function getBooks(req: Request, res: Response) {
  const { title, author, isbn, genre, page = 1, limit = 20 } = req.query;
  const books = await fetchBooks({
    title: typeof title === 'string' ? title : undefined,
    author: typeof author === 'string' ? author : undefined,
    isbn: typeof isbn === 'string' ? isbn : undefined,
    genre: typeof genre === 'string' ? genre : undefined,
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
