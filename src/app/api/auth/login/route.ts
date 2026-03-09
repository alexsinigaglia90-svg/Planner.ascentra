import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/db/client'
import { sessionOptions, type SessionData } from '@/lib/auth/session'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { email?: unknown; password?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    })

    // Constant-time path: always run compare to avoid timing attacks
    const hash = user?.password ?? '$2b$12$invalidhashfortimingnoop000000'
    const valid = await compare(password, hash)

    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    // Resolve which organization this user belongs to (first membership)
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Your account is not associated with any organization.' },
        { status: 403 },
      )
    }

    const res = NextResponse.json({ ok: true })
    const session = await getIronSession<SessionData>(req, res, sessionOptions)
    session.userId = user.id
    session.orgId = membership.organizationId
    await session.save()

    return res
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
