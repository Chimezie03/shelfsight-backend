import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { normalizeEmail } from '../lib/email';
import { AppError } from '../lib/errors';
import { sendPasswordResetEmail } from '../lib/resend-mail';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
  organizationId: string;
  organizationName: string;
}

function buildPayload(user: {
  id: string;
  email: string;
  role: Role;
  name: string;
  organizationId: string;
  organization: { name: string };
}): AuthPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}

function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthPayload }> {
  const normalizedEmail = normalizeEmail(email);
  // Multi-org email collisions are blocked at signup (slug-scoped on
  // future work); for single-org-per-user this findFirst is unambiguous.
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    include: { organization: { select: { name: true } } },
  });

  if (!user) {
    throw new AppError(401, 'AUTHENTICATION_ERROR', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'AUTHENTICATION_ERROR', 'Invalid email or password');
  }

  const payload = buildPayload(user);
  return { token: signToken(payload), user: payload };
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    throw new AppError(401, 'AUTHENTICATION_ERROR', 'Invalid or expired token');
  }
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `org-${Date.now()}`;
}

async function uniqueSlug(name: string): Promise<string> {
  const candidate = slugify(name);
  const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
  if (!existing) return candidate;
  return `${candidate}-${Date.now().toString(36)}`;
}

interface SignupInput {
  orgName: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Creates a new Organization plus its first ADMIN user atomically. Used by the
 * self-serve `/signup` flow.
 */
export async function signupOrganization(input: SignupInput): Promise<{
  token: string;
  user: AuthPayload;
}> {
  const fieldErrors: Record<string, string> = {};
  if (!input.orgName?.trim()) fieldErrors.orgName = 'Required';
  if (!input.name?.trim()) fieldErrors.name = 'Required';
  if (!input.email?.trim()) fieldErrors.email = 'Required';
  if (!input.password) fieldErrors.password = 'Required';

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  const email = normalizeEmail(input.email);
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { email: 'Must be a valid email address' },
    });
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
    });
  }

  // While single-org-per-user is in effect, refuse the signup if the email is
  // already in use anywhere — login by email would be ambiguous otherwise.
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_ENTRY', 'A user with this email already exists', {
      fieldErrors: { email: 'Email already in use' },
    });
  }

  const slug = await uniqueSlug(input.orgName);
  const passwordHash = await bcrypt.hash(input.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: input.orgName.trim(), slug },
    });
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim(),
        role: 'ADMIN',
        organizationId: org.id,
      },
      include: { organization: { select: { name: true } } },
    });
    return user;
  });

  const payload = buildPayload(result);
  return { token: signToken(payload), user: payload };
}

interface AcceptInviteInput {
  token: string;
  name: string;
  password: string;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function acceptInvite(input: AcceptInviteInput): Promise<{
  token: string;
  user: AuthPayload;
}> {
  const fieldErrors: Record<string, string> = {};
  if (!input.token?.trim()) fieldErrors.token = 'Required';
  if (!input.name?.trim()) fieldErrors.name = 'Required';
  if (!input.password) fieldErrors.password = 'Required';

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
    });
  }

  const tokenHash = hashToken(input.token.trim());
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new AppError(404, 'INVITE_INVALID', 'Invite is invalid or has expired');
  }

  // If invite was pre-filled with an email, use that; otherwise the inviter
  // didn't bind a specific email and we generate one from a UUID-style local-part.
  const inferredEmail = invite.email
    ? normalizeEmail(invite.email)
    : `${crypto.randomUUID()}@invite.local`;

  // Conflict check within the org (composite unique). Cross-org duplicates are
  // allowed by the schema but blocked at signup; here we let invites through
  // since the inviter explicitly chose the email.
  if (invite.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: inferredEmail, organizationId: invite.organizationId },
    });
    if (conflict) {
      throw new AppError(409, 'DUPLICATE_ENTRY', 'A user with this email already exists in the organization');
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: inferredEmail,
        passwordHash,
        name: input.name.trim(),
        role: invite.role,
        organizationId: invite.organizationId,
      },
      include: { organization: { select: { name: true } } },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedUserId: created.id },
    });
    return created;
  });

  const payload = buildPayload(user);
  return { token: signToken(payload), user: payload };
}

/**
 * Lightweight preview for the public invite-acceptance page. Reveals only
 * non-sensitive fields the recipient needs to confirm they're joining the
 * right org.
 */
export async function getInvitePreview(rawToken: string): Promise<{
  organizationName: string;
  role: Role;
  email: string | null;
  expiresAt: Date;
}> {
  const tokenHash = hashToken(rawToken);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: { organization: { select: { name: true } } },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new AppError(404, 'INVITE_INVALID', 'Invite is invalid or has expired');
  }

  return {
    organizationName: invite.organization.name,
    role: invite.role,
    email: invite.email,
    expiresAt: invite.expiresAt,
  };
}

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function webAppOrigin(): string {
  const raw = process.env.WEB_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/**
 * Always completes without throwing for unknown emails (anti-enumeration).
 * Logs or emails a one-time reset link when the user exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const trimmed = email?.trim() ?? '';
  if (!trimmed || !EMAIL_PATTERN.test(normalizeEmail(trimmed))) {
    return;
  }

  const normalizedEmail = normalizeEmail(trimmed);
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    return;
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetLink = `${webAppOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const mail = await sendPasswordResetEmail({ to: user.email, resetLink });
  if (mail.ok) {
    console.info(`[password-reset] email sent via Resend to ${user.email}`);
  } else {
    console.warn(
      `[password-reset] email not sent (${mail.errorMessage ?? 'unknown'}); link for ${user.email}: ${resetLink}`,
    );
  }
}

export async function resetPasswordWithToken(rawToken: string, newPassword: string): Promise<void> {
  const fieldErrors: Record<string, string> = {};
  if (!rawToken?.trim()) fieldErrors.token = 'Required';
  if (!newPassword) fieldErrors.password = 'Required';

  if (Object.keys(fieldErrors).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', { fieldErrors });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { password: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
    });
  }

  const tokenHash = hashToken(rawToken.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(400, 'RESET_TOKEN_INVALID', 'Reset link is invalid or has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
