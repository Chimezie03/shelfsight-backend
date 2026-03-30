import type { Request, Response } from 'express';
import {
  getUsersService,
  createUserService,
  updateUserService,
  deleteUserService,
} from '../services/users.service';

export async function getUsers(req: Request, res: Response) {
  const users = await getUsersService();
  res.json(users);
}

export async function createUser(req: Request, res: Response) {
  const user = await createUserService(req.body);
  res.status(201).json(user);
}

export async function updateUser(req: Request, res: Response) {
  const user = await updateUserService(req.params.id, req.body);
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  await deleteUserService(req.params.id);
  res.status(204).send();
}
