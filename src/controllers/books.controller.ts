import { Request, Response } from 'express';
import { fetchBooks } from '../services/books.service';

export async function getBooks(req: Request, res: Response) {
  try {
    const { title, author, isbn, genre, page = 1, limit = 20 } = req.query;
    const books = await fetchBooks({
      title: typeof title === 'string' ? title : undefined,
      author: typeof author === 'string' ? author : undefined,
      isbn: typeof isbn === 'string' ? isbn : undefined,
      genre: typeof genre === 'string' ? genre : undefined,
      page: Number(page),
      limit: Number(limit)
    });
    res.json(books);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
