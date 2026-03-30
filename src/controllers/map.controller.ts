import type { Request, Response } from 'express';
import {
  createShelfSection,
  deleteShelfSection,
  getShelfSectionById,
  listShelfSections,
  parseShelfSectionPayload,
  parseShelfSectionPartial,
  updateShelfSection,
} from '../services/map.service';

export async function listSections(_req: Request, res: Response) {
  const data = await listShelfSections();
  res.json(data);
}

export async function getSection(req: Request, res: Response) {
  const section = await getShelfSectionById(req.params.id);
  res.json(section);
}

export async function createSection(req: Request, res: Response) {
  const payload = parseShelfSectionPayload(req.body);
  const section = await createShelfSection(payload);
  res.status(201).json(section);
}

export async function updateSection(req: Request, res: Response) {
  const partial = parseShelfSectionPartial(req.body);
  const section = await updateShelfSection(req.params.id, partial);
  res.json(section);
}

export async function deleteSection(req: Request, res: Response) {
  await deleteShelfSection(req.params.id);
  res.status(204).send();
}
