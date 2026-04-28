import crypto from 'crypto';
import type { Role } from '@prisma/client';
import prisma, { forOrg } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { normalizeEmail } from '../lib/email';

const INVITE_TTL_DAYS = 7;
const VALID_ROLES: Role[] = ['ADMIN', 'STAFF', 'PATRON'];

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

interface CreateInviteInput {
  organizationId: string;
  createdById: string;
  role: unknown;
  email?: unknown;
}

/**
 * Returns `{ token, invite }`. The raw `token` is shown ONCE; only its sha256
 * hash is persisted, so a stolen DB cannot be turned into account take-over.
 */
export async function createInvite(input: CreateInviteInput) {
  if (!isValidRole(input.role)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { role: `Must be one of: ${VALID_ROLES.join(', ')}` },
    });
  }

  let email: string | null = null;
  if (typeof input.email === 'string' && input.email.trim()) {
    const normalized = normalizeEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
        fieldErrors: { email: 'Must be a valid email address' },
      });
    }
    email = normalized;
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const db = forOrg(input.organizationId);
  const invite = await db.invite.create({
    data: {
      role: input.role,
      email,
      tokenHash,
      expiresAt,
      createdById: input.createdById,
    } as any,
  });

  return { token, invite };
}

export async function listPendingInvites(organizationId: string) {
  const db = forOrg(organizationId);
  return db.invite.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      createdById: true,
    },
  });
}

export async function revokeInvite(organizationId: string, inviteId: string) {
  // Use base prisma + explicit org filter so we get a 404 instead of accidentally
  // touching a different org's invite (deleteMany would silently 0-row).
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, organizationId },
  });
  if (!invite) {
    throw new AppError(404, 'NOT_FOUND', 'Invite not found');
  }
  await prisma.invite.delete({ where: { id: inviteId } });
}
