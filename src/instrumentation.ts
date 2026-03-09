/**
 * Next.js instrumentation hook - runs once per server process at startup.
 * Used to bootstrap the default organization so the app works before auth
 * is wired up.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not edge or Cloudflare Workers)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapDefaultContext } = await import('@/lib/auth/bootstrap')
    try {
      await bootstrapDefaultContext()
    } catch (err) {
      // Non-fatal: if the DB isn't ready yet (e.g. missing migration),
      // log a warning rather than crashing the server.
      console.warn('[bootstrap] Could not ensure default context:', err)
    }
  }
}
