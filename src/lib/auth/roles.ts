/**
 * Role types and capability checks — client-safe (no server imports).
 *
 * This file can be imported by both client and server components.
 * The actual session/context resolution lives in context.ts (server-only).
 */

// ── Roles (hierarchical: admin > manager > planner > viewer) ────────────────

/** Application roles — values stored in OrganizationMembership.role. */
export type AppRole = 'admin' | 'manager' | 'planner' | 'viewer'

/** Role hierarchy — higher index = more permissions. */
const ROLE_HIERARCHY: AppRole[] = ['viewer', 'planner', 'manager', 'admin']

function roleLevel(role: AppRole): number {
  return ROLE_HIERARCHY.indexOf(role)
}

/** True when `role` is at least as powerful as `minRole`. */
export function hasRole(role: AppRole, minRole: AppRole): boolean {
  return roleLevel(role) >= roleLevel(minRole)
}

// ── Capability checks ───────────────────────────────────────────────────────

/** Can create, edit, delete planner data. Roles: planner, manager, admin */
export function canMutate(role: AppRole): boolean {
  return hasRole(role, 'planner')
}

/** Can approve/reject leave, temp requests. Roles: manager, admin */
export function canApprove(role: AppRole): boolean {
  return hasRole(role, 'manager')
}

/** Can view OPEX costs, financial data. Roles: manager, admin */
export function canViewCosts(role: AppRole): boolean {
  return hasRole(role, 'manager')
}

/** Can manage org setup: departments, functions, processes, teams. Admin only */
export function canManageOrg(role: AppRole): boolean {
  return role === 'admin'
}

/** Can manage users: invite, change roles, deactivate. Admin only */
export function canManageUsers(role: AppRole): boolean {
  return role === 'admin'
}

// ── Role metadata for UI ────────────────────────────────────────────────────

export interface RoleMeta {
  role: AppRole
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  capabilities: string[]
}

export const ROLE_METADATA: RoleMeta[] = [
  {
    role: 'admin',
    label: 'Administrator',
    description: 'Volledige toegang tot alle functies en instellingen.',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    capabilities: [
      'Organisatie-instellingen beheren',
      'Gebruikers uitnodigen en rollen toewijzen',
      'Afdelingen, functies, processen beheren',
      'Temp aanvragen en verlof goedkeuren',
      'OPEX en kosten inzien',
      'Planning bewerken',
      'Alle data bekijken',
    ],
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Goedkeuringen, kosteninzicht en volledige planning.',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    capabilities: [
      'Temp aanvragen en verlof goedkeuren',
      'OPEX en kosten inzien',
      'Planning bewerken',
      'Skill reviews uitvoeren',
      'Alle data bekijken',
    ],
  },
  {
    role: 'planner',
    label: 'Planner',
    description: 'Planning bewerken, shifts toewijzen, reviews uitvoeren.',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    capabilities: [
      'Planning bewerken',
      'Shifts toewijzen en wijzigen',
      'Skill reviews uitvoeren',
      'Verlof/verzuim registreren',
      'Alle data bekijken',
    ],
  },
  {
    role: 'viewer',
    label: 'Viewer',
    description: 'Alleen-lezen toegang tot planning en data.',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    capabilities: [
      'Planning bekijken',
      'Roosters en bezetting inzien',
    ],
  },
]
