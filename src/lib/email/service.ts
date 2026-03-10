/**
 * Delivery service — centralized transactional email dispatch.
 *
 * Architecture:
 *   - deliver() persists the job as 'queued', then fires processQueue() without
 *     awaiting it. The caller returns as soon as the record is written.
 *   - processQueue() is the sole processing entry point. It atomically claims
 *     each eligible queued item by transitioning it to 'retrying' before
 *     attempting to send. This prevents double-sends from concurrent calls.
 *   - Simulation mode (no SMTP configured): marks 'simulated' instantly — no queue.
 *   - On send success: marks 'sent'.
 *   - On send failure: increments retryCount, sets nextRetryAt, reverts to 'queued'.
 *   - After MAX_RETRIES failures: marks 'failed' permanently.
 *   - processQueue() is also exposed for cron-driven retry processing via
 *     POST /api/delivery/process (requires CRON_SECRET header).
 *
 * Status lifecycle:
 *   queued → retrying → sent
 *                     ↘ queued (retry scheduled, retryCount < MAX_RETRIES)
 *                     ↘ failed (retryCount >= MAX_RETRIES)
 *   simulated (SMTP not configured — terminal)
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
 * Sends one delivery record that has already been claimed (status='retrying').
 * Only processes items in 'retrying' state — all others are skipped.
 * On failure: increments retryCount and reverts to 'queued' with nextRetryAt,
 * or marks 'failed' after MAX_RETRIES.
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

  // Only process items we own (claimed via 'retrying' transition)
  if (!log || log.status !== 'retrying') return

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
    console.error(
      `[email] Send failed (attempt ${attempt}/${MAX_RETRIES}) for ${log.recipient}:`,
      errorMessage,
    )

    if (attempt >= MAX_RETRIES) {
      await prisma.deliveryLog
        .update({
          where: { id: logId },
          data: { status: 'failed', retryCount: attempt, errorMessage },
        })
        .catch(() => {})
    } else {
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
 * Enqueues a delivery job. Returns once the record is persisted.
 * Processing is kicked off via a non-blocking fire-and-forget processQueue() call.
 * Simulation mode (no SMTP) bypasses the queue entirely.
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

  // ── SMTP mode — write to queue, then kick off worker asynchronously ────────
  try {
    await prisma.deliveryLog.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId ?? null,
        type: opts.type,
        recipient: opts.recipient,
        subject,
        templateData: JSON.stringify(opts.data),
        status: 'queued',
      },
    })
  } catch (err) {
    console.error('[email] Failed to create delivery log:', err)
    return
  }

  // Fire-and-forget: trigger the worker without blocking the caller.
  // In serverless, this completes in the same invocation window.
  // Missed sends are recovered by the cron endpoint (/api/delivery/process).
  void processQueue().catch((err) =>
    console.error('[email] Background processQueue error:', err),
  )
}

/**
 * Worker entry point — processes all queued delivery jobs that are ready.
 *
 * Claim semantics (duplicate-send prevention):
 *   Each item is atomically transitioned from 'queued' → 'retrying' before
 *   processing. The updateMany() conditional write ensures only one concurrent
 *   caller can claim any given item. Items already in 'retrying' are skipped.
 *
 * Safe to call from a cron endpoint or after enqueue. Idempotent per job.
 * Returns the number of jobs processed in this run.
 */
export async function processQueue(): Promise<{ processed: number }> {
  let candidates: Array<{ id: string }> = []
  try {
    candidates = await prisma.deliveryLog.findMany({
      where: {
        status: 'queued',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true },
    })
  } catch (err) {
    console.error('[email] processQueue: failed to fetch candidates:', err)
    return { processed: 0 }
  }

  // Atomically claim each item — only items where we win the claim are processed.
  // Concurrent processQueue() calls will lose the claim on already-claimed items.
  const claimed: string[] = []
  for (const { id } of candidates) {
    try {
      const result = await prisma.deliveryLog.updateMany({
        where: { id, status: 'queued' },
        data: { status: 'retrying' },
      })
      if (result.count === 1) claimed.push(id)
    } catch (err) {
      console.error('[email] processQueue: failed to claim item', id, err)
    }
  }

  for (const id of claimed) {
    await attemptDelivery(id)
  }

  return { processed: claimed.length }
}
