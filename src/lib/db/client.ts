import { PrismaClient } from '@prisma/client'
import type { CloudflareEnv } from '@/types/cloudflare'

// ---------------------------------------------------------------------------
// Development — Node.js / local SQLite singleton
// ---------------------------------------------------------------------------

declare global {
  // Prevent multiple instances during hot-reload in development
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalThis.__prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// ---------------------------------------------------------------------------
// Production — Cloudflare D1
//
// Use this helper inside Server Actions or Route Handlers.
// The `env` object is provided by the Workers runtime via getRequestContext().
//
//   import { getRequestContext } from '@cloudflare/next-on-pages'
//   import { getDb } from '@/lib/db/client'
//
//   const { env } = getRequestContext()
//   const db = getDb(env)
//   const employees = await db.employee.findMany()
// ---------------------------------------------------------------------------

export function getDb(env: CloudflareEnv): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaD1 } = require('@prisma/adapter-d1') as typeof import('@prisma/adapter-d1')
  const adapter = new PrismaD1(env.DB)
  return new PrismaClient({ adapter })
}
