import { Request, Response } from 'express';
import { fetchBooks, createBookService, updateBookService, deleteBookService } from '../services/books.service';

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


export async function createBook(req: Request, res: Response) {
  try {
    const book = await createBookService(req.body);
    res.status(201).json(book);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create book', message: err.message });
  }
}

export async function updateBook(req: Request, res: Response) {
  try {
    const book = await updateBookService(req.params.id, req.body);
    res.json(book);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Book not found', message: err.message });
    } else {
      res.status(400).json({ error: 'Failed to update book', message: err.message });
    }
  }
}

export async function deleteBook(req: Request, res: Response) {
  try {
    await deleteBookService(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Book not found', message: err.message });
    } else {
      res.status(400).json({ error: 'Failed to delete book', message: err.message });
    }
  }
}
