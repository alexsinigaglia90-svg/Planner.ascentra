import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/auth/session'

export async function POST(req: Request): Promise<Response> {
  const res = NextResponse.json({ ok: true })
  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  session.destroy()
  return res
}
