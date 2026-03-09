/**
 * @deprecated
 * This file is a thin compatibility shim. New code should import directly from
 * '@/lib/auth/context' and '@/lib/auth/bootstrap'.
 */

export { bootstrapDefaultContext as bootstrapDefaultOrg } from '@/lib/auth/bootstrap'

/** @deprecated Kept for backwards compatibility. */
export const DEFAULT_ORG_ID = 'org_default'
/** @deprecated Kept for backwards compatibility. */
export const DEFAULT_USER_ID = 'user_default'

/** @deprecated Use getCurrentContext() from '@/lib/auth/context' instead. */
export function getDefaultOrgId(): string {
  return 'org_default'
}

