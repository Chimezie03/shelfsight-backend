import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AppError } from '../lib/errors';

export async function getUsersService() {
  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  });
}

export async function createUserService(data: any) {
  const fieldErrors: Record<string, string> = {};
  if (!data.email) fieldErrors.email = 'Required';
  if (!data.password) fieldErrors.password = 'Required';
  if (!data.name) fieldErrors.name = 'Required';
  if (!data.role) fieldErrors.role = 'Required';

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  const VALID_ROLES = ['ADMIN', 'STAFF', 'PATRON'];
  if (!VALID_ROLES.includes(data.role)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { role: `Must be one of: ${VALID_ROLES.join(', ')}` },
    });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  return await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role
    }
  });
}

export async function updateUserService(id: string, data: any) {
  const updateData: any = {
    email: data.email,
    name: data.name,
    role: data.role
  };
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }
  return await prisma.user.update({
    where: { id },
    data: updateData
  });
}

export async function deleteUserService(id: string) {
  return await prisma.user.delete({
    where: { id }
  });
}
