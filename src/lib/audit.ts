import { prisma } from '@/lib/db/client'

// ---------------------------------------------------------------------------
// Action type catalogue — kept in sync with planning/actions.ts
// ---------------------------------------------------------------------------

export type AuditActionType =
  | 'create_assignment'
  | 'update_assignment'
  | 'delete_assignment'
  | 'move_assignment'
  | 'copy_assignment'
  | 'copy_day'
  | 'copy_week'
  | 'copy_employee_week'
  | 'copy_employee_schedule'
  | 'repeat_pattern'
  | 'autofill'
  | 'plan-wizard'
  | 'update_requirement'
  // User management
  | 'invite_user'
  | 'update_member_role'
  | 'update_user_status'
  | 'remove_member'
  | 'generate_invite_link'
  // Password reset
  | 'generate_reset_link'
  | 'reset_password'

export type AuditEntityType = 'assignment' | 'requirement' | 'bulk' | 'user'

export interface LogActionParams {
  organizationId: string
  userId: string
  actionType: AuditActionType
  entityType: AuditEntityType
  entityId: string
  summary: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}

/**
 * Write an immutable audit log entry.
 * Non-throwing — audit failure never blocks the main mutation.
 */
export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        summary: params.summary,
        beforeData:
          params.beforeData != null ? JSON.stringify(params.beforeData) : null,
        afterData:
          params.afterData != null ? JSON.stringify(params.afterData) : null,
      },
    })
  } catch (err) {
    // Audit failure must never block the primary operation
    console.error('[audit] logAction failed:', err)
  }
}
