import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';

export interface ShelfSectionPayload {
  label: string;
  mapX: number;
  mapY: number;
  width: number;
  height: number;
  floor: number;
  sectionCode?: string | null;
  category?: string | null;
  deweyRangeStart?: string | null;
  deweyRangeEnd?: string | null;
  numberOfTiers?: number | null;
  capacityPerTier?: number | null;
  color?: string | null;
  rotation?: number | null;
  notes?: string | null;
  shelfType?: string | null;
}

const OPTIONAL_STRING_FIELDS = [
  'sectionCode', 'category', 'deweyRangeStart', 'deweyRangeEnd',
  'color', 'notes', 'shelfType',
] as const;

const OPTIONAL_INT_FIELDS = ['numberOfTiers', 'capacityPerTier', 'rotation'] as const;

function collectFieldErrors(
  body: Record<string, unknown>,
): Record<string, string> | null {
  const fieldErrors: Record<string, string> = {};

  const labelRaw = body.label;
  if (typeof labelRaw !== 'string' || labelRaw.trim() === '') {
    fieldErrors.label = 'Label is required and must be non-empty';
  }

  const intFields = ['mapX', 'mapY', 'width', 'height', 'floor'] as const;
  for (const key of intFields) {
    const v = body[key];
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      fieldErrors[key] = `${key} must be an integer`;
    }
  }

  if (typeof body.width === 'number' && Number.isInteger(body.width) && body.width <= 0) {
    fieldErrors.width = 'Width must be a positive integer';
  }
  if (typeof body.height === 'number' && Number.isInteger(body.height) && body.height <= 0) {
    fieldErrors.height = 'Height must be a positive integer';
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function parseOptionalFields(o: Record<string, unknown>): Partial<ShelfSectionPayload> {
  const out: Partial<ShelfSectionPayload> = {};

  for (const key of OPTIONAL_STRING_FIELDS) {
    if (key in o && o[key] !== undefined) {
      out[key] = typeof o[key] === 'string' ? (o[key] as string) : null;
    }
  }

  for (const key of OPTIONAL_INT_FIELDS) {
    if (key in o && o[key] !== undefined) {
      const v = o[key];
      if (typeof v === 'number' && Number.isInteger(v)) {
        out[key] = v;
      }
    }
  }

  return out;
}

export function parseShelfSectionPayload(body: unknown): ShelfSectionPayload {
  if (body === null || typeof body !== 'object') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', {
      fieldErrors: {},
    });
  }
  const o = body as Record<string, unknown>;
  const fieldErrors = collectFieldErrors(o);
  if (fieldErrors) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', {
      fieldErrors,
    });
  }

  const label = (o.label as string).trim();
  const optional = parseOptionalFields(o);

  return {
    label,
    mapX: o.mapX as number,
    mapY: o.mapY as number,
    width: o.width as number,
    height: o.height as number,
    floor: o.floor as number,
    ...optional,
  };
}

export function parseShelfSectionPartial(body: unknown): Partial<ShelfSectionPayload> {
  if (body === null || typeof body !== 'object') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', {
      fieldErrors: {},
    });
  }
  const o = body as Record<string, unknown>;
  const out: Partial<ShelfSectionPayload> = {};
  const fieldErrors: Record<string, string> = {};

  if ('label' in o) {
    if (typeof o.label !== 'string' || o.label.trim() === '') {
      fieldErrors.label = 'Label must be non-empty when provided';
    } else {
      out.label = o.label.trim();
    }
  }
  for (const key of ['mapX', 'mapY', 'width', 'height', 'floor'] as const) {
    if (!(key in o)) continue;
    const v = o[key];
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      fieldErrors[key] = `${key} must be an integer`;
    } else {
      (out as Record<string, number>)[key] = v;
    }
  }
  if (typeof out.width === 'number' && out.width <= 0) {
    fieldErrors.width = 'Width must be a positive integer';
  }
  if (typeof out.height === 'number' && out.height <= 0) {
    fieldErrors.height = 'Height must be a positive integer';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', {
      fieldErrors,
    });
  }

  // Parse optional fields
  Object.assign(out, parseOptionalFields(o));

  if (Object.keys(out).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No valid fields to update', {
      fieldErrors: {},
    });
  }

  return out;
}

function toResponse(section: any) {
  return {
    id: section.id,
    label: section.label,
    mapX: section.mapX,
    mapY: section.mapY,
    width: section.width,
    height: section.height,
    floor: section.floor,
    sectionCode: section.sectionCode ?? null,
    category: section.category ?? 'Uncategorized',
    deweyRangeStart: section.deweyRangeStart ?? null,
    deweyRangeEnd: section.deweyRangeEnd ?? null,
    numberOfTiers: section.numberOfTiers ?? 4,
    capacityPerTier: section.capacityPerTier ?? 30,
    color: section.color ?? '#1B2A4A',
    rotation: section.rotation ?? 0,
    notes: section.notes ?? null,
    shelfType: section.shelfType ?? 'single-shelf',
    currentUsed: section._count?.copies ?? 0,
  };
}

/**
 * ARCH DECISION: Stable ordering for map rendering — floor ascending, then Y, then X, then label.
 */
export async function listShelfSections() {
  const rows = await prisma.shelfSection.findMany({
    include: { _count: { select: { copies: true } } },
    orderBy: [{ floor: 'asc' }, { mapY: 'asc' }, { mapX: 'asc' }, { label: 'asc' }],
  });
  return rows.map(toResponse);
}

export async function getShelfSectionById(id: string) {
  const row = await prisma.shelfSection.findUnique({
    where: { id },
    include: { _count: { select: { copies: true } } },
  });
  if (!row) {
    throw new AppError(404, 'SHELF_SECTION_NOT_FOUND', 'Shelf section not found');
  }
  return toResponse(row);
}

export async function createShelfSection(payload: ShelfSectionPayload) {
  const row = await prisma.shelfSection.create({
    data: {
      label: payload.label,
      mapX: payload.mapX,
      mapY: payload.mapY,
      width: payload.width,
      height: payload.height,
      floor: payload.floor,
      sectionCode: payload.sectionCode ?? null,
      category: payload.category ?? null,
      deweyRangeStart: payload.deweyRangeStart ?? null,
      deweyRangeEnd: payload.deweyRangeEnd ?? null,
      numberOfTiers: payload.numberOfTiers ?? null,
      capacityPerTier: payload.capacityPerTier ?? null,
      color: payload.color ?? null,
      rotation: payload.rotation ?? null,
      notes: payload.notes ?? null,
      shelfType: payload.shelfType ?? null,
    },
    include: { _count: { select: { copies: true } } },
  });
  return toResponse(row);
}

export async function updateShelfSection(id: string, partial: Partial<ShelfSectionPayload>) {
  try {
    const row = await prisma.shelfSection.update({
      where: { id },
      data: partial,
      include: { _count: { select: { copies: true } } },
    });
    return toResponse(row);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'SHELF_SECTION_NOT_FOUND', 'Shelf section not found');
    }
    throw e;
  }
}

export async function deleteShelfSection(id: string) {
  try {
    await prisma.shelfSection.delete({ where: { id } });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
      throw new AppError(404, 'SHELF_SECTION_NOT_FOUND', 'Shelf section not found');
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Book copies by shelf
// ---------------------------------------------------------------------------

export async function getBookCopiesByShelf(shelfId: string) {
  // Verify the shelf exists
  const shelf = await prisma.shelfSection.findUnique({ where: { id: shelfId } });
  if (!shelf) {
    throw new AppError(404, 'SHELF_SECTION_NOT_FOUND', 'Shelf section not found');
  }

  const copies = await prisma.bookCopy.findMany({
    where: { shelfId },
    include: {
      book: true,
      loans: {
        where: { returnedAt: null },
        take: 1,
      },
    },
    orderBy: { book: { deweyDecimal: 'asc' } },
  });

  return copies.map((copy) => ({
    id: copy.id,
    barcode: copy.barcode,
    status: copy.status,
    shelfId: copy.shelfId,
    book: {
      id: copy.book.id,
      title: copy.book.title,
      author: copy.book.author,
      isbn: copy.book.isbn,
      genre: copy.book.genre,
      deweyDecimal: copy.book.deweyDecimal,
      coverImageUrl: copy.book.coverImageUrl,
    },
    activeLoan: copy.loans[0]
      ? {
          dueDate: copy.loans[0].dueDate,
          checkedOutAt: copy.loans[0].checkedOutAt,
        }
      : null,
  }));
}

// ---------------------------------------------------------------------------
// Bulk layout sync
// ---------------------------------------------------------------------------

interface LayoutSection {
  id?: string | null;
  label: string;
  mapX: number;
  mapY: number;
  width: number;
  height: number;
  floor: number;
  sectionCode?: string | null;
  category?: string | null;
  deweyRangeStart?: string | null;
  deweyRangeEnd?: string | null;
  numberOfTiers?: number | null;
  capacityPerTier?: number | null;
  color?: string | null;
  rotation?: number | null;
  notes?: string | null;
  shelfType?: string | null;
}

export async function syncMapLayout(sections: LayoutSection[]) {
  const incomingIds = sections
    .filter((s) => s.id && !s.id.startsWith('new-'))
    .map((s) => s.id as string);

  return prisma.$transaction(async (tx) => {
    // Delete sections not in the incoming array
    if (incomingIds.length > 0) {
      await tx.shelfSection.deleteMany({
        where: { id: { notIn: incomingIds } },
      });
    } else {
      await tx.shelfSection.deleteMany({});
    }

    const results = [];
    for (const section of sections) {
      const data = {
        label: section.label,
        mapX: section.mapX,
        mapY: section.mapY,
        width: section.width,
        height: section.height,
        floor: section.floor,
        sectionCode: section.sectionCode ?? null,
        category: section.category ?? null,
        deweyRangeStart: section.deweyRangeStart ?? null,
        deweyRangeEnd: section.deweyRangeEnd ?? null,
        numberOfTiers: section.numberOfTiers ?? null,
        capacityPerTier: section.capacityPerTier ?? null,
        color: section.color ?? null,
        rotation: section.rotation ?? null,
        notes: section.notes ?? null,
        shelfType: section.shelfType ?? null,
      };

      if (section.id && !section.id.startsWith('new-')) {
        // Existing section — update
        const row = await tx.shelfSection.update({
          where: { id: section.id },
          data,
          include: { _count: { select: { copies: true } } },
        });
        results.push(toResponse(row));
      } else {
        // New section — create
        const row = await tx.shelfSection.create({
          data,
          include: { _count: { select: { copies: true } } },
        });
        results.push(toResponse(row));
      }
    }

    return results;
  });
}
