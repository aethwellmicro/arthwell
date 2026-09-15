import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public paths that never require a session
const PUBLIC_PATHS = ['/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasSession = request.cookies.has('cls_session')

  // Logged-in user visiting login → send to dashboard
  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Unauthenticated user visiting protected route → send to login
  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api        (API routes — auth handled per-route)
     * - _next/static (static files)
     * - _next/image (image optimisation files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - arthwell-logo.svg
     * Note: _next/data prefetches are ALWAYS passed to proxy by Next.js
     * regardless of matcher. Next.js normalises /_next/data/[id]/login.json
     * → /login before the proxy function runs, so pathname checks work correctly.
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|arthwell-logo\\.svg).*)',
  ],
}
