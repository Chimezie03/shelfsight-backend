import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

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
  if (!data.email || !data.password || !data.name || !data.role) {
    throw new Error('Missing required fields: email, password, name, role');
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
