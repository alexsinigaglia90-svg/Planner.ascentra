/**
 * Bootstrap default context — ensures the default organization, user, and
 * membership exist in the database so the app runs on first launch.
 *
 * Idempotent: safe to call multiple times on server startup.
 * Called from src/instrumentation.ts via Next.js register().
 *
 * Default login credentials (development):
 *   Email:    admin@default.local
 *   Password: admin123
 *             (override via SEED_ADMIN_PASSWORD environment variable)
 *
 * Change the admin password via the database or by adding a
 * /settings page in a future iteration.
 */

import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db/client'

const DEFAULT_ORG_ID = 'org_default'
const DEFAULT_USER_ID = 'user_default'
const DEFAULT_EMAIL = 'admin@default.local'

export async function bootstrapDefaultContext(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: 'Default Organization',
      slug: 'default',
    },
  })

  const rawPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
  const password = await hash(rawPassword, 12)

  await prisma.user.upsert({
    where: { id: DEFAULT_USER_ID },
    update: {
      // Refresh the hash on each startup so SEED_ADMIN_PASSWORD changes
      // take effect without manual DB edits.
      password,
    },
    create: {
      id: DEFAULT_USER_ID,
      name: 'Admin',
      email: DEFAULT_EMAIL,
      password,
    },
  })

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: DEFAULT_USER_ID,
        organizationId: DEFAULT_ORG_ID,
      },
    },
    update: {},
    create: {
      userId: DEFAULT_USER_ID,
      organizationId: DEFAULT_ORG_ID,
      role: 'admin',
    },
  })
}

