/**
 * POST /api/delivery/process
 *
 * Processes all queued delivery jobs that are past their retry window.
 * Intended to be called by a cron job or periodic scheduler.
 *
 * Authentication: Bearer token via CRON_SECRET env var.
 * If CRON_SECRET is not set, the endpoint is disabled.
 *
 * Example cron call:
 *   curl -X POST https://your-domain.com/api/delivery/process \
 *        -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextResponse } from 'next/server'
import { processQueue } from '@/lib/email/service'

export async function POST(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'Queue processing is not enabled.' }, { status: 403 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const { processed } = await processQueue()
    console.log(`[delivery/process] Processed ${processed} queued job(s).`)
    return NextResponse.json({ ok: true, processed })
  } catch (err) {
    console.error('[delivery/process]', err)
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 })
  }
}
