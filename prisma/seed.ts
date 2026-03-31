import { PrismaClient, Role, CopyStatus, CopyEventType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = await bcrypt.hash('password123', 12);

  console.log('Clearing existing data...');
  await prisma.bookCopyEvent.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.bookCopy.deleteMany();
  await prisma.book.deleteMany();
  await prisma.shelfSection.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Users...');
  // 1 Admin, 3 Staff, 10 Patrons
  const admin = await prisma.user.create({
    data: { email: 'admin@shelfsight.com', passwordHash: defaultPassword, name: 'Alice Admin', role: Role.ADMIN },
  });

  const staff = [];
  staff.push(await prisma.user.create({ data: { email: 'maria.staff@shelfsight.com', passwordHash: defaultPassword, name: 'Maria Staff', role: Role.STAFF } }));
  staff.push(await prisma.user.create({ data: { email: 'john.staff@shelfsight.com', passwordHash: defaultPassword, name: 'John Staff', role: Role.STAFF } }));
  staff.push(await prisma.user.create({ data: { email: 'liam.staff@shelfsight.com', passwordHash: defaultPassword, name: 'Liam Staff', role: Role.STAFF } }));

  const patronNames = ['Emma Patron', 'Noah Williams', 'Olivia Brown', 'James Jones', 'Ava Garcia', 'Isabella Miller', 'Sophia Davis', 'Mia Rodriguez', 'Charlotte Martinez', 'Amelia Hernandez', 'Harper Lopez', 'Evelyn Gonzalez'];
  const patrons = [];
  for (let i = 0; i < patronNames.length; i++) {
    const name = patronNames[i];
    patrons.push(
      await prisma.user.create({
        data: { email: `patron${i + 1}@shelfsight.com`, passwordHash: defaultPassword, name, role: Role.PATRON }
      })
    );
  }

  console.log('Seeding Shelf Sections...');
  const shelvesData = [
    { label: 'Fiction A–F',   mapX: 60,  mapY: 40,  width: 260, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Fiction',        deweyRangeStart: '800', deweyRangeEnd: '833', color: '#1B2A4A', numberOfTiers: 4, capacityPerTier: 30, sectionCode: 'F-1' },
    { label: 'Fiction G–M',   mapX: 350, mapY: 40,  width: 260, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Fiction',        deweyRangeStart: '834', deweyRangeEnd: '866', color: '#1B2A4A', numberOfTiers: 4, capacityPerTier: 30, sectionCode: 'F-2' },
    { label: 'Fiction N–Z',   mapX: 640, mapY: 40,  width: 260, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Fiction',        deweyRangeStart: '867', deweyRangeEnd: '899', color: '#1B2A4A', numberOfTiers: 4, capacityPerTier: 30, sectionCode: 'F-3' },
    { label: 'Science',       mapX: 60,  mapY: 180, width: 300, height: 100, floor: 1, shelfType: 'double-shelf', category: 'Science',       deweyRangeStart: '500', deweyRangeEnd: '599', color: '#3D8B7A', numberOfTiers: 6, capacityPerTier: 40, sectionCode: 'S-1' },
    { label: 'History & Geo', mapX: 400, mapY: 180, width: 300, height: 100, floor: 1, shelfType: 'double-shelf', category: 'History',       deweyRangeStart: '900', deweyRangeEnd: '999', color: '#C4956A', numberOfTiers: 6, capacityPerTier: 40, sectionCode: 'H-1' },
    { label: 'Technology',    mapX: 60,  mapY: 330, width: 280, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Non-Fiction',    deweyRangeStart: '600', deweyRangeEnd: '699', color: '#64748B', numberOfTiers: 5, capacityPerTier: 35, sectionCode: 'T-1' },
    { label: 'Arts & Rec',    mapX: 380, mapY: 330, width: 280, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Non-Fiction',    deweyRangeStart: '700', deweyRangeEnd: '799', color: '#8B6BB5', numberOfTiers: 5, capacityPerTier: 35, sectionCode: 'A-1' },
    { label: 'Philosophy',    mapX: 700, mapY: 330, width: 220, height: 90, floor: 1, shelfType: 'single-shelf', category: 'Non-Fiction',    deweyRangeStart: '100', deweyRangeEnd: '199', color: '#D4A026', numberOfTiers: 4, capacityPerTier: 30, sectionCode: 'P-1' },
    { label: 'New Arrivals',  mapX: 60,  mapY: 480, width: 240, height: 80, floor: 1, shelfType: 'display-table', category: 'Uncategorized', deweyRangeStart: '000', deweyRangeEnd: '999', color: '#C4454D', numberOfTiers: 2, capacityPerTier: 20, sectionCode: 'N-1' },
  ];
  const shelves = [];
  for (const s of shelvesData) {
    shelves.push(await prisma.shelfSection.create({ data: s }));
  }

  const getShelfForDewey = (dewey: string | null) => {
    if (!dewey) return shelves[8]; // New arrivals
    const num = parseFloat(dewey);
    if (num >= 800 && num < 899) {
      return shelves[Math.floor(Math.random() * 3)];
    }
    if (num >= 500 && num < 600) return shelves[3]; // Science
    if (num >= 900 && num < 999) return shelves[4]; // History
    if (num >= 600 && num < 700) return shelves[5]; // Technology
    if (num >= 700 && num < 800) return shelves[6]; // Arts
    if (num >= 100 && num < 200) return shelves[7]; // Philosophy
    return shelves[8];
  };

  console.log('Seeding Books (50+ items)...');
  const bookList = [
    { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', genre: 'Fiction', deweyDecimal: '813.52' },
    { title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780060935467', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: '1984', author: 'George Orwell', isbn: '9780451524935', genre: 'Fiction', deweyDecimal: '823.912' },
    { title: 'Pride and Prejudice', author: 'Jane Austen', isbn: '9780141439518', genre: 'Fiction', deweyDecimal: '823.7' },
    { title: 'The Catcher in the Rye', author: 'J.D. Salinger', isbn: '9780316769488', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', genre: 'Science', deweyDecimal: '523.1' },
    { title: 'Cosmos', author: 'Carl Sagan', isbn: '9780345539434', genre: 'Science', deweyDecimal: '520' },
    { title: 'Sapiens', author: 'Yuval Noah Harari', isbn: '9780062316097', genre: 'History', deweyDecimal: '909' },
    { title: 'The Art of War', author: 'Sun Tzu', isbn: '9781599869773', genre: 'History', deweyDecimal: '355.02' },
    { title: 'Dune', author: 'Frank Herbert', isbn: '9780441172719', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '9780345339683', genre: 'Fiction', deweyDecimal: '823.912' },
    { title: 'Fahrenheit 451', author: 'Ray Bradbury', isbn: '9781451673319', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'Brave New World', author: 'Aldous Huxley', isbn: '9780060850524', genre: 'Fiction', deweyDecimal: '823.912' },
    { title: 'Foundation', author: 'Isaac Asimov', isbn: '9780553293357', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'Neuromancer', author: 'William Gibson', isbn: '9780441569595', genre: 'Fiction', deweyDecimal: '813.54' },
    { title: 'The Origin of Species', author: 'Charles Darwin', isbn: '9780451529060', genre: 'Science', deweyDecimal: '576.8' },
    { title: 'Silent Spring', author: 'Rachel Carson', isbn: '9780618249060', genre: 'Science', deweyDecimal: '574.5' },
    { title: 'The Selfish Gene', author: 'Richard Dawkins', isbn: '9780198788607', genre: 'Science', deweyDecimal: '575.01' },
    { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', isbn: '9780393317558', genre: 'History', deweyDecimal: '909' },
    { title: "A People's History of the United States", author: 'Howard Zinn', isbn: '9780060838652', genre: 'History', deweyDecimal: '973' },
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', isbn: '9780374533557', genre: 'Philosophy', deweyDecimal: '153.4' },
    { title: 'The Republic', author: 'Plato', isbn: '9780140449143', genre: 'Philosophy', deweyDecimal: '321.07' },
    { title: 'Meditations', author: 'Marcus Aurelius', isbn: '9780812968255', genre: 'Philosophy', deweyDecimal: '188' },
    { title: 'Critique of Pure Reason', author: 'Immanuel Kant', isbn: '9780140447477', genre: 'Philosophy', deweyDecimal: '121' },
    { title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', genre: 'Technology', deweyDecimal: '005.13' },
    { title: 'The Pragmatic Programmer', author: 'Andrew Hunt', isbn: '9780201616224', genre: 'Technology', deweyDecimal: '005.1' },
    { title: 'Design Patterns', author: 'David Thomas', isbn: '9780201616225', genre: 'Technology', deweyDecimal: '005.1' },
    { title: 'Code Complete', author: 'Steve McConnell', isbn: '9780735619678', genre: 'Technology', deweyDecimal: '005.1' },
    { title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', isbn: '9780262033848', genre: 'Technology', deweyDecimal: '005.1' },
    { title: 'Artificial Intelligence', author: 'Stuart Russell', isbn: '9780136042594', genre: 'Technology', deweyDecimal: '006.3' },
    { title: 'The Elements of Style', author: 'William Strunk Jr.', isbn: '9780205309023', genre: 'Arts', deweyDecimal: '808' },
    { title: 'Ways of Seeing', author: 'John Berger', isbn: '9780140135152', genre: 'Arts', deweyDecimal: '701' },
    { title: 'The Story of Art', author: 'E.H. Gombrich', isbn: '9780714832470', genre: 'Arts', deweyDecimal: '709' },
    { title: 'Moby-Dick', author: 'Herman Melville', isbn: '9780142437247', genre: 'Fiction', deweyDecimal: '813.3' },
    { title: 'War and Peace', author: 'Leo Tolstoy', isbn: '9780143039990', genre: 'Fiction', deweyDecimal: '891.73' },
    { title: 'The Odyssey', author: 'Homer', isbn: '9780140268867', genre: 'Fiction', deweyDecimal: '883' },
    { title: 'The Iliad', author: 'Homer', isbn: '9780140275360', genre: 'Fiction', deweyDecimal: '883' },
    { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', isbn: '9780140449136', genre: 'Fiction', deweyDecimal: '891.733' },
    { title: 'The Brothers Karamazov', author: 'Fyodor Dostoevsky', isbn: '9780374528379', genre: 'Fiction', deweyDecimal: '891.733' },
    { title: 'Anna Karenina', author: 'Leo Tolstoy', isbn: '9780140449174', genre: 'Fiction', deweyDecimal: '891.733' },
    { title: 'Les Misérables', author: 'Victor Hugo', isbn: '9780451419439', genre: 'Fiction', deweyDecimal: '843.8' },
    { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', isbn: '9780140449266', genre: 'Fiction', deweyDecimal: '843.8' },
    { title: 'Don Quixote', author: 'Miguel de Cervantes', isbn: '9780142437230', genre: 'Fiction', deweyDecimal: '863.3' },
    { title: 'Frankenstein', author: 'Mary Shelley', isbn: '9780141439471', genre: 'Fiction', deweyDecimal: '823.7' },
    { title: 'Dracula', author: 'Bram Stoker', isbn: '9780141439846', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', isbn: '9780141439570', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'Wuthering Heights', author: 'Emily Brontë', isbn: '9780141439556', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'Great Expectations', author: 'Charles Dickens', isbn: '9780141439563', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'Alice in Wonderland', author: 'Lewis Carroll', isbn: '9780141439761', genre: 'Fiction', deweyDecimal: '823.8' },
    { title: 'Sherlock Holmes', author: 'Arthur Conan Doyle', isbn: '9780140437713', genre: 'Fiction', deweyDecimal: '823.8' },
  ];

  const dbBooks = [];
  for (const b of bookList) {
    dbBooks.push(await prisma.book.create({ data: b }));
  }

  console.log('Seeding Book Copies & Events & Loans...');
  
  for (let i = 0; i < dbBooks.length; i++) {
    const book = dbBooks[i];
    const shelf = getShelfForDewey(book.deweyDecimal);
    
    // Create 2 copies for each book
    for (let c = 1; c <= 2; c++) {
      const barcode = `${book.isbn}-${c}`;
      let status = CopyStatus.AVAILABLE;
      let finalShelfId: string | null = shelf.id;
      
      const copy = await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          barcode,
          status,
          shelfId: finalShelfId
        }
      });

      // Add a SHELVED event
      await prisma.bookCopyEvent.create({
        data: {
          bookCopyId: copy.id,
          type: CopyEventType.SHELVED,
          shelfId: shelf.id,
          userId: staff[0].id,
          note: 'Initial cataloging'
        }
      });
    }
  }

  // Now selectively check out some books and create loans (Historical & Active)
  let loanCount = 0;

  for (let i = 0; i < dbBooks.length; i++) {
    const book = dbBooks[i];
    const copies = await prisma.bookCopy.findMany({ where: { bookId: book.id } });
    
    // Copy 1: Sometimes has a completed past loan
    if (i % 3 === 0) {
      const copy = copies[0];
      const patron = patrons[i % patrons.length];
      
      const checkoutDate = new Date();
      checkoutDate.setDate(checkoutDate.getDate() - 40);
      const dueDate = new Date(checkoutDate);
      dueDate.setDate(dueDate.getDate() + 14);
      
      const returnedDate = new Date(checkoutDate);
      returnedDate.setDate(returnedDate.getDate() + 12);

      const loan = await prisma.loan.create({
        data: {
          userId: patron.id,
          bookCopyId: copy.id,
          checkedOutAt: checkoutDate,
          dueDate: dueDate,
          returnedAt: returnedDate,
          fineAmount: 0
        }
      });
      loanCount++;

      await prisma.bookCopyEvent.createMany({
        data: [
          { bookCopyId: copy.id, type: CopyEventType.CHECKED_OUT, userId: staff[1].id, loanId: loan.id, createdAt: checkoutDate },
          { bookCopyId: copy.id, type: CopyEventType.RETURNED, userId: staff[1].id, loanId: loan.id, createdAt: returnedDate },
          { bookCopyId: copy.id, type: CopyEventType.SHELVED, userId: staff[1].id, shelfId: copy.shelfId, createdAt: new Date(returnedDate.getTime() + 100000) }
        ]
      });
    }

    // Copy 2: sometimes currently checked out (active or overdue)
    if (i % 2 === 0) {
      const copy = copies[1];
      const patron = patrons[(i + 5) % patrons.length];
      const isOverdue = i % 4 === 0;
      
      const checkoutDate = new Date();
      checkoutDate.setDate(checkoutDate.getDate() - (isOverdue ? 25 : 5));
      const dueDate = new Date(checkoutDate);
      dueDate.setDate(dueDate.getDate() + 14);

      const loan = await prisma.loan.create({
        data: {
          userId: patron.id,
          bookCopyId: copy.id,
          checkedOutAt: checkoutDate,
          dueDate: dueDate,
        }
      });
      loanCount++;

      await prisma.bookCopy.update({
        where: { id: copy.id },
        data: { status: CopyStatus.CHECKED_OUT, shelfId: null }
      });

      await prisma.bookCopyEvent.create({
        data: { bookCopyId: copy.id, type: CopyEventType.CHECKED_OUT, userId: staff[2].id, loanId: loan.id, createdAt: checkoutDate }
      });
    }
  }

  const lostCopy = await prisma.bookCopy.findFirst({ where: { status: CopyStatus.AVAILABLE } });
  if (lostCopy) {
    await prisma.bookCopy.update({ where: { id: lostCopy.id }, data: { status: CopyStatus.LOST, shelfId: null } });
    await prisma.bookCopyEvent.create({ data: { bookCopyId: lostCopy.id, type: CopyEventType.MARKED_LOST, userId: admin.id, createdAt: new Date() } });
  }

  const processingCopy = await prisma.bookCopy.findFirst({ where: { status: CopyStatus.AVAILABLE, id: { not: lostCopy!.id } } });
  if (processingCopy) {
    await prisma.bookCopy.update({ where: { id: processingCopy.id }, data: { status: CopyStatus.PROCESSING, shelfId: null } });
    await prisma.bookCopyEvent.create({ data: { bookCopyId: processingCopy.id, type: CopyEventType.MARKED_PROCESSING, userId: admin.id, createdAt: new Date() } });
  }

  console.log(`Seeding complete. Created ${loanCount} loans.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });