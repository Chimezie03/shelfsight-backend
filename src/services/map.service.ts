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
}

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

  return {
    label,
    mapX: o.mapX as number,
    mapY: o.mapY as number,
    width: o.width as number,
    height: o.height as number,
    floor: o.floor as number,
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

  if (Object.keys(out).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'No valid fields to update', {
      fieldErrors: {},
    });
  }

  return out;
}

function toResponse(section: {
  id: string;
  label: string;
  mapX: number;
  mapY: number;
  width: number;
  height: number;
  floor: number;
}) {
  return {
    id: section.id,
    label: section.label,
    mapX: section.mapX,
    mapY: section.mapY,
    width: section.width,
    height: section.height,
    floor: section.floor,
  };
}

/**
 * ARCH DECISION: Stable ordering for map rendering — floor ascending, then Y, then X, then label.
 */
export async function listShelfSections() {
  const rows = await prisma.shelfSection.findMany({
    orderBy: [{ floor: 'asc' }, { mapY: 'asc' }, { mapX: 'asc' }, { label: 'asc' }],
  });
  return rows.map(toResponse);
}

export async function getShelfSectionById(id: string) {
  const row = await prisma.shelfSection.findUnique({ where: { id } });
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
    },
  });
  return toResponse(row);
}

export async function updateShelfSection(id: string, partial: Partial<ShelfSectionPayload>) {
  try {
    const row = await prisma.shelfSection.update({
      where: { id },
      data: partial,
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
