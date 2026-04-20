import { faker } from '@faker-js/faker';

// A completely local script to load directly via Prisma for maximum speed 
// so we don't need Express to be running / mess with JWTs, 
// though the API exists as well if you prefer.
import prisma from '../src/lib/prisma';
import { randomUUID } from 'crypto';

const TOTAL_BOOKS = parseInt(process.env.TOTAL_BOOKS || '10000', 10);
const BATCH_SIZE = 2500;

function createRandomBookData() {
  const genres = [
    'Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 
    'Mystery', 'Biography', 'History', 'Technology', 'Self-Help'
  ];
  
  // Fake ISBN13
  const isbn = `978${faker.string.numeric(10)}`;
  const cleanIsbn = isbn.replace(/-/g, '');
  const copiesCount = faker.number.int({ min: 1, max: 4 });

  const bookId = randomUUID();
  
  const book = {
    id: bookId,
    title: faker.word.words({ count: { min: 1, max: 6 } }),
    author: faker.person.fullName(),
    isbn,
    genre: faker.helpers.arrayElement(genres),
    deweyDecimal: `${faker.number.int({ min: 0, max: 999 })}.${faker.number.int({ min: 1, max: 99})}`,
    language: faker.helpers.arrayElement(['English', 'Spanish', 'French', 'German']),
    coverImageUrl: faker.image.urlLoremFlickr({ category: 'book' }),
    publishYear: faker.number.int({ min: 1900, max: 2024 }).toString(),
    pageCount: faker.number.int({ min: 100, max: 1200 }),
    createdAt: new Date(),
  };

  const copies = Array.from({ length: copiesCount }, (_, i) => ({
    id: randomUUID(),
    bookId,
    barcode: `${cleanIsbn}-${i + 1}-${Date.now()}-${faker.string.alphanumeric(4)}`,
    status: 'AVAILABLE',
  }));

  return { book, copies };
}

async function main() {
  console.log(`Starting bulk load of ${TOTAL_BOOKS} books via Prisma directly...`);
  
  const totalBatches = Math.ceil(TOTAL_BOOKS / BATCH_SIZE);
  let totalSaved = 0;

  for (let batch = 1; batch <= totalBatches; batch++) {
    console.log(`Batch ${batch}/${totalBatches}... generating data`);
    const size = Math.min(BATCH_SIZE, TOTAL_BOOKS - totalSaved);
    
    const items = Array.from({ length: size }, () => createRandomBookData());
    const books = items.map(i => i.book);
    const allCopies = items.flatMap(i => i.copies);

    console.log(`Batch ${batch}/${totalBatches}... inserting books`);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.book.createMany({
          data: books,
          skipDuplicates: true
        });

        // Some might duplicate ISBN, we will skip those books
        // Now fetch created ones to link copies (skipDuplicates means some might not be inserted, 
        // but this script is just for testing so it's fine)
        await tx.bookCopy.createMany({
          data: allCopies,
          skipDuplicates: true
        });
      });
      totalSaved += size;
      console.log(`Batch ${batch} successful. Total saved: ${totalSaved}`);
    } catch (e) {
      console.error(`Error in batch ${batch}:`, e);
      console.error(`Try smaller batch size or clear DB.`);
      break;
    }
  }

  console.log(`Completed. Loaded ~${totalSaved} books into db.`);
}

main().catch(err => {
  console.error("Fatal exception:", err);
  process.exit(1);
})
