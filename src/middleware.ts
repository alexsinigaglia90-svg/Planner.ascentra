import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that are publicly accessible without a session
const PUBLIC_PREFIXES = ['/login', '/api/auth', '/invite', '/forgot-password', '/reset-password', '/agency/upload']

// Static assets and Next.js internals that should always pass through
const IGNORED_PREFIXES = ['/_next', '/favicon.ico']

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Always allow static/internal routes
  if (IGNORED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Always allow public routes
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    // If already authenticated and trying to visit /login, redirect to dashboard
    if (pathname.startsWith('/login') && request.cookies.has('planner_session')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected route: require a session cookie
  if (!request.cookies.has('planner_session')) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the intended destination for post-login redirect
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
