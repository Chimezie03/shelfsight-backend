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

function requireOrg(req: Request): string {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user.organizationId;
}

export async function listSections(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const floorParam = req.query.floor;
  const floor = floorParam !== undefined ? Number(floorParam) : undefined;
  const safeFloor =
    floor !== undefined && Number.isInteger(floor) && floor >= 0 ? floor : undefined;
  const data = await listShelfSections(orgId, safeFloor);
  res.json({ success: true, data });
}

export async function getSection(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const section = await getShelfSectionById(orgId, req.params.id);
  res.json({ success: true, data: section });
}

export async function createSection(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const payload = parseShelfSectionPayload(req.body);
  const section = await createShelfSection(orgId, payload);
  res.status(201).json({ success: true, data: section });
}

export async function updateSection(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const partial = parseShelfSectionPartial(req.body);
  const section = await updateShelfSection(orgId, req.params.id, partial);
  res.json({ success: true, data: section });
}

export async function deleteSection(req: Request, res: Response) {
  const orgId = requireOrg(req);
  await deleteShelfSection(orgId, req.params.id);
  res.status(204).send();
}

export async function listShelfBooks(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const copies = await getBookCopiesByShelf(orgId, req.params.id);
  res.json({ success: true, data: copies });
}

export async function saveLayout(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const sections = req.body;
  if (!Array.isArray(sections)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request body must be an array of sections.');
  }

  const result = await syncMapLayout(orgId, sections);
  res.json({ success: true, data: result });
}
