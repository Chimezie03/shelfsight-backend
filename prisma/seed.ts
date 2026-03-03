import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  // Hash a default password for seed users
  const defaultPassword = await bcrypt.hash('password123', 12);

  // Seed sample users
  await prisma.user.createMany({
    data: [
      { email: 'admin@shelfsight.com', passwordHash: defaultPassword, name: 'Admin User', role: 'ADMIN' },
      { email: 'staff@shelfsight.com', passwordHash: defaultPassword, name: 'Staff User', role: 'STAFF' },
      { email: 'patron@shelfsight.com', passwordHash: defaultPassword, name: 'Patron User', role: 'PATRON' }
    ]
  });

  // Seed sample books
  const books = await prisma.book.createMany({
    data: [
      { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', genre: 'Fiction', deweyDecimal: '813.52' },
      { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', genre: 'Science', deweyDecimal: '523.1' },
      { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780060935467', genre: 'Fiction', deweyDecimal: '813.54' }
    ]
  });

  // Seed sample shelf sections
  const shelf = await prisma.shelfSection.create({
    data: { label: 'Fiction A', mapX: 1, mapY: 1, width: 5, height: 2, floor: 1 }
  });

  // Seed book copies
  const bookRecords = await prisma.book.findMany();
  for (const book of bookRecords) {
    await prisma.bookCopy.createMany({
      data: [
        { bookId: book.id, barcode: `${book.isbn}-A`, status: 'AVAILABLE', shelfId: shelf.id },
        { bookId: book.id, barcode: `${book.isbn}-B`, status: 'CHECKED_OUT', shelfId: shelf.id }
      ]
    });
  }
}

main()
  .then(() => {
    console.log('Seed data inserted');
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
