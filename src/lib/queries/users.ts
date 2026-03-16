/**
 * User management queries — org-scoped, admin-only data access.
 *
 * All functions are scoped to a single organizationId.
 * Callers (server actions, page loaders) are responsible for role-gating.
 */

import { prisma } from '@/lib/db/client'

// ─── Public types ─────────────────────────────────────────────────────────────

export type UserStatus = 'active' | 'invited' | 'disabled'
export type OrgRole = 'admin' | 'manager' | 'planner' | 'viewer'

export interface OrgMember {
  userId: string
  name: string
  email: string
  status: UserStatus
  role: OrgRole
  createdAt: Date
  membershipCreatedAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUserStatus(raw: string | null | undefined): UserStatus {
  if (raw === 'invited' || raw === 'disabled') return raw
  return 'active'
}

function toOrgRole(raw: string | null | undefined): OrgRole {
  if (raw === 'admin' || raw === 'planner') return raw
  return 'viewer'
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Returns all members of an organization, joined with User data. */
export async function getOrgMembers(organizationId: string): Promise<OrgMember[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    status: toUserStatus(m.user.status),
    role: toOrgRole(m.role),
    createdAt: m.user.createdAt,
    membershipCreatedAt: m.createdAt,
  }))
}

/** Returns a single org member by userId (null when not found / not a member). */
export async function getOrgMember(
  organizationId: string,
  userId: string,
): Promise<OrgMember | null> {
  const m = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (!m) return null

  return {
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    status: toUserStatus(m.user.status),
    role: toOrgRole(m.role),
    createdAt: m.user.createdAt,
    membershipCreatedAt: m.createdAt,
  }
}

/**
 * Creates a new user and adds them as a member of the organization.
 *
 * If an existing user with the email already exists and is NOT already a member
 * of this organization, they are added as a member with the given role.
 *
 * Returns { ok: true, userId } on success or { ok: false, error } on conflict.
 */
export async function createOrgMember({
  organizationId,
  name,
  email,
  role,
  status,
  passwordHash,
}: {
  organizationId: string
  name: string
  email: string
  role: OrgRole
  status: UserStatus
  passwordHash?: string
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  // Check if user with this email already exists
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  let userId: string

  if (existing) {
    // User exists — check if already a member
    const alreadyMember = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: existing.id, organizationId } },
      select: { id: true },
    })
    if (alreadyMember) {
      return { ok: false, error: 'A user with this email is already a member of this organization.' }
    }
    userId = existing.id
    // Add membership for the existing user
    await prisma.organizationMembership.create({
      data: { userId, organizationId, role },
    })
    return { ok: true, userId }
  }

  // Create new user + membership atomically
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        status,
        ...(passwordHash ? { password: passwordHash } : {}),
        memberships: {
          create: { organizationId, role },
        },
      },
      select: { id: true },
    })
    return { ok: true, userId: user.id }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2002') {
      return { ok: false, error: 'A user with this email already exists.' }
    }
    throw err
  }
}

/** Updates a member's role within the organization. */
export async function updateMemberRole({
  organizationId,
  userId,
  role,
}: {
  organizationId: string
  userId: string
  role: OrgRole
}): Promise<{ ok: boolean; error?: string }> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  })
  if (!membership) return { ok: false, error: 'Membership not found.' }

  await prisma.organizationMembership.update({
    where: { id: membership.id },
    data: { role },
  })
  return { ok: true }
}

/** Updates a user's account status. */
export async function updateUserStatus({
  userId,
  status,
}: {
  userId: string
  status: UserStatus
}): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { status },
  })
}

/** Removes a user's membership from the organization (does not delete the User record). */
export async function removeOrgMember({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  })
  if (!membership) return { ok: false, error: 'Membership not found.' }

  await prisma.organizationMembership.delete({ where: { id: membership.id } })
  return { ok: true }
}
