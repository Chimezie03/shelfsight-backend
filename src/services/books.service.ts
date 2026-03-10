import prisma from '../lib/prisma';

interface FetchBooksParams {
  title?: string;
  author?: string;
  isbn?: string;
  genre?: string;
  page?: number;
  limit?: number;
}
export async function createBookService(data: any) {
  // Basic validation (expand as needed)
  if (!data.title || !data.author || !data.isbn) {
    throw new Error('Missing required fields: title, author, isbn');
  }
  return await prisma.book.create({
    data: {
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      genre: data.genre,
      deweyDecimal: data.deweyDecimal,
      coverImageUrl: data.coverImageUrl,
    }
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
    }
  });
}

export async function deleteBookService(id: string) {
  return await prisma.book.delete({
    where: { id }
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
      availableCopyIds: book.copies.filter(c => c.status === 'AVAILABLE').map(c => c.id),
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
