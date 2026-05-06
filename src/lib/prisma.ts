import { PrismaClient } from '@prisma/client';

const base = new PrismaClient();

const SCOPED_MODELS = new Set([
  'User',
  'Book',
  'BookCopy',
  'Loan',
  'Fine',
  'TransactionLog',
  'ShelfSection',
  'IngestionJob',
  'Invite',
]);

const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const UNIQUE_LOOKUP_OPS = new Set(['findUnique', 'findUniqueOrThrow']);
const WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'upsert']);

/**
 * Returns a Prisma client scoped to a single organization. Every read auto-injects
 * `where.organizationId`, every create auto-injects `data.organizationId`, and
 * `findUnique` lookups are widened with the organization filter so cross-org rows
 * with the same primary key (impossible today, but defensive) cannot leak.
 *
 * Use the scoped client in any code path that runs on behalf of an authenticated
 * user. Use the default `prisma` export for unscoped operations: signup, login
 * lookup, seed, and admin scripts.
 */
export function forOrg(organizationId: string) {
  return base.$extends({
    name: 'orgScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (CREATE_OPS.has(operation)) {
            const a = args as { data?: any; create?: any; update?: any; where?: any };
            if (operation === 'upsert') {
              if (a.create) a.create = { ...a.create, organizationId };
              if (a.where) a.where = { ...a.where, organizationId };
            } else if (a.data) {
              a.data = { ...a.data, organizationId };
            }
          } else if (operation === 'createMany') {
            const a = args as { data?: any };
            if (Array.isArray(a.data)) {
              a.data = a.data.map((d: any) => ({ ...d, organizationId }));
            } else if (a.data) {
              a.data = { ...a.data, organizationId };
            }
          } else if (
            READ_OPS.has(operation) ||
            WRITE_OPS.has(operation) ||
            UNIQUE_LOOKUP_OPS.has(operation)
          ) {
            const a = args as { where?: any };
            a.where = { ...(a.where ?? {}), organizationId };
          }

          return query(args);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof forOrg>;

export default base;
