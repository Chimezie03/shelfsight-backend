import type { Request, Response } from 'express';
import {
  createInvite,
  listPendingInvites,
  revokeInvite,
} from '../services/invites.service';
import { AppError } from '../lib/errors';

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

function assertOwnOrg(req: Request, paramOrgId: string) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  if (req.user.organizationId !== paramOrgId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot manage invites for another organization');
  }
}

export async function createInviteHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);

  const { role, email } = req.body ?? {};
  const { token, invite } = await createInvite({
    organizationId: orgId,
    createdById: req.user!.userId,
    role,
    email,
  });

  res.status(201).json({
    invite: {
      id: invite.id,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    },
    token,
    url: `${WEB_BASE_URL}/invite/${token}`,
  });
}

export async function listInvitesHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);
  const invites = await listPendingInvites(orgId);
  res.json({ invites });
}

export async function revokeInviteHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);
  await revokeInvite(orgId, req.params.inviteId);
  res.status(204).send();
}
