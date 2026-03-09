// Typed bindings for Cloudflare Workers environment.
// Extend this interface as new bindings are added in wrangler.jsonc.

export interface CloudflareEnv {
  // D1 database — bound as "DB" in wrangler.jsonc
  DB: D1Database
}
