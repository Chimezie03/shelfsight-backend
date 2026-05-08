import prisma from '../lib/prisma';
import { AppError } from '../lib/errors';

const MAX_NAME_LENGTH = 80;

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'org';
}

export async function getOrgDetails(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  if (!org) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  }

  const [users, books, bookCopies, loans] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    prisma.book.count({ where: { organizationId } }),
    prisma.bookCopy.count({ where: { organizationId } }),
    prisma.loan.count({ where: { organizationId } }),
  ]);

  return { ...org, counts: { users, books, bookCopies, loans } };
}

export async function renameOrg(organizationId: string, rawName: unknown) {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      fieldErrors: { name: 'Required' },
    });
  }

  const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
  // Suffix the org id so renames never collide on the unique slug index.
  const slug = `${slugify(name)}-${organizationId.slice(0, 6)}`;

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { name, slug },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  return updated;
}

/**
 * Hard-delete an organization and every record that belongs to it. Wrapped in a
 * single transaction so a partial failure leaves no orphan rows. Order matters:
 * we delete leaf rows before the rows they reference.
 */
export async function deleteOrg(organizationId: string): Promise<void> {
  await prisma.$transaction([
    prisma.bookCopyEvent.deleteMany({ where: { bookCopy: { organizationId } } }),
    prisma.fine.deleteMany({ where: { organizationId } }),
    prisma.loan.deleteMany({ where: { organizationId } }),
    prisma.transactionLog.deleteMany({ where: { organizationId } }),
    prisma.ingestionJob.deleteMany({ where: { organizationId } }),
    prisma.bookCopy.deleteMany({ where: { organizationId } }),
    prisma.book.deleteMany({ where: { organizationId } }),
    prisma.shelfSection.deleteMany({ where: { organizationId } }),
    prisma.user.deleteMany({ where: { organizationId } }),
    prisma.invite.deleteMany({ where: { organizationId } }),
    prisma.organization.delete({ where: { id: organizationId } }),
  ]);
}
