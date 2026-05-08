import { forOrg } from '../lib/prisma';
import { AppError } from '../lib/errors';

export interface ShelfPlacementHint {
  shelfId: string;
  label: string;
  category: string | null;
  estimatedMatchCount: number;
  note: string;
}

export interface BookShelfSuggestion {
  shelfId: string;
  label: string;
  category: string | null;
  deweyRangeStart: string | null;
  deweyRangeEnd: string | null;
  score: number;
  rationale: string[];
}

function parseLeadingDeweyInt(dewey: string | null | undefined): number | null {
  if (dewey == null || String(dewey).trim() === '') return null;
  const m = String(dewey).match(/\d{1,3}/);
  if (!m) return null;
  const n = Number.parseInt(m[0], 10);
  return Number.isNaN(n) ? null : n;
}

function deweyFallsOnShelf(
  bookDewey: string | null,
  rangeStart: string | null,
  rangeEnd: string | null,
): boolean {
  const b = parseLeadingDeweyInt(bookDewey);
  if (b === null) return false;
  const start = parseLeadingDeweyInt(rangeStart);
  const end = parseLeadingDeweyInt(rangeEnd);
  if (start === null || end === null) return false;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return b >= lo && b <= hi;
}

/**
 * Heuristic hints: compare unshelved copies' genres to each shelf's category label.
 * No LLM — suitable as a starting point for staff curation.
 */
export async function getShelfPlacementHints(organizationId: string): Promise<{
  unshelvedCount: number;
  genreCounts: Record<string, number>;
  shelfHints: ShelfPlacementHint[];
}> {
  const db = forOrg(organizationId);

  const shelves = await db.shelfSection.findMany({
    select: {
      id: true,
      label: true,
      category: true,
    },
    orderBy: { label: 'asc' },
  });

  const unshelved = await db.bookCopy.findMany({
    where: { shelfId: null, status: 'AVAILABLE' },
    include: {
      book: { select: { genre: true } },
    },
    take: 500,
  });

  const genreCounts = new Map<string, number>();
  for (const copy of unshelved) {
    const g = (copy.book.genre || '').trim() || 'Uncategorized';
    genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
  }

  const shelfHints: ShelfPlacementHint[] = shelves.map((s) => {
    const cat = (s.category || '').trim() || 'Uncategorized';
    const estimatedMatchCount = unshelved.filter((c) => {
      const g = (c.book.genre || '').trim() || 'Uncategorized';
      return g === cat || (cat !== 'Uncategorized' && g.toLowerCase() === cat.toLowerCase());
    }).length;

    let note: string;
    if (unshelved.length === 0) {
      note = 'No unshelved available copies.';
    } else if (estimatedMatchCount === 0) {
      note = 'No unshelved copies share this shelf category by exact genre match.';
    } else {
      note = `${estimatedMatchCount} unshelved available cop${estimatedMatchCount === 1 ? 'y' : 'ies'} share this shelf category (genre match).`;
    }

    return {
      shelfId: s.id,
      label: s.label,
      category: s.category,
      estimatedMatchCount,
      note,
    };
  });

  return {
    unshelvedCount: unshelved.length,
    genreCounts: Object.fromEntries(genreCounts),
    shelfHints,
  };
}

/**
 * Rank shelves for one catalog book using genre/category alignment and Dewey range overlap.
 */
export async function getShelfPlacementHintsForBook(
  organizationId: string,
  bookId: string,
): Promise<{
  book: {
    id: string;
    title: string;
    genre: string | null;
    deweyDecimal: string | null;
  };
  suggestions: BookShelfSuggestion[];
}> {
  const db = forOrg(organizationId);

  const book = await db.book.findFirst({
    where: { id: bookId },
    select: { id: true, title: true, genre: true, deweyDecimal: true },
  });

  if (!book) {
    throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');
  }

  const shelves = await db.shelfSection.findMany({
    select: {
      id: true,
      label: true,
      category: true,
      deweyRangeStart: true,
      deweyRangeEnd: true,
    },
    orderBy: { label: 'asc' },
  });

  const genre = (book.genre || '').trim();

  const scored: BookShelfSuggestion[] = shelves.map((s) => {
    const rationale: string[] = [];
    let score = 0;
    const cat = (s.category || '').trim();

    if (genre && cat && (genre === cat || genre.toLowerCase() === cat.toLowerCase())) {
      score += 4;
      rationale.push('Shelf category matches this book’s genre.');
    }

    if (deweyFallsOnShelf(book.deweyDecimal, s.deweyRangeStart, s.deweyRangeEnd)) {
      score += 5;
      rationale.push(
        `Dewey ${book.deweyDecimal ?? '—'} falls within this shelf’s Dewey range (${s.deweyRangeStart ?? '—'}–${s.deweyRangeEnd ?? '—'}).`,
      );
    }

    return {
      shelfId: s.id,
      label: s.label,
      category: s.category,
      deweyRangeStart: s.deweyRangeStart,
      deweyRangeEnd: s.deweyRangeEnd,
      score,
      rationale,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const positive = scored.filter((x) => x.score > 0).slice(0, 8);
  const suggestions =
    positive.length > 0
      ? positive
      : scored.slice(0, 5).map((s) => ({
          ...s,
          rationale: [
            ...s.rationale,
            'No genre/Dewey signal matched configured shelves — pick manually or adjust shelf Dewey ranges.',
          ],
        }));

  return {
    book: {
      id: book.id,
      title: book.title,
      genre: book.genre,
      deweyDecimal: book.deweyDecimal,
    },
    suggestions,
  };
}
