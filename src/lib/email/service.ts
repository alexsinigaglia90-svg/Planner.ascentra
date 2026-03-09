/**
 * Delivery service — centralized transactional email dispatch.
 *
 * Behaviour:
 *   - Always creates a DeliveryLog record first (status='pending').
 *   - If SMTP is not configured: simulation mode — logs to console, marks 'simulated'.
 *   - If SMTP is configured: sends via Nodemailer, marks 'sent' or 'failed'.
 *
 * SMTP configuration via environment variables:
 *   SMTP_HOST    e.g. smtp.office365.com
 *   SMTP_PORT    default 587
 *   SMTP_SECURE  "true" for port 465 SSL (leave unset for STARTTLS on 587)
 *   SMTP_USER    SMTP username
 *   SMTP_PASS    SMTP password
 *   MAIL_FROM    Sender address, e.g. "Planner Ascentra <no-reply@ascentra.nl>"
 *
 * Non-throwing: delivery failures are recorded but never propagate to callers.
 */

import { prisma } from '@/lib/db/client'
import { renderTemplate } from './templates'
import type { DeliverOptions } from './types'

// ── SMTP helpers ──────────────────────────────────────────────────────────────

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

// Lazy singleton transporter — created once on first use.
let _transporter: import('nodemailer').Transporter | null = null

async function getTransporter(): Promise<import('nodemailer').Transporter> {
  if (_transporter) return _transporter
  const nodemailer = await import('nodemailer')
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  })
  return _transporter
}

/**
 * Verifies the SMTP connection using transporter.verify().
 * Intended for internal diagnostics only — not exposed in routes or UI.
 */
export async function verifyMailerConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) return false
  try {
    const transporter = await getTransporter()
    await transporter.verify()
    return true
  } catch (err) {
    console.error('[email] SMTP verification failed:', err)
    return false
  }
}

/** Strip HTML tags to produce a plain-text fallback. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── deliver() ─────────────────────────────────────────────────────────────────

export async function deliver(opts: DeliverOptions): Promise<void> {
  const { subject, html } = renderTemplate(opts.type, opts.data)
  const text = htmlToText(html)
  const from = process.env.MAIL_FROM ?? 'Planner Ascentra <no-reply@planner.ascentra>'

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

  // ── 2. Simulation mode ─────────────────────────────────────────────────────
  if (!isSmtpConfigured()) {
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
    const transporter = await getTransporter()
    const result = await transporter.sendMail({
      from,
      to: opts.recipient,
      subject,
      html,
      text,
    })

    if (result.messageId) {
      console.log(`[email] Sent <${result.messageId}> → ${opts.recipient}`)
    }

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
