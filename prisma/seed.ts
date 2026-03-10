import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  // Hash a default password for seed users
  const defaultPassword = await bcrypt.hash('password123', 12);

  // Seed sample users
  // Upsert users to avoid unique constraint errors
  const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
  await prisma.user.upsert({
    where: { email: 'admin@shelfsight.com' },
    update: {
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
    create: {
      email: 'admin@shelfsight.com',
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  const staffPasswordHash = await bcrypt.hash('staffpassword', 10);
  await prisma.user.upsert({
    where: { email: 'staff@shelfsight.com' },
    update: {
      passwordHash: staffPasswordHash,
      name: 'Staff User',
      role: 'STAFF',
    },
    create: {
      email: 'staff@shelfsight.com',
      passwordHash: staffPasswordHash,
      name: 'Staff User',
      role: 'STAFF',
    },
  });
  const patronPasswordHash = await bcrypt.hash('patronpassword', 10);
  await prisma.user.upsert({
    where: { email: 'patron@shelfsight.com' },
    update: {
      passwordHash: patronPasswordHash,
      name: 'Patron User',
      role: 'PATRON',
    },
    create: {
      email: 'patron@shelfsight.com',
      passwordHash: patronPasswordHash,
      name: 'Patron User',
      role: 'PATRON',
    },
  });
  console.log('Seeded users: admin@shelfsight.com / adminpassword, staff@shelfsight.com / staffpassword, patron@shelfsight.com / patronpassword');

  // Seed sample books
  // Upsert books to avoid unique constraint errors on ISBN
  await prisma.book.upsert({
    where: { isbn: '9780743273565' },
    update: {},
    create: {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '9780743273565',
      genre: 'Fiction',
      deweyDecimal: '813.52',
    },
  });
  await prisma.book.upsert({
    where: { isbn: '9780553380163' },
    update: {},
    create: {
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      isbn: '9780553380163',
      genre: 'Science',
      deweyDecimal: '523.1',
    },
  });
  await prisma.book.upsert({
    where: { isbn: '9780060935467' },
    update: {},
    create: {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isbn: '9780060935467',
      genre: 'Fiction',
      deweyDecimal: '813.54',
    },
  });

  // Create or find sample shelf section
  let shelf = await prisma.shelfSection.findFirst({ where: { label: 'Fiction A' } });
  if (!shelf) {
    shelf = await prisma.shelfSection.create({
      data: { label: 'Fiction A', mapX: 1, mapY: 1, width: 5, height: 2, floor: 1 }
    });
  }

  // Upsert book copies
  const bookRecords = await prisma.book.findMany();
  for (const book of bookRecords) {
    await prisma.bookCopy.upsert({
      where: { barcode: `${book.isbn}-A` },
      update: {},
      create: {
        bookId: book.id,
        barcode: `${book.isbn}-A`,
        status: 'AVAILABLE',
        shelfId: shelf.id,
      },
    });
    await prisma.bookCopy.upsert({
      where: { barcode: `${book.isbn}-B` },
      update: {},
      create: {
        bookId: book.id,
        barcode: `${book.isbn}-B`,
        status: 'CHECKED_OUT',
        shelfId: shelf.id,
      },
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
