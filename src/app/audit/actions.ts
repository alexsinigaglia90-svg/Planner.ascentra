'use server'

import { getCurrentContext } from '@/lib/auth/context'
import { getAuditLogsByEntity } from '@/lib/queries/auditLog'
import type { AuditLog } from '@prisma/client'

export async function getAssignmentHistoryAction(assignmentId: string): Promise<AuditLog[]> {
  if (!assignmentId) return []
  const { orgId } = await getCurrentContext()
  return getAuditLogsByEntity(orgId, 'assignment', assignmentId)
}
