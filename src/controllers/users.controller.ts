import type { Request, Response } from 'express';
import {
  getUsersService,
  createUserService,
  updateUserService,
  deleteUserService,
} from '../services/users.service';
import { AppError } from '../lib/errors';

function requireOrg(req: Request): string {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  return req.user.organizationId;
}

export async function getUsers(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const { page, limit } = req.query;
  const result = await getUsersService(
    orgId,
    page !== undefined ? Number(page) : 1,
    limit !== undefined ? Number(limit) : 50,
  );
  res.json(result);
}

export async function createUser(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const user = await createUserService(orgId, req.body);
  res.status(201).json(user);
}

export async function updateUser(req: Request, res: Response) {
  const orgId = requireOrg(req);
  const user = await updateUserService(orgId, req.params.id, req.body);
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  const orgId = requireOrg(req);
  await deleteUserService(orgId, req.params.id);
  res.status(204).send();
}
