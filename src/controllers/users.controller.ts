import { Request, Response } from 'express';
import { getUsersService, createUserService, updateUserService, deleteUserService } from '../services/users.service';

export async function getUsers(req: Request, res: Response) {
  try {
    // Only allow Admins
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const users = await getUsersService();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await createUserService(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ error: 'Failed to create user', message: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await updateUserService(req.params.id, req.body);
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found', message: err.message });
    } else {
      res.status(400).json({ error: 'Failed to update user', message: err.message });
    }
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteUserService(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'User not found', message: err.message });
    } else {
      res.status(400).json({ error: 'Failed to delete user', message: err.message });
    }
  }
}
