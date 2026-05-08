import type { Request, Response } from 'express';
import { getOrgDetails, renameOrg, deleteOrg } from '../services/organizations.service';
import { AppError } from '../lib/errors';

function assertOwnOrg(req: Request, paramOrgId: string) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  }
  if (req.user.organizationId !== paramOrgId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot manage another organization');
  }
}

export async function getOrgHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);
  const organization = await getOrgDetails(orgId);
  res.json({ organization });
}

export async function renameOrgHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);
  const organization = await renameOrg(orgId, req.body?.name);
  res.json({ organization });
}

export async function deleteOrgHandler(req: Request, res: Response) {
  const orgId = req.params.id;
  assertOwnOrg(req, orgId);
  await deleteOrg(orgId);
  // Mirror the cookie options used at login/logout so the browser actually clears it.
  res.clearCookie('token', { httpOnly: true, path: '/' });
  res.status(204).send();
}
