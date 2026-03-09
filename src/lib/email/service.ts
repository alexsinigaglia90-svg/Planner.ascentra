/**
 * Delivery service — centralized transactional email dispatch.
 *
 * Architecture:
 *   - deliver() persists the job as 'queued', then immediately attempts sending.
 *   - Simulation mode (no SMTP configured): marks 'simulated' instantly — no queue.
 *   - On send success: marks 'sent'.
 *   - On send failure: increments retryCount, sets nextRetryAt, keeps 'queued'.
 *   - After MAX_RETRIES failures: marks 'failed' permanently.
 *   - processQueue() picks up all queued items past their nextRetryAt window.
 *     Call from a cron endpoint (/api/delivery/process) to drive retries.
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
import type { DeliverOptions, DeliveryType, TemplateData } from './types'

const MAX_RETRIES = 3
// Backoff window in minutes after each failure: 5 min, 30 min, 2 h
const RETRY_BACKOFF_MINUTES = [5, 30, 120]

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
    port: Number(process.env.SMTP_PORT ?? '587'),
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

// ── Core send attempt ─────────────────────────────────────────────────────────

/**
 * Attempts to send one queued delivery and updates the log record.
 * On failure: increments retryCount and schedules nextRetryAt.
 * After MAX_RETRIES: marks 'failed' permanently.
 */
async function attemptDelivery(logId: string): Promise<void> {
  let log: {
    type: string
    recipient: string
    subject: string
    templateData: string
    retryCount: number
    status: string
  } | null = null

  try {
    log = await prisma.deliveryLog.findUnique({
      where: { id: logId },
      select: {
        type: true,
        recipient: true,
        subject: true,
        templateData: true,
        retryCount: true,
        status: true,
      },
    })
  } catch (err) {
    console.error('[email] Failed to fetch delivery log for attempt:', err)
    return
  }

  if (!log || log.status === 'sent' || log.status === 'simulated') return

  const from = process.env.MAIL_FROM ?? 'Planner Ascentra <no-reply@planner.ascentra>'
  let html: string
  let text: string

  try {
    const data = JSON.parse(log.templateData) as TemplateData
    const rendered = renderTemplate(log.type as DeliveryType, data)
    html = rendered.html
    text = htmlToText(rendered.html)
  } catch (err) {
    console.error('[email] Template render failed for log', logId, err)
    await prisma.deliveryLog
      .update({
        where: { id: logId },
        data: { status: 'failed', errorMessage: 'Template render failed — cannot retry.' },
      })
      .catch(() => {})
    return
  }

  try {
    const transporter = await getTransporter()
    const result = await transporter.sendMail({
      from,
      to: log.recipient,
      subject: log.subject,
      html,
      text,
    })

    if (result.messageId) {
      console.log(`[email] Sent <${result.messageId}> → ${log.recipient}`)
    }

    await prisma.deliveryLog.update({
      where: { id: logId },
      data: { status: 'sent', sentAt: new Date(), errorMessage: null },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const attempt = log.retryCount + 1
    console.error(`[email] Send failed (attempt ${attempt}/${MAX_RETRIES}) for ${log.recipient}:`, errorMessage)

    if (attempt >= MAX_RETRIES) {
      // Permanent failure — exhausted all retries
      await prisma.deliveryLog
        .update({
          where: { id: logId },
          data: { status: 'failed', retryCount: attempt, errorMessage },
        })
        .catch(() => {})
    } else {
      // Schedule retry with exponential-ish backoff
      const backoffMs = (RETRY_BACKOFF_MINUTES[attempt - 1] ?? 60) * 60 * 1000
      const nextRetryAt = new Date(Date.now() + backoffMs)
      await prisma.deliveryLog
        .update({
          where: { id: logId },
          data: { status: 'queued', retryCount: attempt, nextRetryAt, errorMessage },
        })
        .catch(() => {})
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Enqueues a delivery job and immediately attempts sending.
 * Simulation mode bypasses the queue and marks instantly as 'simulated'.
 */
export async function deliver(opts: DeliverOptions): Promise<void> {
  const { subject } = renderTemplate(opts.type, opts.data)

  // ── Simulation mode — instant, no queue/retry ─────────────────────────────
  if (!isSmtpConfigured()) {
    console.log(`\n[email:simulated] ──────────────────────────────────`)
    console.log(`  To:      ${opts.recipient}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Type:    ${opts.type}`)
    if (process.env.NODE_ENV === 'development') {
      console.log(`  Data:    ${JSON.stringify(opts.data, null, 2)}`)
    }
    console.log(`────────────────────────────────────────────────────\n`)
    try {
      await prisma.deliveryLog.create({
        data: {
          organizationId: opts.organizationId,
          userId: opts.userId ?? null,
          type: opts.type,
          recipient: opts.recipient,
          subject,
          templateData: JSON.stringify(opts.data),
          status: 'simulated',
          sentAt: new Date(),
        },
      })
    } catch (err) {
      console.error('[email] Failed to create simulated delivery log:', err)
    }
    return
  }

  // ── SMTP mode — enqueue, then attempt immediately ─────────────────────────
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
        status: 'queued',
      },
      select: { id: true },
    })
    logId = log.id
  } catch (err) {
    console.error('[email] Failed to create delivery log:', err)
    return
  }

  await attemptDelivery(logId)
}

/**
 * Processes all queued delivery jobs that are ready to retry.
 * Safe to call from a cron endpoint — idempotent per job.
 * Returns the number of jobs processed in this run.
 */
export async function processQueue(): Promise<{ processed: number }> {
  let items: Array<{ id: string }> = []
  try {
    items = await prisma.deliveryLog.findMany({
      where: {
        status: 'queued',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true },
    })
  } catch (err) {
    console.error('[email] processQueue: failed to fetch items:', err)
    return { processed: 0 }
  }

  for (const item of items) {
    await attemptDelivery(item.id)
  }

  return { processed: items.length }
}
