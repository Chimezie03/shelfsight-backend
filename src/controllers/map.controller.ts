import type { Request, Response } from 'express';
import {
  createShelfSection,
  deleteShelfSection,
  getShelfSectionById,
  listShelfSections,
  parseShelfSectionPayload,
  parseShelfSectionPartial,
  updateShelfSection,
  getBookCopiesByShelf,
  syncMapLayout,
} from '../services/map.service';
import { AppError } from '../lib/errors';

export async function listSections(req: Request, res: Response) {
  const floorParam = req.query.floor;
  const floor = floorParam !== undefined ? Number(floorParam) : undefined;
  const safeFloor =
    floor !== undefined && Number.isInteger(floor) && floor >= 0 ? floor : undefined;
  const data = await listShelfSections(safeFloor);
  res.json({ success: true, data });
}

export async function getSection(req: Request, res: Response) {
  const section = await getShelfSectionById(req.params.id);
  res.json({ success: true, data: section });
}

export async function createSection(req: Request, res: Response) {
  const payload = parseShelfSectionPayload(req.body);
  const section = await createShelfSection(payload);
  res.status(201).json({ success: true, data: section });
}

export async function updateSection(req: Request, res: Response) {
  const partial = parseShelfSectionPartial(req.body);
  const section = await updateShelfSection(req.params.id, partial);
  res.json({ success: true, data: section });
}

export async function deleteSection(req: Request, res: Response) {
  await deleteShelfSection(req.params.id);
  res.status(204).send();
}

export async function listShelfBooks(req: Request, res: Response) {
  const copies = await getBookCopiesByShelf(req.params.id);
  res.json({ success: true, data: copies });
}

export async function saveLayout(req: Request, res: Response) {
  const sections = req.body;
  if (!Array.isArray(sections)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be an array of sections.');
  }

  const result = await syncMapLayout(sections);
  res.json({ success: true, data: result });
}
