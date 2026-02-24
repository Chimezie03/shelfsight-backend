import prisma from '../lib/prisma';

interface FetchBooksParams {
  title?: string;
  author?: string;
  isbn?: string;
  genre?: string;
  page?: number;
  limit?: number;
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
      copies: true
    }
  });

  return {
    data: books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre,
      deweyDecimal: book.deweyDecimal,
      coverImageUrl: book.coverImageUrl,
      availableCopies: book.copies.filter(c => c.status === 'AVAILABLE').length,
      totalCopies: book.copies.length,
      createdAt: book.createdAt
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
