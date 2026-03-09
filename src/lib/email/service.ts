/**
 * Delivery service — centralized transactional email dispatch.
 *
 * Behaviour:
 *   - Always creates a DeliveryLog record first (status='pending').
 *   - If SMTP_HOST env var is set: sends via SMTP, marks sent/failed.
 *   - Otherwise: simulation mode — logs to console, marks as 'simulated'.
 *
 * SMTP configuration via environment variables:
 *   SMTP_HOST   e.g. smtp.sendgrid.net
 *   SMTP_PORT   default 587
 *   SMTP_SECURE "true" for port 465 SSL
 *   SMTP_USER   SMTP username / API key username
 *   SMTP_PASS   SMTP password / API key
 *   SMTP_FROM   Sender, e.g. "Planner Ascentra <no-reply@ascentra.nl>"
 *
 * Non-throwing: delivery failures are recorded but never propagate to callers.
 */

import { prisma } from '@/lib/db/client'
import { renderTemplate } from './templates'
import type { DeliverOptions } from './types'

export async function deliver(opts: DeliverOptions): Promise<void> {
  const { subject, html } = renderTemplate(opts.type, opts.data)

  // ── 1. Create delivery log ──────────────────────────────────────────────────
  let logId: string
  try {
    const log = await prisma.deliveryLog.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId ?? null,
        type: opts.type,
        recipient: opts.recipient,
        subject,
        templateData: JSON.stringify(opts.data),
        status: 'pending',
      },
      select: { id: true },
    })
    logId = log.id
  } catch (err) {
    console.error('[email] Failed to create delivery log:', err)
    return
  }

  // ── 2. Choose send mode ────────────────────────────────────────────────────
  if (!process.env.SMTP_HOST) {
    // Simulation / dev mode
    console.log(`\n[email:simulated] ──────────────────────────────────`)
    console.log(`  To:      ${opts.recipient}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Type:    ${opts.type}`)
    if (process.env.NODE_ENV === 'development') {
      console.log(`  Data:    ${JSON.stringify(opts.data, null, 2)}`)
    }
    console.log(`────────────────────────────────────────────────────\n`)
    await prisma.deliveryLog.update({
      where: { id: logId },
      data: { status: 'simulated', sentAt: new Date() },
    })
    return
  }

  // ── 3. SMTP send ───────────────────────────────────────────────────────────
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
          : undefined,
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'Planner Ascentra <no-reply@planner.ascentra>',
      to: opts.recipient,
      subject,
      html,
    })

    await prisma.deliveryLog.update({
      where: { id: logId },
      data: { status: 'sent', sentAt: new Date() },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[email] Send failed for ${opts.recipient}:`, errorMessage)
    try {
      await prisma.deliveryLog.update({
        where: { id: logId },
        data: { status: 'failed', errorMessage },
      })
    } catch {
      // best-effort
    }
  }
}
