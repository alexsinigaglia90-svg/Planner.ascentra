'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentContext } from '@/lib/auth/context'
import { markNotificationRead, markAllRead } from '@/lib/queries/notifications'

function isValidId(s: string): boolean {
  return typeof s === 'string' && s.trim().length >= 10
}

/** Marks a single notification as read for the current user. */
export async function markNotificationReadAction(id: string): Promise<void> {
  if (!isValidId(id)) return
  const { orgId, userId } = await getCurrentContext()
  await markNotificationRead(id, orgId, userId)
  revalidatePath('/', 'layout')
}

/** Marks all notifications as read for the current user. */
export async function markAllReadAction(): Promise<void> {
  const { orgId, userId } = await getCurrentContext()
  await markAllRead(orgId, userId)
  revalidatePath('/', 'layout')
}
