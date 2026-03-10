import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const defaultPassword = await bcrypt.hash('password123', 12);

  // ── Users ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@shelfsight.com' },
    update: { passwordHash: defaultPassword, name: 'Admin User', role: 'ADMIN' },
    create: { email: 'admin@shelfsight.com', passwordHash: defaultPassword, name: 'Admin User', role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'staff@shelfsight.com' },
    update: { passwordHash: defaultPassword, name: 'Staff User', role: 'STAFF' },
    create: { email: 'staff@shelfsight.com', passwordHash: defaultPassword, name: 'Staff User', role: 'STAFF' },
  });
  const patron = await prisma.user.upsert({
    where: { email: 'patron@shelfsight.com' },
    update: { passwordHash: defaultPassword, name: 'Patron User', role: 'PATRON' },
    create: { email: 'patron@shelfsight.com', passwordHash: defaultPassword, name: 'Patron User', role: 'PATRON' },
  });
  const patron2 = await prisma.user.upsert({
    where: { email: 'sarah.j@shelfsight.com' },
    update: { passwordHash: defaultPassword, name: 'Sarah Johnson', role: 'PATRON' },
    create: { email: 'sarah.j@shelfsight.com', passwordHash: defaultPassword, name: 'Sarah Johnson', role: 'PATRON' },
  });
  const patron3 = await prisma.user.upsert({
    where: { email: 'michael.c@shelfsight.com' },
    update: { passwordHash: defaultPassword, name: 'Michael Chen', role: 'PATRON' },
    create: { email: 'michael.c@shelfsight.com', passwordHash: defaultPassword, name: 'Michael Chen', role: 'PATRON' },
  });
  console.log('Seeded users: admin / staff / patron / sarah.j / michael.c @shelfsight.com — password: password123');

  // ── Shelf Sections (match library-map initial nodes) ───────────────────
  const findOrCreateShelf = async (label: string, mapX: number, mapY: number, width: number, height: number) => {
    let shelf = await prisma.shelfSection.findFirst({ where: { label } });
    if (!shelf) {
      shelf = await prisma.shelfSection.create({ data: { label, mapX, mapY, width, height, floor: 1 } });
    }
    return shelf;
  };

  const shelfFictionAD   = await findOrCreateShelf('Fiction A–D',         1, 1, 5, 2);
  const shelfFictionEK   = await findOrCreateShelf('Fiction E–K',         7, 1, 5, 2);
  const shelfScience     = await findOrCreateShelf('Science & Technology', 1, 4, 6, 2);
  const shelfNewArrivals = await findOrCreateShelf('New Arrivals',        8, 4, 5, 2);

  // ── Books ──────────────────────────────────────────────────────────────
  // Dewey ranges match map shelf nodes:
  //   Fiction A–D  → 813–823    (shelf-1)
  //   Fiction E–K  → 823–840    (shelf-2)
  //   Science      → 500–599    (shelf-3)
  //   New Arrivals → everything else (shelf-4)
  const booksData = [
    // Fiction A–D (Dewey 813–823)
    { title: 'The Great Gatsby',          author: 'F. Scott Fitzgerald', isbn: '9780743273565', genre: 'Fiction', deweyDecimal: '813.52' },
    { title: 'To Kill a Mockingbird',     author: 'Harper Lee',          isbn: '9780060935467', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'The Catcher in the Rye',    author: 'J.D. Salinger',       isbn: '9780316769488', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'Beloved',                   author: 'Toni Morrison',       isbn: '9781400033416', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'Fahrenheit 451',            author: 'Ray Bradbury',        isbn: '9781451673319', genre: 'Fiction', deweyDecimal: '813.54' },
    // Fiction E–K (Dewey 823–840)
    { title: '1984',                      author: 'George Orwell',       isbn: '9780451524935', genre: 'Fiction', deweyDecimal: '823.912' },
    { title: 'Pride and Prejudice',       author: 'Jane Austen',         isbn: '9780141439518', genre: 'Fiction', deweyDecimal: '823.7' },
    { title: 'Jane Eyre',                 author: 'Charlotte Brontë',    isbn: '9780141441146', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'Brave New World',           author: 'Aldous Huxley',       isbn: '9780060850524', genre: 'Fiction', deweyDecimal: '823.912' },
    // Science & Technology (Dewey 500–599)
    { title: 'A Brief History of Time',   author: 'Stephen Hawking',     isbn: '9780553380163', genre: 'Science', deweyDecimal: '523.1' },
    { title: 'The Origin of Species',     author: 'Charles Darwin',      isbn: '9780451529060', genre: 'Science', deweyDecimal: '576.8' },
    { title: 'Cosmos',                    author: 'Carl Sagan',          isbn: '9780345539434', genre: 'Science', deweyDecimal: '520' },
    { title: 'Silent Spring',            author: 'Rachel Carson',       isbn: '9780618249060', genre: 'Science', deweyDecimal: '574.5' },
    { title: 'The Selfish Gene',          author: 'Richard Dawkins',     isbn: '9780198788607', genre: 'Science', deweyDecimal: '575.01' },
    // History / General → New Arrivals shelf
    { title: 'Sapiens',                   author: 'Yuval Noah Harari',   isbn: '9780062316097', genre: 'History', deweyDecimal: '909' },
    { title: 'The Art of War',            author: 'Sun Tzu',             isbn: '9781599869773', genre: 'History', deweyDecimal: '355.02' },
  ];

  const books = [];
  for (const b of booksData) {
    const book = await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: {},
      create: b,
    });
    books.push(book);
  }
  console.log(`Seeded ${books.length} books`);

  // ── Book Copies ────────────────────────────────────────────────────────
  // Assign each book to the matching shelf and create 2 copies (A & B).
  // Some B-copies are CHECKED_OUT with matching Loan records.
  const checkedOutIsbns = new Set([
    '9780743273565', // Great Gatsby
    '9780451524935', // 1984
    '9780553380163', // Brief History of Time
    '9781400033416', // Beloved
    '9780060850524', // Brave New World
  ]);

  function pickShelf(dewey: string) {
    const n = parseFloat(dewey);
    if (n >= 813 && n < 823) return shelfFictionAD;
    if (n >= 823 && n <= 840) return shelfFictionEK;
    if (n >= 500 && n < 600) return shelfScience;
    return shelfNewArrivals;
  }

  for (const book of books) {
    const shelf = pickShelf(book.deweyDecimal || '0');
    const isOut = checkedOutIsbns.has(book.isbn);

    await prisma.bookCopy.upsert({
      where: { barcode: `${book.isbn}-A` },
      update: { status: 'AVAILABLE', shelfId: shelf.id },
      create: { bookId: book.id, barcode: `${book.isbn}-A`, status: 'AVAILABLE', shelfId: shelf.id },
    });
    await prisma.bookCopy.upsert({
      where: { barcode: `${book.isbn}-B` },
      update: { status: isOut ? 'CHECKED_OUT' : 'AVAILABLE', shelfId: isOut ? null : shelf.id },
      create: { bookId: book.id, barcode: `${book.isbn}-B`, status: isOut ? 'CHECKED_OUT' : 'AVAILABLE', shelfId: isOut ? null : shelf.id },
    });
  }
  console.log('Seeded book copies');

  // ── Loans (for the Circulation page) ──────────────────────────────────
  const loanSpecs = [
    { isbn: '9780743273565', userId: patron.id,  daysAgo: 10, dueDays: 14 },  // active, not overdue
    { isbn: '9780451524935', userId: patron2.id, daysAgo: 20, dueDays: 14 },  // overdue 6 days
    { isbn: '9780553380163', userId: patron3.id, daysAgo: 30, dueDays: 14 },  // overdue 16 days
    { isbn: '9781400033416', userId: patron.id,  daysAgo: 5,  dueDays: 14 },  // active, not overdue
    { isbn: '9780060850524', userId: patron2.id, daysAgo: 18, dueDays: 14 },  // overdue 4 days
  ];

  for (const spec of loanSpecs) {
    const copy = await prisma.bookCopy.findUnique({ where: { barcode: `${spec.isbn}-B` } });
    if (!copy) continue;

    const existing = await prisma.loan.findFirst({ where: { bookCopyId: copy.id, returnedAt: null } });
    if (existing) continue;

    const checkedOutAt = new Date();
    checkedOutAt.setDate(checkedOutAt.getDate() - spec.daysAgo);
    const dueDate = new Date(checkedOutAt);
    dueDate.setDate(dueDate.getDate() + spec.dueDays);

    await prisma.loan.create({
      data: { userId: spec.userId, bookCopyId: copy.id, checkedOutAt, dueDate },
    });
  }
  console.log('Seeded loans');
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
